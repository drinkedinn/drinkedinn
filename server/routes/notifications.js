const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const notes = await db.all(`
      SELECT n.*, u.name as actor_name, u.avatar as actor_avatar,
        p.content as post_preview
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      LEFT JOIN posts p ON n.post_id = p.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC LIMIT 30
    `, [req.user.id]);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/count', auth, async (req, res) => {
  try {
    const row = await db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0', [req.user.id]);
    res.json({ count: row?.count || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

router.post('/:id/read', auth, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

router.post('/read-all', auth, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// ── Web Push subscription management (engagement engine) ──────────────────────
router.post('/push/subscribe', auth, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  try {
    await db.run(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
         VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id`,
      [req.user.id, endpoint, keys.p256dh, keys.auth, Date.now()]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

router.post('/push/unsubscribe', auth, async (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) await db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  res.json({ ok: true });
});

// Client reports its timezone offset so quiet hours work per-user.
router.put('/tz', auth, async (req, res) => {
  const off = parseInt(req.body.tz_offset_minutes, 10);
  if (Number.isNaN(off)) return res.status(400).json({ error: 'bad offset' });
  await db.run('UPDATE users SET tz_offset_minutes = ? WHERE id = ?', [off, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
