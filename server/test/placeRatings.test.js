// server/test/placeRatings.test.js
//
// Ratings used to score bottles (drink_name, distillery, nose, palate,
// finish). They score PLACES now. These run the real routes over HTTP, because
// the interesting behaviour is in the upsert and the join rather than in any
// single function.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const { db, setup, makeUser } = require('./helpers');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { createApp } = require('../app');

let server, port, alice, bob, token, bobToken, placeId, otherPlaceId;

const sign = (u) => jwt.sign({ sub: u.id, tv: 0, purpose: 'session' }, config.jwtSecret, { algorithm: 'HS256' });

function call(method, path, body, tok) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      port, method, path,
      headers: {
        authorization: `Bearer ${tok}`,
        ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (d) => { raw += d; });
      res.on('end', () => {
        let json = null; try { json = JSON.parse(raw); } catch {}
        resolve({ code: res.statusCode, body: json, raw });
      });
    });
    req.on('error', () => resolve({ code: 0, body: null, raw: '' }));
    if (data) req.write(data);
    req.end();
  });
}

before(async () => {
  await setup();
  alice = await makeUser({});
  bob = await makeUser({});
  token = sign(alice);
  bobToken = sign(bob);

  const a = await db.run(
    `INSERT INTO places (name, category, city, country, lat, lng, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['The Lawns', 'bar', 'Kampala', 'UG', 0.34, 32.58, alice.id, Date.now()]
  );
  placeId = Number(a.lastInsertRowid);
  const b = await db.run(
    `INSERT INTO places (name, category, city, country, lat, lng, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Sky Lounge', 'bar', 'Kampala', 'UG', 0.33, 32.57, alice.id, Date.now()]
  );
  otherPlaceId = Number(b.lastInsertRowid);

  server = http.createServer(createApp({ isWorker: false }));
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});

after(() => { if (server) server.close(); });

describe('place ratings', () => {
  test('rates a place and returns it with the place attached', async () => {
    const res = await call('POST', '/api/ratings', { place_id: placeId, rating: 4.5, note: 'Great at sunset' }, token);
    assert.equal(res.code, 200, res.raw.slice(0, 120));
    assert.equal(res.body.place_id, placeId);
    assert.equal(res.body.rating, 4.5);
    // Joined, so a profile row needs no second request per rating — the N+1
    // shape that broke Places before.
    assert.equal(res.body.place_name, 'The Lawns');
    assert.equal(res.body.city, 'Kampala');
  });

  test('rating the same place again replaces rather than duplicates', async () => {
    await call('POST', '/api/ratings', { place_id: placeId, rating: 2, note: 'Changed my mind' }, token);
    const rows = await db.all('SELECT rating, note FROM place_ratings WHERE user_id = ? AND place_id = ?', [alice.id, placeId]);
    assert.equal(rows.length, 1, 'a second rating created a duplicate row');
    assert.equal(Number(rows[0].rating), 2);
    assert.equal(rows[0].note, 'Changed my mind');
  });

  test('refuses a score outside the scale, and a missing place', async () => {
    assert.equal((await call('POST', '/api/ratings', { place_id: placeId, rating: 11 }, token)).code, 400);
    assert.equal((await call('POST', '/api/ratings', { place_id: placeId, rating: 0 }, token)).code, 400);
    assert.equal((await call('POST', '/api/ratings', { rating: 3 }, token)).code, 400);
    assert.equal((await call('POST', '/api/ratings', { place_id: 999999, rating: 3 }, token)).code, 404);
  });

  test('a place profile shows every rating plus the average', async () => {
    await call('POST', '/api/ratings', { place_id: placeId, rating: 4 }, bobToken);
    const res = await call('GET', `/api/ratings/place/${placeId}`, null, token);
    assert.equal(res.code, 200);
    assert.equal(res.body.count, 2);
    assert.equal(res.body.average, 3, `expected (2 + 4) / 2, got ${res.body.average}`);
    assert.equal(res.body.ratings.length, 2);
  });

  test('a blocked member disappears from a place he rated', async () => {
    await db.run('INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)',
      [alice.id, bob.id, Date.now()]);
    const res = await call('GET', `/api/ratings/place/${placeId}`, null, token);
    assert.equal(res.body.ratings.length, 1, "a blocked member's rating is still visible");
    await db.run('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [alice.id, bob.id]);
  });

  test('only the author can delete their rating', async () => {
    const mine = await db.get('SELECT id FROM place_ratings WHERE user_id = ? AND place_id = ?', [alice.id, placeId]);
    assert.equal((await call('DELETE', `/api/ratings/${mine.id}`, null, bobToken)).code, 403);
    assert.equal((await call('DELETE', `/api/ratings/${mine.id}`, null, token)).code, 200);
    assert.equal((await db.all('SELECT 1 FROM place_ratings WHERE id = ?', [mine.id])).length, 0);
  });

  test('erasing an account takes its ratings with it', async () => {
    await call('POST', '/api/ratings', { place_id: otherPlaceId, rating: 5 }, bobToken);
    assert.ok((await db.all('SELECT 1 FROM place_ratings WHERE user_id = ?', [bob.id])).length > 0);
    const { deleteUserCompletely } = require('../lib/deleteUser');
    await deleteUserCompletely(bob.id);
    assert.equal((await db.all('SELECT 1 FROM place_ratings WHERE user_id = ?', [bob.id])).length, 0,
      'place_ratings survived account deletion — it is missing from OWNED');
  });
});
