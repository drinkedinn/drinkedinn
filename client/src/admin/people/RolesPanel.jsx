// client/src/admin/people/RolesPanel.jsx
// The admin roster: who holds which role, who gave it to them, and when.
//
// Two asymmetries the server enforces, surfaced here rather than discovered by
// getting refused:
//   1. Only `owner` holds roles.write. A super_admin has every other permission
//      and still cannot mint admins — so a compromised super_admin cannot make
//      more of itself. If you are not an owner, this panel reads only, and says
//      why.
//   2. The last owner cannot demote or revoke themselves. There is no recovery
//      path from an ownerless install that does not involve a database console,
//      so the action is not offered while you are the only one.
//
// The role list comes from GET /admin/roles/catalogue — server truth, never a
// hard-coded copy that drifts.

import { useCallback, useEffect, useState } from 'react';
import Avatar from '../../components/Avatar';
import ActionDialog from './ActionDialog';
import {
  listRoles, roleCatalogue, grantRole, revokeRole, listMembers, errMessage,
} from './peopleApi';
import { C, card, th, td, btn, input, label, fmtDate, fmtDateTime } from './ui';

function RoleChip({ role }) {
  const tone = role === 'owner' ? C.purple : role === 'super_admin' ? C.accentHi : C.teal;
  return (
    <span style={{ background: tone + '22', color: tone, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
      {role}
    </span>
  );
}

function Catalogue({ rows }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return (
    <div style={card({ padding: '18px 22px' })}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>What each role grants</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
        Straight from the server catalogue, so this cannot drift from what the middleware actually checks.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <details key={r.role} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px' }}>
            <summary style={{ cursor: 'pointer', color: C.text, fontSize: 13, fontWeight: 600, listStyle: 'revert' }}>
              <span style={{ marginRight: 8 }}>{r.role}</span>
              <span style={{ color: C.textFaint, fontWeight: 500, fontSize: 12 }}>
                {(r.permissions || []).length} permissions
              </span>
            </summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {(r.permissions || []).map((p) => (
                <span key={p} style={{
                  background: C.cardHover, border: `1px solid ${C.border}`, borderRadius: 6,
                  padding: '2px 8px', fontSize: 11, color: C.textMuted, fontFamily: 'ui-monospace, monospace',
                }}>
                  {p}
                </span>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export default function RolesPanel({ can = () => false, currentUserId = null, onRosterLoaded }) {
  const [roster, setRoster] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const canRead = can('roles.read');
  const canWrite = can('roles.write');
  const canSearchMembers = can('users.read');

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!canRead) { setLoading(false); return undefined; }
    const ctrl = new AbortController();
    let live = true;
    setLoading(true);
    setError('');
    Promise.all([
      listRoles({ signal: ctrl.signal }),
      roleCatalogue({ signal: ctrl.signal }).catch(() => []),
    ])
      .then(([rows, cat]) => {
        if (!live) return;
        setRoster(rows);
        setCatalogue(cat);
        setLoading(false);
        onRosterLoaded?.(rows);
      })
      .catch((e) => {
        if (!live || e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return;
        setRoster([]);
        setError(errMessage(e, 'Could not load the admin roster.'));
        setLoading(false);
      });
    return () => { live = false; ctrl.abort(); };
  }, [canRead, tick, onRosterLoaded]);

  const ownerCount = roster.filter((r) => r?.role === 'owner').length;
  const roleNames = catalogue.map((c) => c?.role).filter((r) => typeof r === 'string' && r);
  const headers = canWrite
    ? ['Member', 'Role', 'Granted by', 'Granted', 'Change']
    : ['Member', 'Role', 'Granted by', 'Granted'];

  const runSearch = async (e) => {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    try {
      const d = await listMembers({ page: 1, search: q });
      setResults(d.users.slice(0, 8));
    } catch (err) {
      setResults([]);
      setSearchError(errMessage(err, 'Could not search members.'));
    }
    setSearching(false);
  };

  const submitGrant = async (reason) => {
    setBusy(true);
    setDialogError('');
    try {
      await grantRole(dialog.userId, dialog.role, reason);
      setBusy(false);
      setDialog(null);
      setResults(null);
      setTerm('');
      reload();
    } catch (e) {
      setBusy(false);
      setDialogError(errMessage(e, 'Could not set that role.'));
    }
  };

  const submitRevoke = async (reason) => {
    setBusy(true);
    setDialogError('');
    try {
      await revokeRole(dialog.userId, reason);
      setBusy(false);
      setDialog(null);
      reload();
    } catch (e) {
      setBusy(false);
      setDialogError(errMessage(e, 'Could not revoke that role.'));
    }
  };

  if (!canRead) {
    return (
      <div style={card({ padding: 28, textAlign: 'center' })}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>The admin roster is not visible to your role</div>
        <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6 }}>
          Reading who holds which role needs <code style={{ color: C.accentHi }}>roles.read</code>,
          which only owner and super_admin hold.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* The write asymmetry, stated up front */}
      <div style={card({
        padding: '14px 18px',
        background: canWrite ? C.accentSoft : C.card,
        borderColor: canWrite ? C.accent + '44' : C.border,
      })}>
        <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.7 }}>
          {canWrite ? (
            <>
              <strong style={{ color: C.accentHi }}>You can grant roles.</strong> Only an owner can —
              super_admin deliberately cannot, so a compromised super_admin cannot mint more admins.
              Every grant, change and revoke needs a typed reason and lands in the audit log with your
              name on it.
            </>
          ) : (
            <>
              <strong style={{ color: C.text }}>Read-only.</strong> Granting, changing and revoking
              roles requires <code style={{ color: C.accentHi }}>roles.write</code>, which only the
              <code> owner</code> role holds. Your role can see the roster but cannot change it, so
              those controls are not shown rather than shown and refused.
            </>
          )}
        </div>
      </div>

      {/* Grant to a member */}
      {canWrite && canSearchMembers && (
        <div style={card({ padding: '18px 22px' })}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Grant a role</div>
          <form onSubmit={runSearch} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 260px' }}>
              <label htmlFor="roles-member-search" style={label}>Find a member by name or email</label>
              <input
                id="roles-member-search"
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="name@example.com"
                style={{ ...input, width: '100%' }}
              />
            </div>
            <button type="submit" disabled={!term.trim() || searching} style={btn({ tone: 'primary', size: 'md', disabled: !term.trim() || searching })}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {searchError && (
            <div role="alert" style={{ color: C.red, fontSize: 12.5, marginTop: 10 }}>{searchError}</div>
          )}

          {results && results.length === 0 && !searchError && (
            <div style={{ color: C.textMuted, fontSize: 12.5, marginTop: 12 }}>No member matches that.</div>
          )}

          {results && results.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((m) => {
                const existing = roster.find((r) => String(r.user_id) === String(m.id));
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px',
                  }}>
                    <Avatar src={m.avatar} name={m.name || 'Member'} size={30} />
                    <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.name || `Member #${m.id}`}</div>
                      <div style={{ fontSize: 11, color: C.textFaint, wordBreak: 'break-all' }}>{m.email || '—'}</div>
                    </div>
                    {existing && <RoleChip role={existing.role} />}
                    <div>
                      <label htmlFor={`grant-role-${m.id}`} style={{ ...label, marginBottom: 4 }}>Role</label>
                      <select
                        id={`grant-role-${m.id}`}
                        defaultValue=""
                        onChange={(e) => {
                          const role = e.target.value;
                          if (!role) return;
                          setDialogError('');
                          setDialog({
                            kind: 'grant',
                            userId: m.id,
                            name: m.name || `Member #${m.id}`,
                            role,
                            previous: existing?.role || null,
                          });
                          e.target.value = '';
                        }}
                        style={{ ...input, padding: '7px 10px', fontSize: 13 }}
                      >
                        <option value="">Choose…</option>
                        {roleNames.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {canWrite && !canSearchMembers && (
        <div style={card({ padding: '14px 18px', fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 })}>
          Granting a role to someone not already on the roster needs <code style={{ color: C.accentHi }}>users.read</code> to find them.
          Your role can change existing rows below but cannot search members.
        </div>
      )}

      {/* Roster */}
      <div style={card()}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Admin roster</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            {loading ? 'loading…' : `${roster.length} ${roster.length === 1 ? 'row' : 'rows'} · ${ownerCount} owner${ownerCount === 1 ? '' : 's'}`}
          </span>
          <button type="button" onClick={reload} disabled={loading} style={{ ...btn({ tone: 'neutral', disabled: loading }), marginLeft: 'auto' }}>
            Refresh
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {headers.map((h) => (
                  <th key={h} scope="col" style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={headers.length} style={{ ...td, textAlign: 'center', color: C.textMuted, padding: '32px 16px' }}>Loading roster…</td></tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={headers.length} style={{ ...td, textAlign: 'center', padding: '28px 16px' }}>
                    <div role="alert" style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</div>
                    <button type="button" onClick={reload} style={btn({ tone: 'neutral', size: 'md' })}>Try again</button>
                  </td>
                </tr>
              )}

              {!loading && !error && roster.length === 0 && (
                <tr>
                  <td colSpan={headers.length} style={{ ...td, textAlign: 'center', padding: '28px 16px', color: C.textMuted, fontSize: 13, lineHeight: 1.7 }}>
                    No explicit role rows. That does not mean no admins: an account with
                    {' '}<code>is_admin = 1</code> and no row here is treated as <code>super_admin</code> by
                    the server's migration path, and will not appear in this table until a role is granted.
                  </td>
                </tr>
              )}

              {!loading && !error && roster.map((r, i) => {
                const isMe = currentUserId != null && String(currentUserId) === String(r?.user_id);
                const lastOwner = r?.role === 'owner' && ownerCount <= 1;
                const selfDemoteBlocked = isMe && lastOwner;
                return (
                  <tr key={r?.user_id ?? `roster-${i}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={r?.avatar} name={r?.name || 'Admin'} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: C.text }}>
                            {r?.name || `Member #${r?.user_id ?? '?'}`}{isMe ? ' (you)' : ''}
                          </div>
                          <div style={{ fontSize: 11, color: C.textFaint, wordBreak: 'break-all' }}>{r?.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}><RoleChip role={r?.role || 'unknown'} /></td>
                    <td style={{ ...td, color: C.textMuted, fontSize: 12 }}>
                      {r?.granted_by_name || (r?.granted_by ? `Member #${r.granted_by}` : 'Not recorded')}
                    </td>
                    <td style={{ ...td, color: C.textFaint, fontSize: 12, whiteSpace: 'nowrap' }} title={fmtDateTime(r?.granted_at)}>
                      {fmtDate(r?.granted_at)}
                    </td>
                    {canWrite && (
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <label htmlFor={`row-role-${r?.user_id}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                            Change {r?.name || 'member'}'s role
                          </label>
                          <select
                            id={`row-role-${r?.user_id}`}
                            value={r?.role || ''}
                            onChange={(e) => {
                              const role = e.target.value;
                              if (!role || role === r?.role) return;
                              setDialogError('');
                              setDialog({
                                kind: 'grant',
                                userId: r.user_id,
                                name: r?.name || `Member #${r?.user_id}`,
                                role,
                                previous: r?.role || null,
                                // The server blocks the LAST OWNER demoting
                                // THEMSELVES, and nothing else. Demoting the only
                                // other owner goes through and leaves an install
                                // with no one who can grant roles. The dialog says
                                // so before it happens.
                                lastOwnerLoss: lastOwner && role !== 'owner',
                              });
                              e.target.value = r?.role || '';
                            }}
                            style={{ ...input, padding: '6px 10px', fontSize: 12.5 }}
                          >
                            {roleNames.length === 0 && <option value={r?.role || ''}>{r?.role || 'unknown'}</option>}
                            {roleNames.map((name) => (
                              <option
                                key={name}
                                value={name}
                                disabled={selfDemoteBlocked && name !== 'owner'}
                              >
                                {name}{selfDemoteBlocked && name !== 'owner' ? ' — blocked' : ''}
                              </option>
                            ))}
                          </select>

                          {lastOwner ? (
                            <span style={{ fontSize: 11.5, color: C.amber, maxWidth: 300, lineHeight: 1.5 }}>
                              {isMe
                                ? 'You are the only owner. The server refuses to revoke or demote the last owner, so neither is offered — promote a second owner first.'
                                : 'The only owner. Revoking is refused by the server. Demoting them is NOT refused, and would leave nobody who can grant roles — promote a second owner first.'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDialogError('');
                                setDialog({ kind: 'revoke', userId: r.user_id, name: r?.name || `Member #${r?.user_id}`, role: r?.role });
                              }}
                              style={btn({ tone: 'danger' })}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Catalogue rows={catalogue} />

      {!loading && !error && catalogue.length === 0 && (
        <div style={card({ padding: '14px 18px', fontSize: 12.5, color: C.textMuted, lineHeight: 1.65 })}>
          <strong style={{ color: C.text }}>Role catalogue unavailable.</strong>{' '}
          <code style={{ color: C.accentHi }}>GET /admin/roles/catalogue</code> did not answer, so the
          list of roles and what each one grants cannot be shown. Existing rows are still listed above,
          but this panel will not offer a role list it cannot verify against the server.
        </div>
      )}

      {/* Dialogs */}
      {/* Handing out owner, or demoting the last one, is not a click-through:
          both ask for the member's name typed out as well as a reason. */}
      {dialog?.kind === 'grant' && (
        <ActionDialog
          title={dialog.previous ? `Change ${dialog.name} to ${dialog.role}` : `Grant ${dialog.role} to ${dialog.name}`}
          tone={dialog.role === 'owner' || dialog.lastOwnerLoss ? 'danger' : 'primary'}
          confirmName={dialog.role === 'owner' || dialog.lastOwnerLoss ? dialog.name : null}
          submitLabel={dialog.previous ? 'Change role' : 'Grant role'}
          busy={busy}
          error={dialogError}
          summary={(
            <>
              <strong style={{ color: C.text }}>{dialog.name}</strong>
              {dialog.previous
                ? <> moves from <code>{dialog.previous}</code> to <code>{dialog.role}</code>.</>
                : <> gains the <code>{dialog.role}</code> role and admin access.</>}
              {' '}They immediately hold{' '}
              {(catalogue.find((c) => c.role === dialog.role)?.permissions || []).length || 'all listed'}
              {' '}permissions, and their account is marked as an admin.
              {dialog.role === 'owner' && ' An owner can grant and revoke any role, including yours.'}
              {dialog.lastOwnerLoss && (
                <div style={{ marginTop: 10, color: C.amber, fontWeight: 600 }}>
                  This is the last owner. After this change no one holds roles.write, so no one —
                  including you — can grant or revoke a role again without direct database access.
                  Promote a second owner first.
                </div>
              )}
            </>
          )}
          onCancel={() => { if (!busy) { setDialog(null); setDialogError(''); } }}
          onSubmit={submitGrant}
        />
      )}

      {dialog?.kind === 'revoke' && (
        <ActionDialog
          title={`Revoke ${dialog.name}'s admin role`}
          tone="danger"
          confirmName={dialog.name}
          submitLabel="Revoke role"
          busy={busy}
          error={dialogError}
          summary={(
            <>
              <strong style={{ color: C.red }}>{dialog.name} loses the <code>{dialog.role}</code> role
              and all admin access.</strong>{' '}
              Their row is removed from the roster and <code>is_admin</code> is set to 0. Their member
              account, content and history are untouched — this is a demotion, not a deletion.
            </>
          )}
          onCancel={() => { if (!busy) { setDialog(null); setDialogError(''); } }}
          onSubmit={submitRevoke}
        />
      )}
    </div>
  );
}
