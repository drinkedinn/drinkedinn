const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const { excludeBlocked } = require('../lib/blocking');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    // Blocking has to hold here too. This query took no parameters at all, so
    // a blocked member's story stayed in the blocker's rail — the one surface
    // in the app you cannot scroll past without seeing, since the rail sits at
    // the top of Home. Every other feed already filters (places, search,
    // messages, onboarding); stories was simply missed.
    const stories = await db.all(`
      SELECT s.*, u.name, u.avatar FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.created_at > datetime('now', '-24 hours')
        AND ${excludeBlocked('s.user_id')}
      ORDER BY s.created_at DESC
    `, [req.user.id, req.user.id]);
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

router.post('/', auth, async (req, res) => {
  const { drink } = req.body;
  try {
    const { lastInsertRowid } = await db.run('INSERT INTO stories (user_id, drink) VALUES (?, ?)', [req.user.id, drink || '🍹']);
    const story = await db.get('SELECT s.*, u.name, u.avatar FROM stories s JOIN users u ON s.user_id = u.id WHERE s.id = ?', [lastInsertRowid]);
    res.json(story);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create story' });
  }
});

module.exports = router;
