const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  const challenges = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM challenge_entries WHERE challenge_id = c.id) as participant_count,
      (SELECT COUNT(*) FROM challenge_entries WHERE challenge_id = c.id AND user_id = ?) as is_joined
    FROM challenges c ORDER BY c.end_date ASC
  `).all(req.user.id);
  res.json(challenges);
});

router.get('/:id/leaderboard', auth, (req, res) => {
  const board = db.prepare(`
    SELECT u.id, u.name, u.avatar, u.title, ce.created_at as joined_at,
      ROW_NUMBER() OVER (ORDER BY ce.created_at ASC) as rank
    FROM challenge_entries ce JOIN users u ON ce.user_id = u.id
    WHERE ce.challenge_id = ? ORDER BY ce.created_at ASC LIMIT 20
  `).all(req.params.id);
  res.json(board);
});

router.post('/:id/join', auth, (req, res) => {
  const existing = db.prepare('SELECT 1 FROM challenge_entries WHERE challenge_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM challenge_entries WHERE challenge_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ joined: false });
  } else {
    db.prepare('INSERT OR IGNORE INTO challenge_entries (challenge_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
    res.json({ joined: true });
  }
});

module.exports = router;
