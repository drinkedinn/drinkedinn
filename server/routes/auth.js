const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'drinkedinn_secret_2024';

router.post('/register', (req, res) => {
  const { name, email, password, title } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO users (name, email, password, title, avatar, onboarded) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(name, email, hash, title || 'DrinkedInn Member 🥃', avatar);

    const user = db.prepare('SELECT id, name, email, title, avatar, bio, drinks, onboarded FROM users WHERE id = ?').get(lastInsertRowid);
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const { password: _, ...safeUser } = user;
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: safeUser });
});

router.post('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

module.exports = router;
