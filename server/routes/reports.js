const express = require('express');
const db = require('../db');
const { requireAuth: auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Report a post, user, or comment
router.post('/', auth, async (req, res) => {
  const { target_type, target_id, reason } = req.body;
  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ error: 'target_type, target_id, and reason required' });
  }
  if (!['post', 'user', 'comment'].includes(target_type)) {
    return res.status(400).json({ error: 'target_type must be post, user, or comment' });
  }
  try {
    // Check duplicate
    const existing = await db.get(
      'SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ?',
      [req.user.id, target_type, target_id]
    );
    if (existing) return res.json({ ok: true, message: 'Already reported' });

    await db.run(
      'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)',
      [req.user.id, target_type, target_id, reason.slice(0, 500)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Admin: view reports
router.get('/', auth, requireAdmin, async (req, res) => {
  try {
    const reports = await db.all(`
      SELECT r.*, u.name as reporter_name, u.avatar as reporter_avatar,
        CASE WHEN r.target_type = 'post' THEN (SELECT content FROM posts WHERE id = r.target_id) ELSE NULL END as post_content,
        r.target_id as post_id
      FROM reports r JOIN users u ON r.reporter_id = u.id
      ORDER BY r.created_at DESC LIMIT 50
    `);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Admin: resolve report
router.put('/:id', auth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    await db.run('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

module.exports = router;
