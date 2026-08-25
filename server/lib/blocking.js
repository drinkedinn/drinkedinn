// server/lib/blocking.js
// Blocking is mutual by design: once A blocks B, neither sees the other's
// content anywhere. Apple guideline 1.2 and Google Play's UGC policy both
// require the ability to block abusive users.
//
// EXCLUSION_SQL is a correlated subquery you can drop into any WHERE clause to
// hide both directions at once. It is a constant string with a single bound
// parameter, so it never interpolates user input.

const db = require('../db');

/**
 * SQL fragment excluding anyone in a block relationship with the viewer.
 * @param {string} col - the column holding the other user's id (e.g. 'p.user_id')
 * @returns {string} SQL requiring ONE bound param: the viewer's id, twice.
 */
function excludeBlocked(col) {
  return `${col} NOT IN (
    SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
    UNION
    SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
  )`;
}

/** Ids the viewer has blocked or been blocked by. */
async function blockedIds(userId) {
  try {
    const rows = await db.all(
      `SELECT blocked_id AS id FROM blocked_users WHERE blocker_id = ?
       UNION
       SELECT blocker_id AS id FROM blocked_users WHERE blocked_id = ?`,
      [userId, userId]
    );
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

/** True if either user has blocked the other. */
async function isBlocked(a, b) {
  try {
    const row = await db.get(
      `SELECT 1 AS x FROM blocked_users
        WHERE (blocker_id = ? AND blocked_id = ?)
           OR (blocker_id = ? AND blocked_id = ?) LIMIT 1`,
      [a, b, b, a]
    );
    return !!row;
  } catch {
    return false;
  }
}

/** Drop rows authored by a blocked party from an in-memory list. */
function filterBlocked(rows, blocked, key = 'user_id') {
  if (!blocked || blocked.size === 0) return rows;
  return rows.filter((r) => !blocked.has(r[key]));
}

module.exports = { excludeBlocked, blockedIds, isBlocked, filterBlocked };
