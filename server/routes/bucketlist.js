const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  const uid = req.query.user_id || req.user.id;
  try {
    const items = await db.all('SELECT * FROM bucket_list WHERE user_id = ? ORDER BY checked ASC, created_at DESC', [uid]);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bucket list' });
  }
});

router.post('/', auth, async (req, res) => {
  const { drink_name } = req.body;
  if (!drink_name?.trim()) return res.status(400).json({ error: 'Drink name required' });
  try {
    const { lastInsertRowid } = await db.run('INSERT INTO bucket_list (user_id, drink_name) VALUES (?, ?)', [req.user.id, drink_name.trim()]);
    const item = await db.get('SELECT * FROM bucket_list WHERE id = ?', [lastInsertRowid]);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add item' });
  }
});

router.patch('/:id/check', auth, async (req, res) => {
  try {
    const item = await db.get('SELECT * FROM bucket_list WHERE id = ?', [req.params.id]);
    if (!item || item.user_id !== req.user.id) return res.status(403).json({ error: 'Not found' });
    await db.run('UPDATE bucket_list SET checked = ? WHERE id = ?', [item.checked ? 0 : 1, req.params.id]);
    res.json({ checked: !item.checked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await db.get('SELECT user_id FROM bucket_list WHERE id = ?', [req.params.id]);
    if (!item || item.user_id !== req.user.id) return res.status(403).json({ error: 'Not found' });
    await db.run('DELETE FROM bucket_list WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
