// Account deletion is irreversible and legally required (App Store 5.1.1,
// GDPR erasure). It must remove everything belonging to the member and nothing
// belonging to anyone else — both halves matter equally.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { setup, makeUser, makePost, db } = require('./helpers');
const { deleteUserCompletely } = require('../lib/deleteUser');

before(async () => { await setup(); });

describe('complete erasure', () => {
  test('removes the member and every dependent row', async () => {
    const victim = await makeUser();
    const bystander = await makeUser();

    const postId = await makePost(victim.id, 'my pour');
    const bystanderPost = await makePost(bystander.id, 'their pour');

    // Content the member created, and engagement others left on it.
    await db.run('INSERT INTO cheers (user_id, post_id) VALUES (?, ?)', [victim.id, bystanderPost]);
    await db.run('INSERT INTO cheers (user_id, post_id) VALUES (?, ?)', [bystander.id, postId]);
    await db.run('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)', [victim.id, postId, 'hi']);
    await db.run('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)', [bystander.id, postId, 'nice']);
    await db.run('INSERT INTO connections (user_id, target_id) VALUES (?, ?)', [victim.id, bystander.id]);
    await db.run('INSERT INTO connections (user_id, target_id) VALUES (?, ?)', [bystander.id, victim.id]);
    await db.run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [victim.id, bystander.id, 'yo']);
    await db.run('INSERT INTO collection (user_id, name) VALUES (?, ?)', [victim.id, 'A bottle']);
    await db.run('INSERT INTO bucket_list (user_id, drink_name) VALUES (?, ?)', [victim.id, 'Pappy']);
    await db.run('INSERT INTO poll_options (post_id, text) VALUES (?, ?)', [postId, 'Option']);
    await db.run('INSERT OR IGNORE INTO notification_prefs (user_id) VALUES (?)', [victim.id]);

    await deleteUserCompletely(victim.id);

    const gone = async (label, sql, args) => {
      const row = await db.get(sql, args);
      assert.strictEqual(row?.c ?? 0, 0, `${label} still has rows after deletion`);
    };

    await gone('users', 'SELECT COUNT(*) c FROM users WHERE id = ?', [victim.id]);
    await gone('posts', 'SELECT COUNT(*) c FROM posts WHERE user_id = ?', [victim.id]);
    await gone('cheers by them', 'SELECT COUNT(*) c FROM cheers WHERE user_id = ?', [victim.id]);
    await gone('cheers on their post', 'SELECT COUNT(*) c FROM cheers WHERE post_id = ?', [postId]);
    await gone('comments by them', 'SELECT COUNT(*) c FROM comments WHERE user_id = ?', [victim.id]);
    await gone('comments on their post', 'SELECT COUNT(*) c FROM comments WHERE post_id = ?', [postId]);
    await gone('connections either way', 'SELECT COUNT(*) c FROM connections WHERE user_id = ? OR target_id = ?', [victim.id, victim.id]);
    await gone('messages either way', 'SELECT COUNT(*) c FROM messages WHERE sender_id = ? OR receiver_id = ?', [victim.id, victim.id]);
    await gone('collection', 'SELECT COUNT(*) c FROM collection WHERE user_id = ?', [victim.id]);
    await gone('bucket list', 'SELECT COUNT(*) c FROM bucket_list WHERE user_id = ?', [victim.id]);
    await gone('poll options on their post', 'SELECT COUNT(*) c FROM poll_options WHERE post_id = ?', [postId]);
    await gone('notification prefs', 'SELECT COUNT(*) c FROM notification_prefs WHERE user_id = ?', [victim.id]);
  });

  test('leaves other members completely untouched', async () => {
    const victim = await makeUser();
    const bystander = await makeUser();
    const theirPost = await makePost(bystander.id, 'keep me');
    await db.run('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)', [bystander.id, theirPost, 'mine']);

    await deleteUserCompletely(victim.id);

    const user = await db.get('SELECT id FROM users WHERE id = ?', [bystander.id]);
    assert.ok(user, 'bystander must survive');
    const post = await db.get('SELECT id FROM posts WHERE id = ?', [theirPost]);
    assert.ok(post, "bystander's post must survive");
    const comment = await db.get('SELECT COUNT(*) c FROM comments WHERE post_id = ?', [theirPost]);
    assert.strictEqual(comment.c, 1, "bystander's own comment must survive");
  });

  test('clears the referral link so no dangling reference remains', async () => {
    const referrer = await makeUser();
    const referred = await makeUser();
    await db.run('UPDATE users SET referred_by = ? WHERE id = ?', [referrer.id, referred.id]);

    await deleteUserCompletely(referrer.id);

    const row = await db.get('SELECT referred_by FROM users WHERE id = ?', [referred.id]);
    assert.strictEqual(row.referred_by, null, 'referred_by must be nulled, not left pointing at a ghost');
  });
});

describe('input validation', () => {
  test('rejects a non-numeric id rather than issuing a broad delete', async () => {
    await assert.rejects(() => deleteUserCompletely('1 OR 1=1'), /Invalid user id/);
    await assert.rejects(() => deleteUserCompletely(null), /Invalid user id/);
    await assert.rejects(() => deleteUserCompletely(-5), /Invalid user id/);
  });

  test('deleting a non-existent id is harmless', async () => {
    const before = await db.get('SELECT COUNT(*) c FROM users');
    await deleteUserCompletely(999999);
    const after = await db.get('SELECT COUNT(*) c FROM users');
    assert.strictEqual(after.c, before.c, 'must not affect any existing user');
  });
});
