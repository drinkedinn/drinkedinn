// server/lib/permissions.js
// Role-based access control for the admin surface.
//
// Until now "admin" was one boolean. That means the person who answers support
// tickets has the same power as the founder: they can delete accounts, and
// (once the compliance panel exists) rewrite the jurisdiction rules that decide
// who is legally allowed to use the product. Least privilege is not a nicety
// here — it is the difference between a mistake and an incident.
//
// A role is a named bundle of permissions. Permissions are the unit that routes
// check, so a role can be re-scoped without touching a single route.
//
// `owner` is deliberately the only role that can grant roles. Everything else
// is a subset. is_admin=1 with no row in admin_roles is treated as
// `super_admin` so the existing admin account keeps working through the
// migration rather than locking itself out.

const PERMISSIONS = [
  // people
  'users.read', 'users.warn', 'users.suspend', 'users.ban', 'users.delete', 'users.restore',
  // content
  'content.read', 'content.remove', 'content.restrict', 'content.feature',
  // moderation
  'reports.read', 'reports.action', 'reports.assign', 'reports.escalate',
  // places / events / communities
  'places.read', 'places.edit', 'places.verify', 'places.remove',
  'events.read', 'events.remove',
  'groups.read', 'groups.restrict', 'groups.remove',
  // platform
  'flags.read', 'flags.write',
  'config.read', 'config.write',
  'compliance.read', 'compliance.propose', 'compliance.publish',
  'ads.read', 'ads.approve',
  // insight
  'analytics.read', 'audit.read', 'health.read',
  // the keys to the kingdom
  'roles.read', 'roles.write',
];

const P = new Set(PERMISSIONS);

// Read-only baseline every admin role gets.
const READ = ['users.read', 'content.read', 'reports.read', 'places.read',
  'events.read', 'groups.read', 'analytics.read', 'health.read', 'flags.read'];

const ROLES = {
  // Full access, including granting roles. Should be one or two people.
  owner: PERMISSIONS,

  // Everything except handing out roles — so a compromised super_admin cannot
  // quietly mint more of itself.
  super_admin: PERMISSIONS.filter((p) => p !== 'roles.write'),

  ops_admin: [...READ, 'content.remove', 'content.restrict', 'content.feature',
    'places.edit', 'places.verify', 'places.remove', 'events.remove',
    'groups.restrict', 'groups.remove', 'users.warn', 'reports.action',
    'reports.assign', 'config.read', 'audit.read'],

  trust_safety_lead: [...READ, 'users.warn', 'users.suspend', 'users.ban', 'users.restore',
    'content.remove', 'content.restrict', 'reports.action', 'reports.assign',
    'reports.escalate', 'groups.restrict', 'groups.remove', 'audit.read'],

  moderator: [...READ, 'content.remove', 'content.restrict', 'reports.action', 'users.warn'],

  support: [...READ, 'users.warn'],

  marketing: ['analytics.read', 'health.read', 'content.read', 'content.feature', 'flags.read'],

  analytics: ['analytics.read', 'health.read', 'users.read', 'content.read', 'flags.read'],

  // Can draft a jurisdiction change but not publish it alone — publishing is a
  // two-person action (see routes/compliance).
  compliance: [...READ, 'compliance.read', 'compliance.propose', 'audit.read', 'ads.read'],

  finance: ['analytics.read', 'ads.read', 'health.read'],

  engineering: ['health.read', 'flags.read', 'flags.write', 'config.read', 'config.write',
    'analytics.read', 'audit.read'],

  read_only: READ,
};

// Actions severe enough to demand a typed reason, and (where the route says so)
// a second admin's approval. Keeping the list here rather than at each route
// means it cannot drift per-handler.
const HIGH_IMPACT = new Set([
  'users.delete', 'users.ban', 'compliance.publish', 'flags.write',
  'config.write', 'roles.write', 'ads.approve',
]);

const ROLE_NAMES = Object.keys(ROLES);

function permissionsFor(role) {
  return new Set(ROLES[role] || []);
}

function isValidRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLES, role);
}

function isValidPermission(p) {
  return P.has(p);
}

module.exports = { PERMISSIONS, ROLES, ROLE_NAMES, HIGH_IMPACT, permissionsFor, isValidRole, isValidPermission };
