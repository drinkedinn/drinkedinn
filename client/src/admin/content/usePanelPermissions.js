// src/admin/content/usePanelPermissions.js
// What this admin is allowed to do, resolved once for the panel.
//
// Order of truth:
//   1. `permissions` passed by the shell (array or Set of permission strings).
//      Cheapest, exact, no request. Preferred.
//   2. GET /api/admin/roles/me → { user_id, role, permissions: [] }. That route
//      is deliberately NOT gated on roles.read (see routes/adminRoles.js), so
//      every admin — moderator included — can read their own permissions. It
//      exists precisely so panels can hide what the caller would be refused.
//   3. Neither answered → FAIL CLOSED: no mutating control renders, and the UI
//      says why instead of pretending the role has nothing.
//
// The server (middleware/adminAuth.js) is the only real gate. This is about
// not offering an action whose only outcome is a 403 and a row in the audit
// log saying an admin tried something they cannot do.

import { useEffect, useMemo, useState } from 'react';
import api from '../../api';
import { toPermissionSet } from './permissions';
import { apiError } from './ui';

// One request per page load, shared by both panels — switching between Content
// and Places must not re-ask who you are. Module scope only: a permission set
// in localStorage would outlive the decision that produced it, so a revoked
// role would keep its buttons until the browser was cleared.
let inflight = null;

function fetchSelf() {
  if (!inflight) {
    inflight = api.get('/admin/roles/me')
      .then((r) => ({
        role: typeof r?.data?.role === 'string' ? r.data.role : null,
        permissions: Array.isArray(r?.data?.permissions)
          ? r.data.permissions.filter((p) => typeof p === 'string')
          : [],
      }))
      .catch((e) => { inflight = null; throw e; }); // a failure must be retryable
  }
  return inflight;
}

/**
 * @param {{ permissions?: string[]|Set<string>|null, role?: string|null }} props
 * @returns {{ ready: boolean, source: string, role: string|null,
 *             error: string, can: (p: string) => boolean }}
 */
export default function usePanelPermissions({ permissions = null, role = null } = {}) {
  const fromShell = useMemo(() => toPermissionSet(permissions), [permissions]);
  // Depend on contents, not identity — a shell that passes a fresh array on
  // every render must not re-fire the request.
  const shellKey = fromShell ? [...fromShell].sort().join('|') : '';

  const [fetched, setFetched] = useState(null);   // Set | null
  const [fetchedRole, setFetchedRole] = useState(null);
  const [state, setState] = useState(fromShell ? 'shell' : 'pending');
  const [error, setError] = useState('');

  useEffect(() => {
    if (fromShell) { setState('shell'); setError(''); return undefined; }

    let alive = true;
    setState('pending');
    setError('');
    fetchSelf()
      .then((me) => {
        if (!alive) return;
        setFetched(new Set(me.permissions));
        setFetchedRole(me.role);
        setState('self');
      })
      .catch((e) => {
        if (!alive) return;
        setFetched(null);
        setFetchedRole(null);
        setState('failed');
        setError(apiError(e, 'Could not read your admin permissions.'));
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellKey, fromShell === null]);

  const set = fromShell || fetched;

  return useMemo(() => ({
    ready: state !== 'pending',
    source: state,
    role: role || fetchedRole,
    error,
    // Unresolved means no. Never yes.
    can: (permission) => !!set && set.has(permission),
  }), [state, role, fetchedRole, error, set]);
}
