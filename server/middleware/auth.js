// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let payload;
  try {
    // Algorithms pinned: without this, verify accepts whatever the token's own
    // header asks for.
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // A valid signature is not enough — the token must be a SESSION token.
  //
  // Other parts of the app sign single-purpose tokens with this same secret;
  // lib/lifecycle.js mints { sub, purpose: 'digest_unsub' } for the unsubscribe
  // link in every re-engagement email, valid for 60 days. Without this check
  // that link was a full bearer token for the account: anyone holding the URL
  // (a forwarded email, a shared inbox, a mail-security link scanner, browser
  // history) could send it as `Authorization: Bearer …` and read the user's
  // profile, messages and email address.
  //
  // routes/jobs.js already refuses a session token at the unsubscribe endpoint;
  // this is the same rule in the opposite direction.
  //
  // Tokens issued before `purpose` existed carry none, so they are still
  // accepted — only an explicitly non-session purpose is rejected.
  if (payload.purpose !== undefined && payload.purpose !== 'session') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Support both new { sub } and legacy { id } token shapes during migration
  const userId = payload.sub ?? payload.id ?? payload.userId;
  const user = await db.get(
    `SELECT id, email, is_admin, email_verified, token_version FROM users WHERE id = ?`,
    [userId]
  );
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Revocation check: bump token_version in DB to log user out everywhere.
  //
  // A token with no `tv` counts as version 0 rather than skipping the check.
  // Skipping it meant any token predating the claim — including the 60-day
  // unsubscribe token above — survived "sign out everywhere" and a password
  // change indefinitely. Legacy sessions are unaffected while token_version is
  // still 0, and correctly die the moment it is bumped.
  if ((payload.tv ?? 0) !== (user.token_version ?? 0)) {
    return res.status(401).json({ error: 'Token revoked' });
  }

  req.user = user;
  next();
}

function requireVerified(req, res, next) {
  if (!req.user || req.user.email_verified !== 1) {
    return res.status(403).json({ error: 'Email not verified' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.is_admin !== 1) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Default export is requireAuth for backward compat: const auth = require('../middleware/auth')
module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireVerified = requireVerified;
module.exports.requireAdmin = requireAdmin;
