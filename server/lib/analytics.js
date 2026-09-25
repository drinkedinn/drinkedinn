// server/lib/analytics.js
// First-party product analytics: recording events and computing the metrics
// that actually tell you whether the product works.
//
// PRIVACY POSTURE — the constraint that shapes everything here:
//   - No IP addresses, no post content, no message text, no free-text input.
//   - Props are whitelisted per event. An event carrying an unexpected key has
//     that key dropped rather than stored, so a careless call site can never
//     leak user content into the analytics table.
//   - No third-party SDK. Nothing leaves our infrastructure.

const db = require('../db');

// Every event we accept, and the ONLY props each may carry.
// Anything not listed here is discarded.
const SCHEMA = {
  // Lifecycle
  app_opened:            ['platform', 'version'],
  session_started:       ['platform'],
  session_ended:         ['duration_s'],
  // Acquisition
  signup_started:        ['source'],
  signup_completed:      ['source', 'has_dob'],
  email_verified:        [],
  onboarding_completed:  ['followed_count'],
  login_completed:       ['method'],
  // Core engagement
  feed_viewed:           ['tab'],
  post_created:          ['has_image', 'has_poll', 'drink'],
  post_cheered:          [],
  post_commented:        [],
  post_repoured:         [],
  profile_viewed:        ['is_self'],
  user_connected:        [],
  search_performed:      ['tab', 'has_results'],
  // Retention surfaces
  notification_opened:   ['type'],
  push_enabled:          ['platform'],
  streak_advanced:       ['length'],
  // Monetisation (present so the funnel exists before payments do)
  paywall_viewed:        ['placement'],
  subscription_started:  ['plan'],
  subscription_cancelled:['plan', 'reason'],
  // Safety
  content_reported:      ['reason'],
  user_blocked:          [],
  age_verification_started:   ['method'],
  age_verification_completed: ['method', 'level'],
};

const KNOWN = new Set(Object.keys(SCHEMA));

// Small, scalar-only values. Rejects objects, arrays and long strings — those
// are how free text accidentally ends up in an analytics table.
function cleanProps(name, props) {
  const allowed = SCHEMA[name] || [];
  if (!props || typeof props !== 'object') return null;
  const out = {};
  for (const key of allowed) {
    const v = props[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof v === 'boolean') out[key] = v;
    else if (typeof v === 'string' && v.length <= 40) out[key] = v;
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

/**
 * Record one event. Never throws into a request path — losing a metric is
 * always preferable to failing the user's action.
 */
async function track(name, { userId = null, anonId = null, props = null, platform = null, country = null, sessionId = null } = {}) {
  if (!KNOWN.has(name)) return { ok: false, reason: 'unknown_event' };
  try {
    await db.run(
      `INSERT INTO analytics_events (user_id, anon_id, name, props, platform, country_code, session_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, anonId ? String(anonId).slice(0, 64) : null, name,
        cleanProps(name, props),
        platform ? String(platform).slice(0, 16) : null,
        country ? String(country).toUpperCase().slice(0, 2) : null,
        sessionId ? String(sessionId).slice(0, 64) : null,
        Date.now(),
      ]
    );
    return { ok: true };
  } catch (e) {
    console.error('[analytics] track failed', name, e.message);
    return { ok: false, reason: 'error' };
  }
}

/**
 * Ingest a batch of events in ONE round trip.
 *
 * track() writes immediately, which is right for a single call from a handler
 * but wrong for the batch endpoint: POST /api/analytics/events accepts up to
 * MAX_BATCH (50) events and used to await track() per event, so a full batch
 * cost 51 subrequests — one MORE than a Cloudflare Workers invocation is
 * allowed (measured: 51). The ingest endpoint could never accept a full batch.
 *
 * Validation is unchanged and still per-event: unknown names and bad props are
 * dropped here, in process, for free. Only the surviving rows go to the
 * database, as a single db.batch.
 */
async function trackMany(events) {
  const rows = [];
  let rejected = 0;

  for (const e of events || []) {
    if (!e?.name || !KNOWN.has(e.name)) { rejected += 1; continue; }
    rows.push({
      sql: `INSERT INTO analytics_events (user_id, anon_id, name, props, platform, country_code, session_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        e.userId ?? null,
        e.anonId ? String(e.anonId).slice(0, 64) : null,
        e.name,
        cleanProps(e.name, e.props),
        e.platform ? String(e.platform).slice(0, 16) : null,
        e.country ? String(e.country).toUpperCase().slice(0, 2) : null,
        e.sessionId ? String(e.sessionId).slice(0, 64) : null,
        Date.now(),
      ],
    });
  }

  if (!rows.length) return { accepted: 0, rejected };

  try {
    await db.batch(rows);
    return { accepted: rows.length, rejected };
  } catch (err) {
    console.error('[analytics] batch failed', err.message);
    return { accepted: 0, rejected: rejected + rows.length };
  }
}

const DAY = 86400000;

/** Distinct users active in the last N days. */
async function activeUsers(days) {
  const row = await db.get(
    'SELECT COUNT(DISTINCT user_id) AS c FROM analytics_events WHERE user_id IS NOT NULL AND created_at > ?',
    [Date.now() - days * DAY]
  );
  return row?.c || 0;
}

/**
 * Classic cohort retention: of the users who signed up on day X, what share
 * came back on day X+N? This is the number that decides whether the product
 * is worth pouring money into — everything else is vanity.
 */
async function retention(dayOffsets = [1, 7, 30], cohortDays = null) {
  // The cohort window must outlast the longest offset, or nobody in it has had
  // the chance to hit that milestone yet and the metric is silently always zero.
  // Default to twice the furthest offset so each point has a real denominator.
  const furthest = Math.max(...dayOffsets);
  const windowDays = cohortDays ?? Math.max(furthest * 2, 30);
  const since = Date.now() - windowDays * DAY;

  const cohort = await db.all(
    `SELECT user_id, MIN(created_at) AS joined
       FROM analytics_events
      WHERE name = 'signup_completed' AND user_id IS NOT NULL AND created_at > ?
      GROUP BY user_id`,
    [since]
  );
  if (!cohort.length) {
    return {
      cohortSize: 0,
      windowDays,
      points: dayOffsets.map((d) => ({ day: d, eligible: 0, returned: 0, ratio: null })),
    };
  }

  const points = [];
  for (const day of dayOffsets) {
    // Only count members who have HAD the chance to return — otherwise a user
    // who signed up yesterday drags day-30 retention toward zero.
    const eligible = cohort.filter((c) => Date.now() - c.joined >= day * DAY);
    let returned = 0;
    for (const c of eligible) {
      const row = await db.get(
        `SELECT 1 AS x FROM analytics_events
          WHERE user_id = ? AND created_at >= ? AND created_at < ? LIMIT 1`,
        [c.user_id, c.joined + day * DAY, c.joined + (day + 1) * DAY]
      );
      if (row) returned += 1;
    }
    points.push({
      day,
      eligible: eligible.length,
      returned,
      ratio: eligible.length ? Number((returned / eligible.length).toFixed(3)) : null,
    });
  }
  return { cohortSize: cohort.length, windowDays, points };
}

/** Ordered funnel with drop-off between each step. */
async function funnel(steps, days = 30) {
  const since = Date.now() - days * DAY;
  const out = [];
  let previous = null;
  for (const name of steps) {
    const row = await db.get(
      'SELECT COUNT(DISTINCT COALESCE(user_id, anon_id)) AS c FROM analytics_events WHERE name = ? AND created_at > ?',
      [name, since]
    );
    const count = row?.c || 0;
    out.push({
      step: name,
      count,
      fromPrevious: previous === null ? null : (previous ? Number((count / previous).toFixed(3)) : 0),
      fromTop: out.length && out[0].count ? Number((count / out[0].count).toFixed(3)) : previous === null ? 1 : null,
    });
    previous = count;
  }
  return out;
}

/** Which features are actually used, and by how many distinct people. */
async function featureUsage(days = 30) {
  const rows = await db.all(
    `SELECT name, COUNT(*) AS events, COUNT(DISTINCT user_id) AS users
       FROM analytics_events
      WHERE created_at > ?
      GROUP BY name
      ORDER BY users DESC, events DESC`,
    [Date.now() - days * DAY]
  );
  return rows;
}

/** Daily active users for a sparkline. */
async function dailySeries(days = 30) {
  const rows = await db.all(
    `SELECT date(created_at / 1000, 'unixepoch') AS day,
            COUNT(DISTINCT user_id) AS users,
            COUNT(*) AS events
       FROM analytics_events
      WHERE created_at > ?
      GROUP BY day ORDER BY day ASC`,
    [Date.now() - days * DAY]
  );
  return rows;
}

module.exports = {
  track, trackMany, activeUsers, retention, funnel, featureUsage, dailySeries,
  KNOWN_EVENTS: Array.from(KNOWN),
};
