const express = require('express');
const db = require('../db');
const { requirePermission } = require('../middleware/adminAuth');
const { deleteUserCompletely } = require('../lib/deleteUser');
const { logAdminAction } = require('../lib/audit');

const router = express.Router();

// requireAuth + loadAdmin + auditAdmin are applied at the mount in app.js,
// so every route below already has req.admin and is audited. Each still needs
// its own permission — being an admin is not the same as being allowed.

// ─── Platform Stats ────────────────────────────────────────────────────────────
router.get('/stats', requirePermission('analytics.read'), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [usersRow, postsRow, cheersRow, commentsRow, connectionsRow, messagesRow, storiesRow, postsTodayRow, usersTodayRow, groupsRow, challengesRow, reportsRow] = await Promise.all([
      db.get('SELECT COUNT(*) as c FROM users'),
      db.get('SELECT COUNT(*) as c FROM posts'),
      db.get('SELECT COUNT(*) as c FROM cheers'),
      db.get('SELECT COUNT(*) as c FROM comments'),
      db.get('SELECT COUNT(*) as c FROM connections'),
      db.get('SELECT COUNT(*) as c FROM messages'),
      db.get('SELECT COUNT(*) as c FROM stories'),
      db.get('SELECT COUNT(*) as c FROM posts WHERE date(created_at) = ?', [today]),
      db.get('SELECT COUNT(*) as c FROM users WHERE date(created_at) = ?', [today]),
      db.get('SELECT COUNT(*) as c FROM groups').catch(() => ({ c: 0 })),
      db.get('SELECT COUNT(*) as c FROM challenges').catch(() => ({ c: 0 })),
      db.get("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").catch(() => ({ c: 0 })),
    ]);

    const topPosters = await db.all(`
      SELECT u.id, u.name, u.avatar, u.title, COUNT(p.id) as post_count
      FROM users u LEFT JOIN posts p ON p.user_id = u.id
      GROUP BY u.id ORDER BY post_count DESC LIMIT 5
    `);

    const recentSignups = await db.all(`
      SELECT id, name, email, title, avatar, created_at, onboarded
      FROM users ORDER BY created_at DESC LIMIT 8
    `);

    res.json({
      users: usersRow?.c || 0,
      posts: postsRow?.c || 0,
      cheers: cheersRow?.c || 0,
      comments: commentsRow?.c || 0,
      connections: connectionsRow?.c || 0,
      messages: messagesRow?.c || 0,
      stories: storiesRow?.c || 0,
      postsToday: postsTodayRow?.c || 0,
      usersToday: usersTodayRow?.c || 0,
      groups: groupsRow?.c || 0,
      challenges: challengesRow?.c || 0,
      pendingReports: reportsRow?.c || 0,
      topPosters,
      recentSignups
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', requirePermission('users.read'), async (req, res) => {
  const { search = '', page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * 30;
  const like = `%${search}%`;
  try {
    const users = await db.all(`
      SELECT u.id, u.name, u.email, u.title, u.avatar, u.onboarded, u.created_at,
        u.badge, u.verified, u.premium,
        (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count,
        (SELECT COUNT(*) FROM connections WHERE user_id = u.id) as connection_count,
        (SELECT COUNT(*) FROM cheers WHERE user_id = u.id) as cheer_count
      FROM users u
      WHERE u.name LIKE ? OR u.email LIKE ? OR u.title LIKE ?
      ORDER BY u.created_at DESC
      LIMIT 30 OFFSET ?
    `, [like, like, like, offset]);
    const totalRow = await db.get('SELECT COUNT(*) as c FROM users WHERE name LIKE ? OR email LIKE ? OR title LIKE ?', [like, like, like]);
    res.json({ users, total: totalRow?.c || 0, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.delete('/users/:id', requirePermission('users.delete'), async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Delete your own account from Settings instead.' });
  }
  try {
    const target = await db.get('SELECT is_admin FROM users WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.is_admin === 1) {
      return res.status(403).json({ error: 'Demote this admin before deleting the account.' });
    }
    // Same erasure path as self-service deletion — no orphaned rows left behind.
    await deleteUserCompletely(id);
    await logAdminAction(req.user.id, 'user.delete', { targetType: 'user', targetId: id });
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] delete user failed:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─── Posts ─────────────────────────────────────────────────────────────────────
router.get('/posts', requirePermission('content.read'), async (req, res) => {
  const { page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * 30;
  try {
    const posts = await db.all(`
      SELECT p.id, p.content, p.drink, p.location, p.image_url, p.created_at,
        u.id as user_id, u.name, u.avatar,
        (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        (SELECT COUNT(*) FROM reports r WHERE r.target_type = 'post' AND r.target_id = p.id) as report_count
      FROM posts p JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC LIMIT 30 OFFSET ?
    `, [offset]);
    const totalRow = await db.get('SELECT COUNT(*) as c FROM posts');
    res.json({ posts, total: totalRow?.c || 0, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.delete('/posts/:id', requirePermission('content.remove'), async (req, res) => {
  try {
    await db.run('DELETE FROM cheers WHERE post_id = ?', [req.params.id]);
    await db.run('DELETE FROM comments WHERE post_id = ?', [req.params.id]);
    await db.run('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ─── Recent activity feed ──────────────────────────────────────────────────────
router.get('/activity', requirePermission('analytics.read'), async (req, res) => {
  try {
    const posts = await db.all(`
      SELECT 'post' as type, p.id, p.content as detail, u.name, u.avatar, p.created_at as ts
      FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 20
    `);
    const signups = await db.all(`
      SELECT 'signup' as type, u.id, u.email as detail, u.name, u.avatar, u.created_at as ts
      FROM users u ORDER BY u.created_at DESC LIMIT 10
    `);
    const all = [...posts, ...signups].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 30);
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ─── User management actions ──────────────────────────────────────────────────
router.put('/users/:id/badge', requirePermission('users.warn'), async (req, res) => {
  const { badge } = req.body; // e.g. '🏆', '⭐', '🔥', '🥇', null to remove
  try {
    await db.run('UPDATE users SET badge = ? WHERE id = ?', [badge || null, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update badge' });
  }
});

router.put('/users/:id/verify', requirePermission('users.warn'), async (req, res) => {
  const { verified } = req.body; // 1 or 0
  try {
    await db.run('UPDATE users SET verified = ? WHERE id = ?', [verified ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

router.put('/users/:id/premium', requirePermission('users.warn'), async (req, res) => {
  const { premium } = req.body; // 1 or 0
  try {
    await db.run('UPDATE users SET premium = ? WHERE id = ?', [premium ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update premium status' });
  }
});

module.exports = router;
