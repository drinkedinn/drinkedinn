const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'drinkedinn_secret_2024';

router.post('/register', async (req, res) => {
  const { name, email, password, title } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;
    const { lastInsertRowid } = await db.run(
      'INSERT INTO users (name, email, password, title, avatar, onboarded) VALUES (?, ?, ?, ?, ?, 0)',
      [name, email, hash, title || 'DrinkedInn Member 🥃', avatar]
    );

    const user = await db.get('SELECT id, name, email, title, avatar, bio, drinks, onboarded FROM users WHERE id = ?', [lastInsertRowid]);
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { password: _, ...safeUser } = user;
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  try {
    const user = await db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await db.run('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

module.exports = router;
