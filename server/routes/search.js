const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  if (!req.query.q?.trim()) return res.json({ users: [], posts: [] });

  const users = db.prepare(`
    SELECT id, name, title, avatar,
      (SELECT COUNT(*) FROM connections WHERE user_id = id) as connections
    FROM users WHERE (name LIKE ? OR title LIKE ?) AND id != ?
    LIMIT 8
  `).all(q, q, req.user.id);

  const posts = db.prepare(`
    SELECT p.*, u.name, u.title, u.avatar,
      (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM repours WHERE post_id = p.id) as repour_count,
      (SELECT COUNT(*) FROM cheers WHERE post_id = p.id AND user_id = :uid) as user_cheered,
      0 as user_repoured
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.content LIKE :q
    ORDER BY p.created_at DESC LIMIT 10
  `).all({ q, uid: req.user.id });

  res.json({ users, posts });
});

module.exports = router;
