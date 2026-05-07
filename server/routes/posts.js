const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const POST_QUERY = (extra = '') => `
  SELECT p.*, u.name, u.title, u.avatar,
    (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
    (SELECT COUNT(*) FROM repours WHERE post_id = p.id) as repour_count,
    (SELECT COUNT(*) FROM cheers WHERE post_id = p.id AND user_id = :uid) as user_cheered,
    (SELECT COUNT(*) FROM repours WHERE post_id = p.id AND user_id = :uid) as user_repoured,
    (SELECT COUNT(*) FROM connections WHERE user_id = :uid AND target_id = p.user_id) as user_connected
  FROM posts p JOIN users u ON p.user_id = u.id
  ${extra}
`;

const notify = (userId, actorId, type, postId = null) => {
  if (userId === actorId) return;
  db.prepare('INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)').run(userId, actorId, type, postId);
};

router.get('/', auth, (req, res) => {
  const posts = db.prepare(POST_QUERY('ORDER BY p.created_at DESC LIMIT 50')).all({ uid: req.user.id });
  res.json(posts);
});

router.get('/trending', auth, (req, res) => {
  const posts = db.prepare('SELECT content FROM posts ORDER BY created_at DESC LIMIT 300').all();
  const counts = {};
  posts.forEach(({ content }) => { (content.match(/#[\w]+/g) || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }); });
  res.json(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count })));
});

router.get('/explore', auth, (req, res) => {
  const posts = db.prepare(POST_QUERY('ORDER BY cheer_count DESC, comment_count DESC, p.created_at DESC LIMIT 50')).all({ uid: req.user.id });
  res.json(posts);
});

router.get('/trips', auth, (req, res) => {
  const posts = db.prepare(POST_QUERY("WHERE p.location != '' AND p.location IS NOT NULL ORDER BY p.created_at DESC LIMIT 50")).all({ uid: req.user.id });
  res.json(posts);
});

router.get('/cheered', auth, (req, res) => {
  const posts = db.prepare(POST_QUERY('WHERE p.id IN (SELECT post_id FROM cheers WHERE user_id = :uid) ORDER BY p.created_at DESC LIMIT 50')).all({ uid: req.user.id });
  res.json(posts);
});

router.get('/hashtag/:tag', auth, (req, res) => {
  const tag = req.params.tag.startsWith('#') ? req.params.tag : '#' + req.params.tag;
  const posts = db.prepare(POST_QUERY('WHERE p.content LIKE :tag ORDER BY p.created_at DESC LIMIT 50')).all({ uid: req.user.id, tag: `%${tag}%` });
  res.json(posts);
});

router.post('/', auth, (req, res) => {
  const { content, drink, location, lat, lng, image_url, poll_options } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  const hasPoll = Array.isArray(poll_options) && poll_options.filter(o => o?.trim()).length >= 2;
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO posts (user_id, content, drink, location, lat, lng, image_url, has_poll) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, content.trim(), drink || '🥃', location || '', lat || null, lng || null, image_url || '', hasPoll ? 1 : 0);
  if (hasPoll) {
    const ins = db.prepare('INSERT INTO poll_options (post_id, text) VALUES (?, ?)');
    poll_options.filter(o => o?.trim()).forEach(opt => ins.run(lastInsertRowid, opt.trim()));
  }
  const post = db.prepare(POST_QUERY('WHERE p.id = :pid')).get({ uid: req.user.id, pid: lastInsertRowid });
  res.json(post);
});

router.post('/:id/cheer', auth, (req, res) => {
  const { id } = req.params; const uid = req.user.id;
  const exists = db.prepare('SELECT 1 FROM cheers WHERE user_id = ? AND post_id = ?').get(uid, id);
  if (exists) { db.prepare('DELETE FROM cheers WHERE user_id = ? AND post_id = ?').run(uid, id); res.json({ cheered: false }); }
  else {
    db.prepare('INSERT INTO cheers (user_id, post_id) VALUES (?, ?)').run(uid, id);
    const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(id);
    if (post) notify(post.user_id, uid, 'cheer', parseInt(id));
    res.json({ cheered: true });
  }
});

router.post('/:id/repour', auth, (req, res) => {
  const { id } = req.params; const uid = req.user.id;
  const exists = db.prepare('SELECT 1 FROM repours WHERE user_id = ? AND post_id = ?').get(uid, id);
  if (exists) { db.prepare('DELETE FROM repours WHERE user_id = ? AND post_id = ?').run(uid, id); res.json({ repoured: false }); }
  else {
    db.prepare('INSERT INTO repours (user_id, post_id) VALUES (?, ?)').run(uid, id);
    const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(id);
    if (post) notify(post.user_id, uid, 'repour', parseInt(id));
    res.json({ repoured: true });
  }
});

router.get('/:id/comments', auth, (req, res) => {
  res.json(db.prepare('SELECT c.*, u.name, u.avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC').all(req.params.id));
});

router.post('/:id/comments', auth, (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment required' });
  const { lastInsertRowid } = db.prepare('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)').run(req.user.id, req.params.id, content.trim());
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id);
  if (post) notify(post.user_id, req.user.id, 'comment', parseInt(req.params.id));
  res.json(db.prepare('SELECT c.*, u.name, u.avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(lastInsertRowid));
});

router.delete('/:id', auth, (req, res) => {
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not your post' });
  ['cheers','comments','repours','notifications','poll_votes','poll_options'].forEach(t => {
    try { db.prepare(`DELETE FROM ${t} WHERE ${t === 'notifications' ? 'post_id' : t === 'poll_votes' ? 'post_id' : t === 'poll_options' ? 'post_id' : 'post_id'} = ?`).run(req.params.id); } catch {}
  });
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
