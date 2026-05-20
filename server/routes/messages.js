const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all conversations (unique users I've messaged)
router.get('/conversations', auth, async (req, res) => {
  const uid = req.user.id;
  try {
    const convos = await db.all(`
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
    `, [uid, uid, uid, uid, uid, uid, uid, uid, uid]);
    res.json(convos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages with a specific user
router.get('/:userId', auth, async (req, res) => {
  const uid = req.user.id;
  const tid = req.params.userId;
  try {
    const msgs = await db.all(`
      SELECT m.*, u.name, u.avatar FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC LIMIT 100
    `, [uid, tid, tid, uid]);
    await db.run('UPDATE messages SET read = 1 WHERE sender_id = ? AND receiver_id = ?', [tid, uid]);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
router.post('/:userId', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  try {
    const { lastInsertRowid } = await db.run(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [req.user.id, req.params.userId, content.trim()]
    );
    const msg = await db.get('SELECT m.*, u.name, u.avatar FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?', [lastInsertRowid]);
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Unread count
router.get('/unread/count', auth, async (req, res) => {
  try {
    const row = await db.get('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read = 0', [req.user.id]);
    res.json({ count: row?.count || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;
