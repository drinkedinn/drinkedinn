const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { excludeBlocked } = require('../lib/blocking');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  if (!req.query.q?.trim()) return res.json({ users: [], posts: [] });

  try {
    const users = await db.all(`
      SELECT id, name, title, avatar,
        (SELECT COUNT(*) FROM connections WHERE user_id = id) as connections
      FROM users WHERE (name LIKE ? OR title LIKE ?) AND id != ?
        AND ${excludeBlocked('id')}
      LIMIT 8
    `, [q, q, req.user.id, req.user.id, req.user.id]);

    const posts = await db.all(`
      SELECT p.*, u.name, u.title, u.avatar,
        (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        (SELECT COUNT(*) FROM repours WHERE post_id = p.id) as repour_count,
        (SELECT COUNT(*) FROM cheers WHERE post_id = p.id AND user_id = ?) as user_cheered,
        0 as user_repoured
      FROM posts p JOIN users u ON p.user_id = u.id
      WHERE p.content LIKE ?
        AND ${excludeBlocked('p.user_id')}
      ORDER BY p.created_at DESC LIMIT 10
    `, [req.user.id, q, req.user.id, req.user.id]);

    res.json({ users, posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search' });
  }
});

module.exports = router;
