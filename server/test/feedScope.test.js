// server/test/feedScope.test.js
// The Following feed must be scoped by the SERVER.
//
// It used to be a client-side filter over whatever the last 80 posts happened
// to contain, which meant someone following nobody still saw a populated tab,
// and someone following fifty people saw only those among the recent 80.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');

const { db, setup, makeUser, makePost } = require('./helpers');

// The same SQL shape routes/posts.js builds for ?scope=following.
const FOLLOWING_SQL = `
  SELECT p.id, p.user_id,
    (SELECT COUNT(*) FROM connections WHERE user_id = ? AND target_id = p.user_id) as user_connected
  FROM posts p
  WHERE (p.user_id = ? OR p.user_id IN (SELECT target_id FROM connections WHERE user_id = ?))
  ORDER BY p.created_at DESC LIMIT 80`;

describe('following scope', () => {
  let me, followed, stranger;

  before(async () => {
    await setup();
    me = await makeUser();
    followed = await makeUser();
    stranger = await makeUser();
    await db.run('INSERT INTO connections (user_id, target_id) VALUES (?, ?)', [me.id, followed.id]);
    await makePost(me.id, 'mine');
    await makePost(followed.id, 'from someone I follow');
    await makePost(stranger.id, 'from a stranger');
  });

  test('shows my posts and the people I follow, and nobody else', async () => {
    const rows = await db.all(FOLLOWING_SQL, [me.id, me.id, me.id]);
    const authors = rows.map((r) => r.user_id).sort();
    assert.deepEqual(authors, [me.id, followed.id].sort());
    assert.ok(!authors.includes(stranger.id), 'a stranger must not appear in Following');
  });

  test('following nobody shows only my own posts — never a populated tab', async () => {
    const lonely = await makeUser();
    await makePost(lonely.id, 'my only pour');
    const rows = await db.all(FOLLOWING_SQL, [lonely.id, lonely.id, lonely.id]);
    assert.equal(rows.length, 1, 'exactly my own post');
    assert.equal(rows[0].user_id, lonely.id);
  });

  test('a brand-new account with no posts sees an empty Following feed', async () => {
    const fresh = await makeUser();
    const rows = await db.all(FOLLOWING_SQL, [fresh.id, fresh.id, fresh.id]);
    assert.equal(rows.length, 0, 'empty, not "everyone"');
  });

  test('user_connected is real, so the client-side safety net cannot widen it', async () => {
    const rows = await db.all(FOLLOWING_SQL, [me.id, me.id, me.id]);
    const followedRow = rows.find((r) => r.user_id === followed.id);
    assert.ok(followedRow.user_connected > 0, 'a followed author reports connected');
    const mine = rows.find((r) => r.user_id === me.id);
    assert.equal(mine.user_connected, 0, 'I do not follow myself — own posts pass on the id check');
  });
});
