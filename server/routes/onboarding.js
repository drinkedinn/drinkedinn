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
    // Prefer people who share at least one interest with the viewer, then fall
    // back to the most-followed strangers. Interests are comma-separated slugs
    // set at signup — we score by how many overlap. In SQLite there is no
    // string-splitting primitive, so the overlap is computed in JS after
    // pulling the candidate rows.
    const me = await db.get('SELECT interests FROM users WHERE id = ?', [req.user.id]);
    const mine = new Set(String(me?.interests || '').split(',').map((s) => s.trim()).filter(Boolean));

    const rows = await db.all(
      `SELECT u.id, u.name, u.avatar, u.title, u.badge, u.verified, u.interests,
              (SELECT COUNT(*) FROM connections c WHERE c.target_id = u.id) AS followers,
              (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS posts
         FROM users u
        WHERE u.id != ?
          AND u.id NOT IN (SELECT target_id FROM connections WHERE user_id = ?)
        ORDER BY followers DESC, posts DESC
        LIMIT 60`,
      [req.user.id, req.user.id]
    );

    const scored = rows.map((r) => {
      const theirs = String(r.interests || '').split(',').map((s) => s.trim()).filter(Boolean);
      const overlap = theirs.filter((t) => mine.has(t)).length;
      const { interests, ...clean } = r;
      return { ...clean, overlap };
    });
    // Overlap first, then existing follower/posts order preserved by stable sort.
    scored.sort((a, b) => b.overlap - a.overlap);
    res.json({ suggestions: scored.slice(0, 12) });
  } catch (err) {
    console.error('[onboarding/suggestions]', err.message);
    res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

// Save the interests picked in Step 3 of onboarding, plus an optional home city.
router.post('/interests', auth, async (req, res) => {
  try {
    const raw = Array.isArray(req.body.interests) ? req.body.interests : [];
    const cleaned = Array.from(
      new Set(raw.map((s) => String(s || '').trim().toLowerCase()).filter((s) => s && s.length <= 30))
    ).slice(0, 20);
    const city = String(req.body.home_city || '').trim().slice(0, 60);
    await db.run(
      'UPDATE users SET interests = ?, home_city = ? WHERE id = ?',
      [cleaned.join(','), city, req.user.id]
    );
    res.json({ ok: true, interests: cleaned, home_city: city });
  } catch (err) {
    console.error('[onboarding/interests]', err.message);
    res.status(500).json({ error: 'Failed to save interests' });
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
