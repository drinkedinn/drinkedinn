// server/lib/push.js
// Web Push delivery. Respects the responsible caps in responsible.js and prunes
// dead endpoints. Generate VAPID keys once: `npx web-push generate-vapid-keys`.
//
//   npm i web-push
//
// web-push is required lazily so the app never crashes if the dep or VAPID keys
// are absent — push simply no-ops and the in-app notification still persists.

const db = require('../db');
const { canPush, localDateStr } = require('./responsible');

let webpush;
try { webpush = require('web-push'); } catch {}

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!webpush) return false;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:hello@drinkedinn.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

// Send a push to one user, honoring quiet hours + daily cap. Silently no-ops if
// the user is in quiet hours, over cap, or push isn't configured — the in-app
// notification still exists either way.
async function pushToUser(user, payload) {
  const decision = canPush(user);
  if (!decision.allowed) return { sent: 0, skipped: decision.reason };

  if (!ensureConfigured()) return { sent: 0, skipped: 'not_configured' };

  const subs = await db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', [user.id]);
  if (!subs.length) return { sent: 0, skipped: 'no_subscription' };

  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      // 404/410 → subscription is dead, remove it.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await db.run('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
      } else {
        console.error('[push] send failed', e.statusCode, e.message);
      }
    }
  }

  if (sent > 0) {
    const today = localDateStr(user.tz_offset_minutes);
    const newCount = user.push_count_date === today ? user.push_count + 1 : 1;
    await db.run('UPDATE users SET push_count = ?, push_count_date = ? WHERE id = ?', [
      newCount,
      today,
      user.id,
    ]);
  }
  return { sent };
}

module.exports = { pushToUser };
