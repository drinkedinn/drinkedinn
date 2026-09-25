// client/src/admin/moderation/permissions.js
//
// What the UI OFFERS. The server (middleware/adminAuth.requirePermission) is
// the only real gate; this exists so an admin is never handed a button whose
// entire purpose is to come back as a 403.
//
// The permission set is supplied by the admin shell as a prop. When it is
// missing we FAIL CLOSED: the queue still renders read-only and the panel says
// why the buttons are absent. In a trust-and-safety console, guessing
// "probably an owner" is the wrong direction to be wrong in.

/** Normalise Set | Array | null into a Set, or null when no source was given. */
export function toPermissionSet(permissions) {
  if (permissions instanceof Set) return permissions;
  if (Array.isArray(permissions)) return new Set(permissions.filter((p) => typeof p === 'string'));
  return null;
}

/** True only when the shell told us this admin holds `permission`. */
export function can(permissions, permission) {
  const set = toPermissionSet(permissions);
  return !!set && set.has(permission);
}

// Permissions this panel reads or writes, named once so the wiring is greppable.
//
// A note on `reports.escalate`: it exists in lib/permissions.js but
// routes/moderation.js gates the resolve route (including the `escalated`
// resolution) on `reports.action` alone. This panel follows the server, so a
// `moderator` — who holds reports.action but not reports.escalate — can still
// escalate. Hiding that would mean a moderator staring at something serious
// with no way to push it up, which is worse than the inconsistency.
export const PERMS = {
  read:   'reports.read',
  action: 'reports.action',
  assign: 'reports.assign',
};
