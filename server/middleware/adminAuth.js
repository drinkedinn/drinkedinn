// server/middleware/adminAuth.js
// Admin identity, permission checks, and automatic auditing.
//
// The audit lib already existed and its own header said "call from every admin
// route handler". One of five mutating routes actually did. That is what
// happens to any rule enforced by discipline: it decays silently, and you only
// find out when you need the record and it is not there.
//
// So auditing here is STRUCTURAL. auditAdmin() is mounted once on the admin
// router and logs every non-GET request after it completes — actor, action,
// target, status, reason, and the request body with secrets stripped. A new
// route is audited because it exists, not because someone remembered.

const db = require('../db');
const { permissionsFor, isValidRole, HIGH_IMPACT } = require('../lib/permissions');
const { scrub } = require('../lib/errorReporter');

/**
 * Resolve the caller's admin role and permission set onto req.admin.
 * Must run after requireAuth.
 */
async function loadAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const row = await db.get('SELECT role FROM admin_roles WHERE user_id = ?', [req.user.id]);
    let role = row?.role;

    // Migration path: an existing is_admin=1 account with no role row keeps
    // full access as super_admin rather than being locked out of its own
    // panel. Grant explicit roles and this branch stops mattering.
    if (!role && req.user.is_admin === 1) role = 'super_admin';
    if (!role || !isValidRole(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.admin = { role, permissions: permissionsFor(role) };
    next();
  } catch (e) {
    console.error('[adminAuth] role lookup failed:', e.message);
    res.status(500).json({ error: 'Could not verify access.' });
  }
}

/**
 * Gate a route on a permission.
 *
 *   router.delete('/users/:id', requirePermission('users.delete'), handler)
 *
 * High-impact permissions additionally require a typed reason in the body, so
 * the audit record explains WHY, not just what. A destructive action with no
 * stated reason is the thing you regret six months later.
 */
function requirePermission(permission) {
  return function permissionGate(req, res, next) {
    if (!req.admin?.permissions?.has(permission)) {
      return res.status(403).json({
        error: 'Your role does not allow that.',
        required: permission,
        role: req.admin?.role,
      });
    }
    if (HIGH_IMPACT.has(permission)) {
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 8) {
        return res.status(400).json({
          error: 'This action needs a reason (at least 8 characters). It is recorded in the audit log.',
          required_field: 'reason',
        });
      }
      req.adminReason = reason.slice(0, 500);
    }
    next();
  };
}

// Never let a request body carrying these reach the audit table.
const SENSITIVE = /password|token|secret|authorization|api[_-]?key|pepper/i;

function safeBody(body) {
  if (!body || typeof body !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SENSITIVE.test(k)) { out[k] = '[redacted]'; continue; }
    if (typeof v === 'string') out[k] = scrub(v)?.slice(0, 200) ?? null;
    else if (v && typeof v === 'object') out[k] = '[object]';
    else out[k] = v;
  }
  return out;
}

/**
 * Log every mutating admin request. Mounted once on the admin router.
 *
 * Runs on response finish so the recorded status is the real outcome — a
 * refused action is as worth recording as a successful one, and a 403 streak
 * is exactly the signal you want to be able to find later.
 */
function auditAdmin(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();

  const started = Date.now();
  res.on('finish', () => {
    const action = `${req.method} ${req.baseUrl}${req.route?.path || req.path}`;
    db.run(
      `INSERT INTO admin_audit (actor_id, action, target_type, target_id, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id ?? 0,
        action,
        req.params?.id ? 'id' : null,
        req.params?.id != null ? String(req.params.id) : null,
        JSON.stringify({
          role: req.admin?.role || null,
          status: res.statusCode,
          ok: res.statusCode < 400,
          reason: req.adminReason || null,
          body: safeBody(req.body),
          ms: Date.now() - started,
        }),
        Date.now(),
      ]
    ).catch((e) => console.error('[audit] write failed:', e.message));
  });

  next();
}

module.exports = { loadAdmin, requirePermission, auditAdmin, safeBody };
