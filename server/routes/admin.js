const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Admin-only middleware — checks is_admin flag, not hardcoded ID
const adminOnly = (req, res, next) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  next();
};

router.use(auth, adminOnly);

// ─── Platform Stats ────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const users       = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const posts       = db.prepare('SELECT COUNT(*) as c FROM posts').get().c;
  const cheers      = db.prepare('SELECT COUNT(*) as c FROM cheers').get().c;
  const comments    = db.prepare('SELECT COUNT(*) as c FROM comments').get().c;
  const connections = db.prepare('SELECT COUNT(*) as c FROM connections').get().c;
  const messages    = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
  const stories     = db.prepare('SELECT COUNT(*) as c FROM stories').get().c;

  const today = new Date().toISOString().slice(0, 10);
  const postsToday  = db.prepare("SELECT COUNT(*) as c FROM posts WHERE date(created_at) = ?").get(today).c;
  const usersToday  = db.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at) = ?").get(today).c;

  const topPosters = db.prepare(`
    SELECT u.id, u.name, u.avatar, u.title, COUNT(p.id) as post_count
    FROM users u LEFT JOIN posts p ON p.user_id = u.id
    GROUP BY u.id ORDER BY post_count DESC LIMIT 5
  `).all();

  const recentSignups = db.prepare(`
    SELECT id, name, email, title, avatar, created_at, onboarded
    FROM users ORDER BY created_at DESC LIMIT 8
  `).all();

  res.json({ users, posts, cheers, comments, connections, messages, stories, postsToday, usersToday, topPosters, recentSignups });
});

// ─── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  const { search = '', page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * 30;
  const like = `%${search}%`;
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.title, u.avatar, u.onboarded, u.created_at,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count,
      (SELECT COUNT(*) FROM connections WHERE user_id = u.id) as connection_count,
      (SELECT COUNT(*) FROM cheers WHERE user_id = u.id) as cheer_count
    FROM users u
    WHERE u.name LIKE ? OR u.email LIKE ? OR u.title LIKE ?
    ORDER BY u.created_at DESC
    LIMIT 30 OFFSET ?
  `).all(like, like, like, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM users WHERE name LIKE ? OR email LIKE ? OR title LIKE ?').get(like, like, like).c;
  res.json({ users, total, page: parseInt(page) });
});

router.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (id === 1) return res.status(400).json({ error: 'Cannot delete admin' });
  db.prepare('DELETE FROM connections WHERE user_id = ? OR target_id = ?').run(id, id);
  db.prepare('DELETE FROM cheers WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM comments WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM notifications WHERE user_id = ? OR actor_id = ?').run(id, id);
  db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(id, id);
  db.prepare('DELETE FROM stories WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM posts WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ─── Posts ─────────────────────────────────────────────────────────────────────
router.get('/posts', (req, res) => {
  const { page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * 30;
  const posts = db.prepare(`
    SELECT p.id, p.content, p.drink, p.location, p.created_at,
      u.id as user_id, u.name, u.avatar,
      (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
    FROM posts p JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC LIMIT 30 OFFSET ?
  `).all(offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM posts').get().c;
  res.json({ posts, total, page: parseInt(page) });
});

router.delete('/posts/:id', (req, res) => {
  db.prepare('DELETE FROM cheers WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Recent activity feed ──────────────────────────────────────────────────────
router.get('/activity', (req, res) => {
  const posts = db.prepare(`
    SELECT 'post' as type, p.id, p.content as detail, u.name, u.avatar, p.created_at as ts
    FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 20
  `).all();
  const signups = db.prepare(`
    SELECT 'signup' as type, u.id, u.email as detail, u.name, u.avatar, u.created_at as ts
    FROM users u ORDER BY u.created_at DESC LIMIT 10
  `).all();
  const all = [...posts, ...signups].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 30);
  res.json(all);
});

module.exports = router;
