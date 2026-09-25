// client/src/admin/command/useAdminIdentity.js
//
// Who is signed in, and what are they allowed to do.
//
// The brief says a prop from the shell is fine, and a prop is still the
// preferred source — but "render the button and let the server 403" is exactly
// the failure mode we are told to avoid, and an unwired prop silently puts us
// back there. So when the shell does not pass a permission set, this falls
// back to GET /api/admin/roles/me, which the server deliberately leaves
// ungated for precisely this reason:
//
//   "every admin needs to know what they themselves may do, or the console
//    cannot hide actions they would only be refused for"
//     — server/routes/adminRoles.js
//
// The result is cached at module scope so the dashboard and the audit log
// share one request per page load, not one each. It is never written to
// localStorage: a stale cached permission set is a security answer that
// outlives the decision that produced it.

import { useEffect, useState } from 'react';
import api from '../../api';

/** @type {{ role: string|null, permissions: string[] }|null} */
let cached = null;
/** @type {Promise<{ role: string|null, permissions: string[]|null }>|null} */
let inFlight = null;

/** Drop the cached identity — call after a role change elsewhere in the shell. */
export function resetAdminIdentity() {
  cached = null;
  inFlight = null;
}

function loadIdentity() {
  if (!inFlight) {
    inFlight = api.get('/admin/roles/me')
      .then((res) => {
        const data = res?.data && typeof res.data === 'object' ? res.data : {};
        const permissions = Array.isArray(data.permissions)
          ? data.permissions.filter((p) => typeof p === 'string')
          : null;
        const value = {
          role: typeof data.role === 'string' && data.role ? data.role : null,
          permissions,
        };
        // Only cache a usable answer. A malformed one should be retried.
        if (permissions) cached = value;
        return value;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

/**
 * @param {{ role?: string|null, permissions?: string[]|Set<string>|null }} props
 * @returns {{
 *   role: string|null,
 *   permissions: string[]|Set<string>|null,
 *   resolving: boolean,
 *   source: 'shell'|'server'|'unknown'|'pending',
 * }}
 *
 * `permissions: null` with `resolving: false` means we genuinely could not
 * find out — callers should then render optimistically and let the server be
 * the gate, showing its message on a 403.
 */
export default function useAdminIdentity({ role = null, permissions = null } = {}) {
  const supplied = permissions != null;
  const [fetched, setFetched] = useState(() => cached);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (supplied || cached) return undefined;
    let alive = true;
    loadIdentity().then(
      (value) => { if (alive) { if (value.permissions) setFetched(value); else setFailed(true); } },
      () => { if (alive) setFailed(true); },
    );
    return () => { alive = false; };
  }, [supplied]);

  if (supplied) return { role: role ?? null, permissions, resolving: false, source: 'shell' };
  if (fetched) return { role: fetched.role ?? role ?? null, permissions: fetched.permissions, resolving: false, source: 'server' };
  if (failed) return { role: role ?? null, permissions: null, resolving: false, source: 'unknown' };
  return { role: role ?? null, permissions: null, resolving: true, source: 'pending' };
}
