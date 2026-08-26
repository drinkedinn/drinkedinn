// server/lib/expoPush.js
// Native push delivery to iOS and Android through Expo's push service.
//
// Expo sits in front of APNs and FCM, so one token type covers both platforms
// and there are no certificates to rotate. Sends are batched (Expo accepts up
// to 100 messages per request) and dead tokens are pruned automatically —
// without that, a reinstalled app leaves a token that fails forever.
//
// Quiet hours and the daily cap are enforced by the caller (lib/push.js), not
// here, so every delivery channel shares exactly one set of limits.

const db = require('../db');

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

// Optional but recommended by Expo for production sending.
const ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN || '';

function isExpoToken(t) {
  return typeof t === 'string' && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t);
}

async function tokensFor(userId) {
  try {
    const rows = await db.all('SELECT token FROM device_tokens WHERE user_id = ?', [userId]);
    return rows.map((r) => r.token).filter(isExpoToken);
  } catch {
    return [];
  }
}

async function dropToken(token) {
  try { await db.run('DELETE FROM device_tokens WHERE token = ?', [token]); } catch {}
}

/**
 * Push to every device belonging to a user.
 * @returns {Promise<{sent: number, skipped?: string}>}
 */
async function sendToUser(userId, { title, body, data = {} }) {
  // Drop null entries — Expo rejects payloads with undefined values.
  const payload = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null));
  const tokens = await tokensFor(userId);
  if (!tokens.length) return { sent: 0, skipped: 'no_device' };

  let sent = 0;

  for (let i = 0; i < tokens.length; i += BATCH) {
    const slice = tokens.slice(i, i + BATCH);
    const messages = slice.map((to) => ({
      to,
      title,
      body,
      data: payload,
      sound: 'default',
      // Collapse repeat notifications about the same thing rather than stacking.
      channelId: 'default',
      priority: 'normal',
    }));

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        console.error('[expoPush] HTTP', res.status);
        continue;
      }

      const json = await res.json();
      const tickets = Array.isArray(json?.data) ? json.data : [];

      tickets.forEach((ticket, idx) => {
        if (ticket?.status === 'ok') { sent += 1; return; }
        const err = ticket?.details?.error;
        // The device uninstalled or the token was reissued — stop trying.
        if (err === 'DeviceNotRegistered') {
          dropToken(slice[idx]);
        } else if (err) {
          console.error('[expoPush] ticket error', err);
        }
      });
    } catch (e) {
      console.error('[expoPush] send failed', e.message);
    }
  }

  return { sent };
}

/** Register or refresh a device token. */
async function registerToken(userId, token, platform) {
  if (!isExpoToken(token)) throw new Error('Invalid push token');
  const now = Date.now();
  // A device can change hands — always rebind the token to the current user.
  await db.run(
    `INSERT INTO device_tokens (user_id, token, platform, created_at, last_seen)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, last_seen = excluded.last_seen`,
    [userId, token, platform || null, now, now]
  );
}

async function unregisterToken(token) {
  await dropToken(token);
}

module.exports = { sendToUser, registerToken, unregisterToken, isExpoToken };
