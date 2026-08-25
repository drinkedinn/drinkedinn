// server/lib/deleteUser.js
// Complete account erasure. Used by both self-service deletion (GDPR / App Store
// requirement) and admin removal, so the two can never drift apart.
//
// Order matters only for readability — there are no FK cascades configured, so
// every dependent row is removed explicitly. Statements are tolerant of tables
// that don't exist yet on older databases.

const db = require('../db');

// Every table that references a user, with the column(s) that do the referencing.
const OWNED = [
  ['cheers', ['user_id']],
  ['repours', ['user_id']],
  ['comments', ['user_id']],
  ['connections', ['user_id', 'target_id']],
  ['notifications', ['user_id', 'actor_id']],
  ['messages', ['sender_id', 'receiver_id']],
  ['stories', ['user_id']],
  ['poll_votes', ['user_id']],
  ['drink_ratings', ['user_id']],
  ['collection', ['user_id']],
  ['bucket_list', ['user_id']],
  ['group_members', ['user_id']],
  ['group_posts', ['user_id']],
  ['challenge_entries', ['user_id']],
  ['event_rsvps', ['user_id']],
  ['events', ['user_id']],
  ['referrals', ['referrer_id', 'referred_id']],
  ['reports', ['reporter_id']],
  ['notification_prefs', ['user_id']],
  ['push_subscriptions', ['user_id']],
  ['password_resets', ['user_id']],
];

async function safeRun(sql, args) {
  try {
    await db.run(sql, args);
  } catch (e) {
    // A table missing on an older DB shouldn't abort the erasure.
    if (!/no such table|no such column/i.test(String(e.message))) throw e;
  }
}

/**
 * Erase a user and everything attached to them.
 * @param {number} userId
 * @returns {Promise<{ok: true}>}
 */
async function deleteUserCompletely(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid user id');

  // Poll options belong to the user's posts, not the user — clear them first.
  await safeRun(
    'DELETE FROM poll_options WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)',
    [id]
  );
  await safeRun(
    'DELETE FROM poll_votes WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)',
    [id]
  );
  // Engagement other people left on this user's posts.
  await safeRun('DELETE FROM cheers WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)', [id]);
  await safeRun('DELETE FROM repours WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)', [id]);
  await safeRun('DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)', [id]);
  await safeRun('DELETE FROM featured_posts WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)', [id]);
  await safeRun('DELETE FROM notifications WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)', [id]);

  for (const [table, cols] of OWNED) {
    const where = cols.map((c) => `${c} = ?`).join(' OR ');
    await safeRun(`DELETE FROM ${table} WHERE ${where}`, cols.map(() => id));
  }

  await safeRun('DELETE FROM posts WHERE user_id = ?', [id]);
  await safeRun('UPDATE users SET referred_by = NULL WHERE referred_by = ?', [id]);
  await db.run('DELETE FROM users WHERE id = ?', [id]);

  return { ok: true };
}

module.exports = { deleteUserCompletely };
