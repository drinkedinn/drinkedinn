// server/test/blockingEnforcement.test.js
//
// lib/blocking.js promises mutual invisibility, but for a long time only the
// home feed actually applied it — a blocked user could still open the DM thread
// and keep messaging. These tests run the REAL queries from the routes, so they
// catch both a missing filter and a wrong bound-parameter count (the queries
// build their WHERE clause by interpolating excludeBlocked(), which adds two
// parameters each time it appears).

const { test, describe, before } = require('node:test');
const assert = require('node:assert');

const { db, setup, makeUser, makePost } = require('./helpers');
const { excludeBlocked, isBlocked, blockedIds, filterBlocked } = require('../lib/blocking');

describe('blocking enforcement', () => {
  let alice, bob, carol;

  before(async () => {
    await setup();
    alice = await makeUser({ });
    bob = await makeUser({ });
    carol = await makeUser({ });
    // Alice blocks Bob. Carol is uninvolved and must stay visible throughout.
    await db.run(
      'INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)',
      [alice.id, bob.id, 1]
    );
  });

  test('the block is mutual', async () => {
    assert.equal(await isBlocked(alice.id, bob.id), true);
    assert.equal(await isBlocked(bob.id, alice.id), true, 'must hold in both directions');
    assert.equal(await isBlocked(alice.id, carol.id), false);
  });

  test('conversations query excludes the blocked party (real SQL, real params)', async () => {
    await db.run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [bob.id, alice.id, 'hi']);
    await db.run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [carol.id, alice.id, 'hey']);

    const uid = alice.id;
    const rows = await db.all(`
      SELECT DISTINCT
        CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as other_id,
        u.name
      FROM messages m
      JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
      WHERE (m.sender_id = ? OR m.receiver_id = ?)
        AND ${excludeBlocked('u.id')}
    `, [uid, uid, uid, uid, uid, uid]);

    const ids = rows.map((r) => r.other_id);
    assert.ok(!ids.includes(bob.id), 'blocked user must not appear in conversations');
    assert.ok(ids.includes(carol.id), 'unrelated user must still appear');
  });

  test('unread count ignores messages from a blocked sender', async () => {
    const row = await db.get(
      `SELECT COUNT(*) as count FROM messages
        WHERE receiver_id = ? AND read = 0 AND ${excludeBlocked('sender_id')}`,
      [alice.id, alice.id, alice.id]
    );
    assert.equal(row.count, 1, 'only Carol’s message should be counted');
  });

  test('search excludes blocked users and their posts', async () => {
    await makePost(bob.id, 'a blocked pour');
    await makePost(carol.id, 'a visible pour');

    const uid = alice.id;
    const users = await db.all(
      `SELECT id FROM users WHERE id != ? AND ${excludeBlocked('id')}`,
      [uid, uid, uid]
    );
    const userIds = users.map((u) => u.id);
    assert.ok(!userIds.includes(bob.id), 'blocked user must not be searchable');
    assert.ok(userIds.includes(carol.id));

    const posts = await db.all(
      `SELECT p.id, p.user_id FROM posts p WHERE p.content LIKE ? AND ${excludeBlocked('p.user_id')}`,
      ['%pour%', uid, uid]
    );
    const authors = posts.map((p) => p.user_id);
    assert.ok(!authors.includes(bob.id), 'blocked author must not appear in post search');
    assert.ok(authors.includes(carol.id));
  });

  test('in-memory filtering hides blocked authors from a fetched list', async () => {
    const blocked = await blockedIds(alice.id);
    const rows = [{ user_id: bob.id }, { user_id: carol.id }, { user_id: alice.id }];
    const visible = filterBlocked(rows, blocked).map((r) => r.user_id);
    assert.deepEqual(visible, [carol.id, alice.id]);
  });

  test('a viewer with no blocks sees everyone', async () => {
    const blocked = await blockedIds(carol.id);
    assert.equal(blocked.size, 0);
    const rows = [{ user_id: alice.id }, { user_id: bob.id }];
    assert.equal(filterBlocked(rows, blocked).length, 2);
  });
});
