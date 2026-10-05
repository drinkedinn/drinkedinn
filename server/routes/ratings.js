// server/routes/ratings.js
// What members thought of PLACES they went to.
//
// This used to score bottles: drink_name, distillery, nose, palate, finish.
// The subject is the place now, so the shape is a score, an optional note, and
// enough of the place joined in that a client can render a row without a
// second request.
//
// Reads are PUBLIC-by-user (?user_id=) because a profile shows someone's
// ratings; writes are always the caller's own.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { excludeBlocked } = require('../lib/blocking');

const router = express.Router();

const MIN_RATING = 1;
const MAX_RATING = 5;
const MAX_NOTE = 500;

// A rating row with its place attached. Without the join a profile would have
// to fetch each place separately — one query per row, which is the N+1 shape
// that broke the Places pillar before (see CLOUDFLARE.md on the subrequest cap).
const SELECT = `
  SELECT r.id, r.rating, r.note, r.created_at,
         r.place_id,
         p.name AS place_name, p.city, p.country, p.category, p.cover_url
    FROM place_ratings r
    JOIN places p ON p.id = r.place_id
`;

router.get('/', auth, async (req, res) => {
  const uid = req.query.user_id || req.user.id;
  try {
    const rows = await db.all(
      `${SELECT} WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 100`,
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error('[ratings] list', err.message);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Every rating a place has, for the place profile. Blocked members are filtered
// so someone you blocked cannot keep appearing under a venue you both rated.
router.get('/place/:placeId', auth, async (req, res) => {
  try {
    const rows = await db.all(
      `${SELECT}
         JOIN users u ON u.id = r.user_id
        WHERE r.place_id = ? AND ${excludeBlocked('r.user_id')}
     ORDER BY r.created_at DESC
        LIMIT 50`,
      [req.params.placeId, req.user.id, req.user.id]
    );
    const agg = await db.get(
      'SELECT COUNT(*) AS count, AVG(rating) AS average FROM place_ratings WHERE place_id = ?',
      [req.params.placeId]
    );
    res.json({ ratings: rows, count: agg?.count || 0, average: agg?.average ? Number(agg.average.toFixed(2)) : null });
  } catch (err) {
    console.error('[ratings] by place', err.message);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

router.post('/', auth, async (req, res) => {
  const placeId = Number(req.body?.place_id);
  const rating = Number(req.body?.rating);
  const note = String(req.body?.note || '').slice(0, MAX_NOTE);

  if (!Number.isInteger(placeId) || placeId <= 0) {
    return res.status(400).json({ error: 'Which place are you rating?' });
  }
  if (!Number.isFinite(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    return res.status(400).json({ error: `Give it between ${MIN_RATING} and ${MAX_RATING}.` });
  }

  try {
    const place = await db.get('SELECT id FROM places WHERE id = ?', [placeId]);
    if (!place) return res.status(404).json({ error: 'That place no longer exists.' });

    // One rating per member per place. Rating somewhere twice is changing your
    // mind, not adding a second opinion, so the upsert replaces rather than
    // appending — which is what the UNIQUE index in db.js enforces anyway.
    await db.run(
      `INSERT INTO place_ratings (user_id, place_id, rating, note)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, place_id)
       DO UPDATE SET rating = excluded.rating, note = excluded.note, created_at = CURRENT_TIMESTAMP`,
      [req.user.id, placeId, rating, note]
    );

    const row = await db.get(`${SELECT} WHERE r.user_id = ? AND r.place_id = ?`, [req.user.id, placeId]);
    res.json(row);
  } catch (err) {
    console.error('[ratings] create', err.message);
    res.status(500).json({ error: 'Failed to save that rating' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await db.get('SELECT user_id FROM place_ratings WHERE id = ?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (String(r.user_id) !== String(req.user.id)) return res.status(403).json({ error: 'Not yours' });
    await db.run('DELETE FROM place_ratings WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[ratings] delete', err.message);
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

module.exports = router;
