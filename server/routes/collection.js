const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  const uid = req.query.user_id || req.user.id;
  try {
    const items = await db.all('SELECT * FROM collection WHERE user_id = ? ORDER BY created_at DESC', [uid]);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

router.post('/', auth, async (req, res) => {
  const { name, distillery, drink_type, vintage, rating, image_url, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    const { lastInsertRowid } = await db.run(
      'INSERT INTO collection (user_id, name, distillery, drink_type, vintage, rating, image_url, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), distillery || '', drink_type || '', vintage || '', parseFloat(rating) || 0, image_url || '', notes || '']
    );
    const item = await db.get('SELECT * FROM collection WHERE id = ?', [lastInsertRowid]);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to collection' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await db.get('SELECT user_id FROM collection WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Not yours' });
    await db.run('DELETE FROM collection WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
