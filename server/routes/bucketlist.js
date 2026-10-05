// server/routes/bucketlist.js
// Places you want to go.
//
// This was a list of drinks to try. The subject is places now, and the data
// already existed — saved_places is written by the Save control on every place
// card. Like collection.js this is a view rather than a second store, so the
// Saved tab and this list cannot disagree.
//
// The one piece of real behaviour is ticking something off. On a drinks list
// that was a `checked` flag. For a place, having been is not a flag — it is a
// visit, which the app already records. So checking an item off writes a
// place_visits row and drops it from saved_places: it moves from "want to go"
// to "been", which is what ticking it actually means.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { countryOf } = require('../lib/clientCountry');

const router = express.Router();

const SELECT = `
  SELECT p.id AS place_id,
         p.name, p.category, p.city, p.country, p.cover_url, p.lat, p.lng,
         sp.created_at AS saved_at
    FROM saved_places sp
    JOIN places p ON p.id = sp.place_id
   WHERE sp.user_id = ?
ORDER BY sp.created_at DESC
   LIMIT 200
`;

router.get('/', auth, async (req, res) => {
  const uid = req.query.user_id || req.user.id;
  try {
    res.json(await db.all(SELECT, [uid]));
  } catch (err) {
    console.error('[bucketlist] list', err.message);
    res.status(500).json({ error: 'Failed to fetch your list' });
  }
});

router.post('/', auth, async (req, res) => {
  const placeId = Number(req.body?.place_id);
  if (!Number.isInteger(placeId) || placeId <= 0) {
    return res.status(400).json({ error: 'Which place do you want to go to?' });
  }
  try {
    const place = await db.get('SELECT id FROM places WHERE id = ?', [placeId]);
    if (!place) return res.status(404).json({ error: 'That place no longer exists.' });

    // OR IGNORE: saving twice is not an error, it is the same intent twice.
    await db.run('INSERT OR IGNORE INTO saved_places (user_id, place_id) VALUES (?, ?)', [req.user.id, placeId]);

    const rows = await db.all(SELECT, [req.user.id]);
    res.json(rows.find((r) => String(r.place_id) === String(placeId)) || { place_id: placeId });
  } catch (err) {
    console.error('[bucketlist] add', err.message);
    res.status(500).json({ error: 'Could not add that place' });
  }
});

// Tick it off: you went. Records the visit and removes it from the list.
router.patch('/:placeId/check', auth, async (req, res) => {
  const placeId = Number(req.params.placeId);
  if (!Number.isInteger(placeId) || placeId <= 0) return res.status(400).json({ error: 'Bad place id' });
  try {
    const saved = await db.get(
      'SELECT 1 AS x FROM saved_places WHERE user_id = ? AND place_id = ?',
      [req.user.id, placeId]
    );
    if (!saved) return res.status(404).json({ error: 'That place is not on your list.' });

    const place = await db.get('SELECT country FROM places WHERE id = ?', [placeId]);

    // One batch, so a crash between the two cannot leave a place both saved
    // and visited — or neither.
    await db.batch([
      {
        sql: 'INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)',
        args: [req.user.id, placeId, place?.country || countryOf(req) || ''],
      },
      {
        sql: 'DELETE FROM saved_places WHERE user_id = ? AND place_id = ?',
        args: [req.user.id, placeId],
      },
    ]);

    res.json({ checked: true, visited: true, place_id: placeId });
  } catch (err) {
    console.error('[bucketlist] check', err.message);
    res.status(500).json({ error: 'Could not tick that off' });
  }
});

router.delete('/:placeId', auth, async (req, res) => {
  const placeId = Number(req.params.placeId);
  if (!Number.isInteger(placeId) || placeId <= 0) return res.status(400).json({ error: 'Bad place id' });
  try {
    await db.run('DELETE FROM saved_places WHERE user_id = ? AND place_id = ?', [req.user.id, placeId]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[bucketlist] delete', err.message);
    res.status(500).json({ error: 'Failed to remove that place' });
  }
});

module.exports = router;
