const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, title, avatar, bio, drinks, onboarded, created_at FROM users WHERE id = ?').get(req.user.id);
  const { count: connections } = db.prepare('SELECT COUNT(*) as count FROM connections WHERE user_id = ?').get(req.user.id);
  const { count: postCount } = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(req.user.id);
  res.json({ ...user, connections, postCount });
});

router.put('/me', auth, (req, res) => {
  const { name, title, bio, avatar, drinks, onboarded } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const drinksJson = typeof drinks === 'object' ? JSON.stringify(drinks) : (drinks || '{}');
  db.prepare('UPDATE users SET name = ?, title = ?, bio = ?, avatar = ?, drinks = ?, onboarded = ? WHERE id = ?')
    .run(name.trim(), title || '', bio || '', avatar || '', drinksJson, onboarded ? 1 : 0, req.user.id);
  const user = db.prepare('SELECT id, name, email, title, avatar, bio, drinks, onboarded, created_at FROM users WHERE id = ?').get(req.user.id);
  const { count: connections } = db.prepare('SELECT COUNT(*) as count FROM connections WHERE user_id = ?').get(req.user.id);
  const { count: postCount } = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(req.user.id);
  res.json({ ...user, connections, postCount });
});

router.get('/suggestions', auth, (req, res) => {
  const uid = req.user.id;
  const users = db.prepare(`
    SELECT u.id, u.name, u.title, u.avatar,
      (SELECT COUNT(*) FROM connections c2 WHERE c2.target_id = u.id
        AND c2.user_id IN (SELECT target_id FROM connections WHERE user_id = ?)) as mutual,
      (SELECT COUNT(*) FROM connections WHERE user_id = ? AND target_id = u.id) as is_connected
    FROM users u WHERE u.id != ?
    ORDER BY mutual DESC, RANDOM() LIMIT 6
  `).all(uid, uid, uid);
  res.json(users);
});

router.post('/:id/connect', auth, (req, res) => {
  const uid = req.user.id;
  const tid = parseInt(req.params.id);
  if (uid === tid) return res.status(400).json({ error: 'Cannot connect to yourself' });
  const exists = db.prepare('SELECT 1 FROM connections WHERE user_id = ? AND target_id = ?').get(uid, tid);
  if (exists) {
    db.prepare('DELETE FROM connections WHERE user_id = ? AND target_id = ?').run(uid, tid);
    res.json({ connected: false });
  } else {
    db.prepare('INSERT OR IGNORE INTO connections (user_id, target_id) VALUES (?, ?)').run(uid, tid);
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, NULL)').run(tid, uid, 'connect');
    res.json({ connected: true });
  }
});

router.get('/:id', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, title, avatar, bio, drinks, onboarded, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { count: connections } = db.prepare('SELECT COUNT(*) as count FROM connections WHERE user_id = ?').get(req.params.id);
  const isConnected = !!db.prepare('SELECT 1 FROM connections WHERE user_id = ? AND target_id = ?').get(req.user.id, req.params.id);
  const posts = db.prepare(`
    SELECT p.*, u.name, u.title, u.avatar,
      (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM repours WHERE post_id = p.id) as repour_count,
      (SELECT COUNT(*) FROM cheers WHERE post_id = p.id AND user_id = ?) as user_cheered,
      (SELECT COUNT(*) FROM repours WHERE post_id = p.id AND user_id = ?) as user_repoured,
      0 as user_connected
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ? ORDER BY p.created_at DESC
  `).all(req.user.id, req.user.id, req.params.id);

  res.json({ ...user, connections, isConnected, posts });
});

module.exports = router;
