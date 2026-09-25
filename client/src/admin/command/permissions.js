// client/src/admin/command/permissions.js
//
// The panel is told which permissions the signed-in admin holds; it does not
// discover them. See server/lib/permissions.js for the authoritative list.
//
// Three states matter, and conflating them is how you get either a useless
// console or a wall of 403s:
//
//   known + holds it     → render the view
//   known + lacks it     → render the locked note, make NO request
//   unknown              → render optimistically and let the server decide;
//                          a 403 surfaces as the server's own message.
//
// The permission set comes from the shell as a prop, or — when the shell does
// not pass one — from GET /api/admin/roles/me via ./useAdminIdentity. Only if
// BOTH are unavailable does the "unknown" branch apply, so in practice the
// console hides what it cannot do rather than offering it and being refused.

/**
 * @param {string[]|Set<string>|null|undefined} permissions
 * @param {string|null|undefined} role
 */
export function makeGate(permissions, role) {
  const known = permissions != null;
  let set = null;
  if (permissions instanceof Set) set = permissions;
  else if (Array.isArray(permissions)) set = new Set(permissions.filter((p) => typeof p === 'string'));
  else if (permissions && typeof permissions === 'object') {
    // Tolerate a { 'users.read': true } shape too.
    set = new Set(Object.keys(permissions).filter((k) => permissions[k]));
  }

  return {
    known: known && set != null,
    role: typeof role === 'string' && role ? role : null,
    /** True when the admin holds `permission`, or when the set is unknown. */
    has(permission) {
      if (!known || set == null) return true;
      return set.has(permission);
    },
    /** True only when we positively know the admin lacks it. */
    denies(permission) {
      if (!known || set == null) return false;
      return !set.has(permission);
    },
  };
}
