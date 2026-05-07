const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  const uid = req.query.user_id || req.user.id;
  const ratings = db.prepare('SELECT * FROM drink_ratings WHERE user_id = ? ORDER BY created_at DESC').all(uid);
  res.json(ratings);
});

router.post('/', auth, (req, res) => {
  const { drink_name, distillery, drink_type, rating, nose, palate, finish, image_url } = req.body;
  if (!drink_name?.trim() || !rating) return res.status(400).json({ error: 'Name and rating required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO drink_ratings (user_id, drink_name, distillery, drink_type, rating, nose, palate, finish, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, drink_name.trim(), distillery || '', drink_type || '', parseFloat(rating), nose || '', palate || '', finish || '', image_url || '');
  res.json(db.prepare('SELECT * FROM drink_ratings WHERE id = ?').get(lastInsertRowid));
});

router.delete('/:id', auth, (req, res) => {
  const r = db.prepare('SELECT user_id FROM drink_ratings WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.user_id !== req.user.id) return res.status(403).json({ error: 'Not yours' });
  db.prepare('DELETE FROM drink_ratings WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
