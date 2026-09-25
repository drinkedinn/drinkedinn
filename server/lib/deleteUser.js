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

  // Added later than the list above and missed by it, so the function reported
  // {ok:true} — and routes/users.js answered {deleted:true} to a GDPR / App
  // Store 5.1.1(v) erasure request — while this data was still in the database.
  // Verified against db.js by diffing every CREATE TABLE carrying a user
  // reference against this list; these were the remainder.
  ['blocked_users', ['blocker_id', 'blocked_id']],
  ['age_checks', ['user_id']],
  ['ad_events', ['user_id']],
  ['analytics_events', ['user_id']],
  ['device_tokens', ['user_id']],
  ['brand_members', ['user_id']],
  ['error_occurrences', ['user_id']],

  // Places pillar — added Sep 2026. Both are wholly personal:
  //   saved_places is the user's own want-to-go list.
  //   place_visits is their been-here history.
  // A blocked-user policy or a data-portability request must erase both.
  ['saved_places', ['user_id']],
  ['place_visits', ['user_id']],

  // An admin role is an entitlement, not a record worth keeping: an erased
  // account must not leave a row that would re-grant access if the id were
  // ever reused. The ACTIONS that admin took stay in admin_audit (see
  // RETAINED below) — the grant itself goes.
  ['admin_roles', ['user_id']],
];

// Columns that point at a user on rows the user does NOT solely own. The row
// survives; the reference is cleared. Listed separately from OWNED because the
// row is kept, and from RETAINED because the reference is not.
//
// Both of these are FOREIGN KEYs to users(id), so leaving them set makes
// DELETE FROM users fail outright rather than merely leaving data behind.
const NULLED = [
  // A group outlives its founder — other members' posts live in it.
  ['drink_groups', 'created_by'],
  // A place is a canonical venue others have saved and visited.
  ['places', 'created_by'],
];

// Tables that reference a user and are DELIBERATELY not erased. Listed
// explicitly so the coverage test can tell a considered exception from a
// forgotten table.
const RETAINED = [
  // Moderation and administrative audit trail. Erasing it would destroy the
  // record of actions taken against abusive accounts — including the evidence
  // for a ban that a deleted-and-recreated account is trying to escape.
  // Retention here is a legitimate-interest / legal-defence basis rather than
  // an oversight, and actor_id is the acting ADMIN, not the deleted member.
  // `target_id` is a generic TEXT id qualified by target_type, so it is not
  // reliably a user reference at all.
  'admin_audit',
];

// Handled explicitly in deleteUserCompletely() rather than through OWNED,
// because they need a subquery or a specific ordering.
const HANDLED_DIRECTLY = ['posts', 'poll_options', 'featured_posts'];

// Which of the tables we are about to touch actually exist.
//
// The per-statement try/catch above is what made this function tolerant of
// older databases, but it also forced one round trip per statement: ~41 of
// them, against a Cloudflare Workers budget of 50 per invocation (see
// CLOUDFLARE.md). Account deletion was one schema addition away from failing
// outright, and it is the one operation that must not — GDPR and App Store
// 5.1.1(v) both require it.
//
// Asking sqlite_master once lets the rest go out as a single batch, which is
// one subrequest no matter how many statements it carries. Cost goes from
// ~41 to 2, and stops growing with the schema.
async function existingTables() {
  const rows = await db.all(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
  );
  return new Set(rows.map((r) => String(r.name)));
}

/**
 * Erase a user and everything attached to them.
 * @param {number} userId
 * @returns {Promise<{ok: true}>}
 */
async function deleteUserCompletely(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid user id');

  const present = await existingTables();
  const stmts = [];
  const add = (table, sql, args) => {
    if (present.has(table)) stmts.push({ sql, args });
  };

  // Rows that hang off this user's POSTS rather than off the user directly.
  // These must precede the posts delete, and a batch preserves order.
  for (const t of ['poll_options', 'poll_votes', 'cheers', 'repours', 'comments', 'featured_posts', 'notifications']) {
    add(t, `DELETE FROM ${t} WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)`, [id]);
  }

  // Everything that references the user directly.
  for (const [table, cols] of OWNED) {
    const where = cols.map((c) => `${c} = ?`).join(' OR ');
    add(table, `DELETE FROM ${table} WHERE ${where}`, cols.map(() => id));
  }

  add('posts', 'DELETE FROM posts WHERE user_id = ?', [id]);

  // Shared content the member authored but does not solely own. ORPHANED, not
  // destroyed: a group keeps its members and everything they posted in it, and
  // a place stays on the map for everyone who saved or visited it.
  //
  // This is also what made account deletion fail. Both columns carry a foreign
  // key to users(id) and neither was erased, so DELETE FROM users raised
  // SQLITE_CONSTRAINT_FOREIGNKEY for anyone who had ever founded a group or
  // added a place — the route answered 500 and their account could not be
  // deleted at all. That is a GDPR / App Store 5.1.1(v) failure, and it
  // predates the batching above (verified by running the old implementation
  // against the same fixture).
  for (const [table, column] of NULLED) {
    add(table, `UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`, [id]);
  }

  add('users', 'UPDATE users SET referred_by = NULL WHERE referred_by = ?', [id]);
  add('users', 'DELETE FROM users WHERE id = ?', [id]);

  // One round trip, and libsql rolls the whole thing back if any statement
  // fails — so a partial erasure is no longer a reachable state. That is a
  // stronger guarantee than the statement-at-a-time version gave, which could
  // leave a user half-deleted if it died midway.
  //
  // Deliberate behaviour change: the old version also swallowed "no such
  // column", which meant a table whose schema had drifted was silently skipped
  // while the caller was still told {ok:true} — under-deleting a GDPR erasure
  // and reporting success. Now a drifted column aborts the batch and raises,
  // so the request fails visibly instead of lying. Missing TABLES are still
  // tolerated, via the sqlite_master check above.
  await db.batch(stmts);

  return { ok: true };
}

module.exports = { deleteUserCompletely, OWNED, RETAINED, HANDLED_DIRECTLY, NULLED };
