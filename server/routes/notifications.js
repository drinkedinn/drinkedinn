const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const notes = db.prepare(`
    SELECT n.*, u.name as actor_name, u.avatar as actor_avatar,
      p.content as post_preview
    FROM notifications n
    JOIN users u ON n.actor_id = u.id
    LEFT JOIN posts p ON n.post_id = p.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC LIMIT 30
  `).all(req.user.id);
  res.json(notes);
});

router.get('/count', auth, (req, res) => {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id);
  res.json({ count });
});

router.post('/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
