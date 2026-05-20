const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const challenges = await db.all(`
      SELECT c.*,
        (SELECT COUNT(*) FROM challenge_entries WHERE challenge_id = c.id) as participant_count,
        (SELECT COUNT(*) FROM challenge_entries WHERE challenge_id = c.id AND user_id = ?) as is_joined
      FROM challenges c ORDER BY c.end_date ASC
    `, [req.user.id]);
    res.json(challenges);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

router.get('/:id/leaderboard', auth, async (req, res) => {
  try {
    const board = await db.all(`
      SELECT u.id, u.name, u.avatar, u.title, ce.created_at as joined_at,
        ROW_NUMBER() OVER (ORDER BY ce.created_at ASC) as rank
      FROM challenge_entries ce JOIN users u ON ce.user_id = u.id
      WHERE ce.challenge_id = ? ORDER BY ce.created_at ASC LIMIT 20
    `, [req.params.id]);
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.post('/:id/join', auth, async (req, res) => {
  try {
    const existing = await db.get('SELECT 1 FROM challenge_entries WHERE challenge_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (existing) {
      await db.run('DELETE FROM challenge_entries WHERE challenge_id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ joined: false });
    } else {
      await db.run('INSERT OR IGNORE INTO challenge_entries (challenge_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
      res.json({ joined: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update challenge' });
  }
});

module.exports = router;
