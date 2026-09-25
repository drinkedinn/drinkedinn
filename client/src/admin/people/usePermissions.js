// client/src/admin/people/usePermissions.js
// Which buttons this admin is allowed to see.
//
// The server is the enforcer (middleware/adminAuth.js). This is only about not
// offering an action that would come back 403 — a console that shows you a Ban
// button and then refuses it is teaching you to ignore its own affordances.
//
// Where the permission set comes from, in order:
//   1. `permissions` passed by the shell — an array or Set of permission
//      strings. Cheapest and exact. Preferred.
//   2. `role` passed by the shell — looked up in GET /admin/roles/catalogue,
//      which is server truth, so no client-side copy of the role table can
//      drift. Only owner/super_admin can read the catalogue, so this path
//      works for them and quietly fails for everyone else.
//   3. Neither — FAIL CLOSED. Read-only, with a banner saying so. A console
//      that guesses upward is how a support account discovers it can ban.

import { useEffect, useMemo, useRef, useState } from 'react';
import { roleCatalogue, errMessage } from './peopleApi';

export const PERM = {
  READ: 'users.read',
  WARN: 'users.warn',
  SUSPEND: 'users.suspend',
  BAN: 'users.ban',
  DELETE: 'users.delete',
  RESTORE: 'users.restore',
  REPORTS_READ: 'reports.read',
  ROLES_READ: 'roles.read',
  ROLES_WRITE: 'roles.write',
};

function normalise(permissions) {
  if (!permissions) return null;
  if (permissions instanceof Set) return [...permissions];
  if (Array.isArray(permissions)) return permissions.filter((p) => typeof p === 'string');
  return null;
}

export default function usePermissions({ role = null, permissions = null } = {}) {
  const given = useMemo(() => normalise(permissions), [permissions]);
  // Depend on the contents, not the array identity — a shell that passes a
  // fresh array literal every render must not re-trigger the catalogue fetch.
  const givenKey = given ? given.slice().sort().join('|') : '';

  const [resolved, setResolved] = useState(() => (given ? new Set(given) : null));
  const [source, setSource] = useState(given ? 'shell' : 'pending');
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    mounted.current = true;
    if (given) {
      setResolved(new Set(given));
      setSource('shell');
      setError('');
      return undefined;
    }
    if (!role) {
      setResolved(new Set());
      setSource('none');
      setError('');
      return undefined;
    }
    const ctrl = new AbortController();
    setSource('pending');
    roleCatalogue({ signal: ctrl.signal })
      .then((rows) => {
        if (!mounted.current) return;
        const match = rows.find((r) => r?.role === role);
        if (match && Array.isArray(match.permissions)) {
          setResolved(new Set(match.permissions));
          setSource('catalogue');
          setError('');
        } else {
          setResolved(new Set());
          setSource('unknown-role');
          setError(`The server catalogue has no role named "${role}".`);
        }
      })
      .catch((e) => {
        if (!mounted.current || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
        setResolved(new Set());
        setSource('failed');
        setError(errMessage(e, 'Could not read the role catalogue.'));
      });
    return () => ctrl.abort();
  }, [givenKey, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = resolved;
  const ready = set !== null;

  return useMemo(() => ({
    ready,
    role,
    source,
    error,
    // Unresolved means no, not yes.
    can: (permission) => !!set && set.has(permission),
    list: set ? [...set].sort() : [],
  }), [ready, role, source, error, set]);
}
