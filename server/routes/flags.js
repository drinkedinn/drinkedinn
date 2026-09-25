// server/routes/flags.js
// Feature flags and remote config.
//
// The point of this file is the kill switch. If a feature breaks in production,
// turning it off must be one write that takes effect on the next evaluation —
// not an App Store release, which is days.
//
// Two mounts:
//   GET  /api/flags          — any signed-in client, evaluated for that user
//   /api/admin/flags         — the admin CRUD (flags.write is high-impact, so
//                              every change carries a typed reason)

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/adminAuth');

const router = express.Router();       // public (authed) evaluation
const adminRouter = express.Router();  // admin CRUD

/**
 * Deterministic 0-99 bucket for a user/flag pair.
 *
 * Hashing the pair (rather than the user alone) means a user in the first 10%
 * of one flag is not automatically in the first 10% of every flag — otherwise
 * the same unlucky cohort receives every experiment. Deterministic so a user
 * does not flip in and out between requests.
 */
function bucketOf(flagKey, userId) {
  const h = crypto.createHash('sha1').update(`${flagKey}:${userId}`).digest();
  return h.readUInt32BE(0) % 100;
}

function evaluate(flag, user) {
  // Kill switch wins over everything, including explicit targeting. A flag that
  // is off is off.
  if (!flag.enabled) return false;

  let targeting = {};
  try { targeting = JSON.parse(flag.targeting || '{}'); } catch {}

  if (Array.isArray(targeting.user_ids) && targeting.user_ids.length) {
    if (targeting.user_ids.includes(user.id)) return true;
  }
  if (Array.isArray(targeting.countries) && targeting.countries.length) {
    if (!targeting.countries.includes(String(user.country_code || '').toUpperCase())) return false;
  }
  if (targeting.staff_only) return !!user.is_admin;

  const pct = Math.max(0, Math.min(100, flag.rollout_pct || 0));
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  return bucketOf(flag.key, user.id) < pct;
}

// ── Client evaluation ───────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM feature_flags');
    const user = await db.get(
      'SELECT id, is_admin, country_code FROM users WHERE id = ?', [req.user.id]
    );
    const out = {};
    for (const f of rows) out[f.key] = evaluate(f, user || { id: req.user.id });
    res.json(out);
  } catch (e) {
    console.error('[flags] evaluate', e.message);
    // Never fail the app because flags are unavailable — an empty set means
    // every feature falls back to its built-in default.
    res.json({});
  }
});

// ── Admin ───────────────────────────────────────────────────────────────────
adminRouter.get('/', requirePermission('flags.read'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT f.*, u.name AS updated_by_name
         FROM feature_flags f LEFT JOIN users u ON u.id = f.updated_by
     ORDER BY f.key`
    );
    res.json(rows);
  } catch (e) {
    console.error('[flags] list', e.message);
    res.status(500).json({ error: 'Could not load flags.' });
  }
});

adminRouter.put('/:key', requirePermission('flags.write'), async (req, res) => {
  try {
    const key = String(req.params.key).trim().slice(0, 60);
    if (!/^[a-z0-9_.-]+$/i.test(key)) return res.status(400).json({ error: 'Bad flag key.' });
    const enabled = req.body.enabled ? 1 : 0;
    const pct = Math.max(0, Math.min(100, parseInt(req.body.rollout_pct ?? 0, 10) || 0));
    let targeting = '{}';
    if (req.body.targeting && typeof req.body.targeting === 'object') {
      targeting = JSON.stringify(req.body.targeting).slice(0, 2000);
    }
    await db.run(
      `INSERT INTO feature_flags (key, enabled, rollout_pct, targeting, description, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled,
                                      rollout_pct = excluded.rollout_pct,
                                      targeting = excluded.targeting,
                                      description = excluded.description,
                                      updated_by = excluded.updated_by,
                                      updated_at = excluded.updated_at`,
      [key, enabled, pct, targeting, String(req.body.description || '').slice(0, 200),
       req.user.id, Date.now()]
    );
    res.json({ ok: true, key, enabled: !!enabled, rollout_pct: pct });
  } catch (e) {
    console.error('[flags] write', e.message);
    res.status(500).json({ error: 'Could not save that flag.' });
  }
});

// The kill switch, as its own verb. One call, no payload to get wrong.
adminRouter.post('/:key/kill', requirePermission('flags.write'), async (req, res) => {
  try {
    await db.run(
      'UPDATE feature_flags SET enabled = 0, rollout_pct = 0, updated_by = ?, updated_at = ? WHERE key = ?',
      [req.user.id, Date.now(), req.params.key]
    );
    res.json({ ok: true, key: req.params.key, enabled: false });
  } catch (e) {
    console.error('[flags] kill', e.message);
    res.status(500).json({ error: 'Could not kill that flag.' });
  }
});

module.exports = router;
module.exports.adminRouter = adminRouter;
module.exports.evaluate = evaluate;
module.exports.bucketOf = bucketOf;
