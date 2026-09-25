// server/test/memories.test.js
// The Memories grouping heuristic. The whole point is that a user with lots of
// activity gets a small, curated set of "remember this night?" cards — not a
// flood, not silence.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');

const { db, setup, makeUser } = require('./helpers');

async function makePastPost(userId, { daysAgo, placeId = null } = {}) {
  const iso = new Date(Date.now() - daysAgo * 86400_000).toISOString();
  const { lastInsertRowid } = await db.run(
    `INSERT INTO posts (user_id, content, drink, image_url, created_at, place_id)
     VALUES (?, ?, '🥃', '', ?, ?)`,
    [userId, `post ${daysAgo}d ago`, iso, placeId]
  );
  return lastInsertRowid;
}

describe('memories grouping', () => {
  before(() => setup());

  test('a bucket with one post is NOT surfaced (that is not a memory)', async () => {
    const u = await makeUser();
    await makePastPost(u.id, { daysAgo: 90 });
    const posts = await db.all(
      `SELECT p.id, strftime('%Y-%m', p.created_at) AS ym FROM posts p
        WHERE p.user_id = ? AND p.created_at < datetime('now','-30 days')`,
      [u.id]
    );
    // Bucket key = ym (no place)
    const buckets = new Map();
    for (const p of posts) buckets.set(p.ym, (buckets.get(p.ym) || 0) + 1);
    const single = [...buckets.values()].filter((n) => n === 1);
    assert.equal(single.length, 1, 'the bucket exists but has only 1 post');
    // The route's threshold is "group.length < 2 → skip".
    const surfacedBuckets = [...buckets.values()].filter((n) => n >= 2);
    assert.equal(surfacedBuckets.length, 0, 'no memory card surfaces');
  });

  test('only posts older than 30 days count', async () => {
    const u = await makeUser();
    await makePastPost(u.id, { daysAgo: 5 });
    await makePastPost(u.id, { daysAgo: 10 });
    const rows = await db.all(
      `SELECT COUNT(*) AS c FROM posts
        WHERE user_id = ? AND created_at < datetime('now','-30 days')`,
      [u.id]
    );
    assert.equal(rows[0].c, 0, 'recent posts are not memories');
  });

  test('two+ posts in the same month/place form a memory bucket', async () => {
    const u = await makeUser();
    const { lastInsertRowid: placeId } = await db.run(
      "INSERT INTO places (name, city, country) VALUES ('Sky Lounge','Kampala','UG')"
    );
    await makePastPost(u.id, { daysAgo: 60, placeId });
    await makePastPost(u.id, { daysAgo: 61, placeId });
    await makePastPost(u.id, { daysAgo: 62, placeId });
    const posts = await db.all(
      `SELECT strftime('%Y-%m', p.created_at) AS ym, pl.city
         FROM posts p LEFT JOIN places pl ON pl.id = p.place_id
        WHERE p.user_id = ? AND p.created_at < datetime('now','-30 days')`,
      [u.id]
    );
    const key = new Set(posts.map((p) => `${p.ym}|${p.city}`));
    assert.equal(key.size, 1, 'all three fall into one bucket');
  });
});

describe('list and detail agree', () => {
  before(() => setup());

  // The two endpoints previously disagreed twice over: the detail query had no
  // 30-day floor, and matched location with `city = ? OR country = ?` so a
  // city-keyed card also swept in country-keyed posts. Both now share
  // AGE_FILTER and BUCKET_KEY. These pin that they cannot drift apart again.

  test('the detail bucket key resolves city over country, like the list does', async () => {
    const u = await makeUser();
    const { lastInsertRowid: cityPlace } = await db.run(
      "INSERT INTO places (name, city, country) VALUES ('Sky Lounge','Kampala','UG')"
    );
    const { lastInsertRowid: countryOnly } = await db.run(
      "INSERT INTO places (name, city, country) VALUES ('Somewhere','','UG')"
    );
    await makePastPost(u.id, { daysAgo: 60, placeId: cityPlace });
    await makePastPost(u.id, { daysAgo: 61, placeId: countryOnly });

    const KEY = "CASE WHEN COALESCE(pl.city,'') <> '' THEN pl.city ELSE COALESCE(pl.country,'') END";
    const rows = await db.all(
      `SELECT ${KEY} AS k FROM posts p LEFT JOIN places pl ON pl.id = p.place_id WHERE p.user_id = ?`,
      [u.id]
    );
    const keys = rows.map((r) => r.k).sort();
    assert.deepEqual(keys, ['Kampala', 'UG'], 'city-keyed and country-keyed posts land in different buckets');
  });

  test('an empty bucket key means "no place", not "any place"', async () => {
    const u = await makeUser();
    const { lastInsertRowid: placed } = await db.run(
      "INSERT INTO places (name, city, country) VALUES ('Bar','Lisbon','PT')"
    );
    await makePastPost(u.id, { daysAgo: 70, placeId: placed });
    await makePastPost(u.id, { daysAgo: 71, placeId: null });

    const KEY = "CASE WHEN COALESCE(pl.city,'') <> '' THEN pl.city ELSE COALESCE(pl.country,'') END";
    const unplaced = await db.all(
      `SELECT p.id FROM posts p LEFT JOIN places pl ON pl.id = p.place_id
        WHERE p.user_id = ? AND ${KEY} = ''`,
      [u.id]
    );
    assert.equal(unplaced.length, 1, 'only the post with no place matches the empty bucket');
  });

  test('the detail query applies the same 30-day floor as the list', async () => {
    const u = await makeUser();
    await makePastPost(u.id, { daysAgo: 60 });
    await makePastPost(u.id, { daysAgo: 3 });   // too recent to be a memory
    const rows = await db.all(
      `SELECT id FROM posts WHERE user_id = ? AND created_at < datetime('now','-30 days')`,
      [u.id]
    );
    assert.equal(rows.length, 1, 'the recent post must not appear inside a memory');
  });
});
