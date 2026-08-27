// server/lib/errorReporter.js
// First-party error capture.
//
// Errors are GROUPED by fingerprint. A bug that fires ten thousand times is one
// row with a count — an ungrouped log is one nobody reads, which is the same as
// having none.
//
// SCRUBBING IS THE POINT. Stack traces and error messages routinely contain
// tokens, passwords, emails and whatever the user typed. Everything written here
// passes through scrub() first, and the redaction list is deliberately
// aggressive: a missed secret in an error log is a breach, while an
// over-redacted stack is merely annoying.

const crypto = require('crypto');
const db = require('../db');

const MAX_STACK = 4000;
const MAX_MESSAGE = 500;

// Ordered most-specific first so a JWT isn't half-caught by the generic rules.
const REDACTIONS = [
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]'],
  [/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, '[bcrypt]'],
  [/\b(?:\d[ -]*?){13,19}\b/g, '[card]'],
  [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]'],
  // "Bearer <token>" must consume the token, not the word "Bearer". Redacting
  // the scheme and leaving the credential is worse than doing nothing, because
  // it looks scrubbed.
  [/\bBearer\s+[^\s,;"'}]+/gi, 'Bearer [redacted]'],
  // Vendor-prefixed API keys (Stripe sk_/pk_, Expo, GitHub gh*_ and similar).
  [/\b(?:sk|pk|rk|whsec|ghp|gho|ghs|xox[baprs])[-_][A-Za-z0-9_-]{8,}/gi, '[api-key]'],
  [/((?:password|passwd|secret|token|authorization|api[_-]?key)["'\s:=]+)[^\s,;"'}]+/gi, '$1[redacted]'],
  [/\b[A-Fa-f0-9]{32,}\b/g, '[hex]'],
];

function scrub(text) {
  if (!text) return null;
  let out = String(text);
  for (const [re, replacement] of REDACTIONS) out = out.replace(re, replacement);
  return out;
}

// Group by the shape of the error, not its instance. Numbers and ids are
// normalised out so "/posts/41 not found" and "/posts/92 not found" are one bug.
function fingerprintOf({ source, message, stack, route }) {
  const normalisedMessage = String(message || '')
    .replace(/\d+/g, 'N')
    .replace(/['"][^'"]{0,60}['"]/g, 'S')
    .slice(0, 200);
  const topFrame = String(stack || '')
    .split('\n')
    .find((l) => l.includes('/') && !l.includes('node_modules')) || '';
  const normalisedFrame = topFrame.replace(/:\d+:\d+/g, '').trim().slice(0, 160);
  const normalisedRoute = String(route || '').replace(/\/\d+/g, '/:id');

  return crypto
    .createHash('sha1')
    .update(`${source}|${normalisedMessage}|${normalisedFrame}|${normalisedRoute}`)
    .digest('hex')
    .slice(0, 20);
}

/**
 * Record an error. Never throws — a failure in the reporter must not become a
 * second error, and must never break the request that produced it.
 */
async function report({ source = 'server', error, message, stack, route, platform, appVersion, userId = null } = {}) {
  try {
    const msg = scrub(message || error?.message || 'Unknown error').slice(0, MAX_MESSAGE);
    const trace = scrub(stack || error?.stack || '')?.slice(0, MAX_STACK) || null;
    const cleanRoute = scrub(route)?.slice(0, 200) || null;

    const fingerprint = fingerprintOf({ source, message: msg, stack: trace, route: cleanRoute });
    const now = Date.now();

    const existing = await db.get('SELECT id FROM error_reports WHERE fingerprint = ?', [fingerprint]);
    if (existing) {
      // Reopen anything previously resolved — if it's back, it isn't fixed.
      await db.run(
        `UPDATE error_reports
            SET count = count + 1, last_seen = ?,
                status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END
          WHERE fingerprint = ?`,
        [now, fingerprint]
      );
    } else {
      await db.run(
        `INSERT INTO error_reports
           (fingerprint, source, message, stack, route, platform, app_version, count, first_seen, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [fingerprint, source, msg, trace, cleanRoute, platform || null, appVersion || null, now, now]
      );
    }

    if (userId) {
      const seen = await db.get(
        'SELECT 1 AS x FROM error_occurrences WHERE fingerprint = ? AND user_id = ? LIMIT 1',
        [fingerprint, userId]
      );
      if (!seen) {
        await db.run(
          'INSERT INTO error_occurrences (fingerprint, user_id, created_at) VALUES (?, ?, ?)',
          [fingerprint, userId, now]
        );
        await db.run(
          'UPDATE error_reports SET users_affected = users_affected + 1 WHERE fingerprint = ?',
          [fingerprint]
        );
      }
    }

    return { ok: true, fingerprint };
  } catch (e) {
    console.error('[errorReporter] failed to record:', e.message);
    return { ok: false };
  }
}

/**
 * Express error handler. Mount LAST, after every route.
 * Returns a safe message; the detail goes to the report, never to the client.
 */
function expressHandler() {
  return async (err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;

    // 4xx is the client's problem and is not worth recording.
    if (status < 500) {
      return res.status(status).json({ error: err.expose ? err.message : 'Request could not be processed.' });
    }

    await report({
      source: 'server',
      error: err,
      route: `${req.method} ${req.originalUrl || req.url}`,
      userId: req.user?.id || null,
    });

    if (res.headersSent) return;
    res.status(500).json({ error: 'Something went wrong on our end. Try again shortly.' });
  };
}

/** Catch what escapes the request cycle entirely. */
function installProcessHandlers() {
  process.on('unhandledRejection', (reason) => {
    report({ source: 'server', message: `Unhandled rejection: ${reason?.message || reason}`, stack: reason?.stack });
  });
  process.on('uncaughtException', (err) => {
    report({ source: 'server', error: err, message: `Uncaught exception: ${err.message}` });
    console.error('[uncaughtException]', err);
  });
}

module.exports = { report, scrub, fingerprintOf, expressHandler, installProcessHandlers };
