// client/src/admin/people/PeoplePanel.jsx
// Entry point for the People panel. Mount this; it owns the two tabs.
//
// Permissions arrive from the shell. See usePermissions.js for the order of
// preference and why an unresolved permission set means read-only rather than
// full access.

import { useCallback, useEffect, useMemo, useState } from 'react';
import PeopleList from './PeopleList';
import MemberDetail from './MemberDetail';
import RolesPanel from './RolesPanel';
import usePermissions from './usePermissions';
import { listRoles } from './peopleApi';
import { C, card, btn } from './ui';

const TABS = [
  { id: 'members', label: 'Members' },
  { id: 'roster', label: 'Admin roster' },
];

export default function PeoplePanel({
  // Either pass `permissions` (array or Set of permission strings) — preferred —
  // or `role` alone and the panel resolves it from the server catalogue.
  role = null,
  permissions = null,
  admin = null,              // convenience: { role, permissions }
  user = null,               // the signed-in admin, for self-action guards
  currentUserId = null,
}) {
  const effRole = admin?.role ?? role;
  const effPermissions = admin?.permissions ?? permissions;
  const meId = currentUserId ?? user?.id ?? null;

  const perms = usePermissions({ role: effRole, permissions: effPermissions });
  const [tab, setTab] = useState('members');
  const [selected, setSelected] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [roster, setRoster] = useState([]);

  const canReadRoles = perms.can('roles.read');

  // Loaded here as well as in RolesPanel so the member view can tell you that
  // the person you are about to delete is an admin, before the server does.
  useEffect(() => {
    if (!canReadRoles) { setRoster([]); return undefined; }
    const ctrl = new AbortController();
    let live = true;
    listRoles({ signal: ctrl.signal })
      .then((rows) => { if (live) setRoster(rows); })
      .catch(() => { if (live) setRoster([]); });
    return () => { live = false; ctrl.abort(); };
  }, [canReadRoles, refreshToken]);

  const onRosterLoaded = useCallback((rows) => setRoster(Array.isArray(rows) ? rows : []), []);

  const roleRow = useMemo(() => {
    if (!selected) return null;
    return roster.find((r) => String(r?.user_id) === String(selected.id)) || null;
  }, [roster, selected]);

  const handleChanged = useCallback((evt = {}) => {
    if (evt.deleted) setSelected(null);
    else if (evt.patch) setSelected((cur) => (cur ? { ...cur, ...evt.patch } : cur));
    setRefreshToken((t) => t + 1);
  }, []);

  const permissionWarning = !perms.ready || ['none', 'failed', 'unknown-role'].includes(perms.source);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Tabs + who you are */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setTab(t.id)}
              style={{
                background: active ? C.accentSoft : C.card,
                border: `1px solid ${active ? C.accent + '66' : C.border}`,
                color: active ? C.accentHi : C.textMuted,
                borderRadius: 10, padding: '8px 16px', fontSize: 13,
                fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          );
        })}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted }}>
          {perms.role ? <>Signed in as <strong style={{ color: C.text }}>{perms.role}</strong> · {perms.list.length} permissions</> : 'Role unknown'}
        </div>
      </div>

      {permissionWarning && (
        <div style={card({ padding: '14px 18px', background: C.amber + '11', borderColor: C.amber + '44' })}>
          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.7 }}>
            <strong style={{ color: C.amber }}>Running read-only.</strong>{' '}
            {perms.error || 'This panel was not told which permissions you hold, so it assumes none and hides every action.'}
            {' '}Pass <code style={{ color: C.accentHi }}>permissions</code> (an array of permission strings)
            or <code style={{ color: C.accentHi }}>role</code> from the admin shell to enable the actions your
            role actually allows. Failing closed is deliberate: guessing upward is how a support account
            discovers it can ban.
          </div>
        </div>
      )}

      {tab === 'members' && (
        selected ? (
          <MemberDetail
            member={selected}
            can={perms.can}
            currentUserId={meId}
            roleRow={roleRow}
            rolesKnown={canReadRoles}
            onBack={() => setSelected(null)}
            onChanged={handleChanged}
          />
        ) : (
          <PeopleList
            can={perms.can}
            selectedId={null}
            refreshToken={refreshToken}
            onSelect={(m) => setSelected(m)}
          />
        )
      )}

      {tab === 'roster' && (
        <RolesPanel
          can={perms.can}
          currentUserId={meId}
          onRosterLoaded={onRosterLoaded}
        />
      )}

      {/* Footer honesty */}
      <div style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.7, padding: '4px 2px' }}>
        This console shows aggregates and account state. It never renders private message content, and it
        has no way to read or set a password. Every mutating request under <code>/api/admin</code> — roles
        included — is written to <code>admin_audit</code> by the server with your name, the outcome and,
        for high-impact actions, your typed reason. Reads are not audited, so what you look up here is not
        recorded; treat that as a reason to look up only what you need, not as permission to browse.
        {' '}
        <button
          type="button"
          onClick={() => setRefreshToken((t) => t + 1)}
          style={{ ...btn({ tone: 'quiet' }), marginLeft: 6 }}
        >
          Refresh data
        </button>
      </div>
    </div>
  );
}
