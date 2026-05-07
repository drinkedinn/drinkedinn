const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// List all groups with membership info
router.get('/', auth, (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, u.name as creator_name, u.avatar as creator_avatar,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member
    FROM drink_groups g JOIN users u ON g.created_by = u.id
    ORDER BY member_count DESC
  `).all(req.user.id);
  res.json(groups);
});

// Get single group with posts
router.get('/:id', auth, (req, res) => {
  const group = db.prepare(`
    SELECT g.*, u.name as creator_name,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member,
      (SELECT role FROM group_members WHERE group_id = g.id AND user_id = ?) as my_role
    FROM drink_groups g JOIN users u ON g.created_by = u.id WHERE g.id = ?
  `).get(req.user.id, req.user.id, req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const posts = db.prepare(`
    SELECT gp.*, u.name, u.avatar, u.title FROM group_posts gp
    JOIN users u ON gp.user_id = u.id WHERE gp.group_id = ? ORDER BY gp.created_at DESC LIMIT 50
  `).all(req.params.id);

  const members = db.prepare(`
    SELECT u.id, u.name, u.avatar, u.title, gm.role FROM group_members gm
    JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ? ORDER BY gm.joined_at ASC LIMIT 20
  `).all(req.params.id);

  res.json({ ...group, posts, members });
});

// Create group
router.post('/', auth, (req, res) => {
  const { name, description, drink_type } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO drink_groups (name, description, drink_type, created_by) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), description || '', drink_type || '🥃', req.user.id);
  db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(lastInsertRowid, req.user.id, 'admin');
  const group = db.prepare('SELECT * FROM drink_groups WHERE id = ?').get(lastInsertRowid);
  res.json(group);
});

// Join / leave group
router.post('/:id/join', auth, (req, res) => {
  const exists = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (exists) {
    const g = db.prepare('SELECT created_by FROM drink_groups WHERE id = ?').get(req.params.id);
    if (g?.created_by === req.user.id) return res.status(400).json({ error: 'Cannot leave your own group' });
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ joined: false });
  } else {
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, req.user.id, 'member');
    res.json({ joined: true });
  }
});

// Post in group
router.post('/:id/posts', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Join the group first' });
  const { content, drink, image_url } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO group_posts (group_id, user_id, content, drink, image_url) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, req.user.id, content.trim(), drink || '🥃', image_url || '');
  const post = db.prepare('SELECT gp.*, u.name, u.avatar, u.title FROM group_posts gp JOIN users u ON gp.user_id = u.id WHERE gp.id = ?').get(lastInsertRowid);
  res.json(post);
});

module.exports = router;
