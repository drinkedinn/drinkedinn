// server/test/placesPillars.test.js
//
// Collection ("been there") and Bucket list ("want to go") used to be a shelf
// of bottles and a list of drinks. They are views over place_visits and
// saved_places now — the SAME rows the Places pillar reads, deliberately, so
// the Visited tab and the Collection tab cannot disagree about where someone
// has been.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const { db, setup, makeUser } = require('./helpers');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { createApp } = require('../app');

let server, port, alice, token, placeA, placeB;
const sign = (u) => jwt.sign({ sub: u.id, tv: 0, purpose: 'session' }, config.jwtSecret, { algorithm: 'HS256' });

function call(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      port, method, path,
      headers: { authorization: `Bearer ${token}`,
        ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => { let j=null; try { j=JSON.parse(raw); } catch {} resolve({ code: res.statusCode, body: j, raw }); });
    });
    req.on('error', () => resolve({ code: 0, body: null, raw: '' }));
    if (data) req.write(data);
    req.end();
  });
}

const mkPlace = async (name) => Number((await db.run(
  `INSERT INTO places (name, category, city, country, lat, lng, created_by, created_at)
   VALUES (?, 'bar', 'Kampala', 'UG', 0.34, 32.58, ?, ?)`, [name, alice.id, Date.now()])).lastInsertRowid);

before(async () => {
  await setup();
  alice = await makeUser({});
  token = sign(alice);
  placeA = await mkPlace('The Lawns');
  placeB = await mkPlace('Sky Lounge');
  server = http.createServer(createApp({ isWorker: false }));
  await new Promise(r => server.listen(0, r));
  port = server.address().port;
});
after(() => { if (server) server.close(); });

describe('collection — places you have been', () => {
  test('groups repeat visits into one place with a count', async () => {
    await call('POST', '/api/collection', { place_id: placeA });
    await call('POST', '/api/collection', { place_id: placeA });
    const res = await call('GET', '/api/collection');
    assert.equal(res.code, 200);
    const row = res.body.find(r => String(r.place_id) === String(placeA));
    assert.ok(row, 'the visited place is missing from the collection');
    // place_visits is a log; the collection is a set.
    assert.equal(res.body.filter(r => String(r.place_id) === String(placeA)).length, 1, 'the same place appears twice');
    assert.equal(Number(row.visit_count), 2);
    assert.equal(row.name, 'The Lawns');
  });

  test('it is the same rows the Places pillar reads', async () => {
    const direct = await db.all('SELECT COUNT(*) AS c FROM place_visits WHERE user_id = ? AND place_id = ?', [alice.id, placeA]);
    assert.equal(Number(direct[0].c), 2, 'writes did not land in place_visits');
  });

  test('removing a place drops every visit to it', async () => {
    assert.equal((await call('DELETE', `/api/collection/${placeA}`)).code, 200);
    assert.equal((await db.all('SELECT 1 FROM place_visits WHERE user_id = ? AND place_id = ?', [alice.id, placeA])).length, 0);
  });

  test('refuses a place that does not exist', async () => {
    assert.equal((await call('POST', '/api/collection', { place_id: 999999 })).code, 404);
    assert.equal((await call('POST', '/api/collection', {})).code, 400);
  });
});

describe('bucket list — places you want to go', () => {
  test('saving twice does not duplicate', async () => {
    await call('POST', '/api/bucketlist', { place_id: placeB });
    await call('POST', '/api/bucketlist', { place_id: placeB });
    const res = await call('GET', '/api/bucketlist');
    assert.equal(res.body.filter(r => String(r.place_id) === String(placeB)).length, 1);
  });

  test('ticking it off moves it from want-to-go to been', async () => {
    const res = await call('PATCH', `/api/bucketlist/${placeB}/check`);
    assert.equal(res.code, 200, res.raw.slice(0, 100));

    const stillSaved = await db.all('SELECT 1 FROM saved_places WHERE user_id = ? AND place_id = ?', [alice.id, placeB]);
    const visited = await db.all('SELECT 1 FROM place_visits WHERE user_id = ? AND place_id = ?', [alice.id, placeB]);
    assert.equal(stillSaved.length, 0, 'it is still on the want-to-go list after being ticked off');
    assert.equal(visited.length, 1, 'ticking it off did not record the visit');

    // And it now shows up in the other pillar, which is the point of sharing rows.
    const col = await call('GET', '/api/collection');
    assert.ok(col.body.some(r => String(r.place_id) === String(placeB)), 'ticked-off place is missing from the collection');
  });

  test('cannot tick off something that is not on the list', async () => {
    assert.equal((await call('PATCH', `/api/bucketlist/${placeB}/check`)).code, 404);
  });
});
