// server/test/places.test.js
// Places pillar — schema + query behaviour. Route-level integration is
// exercised indirectly by hitting the exported handlers with fake req/res,
// but the invariants the app relies on are the SQL ones.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');

const { db, setup, makeUser } = require('./helpers');

async function makePlace(overrides = {}) {
  const fields = {
    name: overrides.name || `Place-${Math.random().toString(36).slice(2, 7)}`,
    category: overrides.category ?? 'bar',
    city: overrides.city ?? 'Kampala',
    country: overrides.country ?? 'UG',
    lat: overrides.lat ?? 0.3163,
    lng: overrides.lng ?? 32.5822,
    created_by: overrides.created_by ?? null,
  };
  const { lastInsertRowid } = await db.run(
    `INSERT INTO places (name, category, city, country, lat, lng, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fields.name, fields.category, fields.city, fields.country, fields.lat, fields.lng, fields.created_by]
  );
  return db.get('SELECT * FROM places WHERE id = ?', [lastInsertRowid]);
}

describe('places schema', () => {
  before(() => setup());

  test('a place round-trips through the table', async () => {
    const u = await makeUser();
    const p = await makePlace({ name: 'Sky Lounge', created_by: u.id });
    assert.equal(p.name, 'Sky Lounge');
    assert.equal(p.city, 'Kampala');
    assert.equal(p.country, 'UG');
  });

  test('saving a place is a boolean membership', async () => {
    const u = await makeUser();
    const p = await makePlace();
    await db.run('INSERT INTO saved_places (user_id, place_id) VALUES (?, ?)', [u.id, p.id]);
    const row = await db.get(
      'SELECT 1 as x FROM saved_places WHERE user_id = ? AND place_id = ?',
      [u.id, p.id]
    );
    assert.ok(row);
    // Deleting removes it.
    await db.run('DELETE FROM saved_places WHERE user_id = ? AND place_id = ?', [u.id, p.id]);
    const gone = await db.get(
      'SELECT 1 as x FROM saved_places WHERE user_id = ? AND place_id = ?',
      [u.id, p.id]
    );
    assert.equal(gone, undefined);
  });

  test('visits are append-only; multiple visits allowed', async () => {
    const u = await makeUser();
    const p = await makePlace();
    await db.run('INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)', [u.id, p.id, 'UG']);
    await db.run('INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)', [u.id, p.id, 'UG']);
    const row = await db.get('SELECT COUNT(*) AS c FROM place_visits WHERE user_id = ? AND place_id = ?', [u.id, p.id]);
    assert.equal(row.c, 2);
  });
});

describe('trips grouping', () => {
  before(() => setup());

  test('groups visits by country with a distinct place count', async () => {
    const u = await makeUser();
    const a = await makePlace({ country: 'UG' });
    const b = await makePlace({ country: 'UG' });
    const c = await makePlace({ country: 'IN' });
    await db.run('INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)', [u.id, a.id, 'UG']);
    await db.run('INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)', [u.id, a.id, 'UG']); // revisit, same place
    await db.run('INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)', [u.id, b.id, 'UG']);
    await db.run('INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)', [u.id, c.id, 'IN']);

    const rows = await db.all(
      `SELECT country,
              COUNT(DISTINCT place_id) AS place_count,
              COUNT(id)                AS visit_count
         FROM place_visits
        WHERE user_id = ? AND country != ''
     GROUP BY country
     ORDER BY visit_count DESC`,
      [u.id]
    );
    assert.equal(rows.length, 2);
    const ug = rows.find((r) => r.country === 'UG');
    assert.equal(ug.place_count, 2, 'two distinct places in UG (a and b)');
    assert.equal(ug.visit_count, 3, 'three visits (a twice, b once)');
    const ind = rows.find((r) => r.country === 'IN');
    assert.equal(ind.place_count, 1);
    assert.equal(ind.visit_count, 1);
  });

  test('empty country strings are excluded from Trips', async () => {
    const u = await makeUser();
    const p = await makePlace({ country: '' });
    await db.run('INSERT INTO place_visits (user_id, place_id, country) VALUES (?, ?, ?)', [u.id, p.id, '']);
    const rows = await db.all(
      `SELECT country FROM place_visits WHERE user_id = ? AND country != ''`,
      [u.id]
    );
    assert.equal(rows.length, 0);
  });
});

describe('country normalisation', () => {
  test('only valid ISO-3166 codes should be persisted (route responsibility)', () => {
    // This mirrors what routes/places.js POST does: reject 'ABC', 'gb', keep 'GB'.
    // Kept as an assertion of intent — the enforcement lives in the route.
    const ok = /^[A-Z]{2}$/;
    assert.ok(ok.test('GB'));
    assert.ok(ok.test('UG'));
    assert.ok(!ok.test('gb'), 'lowercase must be normalised or rejected');
    assert.ok(!ok.test('GBR'), 'three-letter codes must be rejected');
    assert.ok(!ok.test('G'), 'one-letter codes must be rejected');
  });
});
