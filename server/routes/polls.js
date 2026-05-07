const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/:postId', auth, (req, res) => {
  const options = db.prepare('SELECT po.*, (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count, (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id AND user_id = ?) as user_voted FROM poll_options po WHERE po.post_id = ?').all(req.user.id, req.params.postId);
  const total = options.reduce((s, o) => s + o.vote_count, 0);
  res.json({ options, total });
});

router.post('/:postId/vote', auth, (req, res) => {
  const { option_id } = req.body;
  if (!option_id) return res.status(400).json({ error: 'option_id required' });
  const opt = db.prepare('SELECT * FROM poll_options WHERE id = ? AND post_id = ?').get(option_id, req.params.postId);
  if (!opt) return res.status(404).json({ error: 'Option not found' });
  const existing = db.prepare('SELECT * FROM poll_votes WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.postId);
  if (existing) {
    if (existing.option_id === option_id) {
      db.prepare('DELETE FROM poll_votes WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.postId);
    } else {
      db.prepare('UPDATE poll_votes SET option_id = ? WHERE user_id = ? AND post_id = ?').run(option_id, req.user.id, req.params.postId);
    }
  } else {
    db.prepare('INSERT INTO poll_votes (user_id, option_id, post_id) VALUES (?, ?, ?)').run(req.user.id, option_id, req.params.postId);
  }
  const options = db.prepare('SELECT po.*, (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count, (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id AND user_id = ?) as user_voted FROM poll_options po WHERE po.post_id = ?').all(req.user.id, req.params.postId);
  const total = options.reduce((s, o) => s + o.vote_count, 0);
  res.json({ options, total });
});

module.exports = router;
