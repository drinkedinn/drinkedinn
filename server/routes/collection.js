// server/routes/collection.js
// Places you have been.
//
// This was a shelf of bottles: name, distillery, drink_type, vintage. The
// subject is places now, and the data already existed — place_visits is
// written whenever someone marks a visit from the Places pillar.
//
// So this does NOT get its own table. A second store for the same facts means
// the Visited tab and the Collection tab can disagree about where you have
// been, and one of them is always wrong. It is a view over place_visits, and
// the writes land in the same rows the Places pillar reads.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { countryOf } = require('../lib/clientCountry');

const router = express.Router();

// Grouped by place, because place_visits is a LOG — going somewhere twice is
// two rows and one place. The collection is the set, with how often and when.
const SELECT = `
  SELECT p.id            AS place_id,
         p.name, p.category, p.city, p.country, p.cover_url, p.lat, p.lng,
         COUNT(v.id)     AS visit_count,
         MAX(v.created_at) AS last_visit
    FROM place_visits v
    JOIN places p ON p.id = v.place_id
   WHERE v.user_id = ?
GROUP BY p.id
ORDER BY last_visit DESC
   LIMIT 200
`;

router.get('/', auth, async (req, res) => {
  const uid = req.query.user_id || req.user.id;
  try {
    res.json(await db.all(SELECT, [uid]));
  } catch (err) {
    console.error('[collection] list', err.message);
    res.status(500).json({ error: 'Failed to fetch your places' });
  }
});

// Record a visit. Same table and same shape as POST /places/:id/visit, so the
// two cannot drift.
router.post('/', auth, async (req, res) => {
  const placeId = Number(req.body?.place_id);
  if (!Number.isInteger(placeId) || placeId <= 0) {
    return res.status(400).json({ error: 'Which place did you go to?' });
  }
  try {
    const place = await db.get('SELECT id, country FROM places WHERE id = ?', [placeId]);
    if (!place) return res.status(404).json({ error: 'That place no longer exists.' });

    await db.run(
      'INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)',
      [req.user.id, placeId, place.country || countryOf(req) || '']
    );

    const rows = await db.all(SELECT, [req.user.id]);
    res.json(rows.find((r) => String(r.place_id) === String(placeId)) || { place_id: placeId });
  } catch (err) {
    console.error('[collection] add', err.message);
    res.status(500).json({ error: 'Could not record that visit' });
  }
});

// Removes the PLACE from the collection, which means every visit to it — the
// collection is a set, so taking something off it halfway would leave the row
// showing with a smaller count and read like a bug.
router.delete('/:placeId', auth, async (req, res) => {
  const placeId = Number(req.params.placeId);
  if (!Number.isInteger(placeId) || placeId <= 0) return res.status(400).json({ error: 'Bad place id' });
  try {
    await db.run('DELETE FROM place_visits WHERE user_id = ? AND place_id = ?', [req.user.id, placeId]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[collection] delete', err.message);
    res.status(500).json({ error: 'Failed to remove that place' });
  }
});

module.exports = router;
