// server/routes/analytics.js
//   POST /analytics/events   batched ingest from clients
//   GET  /analytics/metrics  admin dashboard data
//
// Ingest is intentionally forgiving: unknown event names are dropped silently
// rather than 400'd. A client shipped last month must never break because the
// event whitelist moved on, and analytics must never surface an error to a user.

const express = require('express');
const analytics = require('../lib/analytics');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

const router = express.Router();
const MAX_BATCH = 50;

// Identify the caller if a token is present, but don't require one — signup and
// onboarding events happen before an account exists.
async function softAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const id = payload.sub ?? payload.id;
      const user = await db.get('SELECT id, country_code FROM users WHERE id = ?', [id]);
      if (user) req.analyticsUser = user;
    } catch { /* anonymous is fine */ }
  }
  next();
}

router.post('/events', softAuth, async (req, res) => {
  const batch = Array.isArray(req.body?.events) ? req.body.events.slice(0, MAX_BATCH) : [];
  if (!batch.length) return res.json({ accepted: 0 });

  const country = String(
    req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || req.analyticsUser?.country_code || ''
  ).toUpperCase().slice(0, 2);

  let accepted = 0;
  for (const e of batch) {
    if (!e?.name) continue;
    const r = await analytics.track(e.name, {
      userId: req.analyticsUser?.id || null,
      anonId: e.anonId || req.body.anonId || null,
      props: e.props || null,
      platform: e.platform || req.body.platform || null,
      country,
      sessionId: e.sessionId || req.body.sessionId || null,
    });
    if (r.ok) accepted += 1;
  }
  // 200 regardless — a rejected event must never look like a failure worth retrying.
  res.json({ accepted, received: batch.length });
});

// ── Admin metrics ───────────────────────────────────────────────────────────
router.get('/metrics', auth, requireAdmin, async (req, res) => {
  try {
    const [dau, wau, mau, ret, series, features, signupFunnel] = await Promise.all([
      analytics.activeUsers(1),
      analytics.activeUsers(7),
      analytics.activeUsers(30),
      analytics.retention([1, 7, 30]),
      analytics.dailySeries(30),
      analytics.featureUsage(30),
      analytics.funnel(
        ['app_opened', 'signup_started', 'signup_completed', 'onboarding_completed', 'post_created'],
        30
      ),
    ]);

    res.json({
      active: {
        dau, wau, mau,
        // Stickiness: what share of monthly users show up on a given day.
        // Above ~0.20 is healthy for a social product.
        stickiness: mau > 0 ? Number((dau / mau).toFixed(3)) : null,
      },
      retention: ret,
      funnel: signupFunnel,
      features,
      series,
    });
  } catch (err) {
    console.error('[analytics/metrics]', err.message);
    res.status(500).json({ error: 'Could not build metrics.' });
  }
});

module.exports = router;
