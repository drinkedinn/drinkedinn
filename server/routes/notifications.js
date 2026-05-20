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

module.exports = router;
