const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all conversations (unique users I've messaged)
router.get('/conversations', auth, (req, res) => {
  const uid = req.user.id;
  const convos = db.prepare(`
    SELECT DISTINCT
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as other_id,
      u.name, u.avatar, u.title,
      (SELECT content FROM messages WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?) ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?) ORDER BY created_at DESC LIMIT 1) as last_at,
      (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND read = 0) as unread
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
    WHERE m.sender_id = ? OR m.receiver_id = ?
    ORDER BY last_at DESC
  `).all(uid, uid, uid, uid, uid, uid, uid, uid, uid);
  res.json(convos);
});

// Get messages with a specific user
router.get('/:userId', auth, (req, res) => {
  const uid = req.user.id;
  const tid = req.params.userId;
  const msgs = db.prepare(`
    SELECT m.*, u.name, u.avatar FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC LIMIT 100
  `).all(uid, tid, tid, uid);
  db.prepare('UPDATE messages SET read = 1 WHERE sender_id = ? AND receiver_id = ?').run(tid, uid);
  res.json(msgs);
});

// Send message
router.post('/:userId', auth, (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)'
  ).run(req.user.id, req.params.userId, content.trim());
  const msg = db.prepare('SELECT m.*, u.name, u.avatar FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?').get(lastInsertRowid);
  res.json(msg);
});

// Unread count
router.get('/unread/count', auth, (req, res) => {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read = 0').get(req.user.id);
  res.json({ count });
});

module.exports = router;
