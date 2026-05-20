const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const events = await db.all(`
      SELECT e.*, u.name, u.avatar,
        (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id) as rsvp_count,
        (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id AND user_id = ?) as user_rsvped
      FROM events e JOIN users u ON e.user_id = u.id
      WHERE e.date >= date('now')
      ORDER BY e.date ASC LIMIT 10
    `, [req.user.id]);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/', auth, async (req, res) => {
  const { title, date, location, drink } = req.body;
  if (!title?.trim() || !date) return res.status(400).json({ error: 'Title and date required' });
  try {
    const { lastInsertRowid } = await db.run(
      'INSERT INTO events (user_id, title, date, location, drink) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, title.trim(), date, location || '', drink || '🥃']
    );
    await db.run('INSERT OR IGNORE INTO event_rsvps (event_id, user_id) VALUES (?, ?)', [lastInsertRowid, req.user.id]);
    const event = await db.get('SELECT e.*, u.name, u.avatar, 1 as rsvp_count, 1 as user_rsvped FROM events e JOIN users u ON e.user_id = u.id WHERE e.id = ?', [lastInsertRowid]);
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.post('/:id/rsvp', auth, async (req, res) => {
  try {
    const existing = await db.get('SELECT 1 FROM event_rsvps WHERE event_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (existing) {
      await db.run('DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ rsvped: false });
    } else {
      await db.run('INSERT OR IGNORE INTO event_rsvps (event_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
      res.json({ rsvped: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update RSVP' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await db.get('SELECT user_id FROM events WHERE id = ?', [req.params.id]);
    if (!event) return res.status(404).json({ error: 'Not found' });
    if (event.user_id !== req.user.id) return res.status(403).json({ error: 'Not your event' });
    await db.run('DELETE FROM event_rsvps WHERE event_id = ?', [req.params.id]);
    await db.run('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
