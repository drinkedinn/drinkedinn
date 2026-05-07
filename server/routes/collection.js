const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  const uid = req.query.user_id || req.user.id;
  const items = db.prepare('SELECT * FROM collection WHERE user_id = ? ORDER BY created_at DESC').all(uid);
  res.json(items);
});

router.post('/', auth, (req, res) => {
  const { name, distillery, drink_type, vintage, rating, image_url, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO collection (user_id, name, distillery, drink_type, vintage, rating, image_url, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, name.trim(), distillery || '', drink_type || '', vintage || '', parseFloat(rating) || 0, image_url || '', notes || '');
  res.json(db.prepare('SELECT * FROM collection WHERE id = ?').get(lastInsertRowid));
});

router.delete('/:id', auth, (req, res) => {
  const item = db.prepare('SELECT user_id FROM collection WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Not yours' });
  db.prepare('DELETE FROM collection WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
