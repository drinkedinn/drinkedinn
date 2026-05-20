const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  const uid = req.query.user_id || req.user.id;
  try {
    const ratings = await db.all('SELECT * FROM drink_ratings WHERE user_id = ? ORDER BY created_at DESC', [uid]);
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

router.post('/', auth, async (req, res) => {
  const { drink_name, distillery, drink_type, rating, nose, palate, finish, image_url } = req.body;
  if (!drink_name?.trim() || !rating) return res.status(400).json({ error: 'Name and rating required' });
  try {
    const { lastInsertRowid } = await db.run(
      'INSERT INTO drink_ratings (user_id, drink_name, distillery, drink_type, rating, nose, palate, finish, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, drink_name.trim(), distillery || '', drink_type || '', parseFloat(rating), nose || '', palate || '', finish || '', image_url || '']
    );
    const item = await db.get('SELECT * FROM drink_ratings WHERE id = ?', [lastInsertRowid]);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create rating' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await db.get('SELECT user_id FROM drink_ratings WHERE id = ?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.user_id !== req.user.id) return res.status(403).json({ error: 'Not yours' });
    await db.run('DELETE FROM drink_ratings WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

module.exports = router;
