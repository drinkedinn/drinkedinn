// client/src/admin/moderation/useAdminIdentity.js
//
// Who is signed in, and what may they do.
//
// The shell is the preferred source: pass `permissions` (Set | string[]),
// `role` and `currentUserId` down as props and this hook uses them verbatim
// and makes no request.
//
// When the shell passes nothing, the panel asks the server rather than
// guessing. GET /api/admin/roles/me returns the CALLER'S OWN role and
// permissions and is deliberately NOT gated on roles.read — see
// server/routes/adminRoles.js — precisely so a panel can hide the actions its
// admin would only be refused for. A moderator holds no roles.read, so a gated
// endpoint would have made every panel fail closed and render nothing.
//
// Response shape (verbatim from routes/adminRoles.js):
//   { user_id: number, role: string, permissions: string[] }
//
// If that request fails we stay failed-closed: no action buttons, and the panel
// says why. Being wrong in the direction of "offered a button that 403s" is the
// wrong direction to be wrong in for a trust-and-safety console.

import { useEffect, useState } from 'react';
import api from '../../api';
import { toPermissionSet } from './permissions';

export default function useAdminIdentity({ permissions, role, currentUserId }) {
  const fromProps = toPermissionSet(permissions);

  const [fetched, setFetched] = useState(null); // { permissions: Set, role, userId }
  const [loading, setLoading] = useState(!fromProps);
  const [error, setError] = useState('');

  useEffect(() => {
    if (fromProps) { setLoading(false); return undefined; }

    let alive = true;
    setLoading(true);
    setError('');

    api.get('/admin/roles/me')
      .then((r) => {
        if (!alive) return;
        const list = Array.isArray(r.data?.permissions) ? r.data.permissions : [];
        setFetched({
          permissions: new Set(list.filter((p) => typeof p === 'string')),
          role: typeof r.data?.role === 'string' ? r.data.role : null,
          userId: Number.isFinite(Number(r.data?.user_id)) ? Number(r.data.user_id) : null,
        });
      })
      .catch((err) => {
        if (!alive) return;
        setFetched(null);
        setError(err?.response?.data?.error || 'Could not confirm what your role allows.');
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
    // `fromProps` is derived from the prop each render; depend on the prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);

  const resolved = fromProps || fetched?.permissions || null;

  return {
    // null means "we do not know" — never an empty Set, which would read as
    // "we know, and they may do nothing".
    permissions: resolved,
    known: resolved !== null,
    role: role ?? fetched?.role ?? null,
    userId: currentUserId ?? fetched?.userId ?? null,
    source: fromProps ? 'shell' : fetched ? 'server' : null,
    loading,
    error,
  };
}
