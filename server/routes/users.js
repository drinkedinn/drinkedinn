const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');
const { notify } = require('../lib/notify');
const { deleteUserCompletely } = require('../lib/deleteUser');

const router = express.Router();

// Permanently erase the signed-in account and everything attached to it.
// Required by the App Store and Play Store for any app that allows sign-up,
// and by GDPR/CCPA. Re-authenticates first — this is irreversible.
router.delete('/me', auth, async (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'Enter your password to confirm deletion.' });
  }

  try {
    const user = await db.get('SELECT id, password, is_admin FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    const valid = await require('../lib/password').verify(password, user.password);
    if (!valid) return res.status(401).json({ error: 'That password is incorrect.' });

    // Guard against the platform locking itself out of its own admin panel.
    if (user.is_admin === 1) {
      const admins = await db.get('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1');
      if ((admins?.c || 0) <= 1) {
        return res.status(409).json({
          error: 'This is the only admin account. Promote another admin before deleting it.',
        });
      }
    }

    await deleteUserCompletely(user.id);
    res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error('[users] delete failed:', err.message);
    res.status(500).json({ error: 'Could not delete the account. Contact support.' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await db.get('SELECT id, name, email, title, avatar, bio, drinks, onboarded, is_admin, verified, premium, badge, current_streak, longest_streak, created_at FROM users WHERE id = ?', [req.user.id]);
    const connRow = await db.get('SELECT COUNT(*) as count FROM connections WHERE user_id = ?', [req.user.id]);
    const postRow = await db.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [req.user.id]);
    const connections = connRow?.count || 0;
    const postCount = postRow?.count || 0;
    res.json({ ...user, connections, postCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.put('/me', auth, async (req, res) => {
  const { name, title, bio, avatar, drinks, onboarded } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const drinksJson = typeof drinks === 'object' ? JSON.stringify(drinks) : (drinks || '{}');
  try {
    await db.run(
      'UPDATE users SET name = ?, title = ?, bio = ?, avatar = ?, drinks = ?, onboarded = ? WHERE id = ?',
      [name.trim(), title || '', bio || '', avatar || '', drinksJson, onboarded ? 1 : 0, req.user.id]
    );
    const user = await db.get('SELECT id, name, email, title, avatar, bio, drinks, onboarded, is_admin, verified, premium, badge, current_streak, longest_streak, created_at FROM users WHERE id = ?', [req.user.id]);
    const connRow = await db.get('SELECT COUNT(*) as count FROM connections WHERE user_id = ?', [req.user.id]);
    const postRow = await db.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [req.user.id]);
    const connections = connRow?.count || 0;
    const postCount = postRow?.count || 0;
    res.json({ ...user, connections, postCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.get('/discover', auth, async (req, res) => {
  const uid = req.user.id;
  try {
    const users = await db.all(`
      SELECT u.id, u.name, u.title, u.avatar, u.drinks,
        (SELECT COUNT(*) FROM connections WHERE user_id = u.id) as connections,
        (SELECT COUNT(*) FROM connections c2 WHERE c2.target_id = u.id
          AND c2.user_id IN (SELECT target_id FROM connections WHERE user_id = ?)) as mutual,
        (SELECT COUNT(*) FROM connections WHERE user_id = ? AND target_id = u.id) as isConnected
      FROM users u WHERE u.id != ? AND u.onboarded = 1
      ORDER BY mutual DESC, connections DESC, RANDOM() LIMIT 60
    `, [uid, uid, uid]);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/suggestions', auth, async (req, res) => {
  const uid = req.user.id;
  try {
    const users = await db.all(`
      SELECT u.id, u.name, u.title, u.avatar,
        (SELECT COUNT(*) FROM connections c2 WHERE c2.target_id = u.id
          AND c2.user_id IN (SELECT target_id FROM connections WHERE user_id = ?)) as mutual,
        (SELECT COUNT(*) FROM connections WHERE user_id = ? AND target_id = u.id) as is_connected
      FROM users u WHERE u.id != ?
      ORDER BY mutual DESC, RANDOM() LIMIT 6
    `, [uid, uid, uid]);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

router.post('/:id/connect', auth, async (req, res) => {
  const uid = req.user.id;
  const tid = parseInt(req.params.id);
  if (uid === tid) return res.status(400).json({ error: 'Cannot connect to yourself' });
  try {
    const exists = await db.get('SELECT 1 FROM connections WHERE user_id = ? AND target_id = ?', [uid, tid]);
    if (exists) {
      await db.run('DELETE FROM connections WHERE user_id = ? AND target_id = ?', [uid, tid]);
      res.json({ connected: false });
    } else {
      await db.run('INSERT OR IGNORE INTO connections (user_id, target_id) VALUES (?, ?)', [uid, tid]);
      await notify({ recipientId: tid, actorId: uid, type: 'connect', actorName: req.user.name || 'Someone' });
      res.json({ connected: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update connection' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    // This is the PUBLIC profile. It previously reused the /me column list,
    // which includes email and is_admin — so any signed-in account could read
    // every member's email address by walking sequential ids, and learn which
    // accounts are administrators. Neither belongs in someone else's profile.
    const user = await db.get('SELECT id, name, title, avatar, bio, drinks, onboarded, verified, premium, badge, current_streak, longest_streak, created_at FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Viewing your own profile through this route still shows your own email.
    if (String(req.user.id) === String(req.params.id)) {
      const self = await db.get('SELECT email, is_admin FROM users WHERE id = ?', [req.user.id]);
      Object.assign(user, self);
    }

    const connRow = await db.get('SELECT COUNT(*) as count FROM connections WHERE user_id = ?', [req.params.id]);
    const connections = connRow?.count || 0;
    const isConnectedRow = await db.get('SELECT 1 FROM connections WHERE user_id = ? AND target_id = ?', [req.user.id, req.params.id]);
    const isConnected = !!isConnectedRow;
    const posts = await db.all(`
      SELECT p.*, u.name, u.title, u.avatar,
        (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        (SELECT COUNT(*) FROM repours WHERE post_id = p.id) as repour_count,
        (SELECT COUNT(*) FROM cheers WHERE post_id = p.id AND user_id = ?) as user_cheered,
        (SELECT COUNT(*) FROM repours WHERE post_id = p.id AND user_id = ?) as user_repoured,
        0 as user_connected
      FROM posts p JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ? ORDER BY p.created_at DESC
    `, [req.user.id, req.user.id, req.params.id]);

    res.json({ ...user, connections, isConnected, posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── /users/:id/places — Places pillar on the profile ────────────────────────
// Combined view: places the user has visited, dedup'd and most-recent first.
router.get('/:id/places', auth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT pl.*,
              MAX(v.created_at) AS last_visit,
              COUNT(v.id)       AS visit_count
         FROM places pl
         JOIN place_visits v ON v.place_id = pl.id
        WHERE v.user_id = ?
     GROUP BY pl.id
     ORDER BY last_visit DESC
        LIMIT 60`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[/users/:id/places]', err.message);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

// ── /users/:id/trips — country groupings for the profile Trips pillar ───────
router.get('/:id/trips', auth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT country,
              COUNT(DISTINCT place_id) AS place_count,
              COUNT(id)                AS visit_count,
              MAX(created_at)          AS last_visit
         FROM place_visits
        WHERE user_id = ? AND country != ''
     GROUP BY country
     ORDER BY last_visit DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[/users/:id/trips]', err.message);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// ── /users/:id/tagged — posts the user was tagged in ────────────────────────
// v1 heuristic: posts whose content contains "@<name>" of the target user.
// Real tagging is a future extension; documented in notes so a proper tags
// table can back this endpoint later without a client change.
router.get('/:id/tagged', auth, async (req, res) => {
  try {
    const u = await db.get('SELECT name FROM users WHERE id = ?', [req.params.id]);
    if (!u) return res.status(404).json({ error: 'Not found' });
    const handle = String(u.name || '').split(/\s+/)[0];
    if (!handle) return res.json([]);
    const rows = await db.all(
      `SELECT p.*, u.name, u.title, u.avatar
         FROM posts p
         JOIN users u ON u.id = p.user_id
        WHERE p.content LIKE ?
     ORDER BY p.created_at DESC
        LIMIT 40`,
      [`%@${handle}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('[/users/:id/tagged]', err.message);
    res.status(500).json({ error: 'Failed to fetch tagged' });
  }
});

module.exports = router;
