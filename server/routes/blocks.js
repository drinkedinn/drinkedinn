// server/routes/blocks.js
// Block and unblock other members. Required by Apple guideline 1.2 ("the ability
// to block abusive users from the service") and Google Play's UGC policy.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Who I've blocked (shown in Settings so people can undo it).
router.get('/', auth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT u.id, u.name, u.avatar, u.title, b.created_at
         FROM blocked_users b JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = ?
        ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ blocked: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load blocked list' });
  }
});

// Block someone. Also severs any existing connection in both directions —
// a blocked person should not remain in your network.
router.post('/:id', auth, async (req, res) => {
  const target = parseInt(req.params.id, 10);
  if (!Number.isInteger(target)) return res.status(400).json({ error: 'Invalid user' });
  if (target === req.user.id) return res.status(400).json({ error: "You can't block yourself." });

  try {
    const exists = await db.get('SELECT id FROM users WHERE id = ?', [target]);
    if (!exists) return res.status(404).json({ error: 'User not found' });

    await db.run(
      'INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)',
      [req.user.id, target, Date.now()]
    );
    await db.run(
      'DELETE FROM connections WHERE (user_id = ? AND target_id = ?) OR (user_id = ? AND target_id = ?)',
      [req.user.id, target, target, req.user.id]
    );
    // Clear notifications between the two so the block takes effect immediately.
    await db.run(
      'DELETE FROM notifications WHERE (user_id = ? AND actor_id = ?) OR (user_id = ? AND actor_id = ?)',
      [req.user.id, target, target, req.user.id]
    );

    res.json({ ok: true, blocked: true });
  } catch (err) {
    console.error('[blocks] failed:', err.message);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const target = parseInt(req.params.id, 10);
  try {
    await db.run('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, target]);
    res.json({ ok: true, blocked: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

module.exports = router;
