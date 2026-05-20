const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// List all groups with membership info
router.get('/', auth, async (req, res) => {
  try {
    const groups = await db.all(`
      SELECT g.*, u.name as creator_name, u.avatar as creator_avatar,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member
      FROM drink_groups g JOIN users u ON g.created_by = u.id
      ORDER BY member_count DESC
    `, [req.user.id]);
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get single group with posts
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await db.get(`
      SELECT g.*, u.name as creator_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member,
        (SELECT role FROM group_members WHERE group_id = g.id AND user_id = ?) as my_role
      FROM drink_groups g JOIN users u ON g.created_by = u.id WHERE g.id = ?
    `, [req.user.id, req.user.id, req.params.id]);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const posts = await db.all(`
      SELECT gp.*, u.name, u.avatar, u.title FROM group_posts gp
      JOIN users u ON gp.user_id = u.id WHERE gp.group_id = ? ORDER BY gp.created_at DESC LIMIT 50
    `, [req.params.id]);

    const members = await db.all(`
      SELECT u.id, u.name, u.avatar, u.title, gm.role FROM group_members gm
      JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ? ORDER BY gm.joined_at ASC LIMIT 20
    `, [req.params.id]);

    res.json({ ...group, posts, members });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Create group
router.post('/', auth, async (req, res) => {
  const { name, description, drink_type } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    const { lastInsertRowid } = await db.run(
      'INSERT INTO drink_groups (name, description, drink_type, created_by) VALUES (?, ?, ?, ?)',
      [name.trim(), description || '', drink_type || '🥃', req.user.id]
    );
    await db.run('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [lastInsertRowid, req.user.id, 'admin']);
    const group = await db.get('SELECT * FROM drink_groups WHERE id = ?', [lastInsertRowid]);
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Join / leave group
router.post('/:id/join', auth, async (req, res) => {
  try {
    const exists = await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (exists) {
      const g = await db.get('SELECT created_by FROM drink_groups WHERE id = ?', [req.params.id]);
      if (g?.created_by === req.user.id) return res.status(400).json({ error: 'Cannot leave your own group' });
      await db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ joined: false });
    } else {
      await db.run('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [req.params.id, req.user.id, 'member']);
      res.json({ joined: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group membership' });
  }
});

// Post in group
router.post('/:id/posts', auth, async (req, res) => {
  try {
    const member = await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!member) return res.status(403).json({ error: 'Join the group first' });
    const { content, drink, image_url } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    const { lastInsertRowid } = await db.run(
      'INSERT INTO group_posts (group_id, user_id, content, drink, image_url) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.id, content.trim(), drink || '🥃', image_url || '']
    );
    const post = await db.get('SELECT gp.*, u.name, u.avatar, u.title FROM group_posts gp JOIN users u ON gp.user_id = u.id WHERE gp.id = ?', [lastInsertRowid]);
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group post' });
  }
});

module.exports = router;
