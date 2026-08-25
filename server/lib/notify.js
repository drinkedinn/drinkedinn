// server/lib/notify.js
// The heart of the re-engagement loop. ONE function the rest of the app calls.
// Adapted to DrinkedInn's EXISTING notifications table:
//   notifications(id, user_id, actor_id, type, post_id, read, created_at, count)
//
// Design choices that keep it non-manipulative:
//   - never notify a user about their own action
//   - respect per-type preferences (notification_prefs)
//   - in-app notifications are always recorded; PUSH is throttled (quiet hours + daily cap)
//   - duplicate events are BATCHED, not spammed ("X and N others cheered your pour")

const db = require('../db');
const { pushToUser } = require('./push');

// Map notification type -> notification_prefs column (real schema).
// Types without a column are always allowed (e.g. repour, system).
const PREF_COLUMN = {
  cheer: 'cheers',
  comment: 'comments',
  reply: 'comments',
  connect: 'connections',
  follow: 'connections',
  challenge: 'challenges',
};

async function prefAllows(recipientId, type) {
  const col = PREF_COLUMN[type];
  if (!col) return true; // no toggle => allowed
  try {
    const row = await db.get(
      `SELECT ${col} AS v FROM notification_prefs WHERE user_id = ?`,
      [recipientId]
    );
    if (!row) return true;     // no prefs row => default on
    return row.v !== 0;        // 0 = off
  } catch {
    return true;               // fail open — never silently lose notifications
  }
}

function pushCopy(type, actorName, count) {
  const others = count > 1 ? ` and ${count - 1} other${count > 2 ? 's' : ''}` : '';
  switch (type) {
    case 'cheer':     return { title: 'New cheers 🥂', body: `${actorName}${others} cheered your pour` };
    case 'repour':    return { title: 'Repour 🔁', body: `${actorName} repoured your pour` };
    case 'comment':   return { title: 'New comment 💬', body: `${actorName} commented on your pour` };
    case 'reply':     return { title: 'New reply 💬', body: `${actorName} replied to you` };
    case 'connect':
    case 'follow':    return { title: 'New connection 🤝', body: `${actorName} connected with you` };
    case 'mention':   return { title: 'You were mentioned', body: `${actorName} mentioned you` };
    case 'potd':      return { title: 'Pour of the Day! 🏆', body: 'Your pour was featured' };
    case 'challenge': return { title: 'Challenge update', body: 'There’s news in your challenge' };
    default:          return { title: 'DrinkedInn', body: 'You have an update' };
  }
}

/**
 * Create a notification (in-app row + throttled push).
 * @param {object} o
 * @param {number} o.recipientId  who receives it
 * @param {number} [o.actorId]    who caused it (omit for system)
 * @param {string} o.type         cheer|repour|comment|reply|connect|mention|potd|challenge|system
 * @param {string|number} [o.postId]
 * @param {string} [o.actorName]  display name for push copy
 */
async function notify({ recipientId, actorId = null, type, postId = null, actorName = 'Someone' }) {
  if (!recipientId) return;
  if (actorId && actorId === recipientId) return;       // never self-notify
  if (!(await prefAllows(recipientId, type))) return;    // user opted out of this type

  // Batch: collapse an existing UNREAD same-(type, post) notification into one,
  // bumping its count + recency instead of creating another row.
  let count = 1;
  let batched = null;
  if (postId != null && ['cheer', 'comment', 'reply', 'repour'].includes(type)) {
    batched = await db.get(
      `SELECT id, count FROM notifications
        WHERE user_id = ? AND type = ? AND post_id = ? AND read = 0
        ORDER BY created_at DESC LIMIT 1`,
      [recipientId, type, postId]
    );
  }

  if (batched) {
    count = (batched.count || 1) + 1;
    await db.run(
      'UPDATE notifications SET count = ?, actor_id = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
      [count, actorId, batched.id]
    );
  } else {
    await db.run(
      'INSERT INTO notifications (user_id, actor_id, type, post_id, count) VALUES (?, ?, ?, ?, 1)',
      [recipientId, actorId, type, postId]
    );
  }

  // Fire push (throttled inside pushToUser). In-app notif already persisted above.
  try {
    const recipient = await db.get(
      'SELECT id, tz_offset_minutes, push_count, push_count_date FROM users WHERE id = ?',
      [recipientId]
    );
    if (recipient) {
      const copy = pushCopy(type, actorName, count);
      await pushToUser(recipient, { ...copy, url: '/', type });
    }
  } catch (e) {
    console.error('[notify] push step failed (in-app notif still saved):', e.message);
  }
}

module.exports = { notify };
