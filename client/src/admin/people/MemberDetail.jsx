// client/src/admin/people/MemberDetail.jsx
// One member, everything the server will tell us, and only the actions this
// admin is actually allowed to take.
//
// Deliberate omissions:
//   · No password affordance of any kind. Passwords exist only as hashes; there
//     is nothing to show and nothing to set from here.
//   · No private message content, ever — not summarised, not counted per
//     conversation, not linked.
//   · No report text. reports.reason is free text — the child-safety endpoint
//     puts a reporter's account of what they saw in it — so this view shows the
//     COUNT and the CATEGORY and never the string. Reading the report itself is
//     the Moderation panel's job, where that access is the point.
//   · No "last seen" timeline. The users table has last_active_date, the admin
//     API does not return it, and building a presence tracker out of an
//     operations console is how a safety tool becomes a surveillance tool.

import { useEffect, useState } from 'react';
import Avatar from '../../components/Avatar';
import ActionDialog from './ActionDialog';
import {
  ENFORCEMENT, deleteMember, setVerified, setPremium, setBadge,
  recentReports, reportTallyFor, errMessage,
} from './peopleApi';
import { C, card, btn, label, input, fmtDate, fmtNum, accountAge } from './ui';

const BADGES = ['🏆', '⭐', '🔥', '🥇'];

function Section({ title, hint, children, tone = null }) {
  return (
    <div style={card({ padding: '18px 22px', borderColor: tone ? tone + '44' : C.border })}>
      <div style={{ fontSize: 13, fontWeight: 700, color: tone || C.text, marginBottom: hint ? 4 : 12 }}>{title}</div>
      {hint && <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, marginBottom: 12 }}>{hint}</div>}
      {children}
    </div>
  );
}

function Field({ k, v, muted = false }) {
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ fontSize: 11, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 13.5, color: muted ? C.textMuted : C.text, fontWeight: muted ? 400 : 600, marginTop: 3, lineHeight: 1.45 }}>{v}</div>
    </div>
  );
}

const grid = { display: 'flex', flexWrap: 'wrap', gap: 20 };

export default function MemberDetail({
  member,
  // A missing `can` means "we were told nothing", which must read as "allowed
  // nothing". Defaulting to deny keeps a wiring mistake from opening the Delete
  // button to a role that has no business seeing it.
  can = () => false,
  currentUserId = null,
  roleRow = null,
  rolesKnown = false,
  onBack,
  onChanged,
}) {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [flagBusy, setFlagBusy] = useState('');
  const [flagError, setFlagError] = useState('');
  const [tally, setTally] = useState(null);
  const [tallyError, setTallyError] = useState('');

  const memberId = member?.id ?? null;
  const canSeeReports = can('reports.read');

  useEffect(() => {
    setDialog(null);
    setDialogError('');
    setFlagError('');
    setTally(null);
    setTallyError('');
    if (!memberId || !canSeeReports) return undefined;
    const ctrl = new AbortController();
    let live = true;
    recentReports({ signal: ctrl.signal })
      .then((rows) => { if (live) setTally(reportTallyFor(memberId, rows)); })
      .catch((e) => {
        if (!live || e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return;
        setTallyError(errMessage(e, 'Could not read the reports window.'));
      });
    return () => { live = false; ctrl.abort(); };
  }, [memberId, canSeeReports]);

  if (!member) {
    return (
      <div style={card({ padding: 28, textAlign: 'center', color: C.textMuted, fontSize: 13 })}>
        Select a member from the list.
      </div>
    );
  }

  const isSelf = currentUserId != null && String(currentUserId) === String(member.id);
  const holdsAdminRole = !!roleRow;
  const name = member.name || `Member #${member.id}`;

  // ── Account flags (verify / premium / badge) ───────────────────────────────
  // lib/permissions.js has no permission for these — the routes only require
  // is_admin. Gating on users.warn is this panel's choice: the lowest
  // people-mutating permission, so read_only, analytics, marketing and finance
  // roles cannot flip another member's account state from here.
  const canEditFlags = can('users.warn');

  // `patch` is what we know we just set, so the open detail view stays truthful
  // without a refetch the list API cannot do for a single member anyway.
  const runFlag = async (key, fn, patch) => {
    setFlagBusy(key);
    setFlagError('');
    try {
      await fn();
      onChanged?.({ patch });
    } catch (e) {
      setFlagError(errMessage(e, 'Could not update that flag.'));
    }
    setFlagBusy('');
  };

  const submitDelete = async (reason) => {
    setBusy(true);
    setDialogError('');
    try {
      await deleteMember(member.id, reason);
      setBusy(false);
      setDialog(null);
      onChanged?.({ deleted: true, id: member.id });
    } catch (e) {
      setBusy(false);
      setDialogError(errMessage(e, 'Could not delete that member.'));
    }
  };

  const canDelete = can('users.delete');
  const deleteBlock = isSelf
    ? 'You cannot delete your own account here. The server refuses it — use Settings in the main app.'
    : holdsAdminRole
      ? `${name} holds the ${roleRow.role} admin role. The server refuses to delete an admin account — revoke the role in the Admin roster first.`
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={card({ padding: '20px 22px' })}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar src={member.avatar} name={name} size={56} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{name}</span>
              {member.verified ? <span title="Verified" style={{ color: C.accentHi, fontSize: 16 }}>✓</span> : null}
              {member.premium ? <span style={{ background: C.amber + '22', color: C.amber, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Premium</span> : null}
              {member.badge ? <span title="Badge" style={{ fontSize: 15 }}>{member.badge}</span> : null}
              {holdsAdminRole && (
                <span style={{ background: C.purple + '22', color: C.purple, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                  {roleRow.role}
                </span>
              )}
              {isSelf && (
                <span style={{ background: C.border, color: C.textMuted, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>You</span>
              )}
            </div>
            <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>{member.title || 'No headline'}</div>
            <div style={{ color: C.textFaint, fontSize: 12, marginTop: 2, wordBreak: 'break-all' }}>
              {member.email || 'No email on file'} · member #{member.id}
            </div>
          </div>
          <button type="button" onClick={onBack} style={btn({ tone: 'neutral', size: 'md' })}>← All members</button>
        </div>
      </div>

      {/* Identity / account */}
      <Section title="Account">
        <div style={grid}>
          <Field k="Joined" v={fmtDate(member.created_at)} />
          <Field k="Account age" v={accountAge(member.created_at)} />
          <Field k="Onboarding" v={member.onboarded ? 'Completed' : 'Not finished'} />
          <Field k="Verified" v={member.verified ? 'Yes' : 'No'} />
          <Field k="Premium" v={member.premium ? 'Yes' : 'No'} />
          <Field k="Badge" v={member.badge || 'None'} />
          <Field k="Last active" v="Not returned by this API" muted />
          <Field k="Country" v="Not returned by this API" muted />
        </div>
        <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 14, lineHeight: 1.6 }}>
          The users table does hold <code>last_active_date</code> and <code>country_code</code>, but
          <code> GET /admin/users</code> does not select them. Shown as unavailable rather than guessed.
        </div>
      </Section>

      {/* Counts */}
      <Section title="Activity">
        <div style={grid}>
          <Field k="Posts" v={fmtNum(member.post_count)} />
          <Field k="Cheers given" v={fmtNum(member.cheer_count)} />
          <Field k="Connections" v={fmtNum(member.connection_count)} />
          <Field k="Followers" v="Not a concept in this schema" muted />
          {canSeeReports ? (
            <>
              <Field
                k="Reports received"
                v={tally ? `${fmtNum(tally.received)}${tally.pendingReceived ? ` (${tally.pendingReceived} open)` : ''}` : tallyError ? 'Unavailable' : 'Counting…'}
              />
              {tally && tally.severe > 0 && (
                <Field k="Child-safety reports" v={<span style={{ color: C.red }}>{fmtNum(tally.severe)} — handle in Moderation</span>} />
              )}
              <Field k="Reports filed" v={tally ? fmtNum(tally.filed) : tallyError ? 'Unavailable' : 'Counting…'} />
            </>
          ) : (
            <Field k="Reports" v="Needs reports.read" muted />
          )}
        </div>
        {canSeeReports && (
          <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 14, lineHeight: 1.6 }}>
            {tallyError
              ? tallyError
              : `Counted within the ${tally ? fmtNum(tally.windowSize) : '50'} most recent reports platform-wide — a window, not a lifetime total, and it undercounts an older account. ` +
                (tally && tally.categories.length ? `Categories: ${tally.categories.join(', ')}. ` : '') +
                'What a reporter wrote is never shown here — only the category it falls into. Open the report itself in Moderation to read it.'}
          </div>
        )}
      </Section>

      {/* Enforcement state */}
      <Section title="Enforcement state" tone={C.amber}>
        <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
          Unknown from this console. The schema carries <code>suspended_until</code>,
          {' '}<code>banned_at</code> and <code>moderation_note</code> on the users table, but no admin
          endpoint reads or writes them yet, so this panel will not claim a member is in good standing.
          Treat enforcement history as unverified until those routes exist.
        </div>
      </Section>

      {/* Actions */}
      <Section
        title="Actions"
        hint="Anything that fires from here asks for a typed reason first and records it against your account. Actions your role cannot take are not shown at all."
      >
        {/* Enforcement actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {ENFORCEMENT.filter((a) => can(a.permission)).map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={!a.available}
              title={a.available ? a.effect : `No server route yet — ${a.endpoint}`}
              style={btn({ tone: a.tone, size: 'md', disabled: !a.available })}
            >
              {a.label}
            </button>
          ))}
          {ENFORCEMENT.every((a) => !can(a.permission)) && (
            <div style={{ fontSize: 12.5, color: C.textMuted }}>
              Your role holds none of users.warn, users.suspend, users.ban or users.restore.
            </div>
          )}
        </div>

        {ENFORCEMENT.some((a) => can(a.permission)) && (
          <div style={{
            background: C.amber + '11', border: `1px solid ${C.amber}44`, borderRadius: 10,
            padding: '12px 14px', fontSize: 12, color: C.textMuted, lineHeight: 1.65, marginBottom: 16,
          }}>
            <strong style={{ color: C.amber }}>Warn, Suspend, Ban and Restore are not wired.</strong>{' '}
            The permissions exist and the columns exist; the routes do not. Rather than send a request
            that can only 404, the buttons are inert. They expect:{' '}
            {ENFORCEMENT.map((a) => a.endpoint).join(' · ')}.
          </div>
        )}

        {/* Delete */}
        {canDelete && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            {deleteBlock ? (
              <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
                <strong style={{ color: C.text }}>Delete unavailable.</strong> {deleteBlock}
              </div>
            ) : (
              <>
                <button type="button" onClick={() => { setDialogError(''); setDialog({ type: 'delete' }); }} style={btn({ tone: 'danger', size: 'md' })}>
                  Delete member…
                </button>
                <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 8, lineHeight: 1.6 }}>
                  Permanent erasure of the account and everything attached to it. Not reversible.
                  {!rolesKnown && ' Your role cannot read the admin roster, so this panel cannot tell whether this member is an admin — the server will refuse if they are.'}
                </div>
              </>
            )}
          </div>
        )}
        {!canDelete && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, fontSize: 12.5, color: C.textMuted }}>
            Deleting members needs <code style={{ color: C.accentHi }}>users.delete</code>, which your role does not have.
          </div>
        )}
      </Section>

      {/* Account flags */}
      {canEditFlags && (
        <Section
          title="Account flags"
          hint="Verification, premium and badge — cosmetic account state, not enforcement. The server records each change in the audit log against your name, but does not demand a reason for them the way it does for a ban or a deletion, so they apply on click."
        >
          {flagError && (
            <div role="alert" style={{ background: C.red + '22', border: `1px solid ${C.red}44`, borderRadius: 10, padding: '10px 14px', color: C.red, fontSize: 12.5, marginBottom: 12 }}>
              {flagError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <button
              type="button"
              disabled={flagBusy === 'verify'}
              onClick={() => runFlag(
                'verify',
                () => setVerified(member.id, !member.verified),
                { verified: member.verified ? 0 : 1 },
              )}
              style={btn({ tone: member.verified ? 'primary' : 'neutral', size: 'md', disabled: flagBusy === 'verify' })}
            >
              {member.verified ? 'Remove verification' : 'Mark verified'}
            </button>
            <button
              type="button"
              disabled={flagBusy === 'premium'}
              onClick={() => runFlag(
                'premium',
                () => setPremium(member.id, !member.premium),
                { premium: member.premium ? 0 : 1 },
              )}
              style={btn({ tone: member.premium ? 'warn' : 'neutral', size: 'md', disabled: flagBusy === 'premium' })}
            >
              {member.premium ? 'Remove premium' : 'Grant premium'}
            </button>
            <div>
              <label htmlFor="member-badge" style={label}>Badge</label>
              <select
                id="member-badge"
                value={member.badge || ''}
                disabled={flagBusy === 'badge'}
                onChange={(e) => {
                  const next = e.target.value || null;
                  runFlag('badge', () => setBadge(member.id, next), { badge: next });
                }}
                style={{ ...input, padding: '8px 12px' }}
              >
                <option value="">None</option>
                {BADGES.map((b) => <option key={b} value={b}>{b}</option>)}
                {member.badge && !BADGES.includes(member.badge) && (
                  <option value={member.badge}>{member.badge}</option>
                )}
              </select>
            </div>
          </div>
        </Section>
      )}

      {/* Credentials */}
      <Section title="Credentials">
        <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
          Passwords are stored only as salted hashes. They cannot be viewed, exported or set from this
          console, by anyone, at any role — there is no endpoint that would return one and none will be
          added here. A member who is locked out resets their own password by email.
        </div>
      </Section>

      {/* Dialogs */}
      {dialog?.type === 'delete' && (
        <ActionDialog
          title={`Delete ${name}`}
          tone="danger"
          confirmName={name}
          submitLabel="Delete permanently"
          busy={busy}
          error={dialogError}
          auditNote="users.delete is a high-impact permission: the server refuses the request outright if this reason is under 8 characters, and writes the reason, your name and the outcome to the admin audit log."
          summary={(
            <>
              <strong style={{ color: C.red }}>This permanently erases {name} (member #{member.id}{member.email ? `, ${member.email}` : ''}).</strong>
              {' '}Their {fmtNum(member.post_count)} posts, comments, cheers, connections, messages and
              media go with the account, through the same erasure path as a self-service deletion.
              Nothing here can be undone and there is no restore.
            </>
          )}
          onCancel={() => { if (!busy) { setDialog(null); setDialogError(''); } }}
          onSubmit={submitDelete}
        />
      )}
    </div>
  );
}
