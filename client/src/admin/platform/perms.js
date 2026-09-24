// client/src/admin/platform/perms.js
//
// The shell tells this panel what the signed-in admin may do. A button the
// server will 403 should never have been on screen: the admin learns the limit
// by being refused, and a refused destructive action still costs a row in the
// audit log and a moment of doubt about whether it half-happened.
//
// The server (middleware/adminAuth.js) remains the only real gate. This is
// about not offering what cannot be done.
//
// Reads and writes are deliberately treated differently when the shell tells us
// nothing:
//
//   can(p)        — POSITIVELY holds it. False when we were not told.
//                   Gate every write and every destructive control on this.
//   mayAttempt(p) — holds it, OR we were not told. Gate reads on this, and let
//                   the server answer: a 403 on a GET costs nothing and its
//                   message is shown verbatim. Failing closed here would mean
//                   an integrator who forgets the prop sees a blank panel and
//                   no explanation of why.

/**
 * Accepts a Set, an array of permission strings, a { 'flags.read': true } map,
 * or null/undefined when the shell has not supplied one.
 *
 * @returns {{ known: boolean, can: (p: string) => boolean, mayAttempt: (p: string) => boolean }}
 */
export function makeCan(permissions) {
  let set = null;
  if (permissions instanceof Set) set = permissions;
  else if (Array.isArray(permissions)) set = new Set(permissions.filter((p) => typeof p === 'string'));
  else if (permissions && typeof permissions === 'object') {
    set = new Set(Object.keys(permissions).filter((k) => permissions[k]));
  }

  const known = !!set;
  return {
    // known=false means "we were not told" — callers say so in the UI rather
    // than implying the admin's role is the reason a control is missing.
    known,
    can: (permission) => known && set.has(permission),
    mayAttempt: (permission) => !known || set.has(permission),
  };
}
