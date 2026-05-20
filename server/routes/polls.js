const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/:postId', auth, async (req, res) => {
  try {
    const options = await db.all(
      'SELECT po.*, (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count, (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id AND user_id = ?) as user_voted FROM poll_options po WHERE po.post_id = ?',
      [req.user.id, req.params.postId]
    );
    const total = options.reduce((s, o) => s + o.vote_count, 0);
    res.json({ options, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch poll' });
  }
});

router.post('/:postId/vote', auth, async (req, res) => {
  const { option_id } = req.body;
  if (!option_id) return res.status(400).json({ error: 'option_id required' });
  try {
    const opt = await db.get('SELECT * FROM poll_options WHERE id = ? AND post_id = ?', [option_id, req.params.postId]);
    if (!opt) return res.status(404).json({ error: 'Option not found' });
    const existing = await db.get('SELECT * FROM poll_votes WHERE user_id = ? AND post_id = ?', [req.user.id, req.params.postId]);
    if (existing) {
      if (existing.option_id === option_id) {
        await db.run('DELETE FROM poll_votes WHERE user_id = ? AND post_id = ?', [req.user.id, req.params.postId]);
      } else {
        await db.run('UPDATE poll_votes SET option_id = ? WHERE user_id = ? AND post_id = ?', [option_id, req.user.id, req.params.postId]);
      }
    } else {
      await db.run('INSERT INTO poll_votes (user_id, option_id, post_id) VALUES (?, ?, ?)', [req.user.id, option_id, req.params.postId]);
    }
    const options = await db.all(
      'SELECT po.*, (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count, (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id AND user_id = ?) as user_voted FROM poll_options po WHERE po.post_id = ?',
      [req.user.id, req.params.postId]
    );
    const total = options.reduce((s, o) => s + o.vote_count, 0);
    res.json({ options, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to vote' });
  }
});

module.exports = router;
