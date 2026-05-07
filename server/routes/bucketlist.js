const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  const uid = req.query.user_id || req.user.id;
  const items = db.prepare('SELECT * FROM bucket_list WHERE user_id = ? ORDER BY checked ASC, created_at DESC').all(uid);
  res.json(items);
});

router.post('/', auth, (req, res) => {
  const { drink_name } = req.body;
  if (!drink_name?.trim()) return res.status(400).json({ error: 'Drink name required' });
  const { lastInsertRowid } = db.prepare('INSERT INTO bucket_list (user_id, drink_name) VALUES (?, ?)').run(req.user.id, drink_name.trim());
  res.json(db.prepare('SELECT * FROM bucket_list WHERE id = ?').get(lastInsertRowid));
});

router.patch('/:id/check', auth, (req, res) => {
  const item = db.prepare('SELECT * FROM bucket_list WHERE id = ?').get(req.params.id);
  if (!item || item.user_id !== req.user.id) return res.status(403).json({ error: 'Not found' });
  db.prepare('UPDATE bucket_list SET checked = ? WHERE id = ?').run(item.checked ? 0 : 1, req.params.id);
  res.json({ checked: !item.checked });
});

router.delete('/:id', auth, (req, res) => {
  const item = db.prepare('SELECT user_id FROM bucket_list WHERE id = ?').get(req.params.id);
  if (!item || item.user_id !== req.user.id) return res.status(403).json({ error: 'Not found' });
  db.prepare('DELETE FROM bucket_list WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
