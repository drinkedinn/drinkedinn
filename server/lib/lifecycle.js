// server/lib/lifecycle.js
// Daily re-engagement email. The highest-ROI retention layer: bring people back
// by showing them what they missed — pours from people they follow while they
// were away — on a gentle, capped cadence. Never daily spam.
//
// Cadence: we only email on specific inactivity milestones (1, 3, 7, 14, 30 days),
// at most once per user per day, and only if they haven't turned digests off.
// Responsible by design: no "you're losing your streak!" pressure, easy opt-out.

const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { sendDigestEmail } = require('./mailer');

const MILESTONES = new Set([1, 3, 7, 14, 30]); // days inactive that trigger an email
const MAX_PER_RUN = 200;                         // cap per cron run (serverless + SMTP safety)

// Cloudflare Workers allows 50 subrequests per invocation, and each user who
// actually reaches buildDigest costs about four: two digest queries, one
// outbound Resend call and one UPDATE. MAX_PER_RUN was written for a platform
// with no such limit, so a full run needed ~801 — measured at 81 with only 40
// users, already over. It failed partway through, having mailed some people
// and not others.
//
// So the per-INVOCATION bound is separate from the per-RUN one. On Workers we
// process a slice small enough to fit (1 scan + 10 x 4 = 41) and report
// `remaining: true`; the caller invokes /api/jobs/lifecycle again until that
// is false. Users already mailed have last_digest_date set, so the next
// invocation's query naturally excludes them — the slicing needs no cursor.
const IS_WORKER = typeof globalThis.WebSocketPair !== 'undefined';
const MAX_PER_INVOCATION = IS_WORKER ? 10 : MAX_PER_RUN;

function todayStr(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// Whole days between an ISO date/datetime string and `now`.
function daysSince(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).replace(' ', 'T'));
  if (isNaN(d)) return null;
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

function unsubscribeUrl(userId) {
  const token = jwt.sign({ sub: userId, purpose: 'digest_unsub' }, config.jwtSecret, { expiresIn: '60d' });
  return `${config.publicBaseUrl}/api/jobs/unsubscribe?token=${token}`;
}

// Build the per-user digest content. Returns null if there's nothing worth sending.
async function buildDigest(user, sinceDateStr) {
  // Posts from people this user follows, since they were last active.
  const since = sinceDateStr ? String(sinceDateStr) : '1970-01-01';
  const followedPosts = await db.all(
    `SELECT p.id, p.content, u.name AS author
       FROM posts p
       JOIN connections c ON c.target_id = p.user_id AND c.user_id = ?
       JOIN users u ON u.id = p.user_id
      WHERE p.created_at > ?
      ORDER BY p.created_at DESC
      LIMIT 5`,
    [user.id, since]
  );

  if (followedPosts.length) {
    const items = followedPosts.map((p) => ({
      title: `${p.author} shared a pour`,
      body: snippet(p.content),
    }));
    return {
      subject: `You missed ${followedPosts.length} pour${followedPosts.length > 1 ? 's' : ''} on DrinkedInn 🥃`,
      heading: 'While you were away…',
      intro: 'Here’s what people you follow have been pouring.',
      items,
    };
  }

  // Fallback: they follow no one (or nothing new) — surface community highlights
  // and a nudge to connect, which is the real fix for an empty feed.
  const highlights = await db.all(
    `SELECT p.id, p.content, u.name AS author,
            (SELECT COUNT(*) FROM cheers c WHERE c.post_id = p.id) AS cheers
       FROM posts p JOIN users u ON u.id = p.user_id
      ORDER BY cheers DESC, p.created_at DESC
      LIMIT 3`
  );
  if (!highlights.length) return null;

  return {
    subject: 'What’s pouring on DrinkedInn this week 🥃',
    heading: 'Come see what’s pouring',
    intro: 'Some of the most-loved pours from the community — follow a few people to fill your feed.',
    items: highlights.map((p) => ({
      title: `${p.author} · ${p.cheers} cheers`,
      body: snippet(p.content),
    })),
  };
}

function snippet(text, n = 90) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

/**
 * Scan users and send due re-engagement emails.
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun] don't send or write — just report who'd get one
 * @returns {Promise<{scanned:number, sent:number, skipped:number, dryRun:boolean, details:Array}>}
 */
async function runLifecycleEmails({ dryRun = false } = {}) {
  const today = todayStr();
  const now = new Date();

  // Verified users with an email, digests not disabled, not already mailed today.
  const users = await db.all(
    `SELECT u.id, u.name, u.email, u.created_at, u.last_active_date, u.last_digest_date,
            COALESCE(np.digest_email, 1) AS digest_on
       FROM users u
       LEFT JOIN notification_prefs np ON np.user_id = u.id
      WHERE u.email IS NOT NULL AND u.email != ''
        AND u.email_verified = 1
        AND COALESCE(np.digest_email, 1) != 0
        AND (u.last_digest_date IS NULL OR u.last_digest_date != ?)
      LIMIT 2000`,
    [today]
  );

  let sent = 0;
  let skipped = 0;
  const details = [];

  // Users that cost subrequests this invocation — i.e. reached buildDigest.
  // Counted separately from `sent`, because a dry run never increments `sent`
  // and so would otherwise walk all 2000 rows at two queries each.
  let processed = 0;
  let truncated = false;

  for (const u of users) {
    if (sent >= MAX_PER_RUN) break;
    if (processed >= MAX_PER_INVOCATION) { truncated = true; break; }

    const sinceDate = u.last_active_date || u.created_at;
    const inactive = daysSince(u.last_active_date || u.created_at, now);
    if (inactive === null || !MILESTONES.has(inactive)) { skipped++; continue; }

    processed++;
    const digest = await buildDigest(u, sinceDate);
    if (!digest) { skipped++; continue; }

    details.push({ id: u.id, email: u.email, inactive, items: digest.items.length });

    if (dryRun) { continue; }

    try {
      await sendDigestEmail(u.email, {
        ...digest,
        ctaUrl: config.publicBaseUrl,
        ctaLabel: 'Open DrinkedInn',
        unsubscribeUrl: unsubscribeUrl(u.id),
      });
      await db.run('UPDATE users SET last_digest_date = ? WHERE id = ?', [today, u.id]);
      sent++;
    } catch (e) {
      console.error('[lifecycle] send failed for', u.email, e.message);
      skipped++;
    }
  }

  // `remaining` tells the caller to invoke again. It is true only when the
  // per-invocation bound actually stopped us, not merely when the scan was
  // full — a scan can return 2000 rows of which none hit a milestone.
  return {
    scanned: users.length,
    sent: dryRun ? details.length : sent,
    skipped,
    dryRun,
    remaining: truncated,
    details,
  };
}

module.exports = { runLifecycleEmails };
