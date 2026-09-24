// src/admin/content/permissions.js
// Client-side permission reads for the Content & Places panel.
//
// The server is the authority (middleware/adminAuth.requirePermission). This is
// only about what the UI OFFERS: an admin should never be handed a Remove
// button that exists purely to come back as a 403. An action they cannot take
// is not rendered at all.
//
// The permission set is supplied by the admin shell as a prop. When it is
// missing we FAIL CLOSED — read views still render, every mutating control is
// withheld — because guessing "probably an owner" in a trust-and-safety console
// is the wrong direction to be wrong in.

/** Normalise Set | Array | null into a Set, or null when no source was given. */
export function toPermissionSet(permissions) {
  if (permissions instanceof Set) return permissions;
  if (Array.isArray(permissions)) return new Set(permissions);
  return null;
}

/** True only when the shell told us this admin holds `permission`. */
export function can(permissions, permission) {
  const set = toPermissionSet(permissions);
  return !!set && set.has(permission);
}

/** False when the shell passed nothing — used to explain the missing buttons. */
export function hasPermissionSource(permissions) {
  return toPermissionSet(permissions) !== null;
}

// Permissions this panel reads or writes, named once so the wiring is greppable.
export const PERMS = {
  contentRead:   'content.read',
  contentRemove: 'content.remove',
  placesRead:    'places.read',
  placesEdit:    'places.edit',
};
