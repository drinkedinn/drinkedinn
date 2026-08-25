// server/routes/onboarding.js
// Solves "new user lands on an empty feed and bounces" — gets them following a
// handful of active people in their first session. Mounted behind auth.
//
// Adapted to real schema: connections(user_id=follower, target_id=following),
// users.avatar (not avatar_url).

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Suggest active people to follow: most-followed accounts the user doesn't
// already follow. v1 heuristic — later, personalize by drink interest.
router.get('/suggestions', auth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT u.id, u.name, u.avatar, u.title, u.badge, u.verified,
              (SELECT COUNT(*) FROM connections c WHERE c.target_id = u.id) AS followers,
              (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS posts
         FROM users u
        WHERE u.id != ?
          AND u.id NOT IN (SELECT target_id FROM connections WHERE user_id = ?)
        ORDER BY followers DESC, posts DESC
        LIMIT 12`,
      [req.user.id, req.user.id]
    );
    res.json({ suggestions: rows });
  } catch (err) {
    console.error('[onboarding/suggestions]', err.message);
    res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

// Mark onboarding complete.
router.post('/complete', auth, async (req, res) => {
  await db.run('UPDATE users SET onboarded = 1 WHERE id = ?', [req.user.id]);
  res.json({ ok: true });
});

router.get('/state', auth, async (req, res) => {
  const u = await db.get('SELECT onboarded FROM users WHERE id = ?', [req.user.id]);
  const following = await db.get(
    'SELECT COUNT(*) AS c FROM connections WHERE user_id = ?',
    [req.user.id]
  );
  res.json({ onboarded: u?.onboarded === 1, following: following?.c || 0 });
});

module.exports = router;
