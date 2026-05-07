const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  const events = db.prepare(`
    SELECT e.*, u.name, u.avatar,
      (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id) as rsvp_count,
      (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id AND user_id = ?) as user_rsvped
    FROM events e JOIN users u ON e.user_id = u.id
    WHERE e.date >= date('now')
    ORDER BY e.date ASC LIMIT 10
  `).all(req.user.id);
  res.json(events);
});

router.post('/', auth, (req, res) => {
  const { title, date, location, drink } = req.body;
  if (!title?.trim() || !date) return res.status(400).json({ error: 'Title and date required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO events (user_id, title, date, location, drink) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, title.trim(), date, location || '', drink || '🥃');
  db.prepare('INSERT OR IGNORE INTO event_rsvps (event_id, user_id) VALUES (?, ?)').run(lastInsertRowid, req.user.id);
  const event = db.prepare('SELECT e.*, u.name, u.avatar, 1 as rsvp_count, 1 as user_rsvped FROM events e JOIN users u ON e.user_id = u.id WHERE e.id = ?').get(lastInsertRowid);
  res.json(event);
});

router.post('/:id/rsvp', auth, (req, res) => {
  const existing = db.prepare('SELECT 1 FROM event_rsvps WHERE event_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ rsvped: false });
  } else {
    db.prepare('INSERT OR IGNORE INTO event_rsvps (event_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
    res.json({ rsvped: true });
  }
});

router.delete('/:id', auth, (req, res) => {
  const event = db.prepare('SELECT user_id FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Not found' });
  if (event.user_id !== req.user.id) return res.status(403).json({ error: 'Not your event' });
  db.prepare('DELETE FROM event_rsvps WHERE event_id = ?').run(req.params.id);
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
