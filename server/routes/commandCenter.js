// server/routes/commandCenter.js
// The screen you leave open on a monitor. Mounted under /api/admin/command.
//
// Deliberately aggregate-only. It answers "how is the platform" without
// exposing who is doing what: counts of people online, not a list of them; a
// count of messages sent, never their contents. Admin visibility is not
// surveillance, and a dashboard is the easiest place to lose that distinction.

const express = require('express');
const db = require('../db');
const { requirePermission } = require('../middleware/adminAuth');

const router = express.Router();

const since = (mins) => `datetime('now','-${mins} minutes')`;

router.get('/', requirePermission('analytics.read'), async (req, res) => {
  try {
    const one = async (sql, args = []) => (await db.get(sql, args))?.c ?? 0;

    const [
      users, newToday, postsToday, storiesToday, commentsToday,
      posts10, messages10, activeToday, places, events, groups,
    ] = await Promise.all([
      one('SELECT COUNT(*) AS c FROM users'),
      one(`SELECT COUNT(*) AS c FROM users WHERE created_at > ${since(1440)}`),
      one(`SELECT COUNT(*) AS c FROM posts WHERE created_at > ${since(1440)}`),
      one(`SELECT COUNT(*) AS c FROM stories WHERE created_at > ${since(1440)}`),
      one(`SELECT COUNT(*) AS c FROM comments WHERE created_at > ${since(1440)}`),
      one(`SELECT COUNT(*) AS c FROM posts WHERE created_at > ${since(10)}`),
      one(`SELECT COUNT(*) AS c FROM messages WHERE created_at > ${since(10)}`),
      // "Active" is last_active_date, which the streak engine already maintains.
      one(`SELECT COUNT(*) AS c FROM users WHERE last_active_date = date('now')`),
      one('SELECT COUNT(*) AS c FROM places'),
      one(`SELECT COUNT(*) AS c FROM events WHERE created_at > ${since(1440)}`),
      one('SELECT COUNT(*) AS c FROM drink_groups'),
    ]);

    const openReports = await one("SELECT COUNT(*) AS c FROM reports WHERE status = 'pending'");
    const csae = await one(
      "SELECT COUNT(*) AS c FROM reports WHERE status = 'pending' AND reason LIKE 'csae%'"
    );
    const unassigned = await one(
      "SELECT COUNT(*) AS c FROM reports WHERE status = 'pending' AND assigned_to IS NULL"
    );

    // Signup trend, 14 days.
    const signups = await db.all(
      `SELECT date(created_at) AS day, COUNT(*) AS c
         FROM users WHERE created_at > datetime('now','-14 days')
     GROUP BY day ORDER BY day`
    );

    // Geography, aggregated. Country only — never a per-user location.
    const countries = await db.all(
      `SELECT country_code AS country, COUNT(*) AS c
         FROM users WHERE country_code IS NOT NULL AND country_code != ''
     GROUP BY country_code ORDER BY c DESC LIMIT 12`
    );

    res.json({
      live: { posts_10m: posts10, messages_10m: messages10, active_today: activeToday },
      today: {
        new_users: newToday, posts: postsToday, stories: storiesToday,
        comments: commentsToday, events: events,
      },
      totals: { users, places, groups },
      safety: { open_reports: openReports, csae_open: csae, unassigned },
      signups,
      countries,
      generated_at: Date.now(),
    });
  } catch (e) {
    console.error('[command] stats', e.message);
    res.status(500).json({ error: 'Could not load the command centre.' });
  }
});

// Audit log viewer — who did what, when, and why.
router.get('/audit', requirePermission('audit.read'), async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10)));
    const rows = await db.all(
      `SELECT a.*, u.name AS actor_name, u.email AS actor_email
         FROM admin_audit a LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC LIMIT ?`,
      [limit]
    );
    res.json(rows.map((r) => {
      let detail = null;
      try { detail = r.detail ? JSON.parse(r.detail) : null; } catch {}
      return { ...r, detail };
    }));
  } catch (e) {
    console.error('[command] audit', e.message);
    res.status(500).json({ error: 'Could not load the audit log.' });
  }
});

// System health, for the status strip.
router.get('/health', requirePermission('health.read'), async (req, res) => {
  const out = { db: 'unknown', r2: 'unknown', checked_at: Date.now() };
  try {
    await db.get('SELECT 1 AS ok');
    out.db = 'ok';
  } catch (e) {
    out.db = 'error';
    out.db_error = e.message?.slice(0, 200);
  }
  try {
    const storage = require('../lib/storage');
    out.r2 = storage.isDurable ? 'ok' : 'local-disk';
  } catch { out.r2 = 'unknown'; }
  res.json(out);
});

module.exports = router;
