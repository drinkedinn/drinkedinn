const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const stories = db.prepare(`
    SELECT s.*, u.name, u.avatar FROM stories s
    JOIN users u ON s.user_id = u.id
    WHERE s.created_at > datetime('now', '-24 hours')
    ORDER BY s.created_at DESC
  `).all();
  res.json(stories);
});

router.post('/', auth, (req, res) => {
  const { drink } = req.body;
  const { lastInsertRowid } = db.prepare('INSERT INTO stories (user_id, drink) VALUES (?, ?)').run(req.user.id, drink || '🍹');
  const story = db.prepare('SELECT s.*, u.name, u.avatar FROM stories s JOIN users u ON s.user_id = u.id WHERE s.id = ?').get(lastInsertRowid);
  res.json(story);
});

module.exports = router;
