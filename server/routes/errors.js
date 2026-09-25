// server/routes/errors.js
//   POST /errors        client crash/error ingest (mobile and web)
//   GET  /errors        admin list, grouped, worst first
//   PUT  /errors/:fp    resolve or ignore a group

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const reporter = require('../lib/errorReporter');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

// Identify the reporter if we can, but accept anonymous reports — a crash on the
// login screen is exactly the one you most want to hear about.
async function softAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.reporterId = payload.sub ?? payload.id ?? null;
    } catch { /* anonymous */ }
  }
  next();
}

router.post('/', softAuth, async (req, res) => {
  const { message, stack, route, platform, appVersion, source } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });

  await reporter.report({
    source: source === 'mobile' || source === 'web' ? source : 'client',
    message,
    stack,
    route,
    platform,
    appVersion,
    userId: req.reporterId || null,
  });

  // Always 200 — a client retrying a failed crash report is a loop nobody wants.
  res.json({ received: true });
});

// ── Admin ───────────────────────────────────────────────────────────────────
router.get('/', auth, requireAdmin, async (req, res) => {
  const status = ['open', 'resolved', 'ignored'].includes(req.query.status) ? req.query.status : 'open';
  try {
    const rows = await db.all(
      `SELECT fingerprint, source, message, stack, route, platform, app_version,
              count, users_affected, status, first_seen, last_seen
         FROM error_reports
        WHERE status = ?
        ORDER BY users_affected DESC, count DESC, last_seen DESC
        LIMIT 100`,
      [status]
    );
    const totals = await db.get(
      `SELECT
         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
         SUM(CASE WHEN status = 'open' THEN count ELSE 0 END) AS occurrences
       FROM error_reports`
    );
    res.json({ errors: rows, open: totals?.open || 0, occurrences: totals?.occurrences || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Could not load errors.' });
  }
});

router.put('/:fingerprint', auth, requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'resolved', 'ignored'].includes(status)) {
    return res.status(400).json({ error: 'status must be open, resolved or ignored' });
  }
  await db.run('UPDATE error_reports SET status = ? WHERE fingerprint = ?', [status, req.params.fingerprint]);
  res.json({ ok: true });
});

module.exports = router;
