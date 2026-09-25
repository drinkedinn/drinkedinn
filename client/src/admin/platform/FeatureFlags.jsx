// client/src/admin/platform/FeatureFlags.jsx
//
// The flag table. Reads GET /api/admin/flags, writes through PUT /:key and the
// separate POST /:key/kill. flags.read to see it, flags.write to change it —
// and flags.write is high-impact, so every write carries a typed reason that
// is stored in admin_audit next to the admin's name.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C, btn, thStyle, tdStyle, formatWhen } from './theme';
import {
  Card, Chip, Note, Loading, EmptyState, ErrorBlock, ReasonField,
  ConfirmDialog, TextInput, Mono, PermissionNote,
} from './ui';
import { makeCan } from './perms';
import { parseTargeting, summarizeTargeting, REASON_MIN } from './targeting';
import { listFlags, killFlag } from './flagsApi';
import { apiError } from './errors';
import PrecedenceNote from './PrecedenceNote';
import FlagEditor from './FlagEditor';

const COLS = ['Flag', 'State', 'Rollout', 'Targeting', 'Last change', ''];

export default function FeatureFlags({ permissions }) {
  const { can, mayAttempt, known } = makeCan(permissions);
  // Reading is optimistic: if the shell told us nothing, ask the server and let
  // its 403 speak. Writing is not — a Kill button is never rendered on a guess.
  const canRead  = mayAttempt('flags.read');
  const canWrite = can('flags.write');

  const [flags, setFlags]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [editing, setEditing] = useState(null);   // flag key being edited
  const [notice, setNotice]   = useState(null);   // { tone, text }

  const [killTarget, setKillTarget] = useState(null);
  const [killReason, setKillReason] = useState('');
  const [killBusy, setKillBusy]     = useState(false);
  const [killError, setKillError]   = useState(null);

  // Set true on EVERY mount, not just the first. React 18 StrictMode (this app
  // uses it — see src/main.jsx) mounts, unmounts and remounts in development:
  // a cleanup-only ref would be left false on the second mount and every
  // setState below would be skipped, leaving the panel on "Loading…" forever.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listFlags();
      if (!alive.current) return rows;
      setFlags(rows);
      setError(null);
      return rows;
    } catch (err) {
      if (alive.current) setError(apiError(err, 'Could not reach the server to load feature flags.'));
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => { if (canRead) load(); else setLoading(false); }, [canRead, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flags;
    return flags.filter((f) =>
      String(f?.key || '').toLowerCase().includes(q) ||
      String(f?.description || '').toLowerCase().includes(q));
  }, [flags, search]);

  if (!canRead) {
    return <PermissionNote known={known} permission="flags.read" action="view feature flags" />;
  }

  const openKill = (flag) => {
    if (!flag?.key) return;
    setKillTarget(flag); setKillReason(''); setKillError(null);
  };

  const confirmKill = async () => {
    if (!killTarget || killReason.trim().length < REASON_MIN) return;
    setKillBusy(true); setKillError(null);
    try {
      await killFlag(killTarget.key, killReason.trim());
      const key = killTarget.key;
      const rows = await load();
      if (!alive.current) return;
      setKillTarget(null);
      setKillBusy(false);
      setEditing(null);
      // The route updates by key and reports ok even when nothing matched, so
      // the claim is checked against what the list now says rather than echoed.
      const after = Array.isArray(rows) ? rows.find((f) => f?.key === key) : null;
      if (!Array.isArray(rows)) {
        setNotice({ tone: 'amber', text: `The server accepted the kill for ${key}, but the list could not be reloaded to confirm it. Refresh before assuming it is off.` });
      } else if (!after) {
        setNotice({ tone: 'amber', text: `Kill sent for ${key}, but no flag with that key came back from the server. The route reports success even when no row matched — check the key exists.` });
      } else if (after.enabled) {
        setNotice({ tone: 'red', text: `Kill sent for ${key}, but it still reads as ON. Do not assume it is off — reload and check.` });
      } else {
        setNotice({ tone: 'green', text: `${key} is off for everyone and its rollout is 0%. Clients pick this up on their next flag evaluation.` });
      }
    } catch (err) {
      if (!alive.current) return;
      setKillBusy(false);
      setKillError(apiError(err, 'Could not reach the server. The flag has NOT been killed.'));
    }
  };

  const killTargeting = killTarget ? parseTargeting(killTarget.targeting) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <PrecedenceNote />

      <Note icon="🗒️">
        Changing a flag is a high-impact action: it needs a typed reason and is written to the audit log with your name, the flag
        key and the time. Changes are not pushed — each client picks them up at its next flag evaluation.
      </Note>

      {notice && (
        <Card style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center',
          background: (notice.tone === 'green' ? C.green : notice.tone === 'red' ? C.red : C.amber) + '11',
          borderColor: (notice.tone === 'green' ? C.green : notice.tone === 'red' ? C.red : C.amber) + '44' }} role="status">
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.55, color: notice.tone === 'green' ? C.green : notice.tone === 'red' ? C.red : C.amber }}>
            {notice.text}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"
            style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 16, padding: 4, fontFamily: 'inherit' }}>×</button>
        </Card>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor="flag-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          Search flags
        </label>
        <TextInput
          id="flag-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Search by key or description…"
          style={{ flex: 1, maxWidth: 360, background: C.card }}
        />
        <div style={{ fontSize: 12.5, color: C.textMuted, marginLeft: 'auto' }}>
          {flags.length} flag{flags.length === 1 ? '' : 's'}{search.trim() && ` · ${filtered.length} shown`}
        </div>
        <button type="button" onClick={() => load()} disabled={loading} style={btn('ghost', loading)}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <ErrorBlock message={error} onRetry={load} />}

      {loading && flags.length === 0 && !error && <Loading label="Loading feature flags…" />}

      {!loading && !error && flags.length === 0 && (
        <EmptyState icon="🎛️" title="No feature flags defined">
          Nothing is stored in <Mono>feature_flags</Mono> yet. This panel edits and kills flags that already exist —
          creating one is not wired here.
        </EmptyState>
      )}

      {flags.length > 0 && filtered.length === 0 && (
        <EmptyState icon="🔍" title="No flag matches that search">
          Nothing matches “{search.trim()}”.
        </EmptyState>
      )}

      {filtered.length > 0 && (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                Feature flags, their rollout and targeting
              </caption>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {COLS.map((h, i) => <th key={i} scope="col" style={thStyle}>{h || <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span>}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const open = editing === f.key;
                  return (
                    <FlagRow
                      key={f.key}
                      flag={f}
                      open={open}
                      canWrite={canWrite}
                      onToggleEdit={() => setEditing(open ? null : f.key)}
                      onRequestKill={openKill}
                      onSaved={async () => {
                        setEditing(null);
                        await load();
                        if (alive.current) setNotice({ tone: 'green', text: `${f.key} saved. The change is in the audit log with your reason.` });
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!canWrite && flags.length > 0 && (
        <PermissionNote known={known} permission="flags.write" action="change feature flags" />
      )}

      {killTarget && (
        <ConfirmDialog
          icon="🛑"
          title={`Kill switch — ${killTarget.key}`}
          confirmLabel={`Kill ${killTarget.key}`}
          confirmVariant="kill"
          confirmDisabled={killReason.trim().length < REASON_MIN}
          busy={killBusy}
          error={killError}
          onCancel={() => { if (!killBusy) setKillTarget(null); }}
          onConfirm={confirmKill}
        >
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>
            This turns <Mono style={{ color: C.text, fontWeight: 700 }}>{killTarget.key}</Mono> <strong>off for everyone, immediately.</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: C.textMuted, fontSize: 12.5, lineHeight: 1.7 }}>
            <li>
              Every user loses the feature at their next flag evaluation — including
              {killTargeting?.user_ids?.length
                ? <> the <strong style={{ color: C.text }}>{killTargeting.user_ids.length} allow-listed user id{killTargeting.user_ids.length > 1 ? 's' : ''}</strong>. An off flag beats the allow-list.</>
                : <> any allow-listed ids and staff. An off flag beats all targeting.</>}
            </li>
            <li>The rollout percent is reset to <strong style={{ color: C.text }}>0%</strong>{Number(killTarget.rollout_pct) > 0 ? <> (currently {Number(killTarget.rollout_pct)}%)</> : null}. Turning the flag back on later will not restore it.</li>
            <li>The flag and its targeting are <strong style={{ color: C.text }}>not deleted</strong>; you can switch it back on.</li>
            <li>This is recorded in the audit log with your name, the flag and the reason below.</li>
          </ul>
          <ReasonField
            id="kill-reason"
            value={killReason}
            onChange={setKillReason}
            disabled={killBusy}
            autoFocus
            minLength={REASON_MIN}
            label="Why are you killing this flag?"
          />
        </ConfirmDialog>
      )}
    </div>
  );
}

// ── One row, plus its expanded editor ───────────────────────────────────────
function FlagRow({ flag, open, canWrite, onToggleEdit, onRequestKill, onSaved }) {
  const targeting = parseTargeting(flag?.targeting);
  const chips = summarizeTargeting(targeting);
  const when = formatWhen(flag?.updated_at);
  const enabled = !!flag?.enabled;
  const pct = Number.isFinite(Number(flag?.rollout_pct)) ? Number(flag.rollout_pct) : 0;
  const pctIgnored = !enabled || targeting.staff_only;

  return (
    <>
      <tr style={{ borderBottom: open ? 'none' : `1px solid ${C.border}`, background: open ? C.cardHover : 'transparent' }}>
        <td style={{ ...tdStyle, minWidth: 200 }}>
          <div style={{ fontWeight: 700, color: C.text, fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: 12.5, wordBreak: 'break-all' }}>
            {flag?.key || '—'}
          </div>
          <div style={{ color: C.textFaint, fontSize: 11.5, marginTop: 3, lineHeight: 1.5, maxWidth: 320 }}>
            {flag?.description || 'No description'}
          </div>
        </td>

        <td style={tdStyle}>
          <Chip label={enabled ? 'On' : 'Off'} tone={enabled ? 'good' : 'bad'} />
        </td>

        <td style={{ ...tdStyle, minWidth: 130 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 56, height: 6, borderRadius: 4, background: C.border, overflow: 'hidden', flexShrink: 0 }} aria-hidden="true">
              <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: pctIgnored ? C.textFaint : C.accentHi }} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: pctIgnored ? C.textFaint : C.text }}>{pct}%</span>
          </div>
          {pctIgnored && (
            <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 4 }}>
              {!enabled ? 'ignored — flag is off' : 'ignored — staff only'}
            </div>
          )}
        </td>

        <td style={{ ...tdStyle, minWidth: 160 }}>
          {chips.length === 0
            ? <span style={{ color: C.textFaint, fontSize: 12 }}>None</span>
            : <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{chips.map((c, i) => <Chip key={i} label={c.label} tone={c.tone} />)}</div>}
        </td>

        <td style={{ ...tdStyle, minWidth: 150 }}>
          <div style={{ color: C.text, fontSize: 12.5 }}>{flag?.updated_by_name || (flag?.updated_by ? `Admin #${flag.updated_by}` : 'Unknown')}</div>
          <div style={{ color: C.textFaint, fontSize: 11.5, marginTop: 2 }} title={when?.abs || undefined}>
            {when ? when.rel : 'never recorded'}
          </div>
        </td>

        <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {canWrite ? (
            <div style={{ display: 'inline-flex', gap: 6 }}>
              <button type="button" onClick={onToggleEdit} aria-expanded={open} style={btn('ghost')}>
                {open ? 'Close' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => onRequestKill(flag)}
                disabled={!enabled}
                title={enabled ? `Turn ${flag.key} off for everyone` : 'Already off'}
                style={btn('kill', !enabled)}
              >
                Kill
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 11.5, color: C.textFaint }}>View only</span>
          )}
        </td>
      </tr>

      {open && canWrite && (
        <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.cardHover }}>
          <td colSpan={COLS.length} style={{ padding: '4px 16px 22px' }}>
            <FlagEditor
              key={flag.key}
              flag={flag}
              onCancel={onToggleEdit}
              onSaved={onSaved}
              onRequestKill={onRequestKill}
            />
          </td>
        </tr>
      )}
    </>
  );
}
