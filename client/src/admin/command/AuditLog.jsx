// client/src/admin/command/AuditLog.jsx
//
// The audit viewer for GET /api/admin/command/audit.
//
// Every mutating admin request is recorded structurally by
// middleware/adminAuth.auditAdmin — including the ones that were REFUSED. A
// 403 streak is exactly the signal you want to be able to find later, so
// refused entries are styled to stand out rather than fade away.
//
// The endpoint takes only `limit` (1–200, newest first). It has no actor or
// outcome parameters, so the two filters here narrow the fetched window on the
// client. The UI says so rather than implying it searched all of history.
//
// Props (optional, from the shell): role, permissions — see ./permissions.js.

import { useMemo, useState } from 'react';
import api from '../../api';
import { C, inputStyle, num } from './theme';
import { Card, Note, ErrorNote, PermissionNote, PanelStyles, EmptyNote, SkeletonLine } from './ui';
import { makeGate } from './permissions';
import useAdminIdentity from './useAdminIdentity';
import usePolling from './usePolling';
import FreshnessMeter from './FreshnessMeter';
import AuditRow, { outcomeOf, actorLabel } from './AuditRow';

const LIMITS = [25, 50, 100, 200];
const REFRESH_MS = 30000;
const COLUMNS = ['When', 'Who', 'Action', 'Target', 'Outcome', 'Reason'];

export default function AuditLog({ role = null, permissions = null }) {
  const identity = useAdminIdentity({ role, permissions });
  const gate = useMemo(
    () => makeGate(identity.permissions, identity.role),
    [identity.permissions, identity.role],
  );
  const canRead = !gate.denies('audit.read');

  const [limit, setLimit] = useState(100);
  const [actorFilter, setActorFilter] = useState('all');
  const [refusedOnly, setRefusedOnly] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  const poll = usePolling(
    async () => {
      const res = await api.get(`/admin/command/audit?limit=${encodeURIComponent(limit)}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    {
      intervalMs: REFRESH_MS,
      // Wait until we know the caller's permissions before asking.
      enabled: canRead && !identity.resolving,
      // Auto-refresh starts paused: rows reordering under someone who is
      // reading an entry is worse than a slightly stale list. The control is
      // right there when they want it live.
      startPaused: true,
      refreshKey: String(limit),
    }
  );

  const rows = useMemo(() => (Array.isArray(poll.data) ? poll.data : []), [poll.data]);

  const actors = useMemo(() => {
    const byId = new Map();
    for (const r of rows) {
      const id = r?.actor_id == null ? 'unknown' : String(r.actor_id);
      if (!byId.has(id)) byId.set(id, { id, label: actorLabel(r), count: 0 });
      byId.get(id).count += 1;
    }
    return [...byId.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (actorFilter !== 'all') {
      const id = r?.actor_id == null ? 'unknown' : String(r.actor_id);
      if (id !== actorFilter) return false;
    }
    if (refusedOnly && outcomeOf(r).kind !== 'refused') return false;
    return true;
  }), [rows, actorFilter, refusedOnly]);

  const refusedCount = useMemo(() => rows.filter((r) => outcomeOf(r).kind === 'refused').length, [rows]);

  const toggleRow = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (!canRead && !identity.resolving) {
    return (
      <>
        <PanelStyles />
        <PermissionNote permission="audit.read" role={gate.role} />
      </>
    );
  }

  const filtersActive = actorFilter !== 'all' || refusedOnly;
  const firstLoad = (poll.loading || identity.resolving) && poll.data == null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PanelStyles />

      {/* ── Control bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
          Admin audit trail
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <FreshnessMeter
            lastUpdated={poll.lastUpdated}
            paused={poll.paused}
            busy={poll.busy}
            onTogglePause={() => poll.setPaused((p) => !p)}
            onRefresh={poll.refresh}
            intervalMs={REFRESH_MS}
          />
        </div>
      </div>

      {/* ── Filters ── */}
      <Card style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="di-audit-actor" style={labelStyle}>Actor</label>
            <select
              id="di-audit-actor"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              style={{ ...inputStyle, minWidth: 220, cursor: 'pointer' }}
            >
              <option value="all">All actors ({actors.length})</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>{a.label} — {a.count}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="di-audit-limit" style={labelStyle}>Entries fetched</label>
            <select
              id="di-audit-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 100)}
              style={{ ...inputStyle, minWidth: 130, cursor: 'pointer' }}
            >
              {LIMITS.map((n) => <option key={n} value={n}>Newest {n}</option>)}
            </select>
          </div>

          <div style={{ paddingBottom: 8 }}>
            <label htmlFor="di-audit-refused" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text }}>
              <input
                id="di-audit-refused"
                type="checkbox"
                checked={refusedOnly}
                onChange={(e) => setRefusedOnly(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: C.red, cursor: 'pointer' }}
              />
              Refused only
              <span style={{ fontSize: 11, color: refusedCount > 0 ? C.red : C.textFaint, fontWeight: 700 }}>
                ({refusedCount})
              </span>
            </label>
          </div>

          {filtersActive && (
            <button
              type="button"
              className="di-cmd-focus"
              onClick={() => { setActorFilter('all'); setRefusedOnly(false); }}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: C.textMuted, fontFamily: 'inherit', marginBottom: 2,
              }}
            >
              Clear filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted, paddingBottom: 10 }}>
            Showing <strong style={{ color: C.text }}>{num(filtered.length)}</strong> of{' '}
            <strong style={{ color: C.text }}>{num(rows.length)}</strong> fetched
          </div>
        </div>

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textFaint, lineHeight: 1.6 }}>
          Filters narrow the newest {limit} entries that were fetched — the endpoint accepts a limit and nothing
          else, so this is not a search of the whole history. Raise the limit to look further back.
        </div>
      </Card>

      {poll.error && (
        <ErrorNote
          message={poll.forbidden ? `${poll.error}${gate.role ? ` (your role: ${gate.role})` : ''}` : poll.error}
          onRetry={poll.refresh}
        />
      )}

      {/* ── The log ── */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          {firstLoad ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonLine key={i} height={22} />)}
            </div>
          ) : rows.length === 0 && !poll.error ? (
            <EmptyNote
              icon="🗒️"
              title="Nothing recorded yet"
              detail="Admin actions appear here the moment one is taken. Reads are not recorded — only requests that change something."
            />
          ) : filtered.length === 0 ? (
            <EmptyNote
              icon="🔎"
              title="No entries match these filters"
              detail={`${num(rows.length)} entries were fetched. Clear the filters or raise the limit to look further back.`}
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <caption style={{ captionSide: 'top', textAlign: 'left', padding: '12px 16px 0', fontSize: 11, color: C.textFaint }}>
                Admin actions, newest first. Refused actions are marked in red.
              </caption>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {COLUMNS.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      style={{
                        padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted,
                        fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const key = r?.id != null ? `audit-${r.id}` : `audit-idx-${i}`;
                  return (
                    <AuditRow
                      key={key}
                      domId={key}
                      row={r}
                      expanded={expanded.has(key)}
                      onToggle={() => toggleRow(key)}
                      columnCount={COLUMNS.length}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* ── What this log is and is not ── */}
      <Note icon="📓" tone={C.accent}>
        This is the record of what admins did, not of what users said — no message or post content is stored
        here, and request bodies are scrubbed before they are written. Be aware of the limit of the trail:
        only requests that <strong style={{ color: C.text }}>changed</strong> something are recorded, so reads
        — including opening this page — leave no entry. A typed reason is demanded for banning, suspending or
        deleting a member, removing content, writing a feature flag or config, approving an advert, publishing
        a compliance change, and changing anyone's role; that is why the reason column is filled for those
        entries and empty for the rest.
      </Note>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: C.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 6,
};
