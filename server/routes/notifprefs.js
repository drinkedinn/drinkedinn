const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Get notification preferences
router.get('/', auth, async (req, res) => {
  try {
    let prefs = await db.get('SELECT * FROM notification_prefs WHERE user_id = ?', [req.user.id]);
    if (!prefs) {
      await db.run(
        'INSERT OR IGNORE INTO notification_prefs (user_id) VALUES (?)', [req.user.id]
      );
      prefs = { user_id: req.user.id, cheers: 1, comments: 1, connections: 1, messages: 1, challenges: 1, digest_email: 1 };
    }
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update notification preferences
router.put('/', auth, async (req, res) => {
  const { cheers, comments, connections, messages, challenges, digest_email } = req.body;
  try {
    await db.run(
      `INSERT OR REPLACE INTO notification_prefs (user_id, cheers, comments, connections, messages, challenges, digest_email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, cheers ? 1 : 0, comments ? 1 : 0, connections ? 1 : 0, messages ? 1 : 0, challenges ? 1 : 0, digest_email ? 1 : 0]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

module.exports = router;
