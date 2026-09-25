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
const expoPush = require('./expoPush');

let webpush;
try { webpush = require('web-push'); } catch {}

let configured = false;
// How many web-push endpoints one notification will fan out to. Real people
// have a handful of devices; anything past this is stale subscriptions.
const MAX_WEB_PUSH_FANOUT = 8;

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
  // Quiet hours and the daily cap are checked ONCE here, so web and native
  // share exactly one set of limits. A user on both must not get double.
  const decision = canPush(user);
  if (!decision.allowed) return { sent: 0, skipped: decision.reason };

  let sent = 0;

  // ── Native (iOS / Android via Expo) ──────────────────────────────────────
  try {
    const native = await expoPush.sendToUser(user.id, {
      title: payload.title,
      body: payload.body,
      data: { url: payload.url, type: payload.type, postId: payload.postId, actorId: payload.actorId },
    });
    sent += native.sent || 0;
  } catch (e) {
    console.error('[push] native send failed:', e.message);
  }

  // ── Web push ─────────────────────────────────────────────────────────────
  if (!ensureConfigured()) {
    if (sent > 0) await bumpCount(user);
    return { sent, skipped: sent ? undefined : 'not_configured' };
  }

  // LIMIT is not cosmetic. Each sendNotification below is an outbound HTTPS
  // request, and on Cloudflare Workers an invocation gets 50 subrequests
  // total. This query had no LIMIT, so the fan-out was bounded only by how
  // many browsers a member had ever subscribed from — and it runs on EVERY
  // cheer, comment and connect they receive, via notify(). A member with 50
  // stale subscriptions could make every interaction with them fail.
  //
  // Newest first, so the bound drops the most likely-dead endpoints.
  const subs = await db.all(
    'SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [user.id, MAX_WEB_PUSH_FANOUT]
  );
  if (!subs.length) {
    if (sent > 0) await bumpCount(user);
    return { sent, skipped: sent ? undefined : 'no_subscription' };
  }

  const dead = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      // 404/410 → subscription is dead. Collected and removed in one batch
      // below rather than one DELETE each, which would have added a second
      // unbounded fan-out on exactly the worst case (many dead endpoints).
      if (e.statusCode === 404 || e.statusCode === 410) {
        dead.push(s.id);
      } else {
        console.error('[push] send failed', e.statusCode, e.message);
      }
    }
  }

  if (dead.length) {
    try {
      await db.batch(dead.map((id) => ({
        sql: 'DELETE FROM push_subscriptions WHERE id = ?',
        args: [id],
      })));
    } catch (e) {
      console.error('[push] pruning dead subscriptions failed:', e.message);
    }
  }

  if (sent > 0) await bumpCount(user);
  return { sent };
}

// One notification against the daily cap, however many devices it reached.
// Counting per-device would punish someone for owning a phone and a laptop.
async function bumpCount(user) {
  const today = localDateStr(user.tz_offset_minutes);
  const newCount = user.push_count_date === today ? (user.push_count || 0) + 1 : 1;
  await db.run('UPDATE users SET push_count = ?, push_count_date = ? WHERE id = ?', [
    newCount,
    today,
    user.id,
  ]);
}

module.exports = { pushToUser };
