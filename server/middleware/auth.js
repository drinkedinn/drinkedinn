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
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Support both new { sub } and legacy { id } token shapes during migration
  const userId = payload.sub ?? payload.id ?? payload.userId;
  const user = await db.get(
    `SELECT id, email, is_admin, email_verified, token_version FROM users WHERE id = ?`,
    [userId]
  );
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Revocation check: bump token_version in DB to log user out everywhere
  if (payload.tv !== undefined && (payload.tv ?? 0) !== (user.token_version ?? 0)) {
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
