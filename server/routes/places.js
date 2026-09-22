// server/routes/places.js
// Places — the third brand pillar. Canonical venues that posts, saves and
// visits all point at.
//
// Conventions this file follows:
//   - Every route is behind auth (the mount in app.js does not, so we do here).
//   - Blocking is enforced on any route that names *users* — a place is not a
//     user, but "friends who visited" and "top stories" must exclude blocked
//     accounts (server/lib/blocking.js).
//   - No route returns a raw error from the database. Every catch returns a
//     stable shape { error: '…' } and logs to console for the error reporter
//     to pick up.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { excludeBlocked } = require('../lib/blocking');
const { countryOf } = require('../lib/clientCountry');

const router = express.Router();

// ── Utilities ───────────────────────────────────────────────────────────────
// Haversine distance in kilometres. Cheap enough to compute per row for the
// tens of rows a nearby query returns; use a bounding-box prefilter first to
// avoid full-table scans.
function distanceKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// A place row for the client. Includes the current viewer's saved/visited state
// so the UI doesn't have to make a second round trip for that.
async function decorate(place, viewerId) {
  if (!place) return null;
  const [saved, visits, storiesRow] = await Promise.all([
    db.get(
      'SELECT 1 as x FROM saved_places WHERE user_id = ? AND place_id = ?',
      [viewerId, place.id]
    ),
    db.get(
      'SELECT COUNT(*) as c FROM place_visits WHERE place_id = ?',
      [place.id]
    ),
    db.get('SELECT COUNT(*) as c FROM posts WHERE place_id = ?', [place.id]),
  ]);
  return {
    ...place,
    saved: !!saved,
    visit_count: visits?.c || 0,
    story_count: storiesRow?.c || 0,
  };
}

// ── List / search ───────────────────────────────────────────────────────────
// GET /api/places?q=&city=&country=
router.get('/', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const city = (req.query.city || '').trim();
    const country = (req.query.country || '').trim().toUpperCase();
    const clauses = [];
    const args = [];
    if (q) {
      clauses.push('(name LIKE ? OR category LIKE ? OR city LIKE ?)');
      const wild = `%${q}%`;
      args.push(wild, wild, wild);
    }
    if (city) {
      clauses.push('city = ?');
      args.push(city);
    }
    if (country) {
      clauses.push('country = ?');
      args.push(country);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.all(
      `SELECT * FROM places ${where} ORDER BY created_at DESC LIMIT 50`,
      args
    );
    const decorated = await Promise.all(rows.map((r) => decorate(r, req.user.id)));
    res.json(decorated);
  } catch (e) {
    console.error('[places] list', e.message);
    res.status(500).json({ error: 'Could not load places.' });
  }
});

// ── Nearby ──────────────────────────────────────────────────────────────────
// GET /api/places/nearby?lat=&lng=&radius_km=50
router.get('/nearby', auth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = Math.min(200, Math.max(1, parseFloat(req.query.radius_km || '50')));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng are required.' });
    }
    // Bounding box: 1 deg lat ≈ 111km, 1 deg lng ≈ 111*cos(lat) km.
    const dLat = radius / 111;
    const dLng = radius / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    const rows = await db.all(
      `SELECT * FROM places
        WHERE lat IS NOT NULL AND lng IS NOT NULL
          AND lat BETWEEN ? AND ?
          AND lng BETWEEN ? AND ?
        LIMIT 200`,
      [lat - dLat, lat + dLat, lng - dLng, lng + dLng]
    );
    const withDist = rows
      .map((r) => ({ ...r, distance_km: distanceKm(lat, lng, r.lat, r.lng) }))
      .filter((r) => r.distance_km != null && r.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 50);
    const decorated = await Promise.all(withDist.map((r) => decorate(r, req.user.id)));
    res.json(decorated);
  } catch (e) {
    console.error('[places] nearby', e.message);
    res.status(500).json({ error: 'Could not load nearby places.' });
  }
});

// ── Trending ────────────────────────────────────────────────────────────────
// GET /api/places/trending — highest activity in the last 30 days.
router.get('/trending', auth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT p.*,
              (SELECT COUNT(*) FROM place_visits v WHERE v.place_id = p.id AND v.created_at > datetime('now','-30 days')) AS recent_visits,
              (SELECT COUNT(*) FROM posts       po WHERE po.place_id = p.id AND po.created_at > datetime('now','-30 days')) AS recent_stories
         FROM places p
     ORDER BY (recent_visits + recent_stories) DESC, p.created_at DESC
        LIMIT 30`
    );
    const decorated = await Promise.all(rows.map((r) => decorate(r, req.user.id)));
    res.json(decorated.filter((r) => (r.visit_count + r.story_count) > 0));
  } catch (e) {
    console.error('[places] trending', e.message);
    res.status(500).json({ error: 'Could not load trending places.' });
  }
});

// ── Saved ───────────────────────────────────────────────────────────────────
// GET /api/places/saved — the viewer's Want-to-go list.
router.get('/saved', auth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT p.* FROM places p
         JOIN saved_places sp ON sp.place_id = p.id
        WHERE sp.user_id = ?
     ORDER BY sp.created_at DESC`,
      [req.user.id]
    );
    const decorated = await Promise.all(rows.map((r) => decorate(r, req.user.id)));
    res.json(decorated);
  } catch (e) {
    console.error('[places] saved', e.message);
    res.status(500).json({ error: 'Could not load saved places.' });
  }
});

// ── Visited ─────────────────────────────────────────────────────────────────
// GET /api/places/visited — distinct places, most-recent visit first.
router.get('/visited', auth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT p.*, MAX(v.created_at) AS last_visit, COUNT(v.id) AS my_visits
         FROM places p
         JOIN place_visits v ON v.place_id = p.id
        WHERE v.user_id = ?
     GROUP BY p.id
     ORDER BY last_visit DESC`,
      [req.user.id]
    );
    const decorated = await Promise.all(rows.map((r) => decorate(r, req.user.id)));
    res.json(decorated);
  } catch (e) {
    console.error('[places] visited', e.message);
    res.status(500).json({ error: 'Could not load visited places.' });
  }
});

// ── Trips (grouped by country) ──────────────────────────────────────────────
// GET /api/trips — one row per country the viewer has visited, with
// aggregates for the Places → Trips view.
router.get('/trips-summary', auth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT v.country AS country,
              COUNT(DISTINCT v.place_id) AS place_count,
              COUNT(DISTINCT v.id) AS visit_count,
              MAX(v.created_at) AS last_visit
         FROM place_visits v
        WHERE v.user_id = ? AND v.country != ''
     GROUP BY v.country
     ORDER BY last_visit DESC`,
      [req.user.id]
    );
    // Story counts joined per country by way of the visited places.
    const withStories = await Promise.all(
      rows.map(async (row) => {
        const story = await db.get(
          `SELECT COUNT(*) as c FROM posts po
             JOIN places p ON p.id = po.place_id
            WHERE po.user_id = ? AND p.country = ?`,
          [req.user.id, row.country]
        );
        return { ...row, story_count: story?.c || 0 };
      })
    );
    res.json(withStories);
  } catch (e) {
    console.error('[places] trips-summary', e.message);
    res.status(500).json({ error: 'Could not load trips.' });
  }
});

// ── Create ──────────────────────────────────────────────────────────────────
// POST /api/places  { name, category?, city?, country?, lat?, lng?, cover_url? }
router.post('/', auth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'A name is required.' });
    if (name.length > 100) return res.status(400).json({ error: 'That name is too long.' });
    const category = String(req.body.category || '').trim().slice(0, 40);
    const city = String(req.body.city || '').trim().slice(0, 60);
    // Only keep a country if it's a valid ISO code (matches lib/clientCountry).
    const rawCountry = String(req.body.country || '').trim().toUpperCase();
    const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : '';
    const lat = req.body.lat != null && Number.isFinite(+req.body.lat) ? +req.body.lat : null;
    const lng = req.body.lng != null && Number.isFinite(+req.body.lng) ? +req.body.lng : null;
    const cover = String(req.body.cover_url || '').trim().slice(0, 500);

    const { lastInsertRowid } = await db.run(
      `INSERT INTO places (name, category, city, country, lat, lng, cover_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, city, country, lat, lng, cover, req.user.id]
    );
    const place = await db.get('SELECT * FROM places WHERE id = ?', [lastInsertRowid]);
    res.status(201).json(await decorate(place, req.user.id));
  } catch (e) {
    console.error('[places] create', e.message);
    res.status(500).json({ error: 'Could not create that place.' });
  }
});

// ── Profile ─────────────────────────────────────────────────────────────────
// GET /api/places/:id — cover, aggregates, friends who visited, top stories.
router.get('/:id(\\d+)', auth, async (req, res) => {
  try {
    const place = await db.get('SELECT * FROM places WHERE id = ?', [req.params.id]);
    if (!place) return res.status(404).json({ error: 'Not found.' });
    const decorated = await decorate(place, req.user.id);

    const [friends, topStories, recentStories] = await Promise.all([
      // Distinct friends (people the viewer connects to) who visited, capped
      // and excluding blocked accounts.
      db.all(
        `SELECT DISTINCT u.id, u.name, u.avatar
           FROM place_visits v
           JOIN users u ON u.id = v.user_id
           JOIN connections c ON c.target_id = v.user_id AND c.user_id = ?
          WHERE v.place_id = ?
            AND ${excludeBlocked('u.id')}
          LIMIT 20`,
        [req.user.id, req.params.id, req.user.id, req.user.id]
      ),
      // Highest-engagement recent posts anchored to this place.
      db.all(
        `SELECT p.id, p.content, p.image_url, p.created_at, p.user_id,
                u.name, u.avatar,
                (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) AS cheer_count
           FROM posts p
           JOIN users u ON u.id = p.user_id
          WHERE p.place_id = ?
            AND ${excludeBlocked('p.user_id')}
       ORDER BY cheer_count DESC, p.created_at DESC
          LIMIT 6`,
        [req.params.id, req.user.id, req.user.id]
      ),
      db.all(
        `SELECT p.id, p.content, p.image_url, p.created_at, p.user_id,
                u.name, u.avatar
           FROM posts p
           JOIN users u ON u.id = p.user_id
          WHERE p.place_id = ?
            AND ${excludeBlocked('p.user_id')}
       ORDER BY p.created_at DESC
          LIMIT 12`,
        [req.params.id, req.user.id, req.user.id]
      ),
    ]);

    res.json({
      ...decorated,
      friends,
      top_stories: topStories,
      recent_stories: recentStories,
    });
  } catch (e) {
    console.error('[places] profile', e.message);
    res.status(500).json({ error: 'Could not load that place.' });
  }
});

// ── Save toggle ─────────────────────────────────────────────────────────────
// POST /api/places/:id/save  → { saved: true|false }
router.post('/:id(\\d+)/save', auth, async (req, res) => {
  try {
    const placeId = parseInt(req.params.id, 10);
    const exists = await db.get('SELECT 1 as x FROM places WHERE id = ?', [placeId]);
    if (!exists) return res.status(404).json({ error: 'Not found.' });
    const already = await db.get(
      'SELECT 1 as x FROM saved_places WHERE user_id = ? AND place_id = ?',
      [req.user.id, placeId]
    );
    if (already) {
      await db.run(
        'DELETE FROM saved_places WHERE user_id = ? AND place_id = ?',
        [req.user.id, placeId]
      );
      return res.json({ saved: false });
    }
    await db.run(
      'INSERT INTO saved_places (user_id, place_id) VALUES (?, ?)',
      [req.user.id, placeId]
    );
    res.json({ saved: true });
  } catch (e) {
    console.error('[places] save', e.message);
    res.status(500).json({ error: 'Could not update that.' });
  }
});

// ── Visit ───────────────────────────────────────────────────────────────────
// POST /api/places/:id/visit — mark "been here". Multiple visits allowed.
router.post('/:id(\\d+)/visit', auth, async (req, res) => {
  try {
    const placeId = parseInt(req.params.id, 10);
    const place = await db.get('SELECT * FROM places WHERE id = ?', [placeId]);
    if (!place) return res.status(404).json({ error: 'Not found.' });
    // The viewer's country wins the tie against the place's country only when
    // the place has none — so a place entered without a country still ends up
    // in the right Trips bucket.
    const country = place.country || countryOf(req);
    await db.run(
      'INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)',
      [req.user.id, placeId, country]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[places] visit', e.message);
    res.status(500).json({ error: 'Could not record that visit.' });
  }
});

module.exports = router;
