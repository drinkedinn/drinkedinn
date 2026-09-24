// client/src/admin/moderation/ModerationQueue.jsx
//
// The working queue. Mounted against /api/admin/moderation.
//
// The ordering principle is the server's, and this panel does not soften it:
// severity beats arrival. P0 sits at the top under a band that says IMMEDIATE
// in words, and a child-safety report carries a CHILD SAFETY label wherever it
// appears — in the alert above the table, in its group, in its row, and in its
// detail. A queue where a CSAE report can be missed is a queue that has failed
// at the only job it has.
//
// Props (all optional):
//   permissions      Set | string[]  — the signed-in admin's permissions, from
//                    the shell. When it is absent the panel asks the server
//                    itself (GET /admin/roles/me). If that also fails it FAILS
//                    CLOSED: read-only, and it says why. See permissions.js.
//   role             string          — shown for orientation only.
//   currentUserId    number          — so a row can say "You" rather than a name.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import api from '../../api';
import { C, CSAE_BG, thStyle } from './theme';
import { Btn, Card, ErrorState, LoadingState, Notice, StatTile, EmptyState } from './ui';
import { ASSIGNMENTS, PRIORITIES, STATUSES, floorMessage, isCsae, priorityMeta } from './constants';
import { PERMS, can } from './permissions';
import useAdminIdentity from './useAdminIdentity';
import { parseTs } from './format';
import QueueRow, { COLSPAN, COLUMNS } from './QueueRow';
import ReportDetail from './ReportDetail';
import PriorityDialog from './PriorityDialog';
import ResolveDialog from './ResolveDialog';

const ALL_STATUSES = STATUSES.map((s) => s.value);

/** The server's own words. Never err.message, which says "Request failed…". */
const serverError = (err, fallback) => err?.response?.data?.error || fallback;

export default function ModerationQueue({ permissions, role, currentUserId = null }) {
  const statusId = useId();
  const priorityId = useId();
  const assignedId = useId();

  const identity = useAdminIdentity({ permissions, role, currentUserId });
  const permsKnown = identity.known;
  const perms = identity.permissions;
  const canRead = can(perms, PERMS.read);
  const canAssign = can(perms, PERMS.assign);
  const canAction = can(perms, PERMS.action);
  const myId = identity.userId;
  const myRole = identity.role;

  // Only a KNOWN-lacking reports.read stops the panel from asking. When we
  // could not establish the permission set at all we still try: the server is
  // the real gate and its refusal is more informative than our guess.
  const mayFetch = !identity.loading && (!permsKnown || canRead);

  // Filters
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState('');
  const [assigned, setAssigned] = useState('all');
  const [csaeOnly, setCsaeOnly] = useState(false);

  // Queue
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState(null);
  const reqRef = useRef(0);

  // Counts
  const [counts, setCounts] = useState(null);
  const [countsError, setCountsError] = useState('');

  // Interaction
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(null); // { id, action }
  const [flash, setFlash] = useState(null); // { tone, title, text }
  const [dialog, setDialog] = useState(null); // { type, report }

  // Reports pulled in from the other statuses, for the detail view only.
  const [extra, setExtra] = useState([]);
  const [widened, setWidened] = useState(false);
  const [widening, setWidening] = useState(false);
  const [widenError, setWidenError] = useState('');

  const loadQueue = useCallback(async () => {
    if (!mayFetch) return;
    const seq = ++reqRef.current;
    setLoading(true);
    setError('');
    try {
      const params = { status };
      if (priority) params.priority = priority;
      const assignParam = ASSIGNMENTS.find((a) => a.value === assigned)?.param;
      if (assignParam) params.assigned = assignParam;

      const r = await api.get('/admin/moderation/queue', { params });
      if (seq !== reqRef.current) return; // a newer request won
      setRows(Array.isArray(r.data) ? r.data.filter(Boolean) : []);
      setLoadedAt(Date.now());
    } catch (err) {
      if (seq !== reqRef.current) return;
      setRows([]);
      setError(serverError(err, 'Could not load the queue.'));
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, [status, priority, assigned, mayFetch]);

  const loadCounts = useCallback(async () => {
    if (!mayFetch) return;
    setCountsError('');
    try {
      const r = await api.get('/admin/moderation/counts');
      setCounts(r.data && typeof r.data === 'object' ? r.data : null);
    } catch (err) {
      setCounts(null);
      setCountsError(serverError(err, 'Could not load the counts.'));
    }
  }, [mayFetch]);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  // Anything that mutates a report invalidates the widened cache.
  const refreshAll = useCallback(async () => {
    setExtra([]);
    setWidened(false);
    setWidenError('');
    await Promise.all([loadQueue(), loadCounts()]);
  }, [loadQueue, loadCounts]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const assignToMe = async (report) => {
    if (!canAssign || !report) return;
    setBusy({ id: report.id, action: 'assign' });
    setFlash(null);
    try {
      // routes/moderation.js: an absent user_id falls back to req.user.id, so
      // the server decides who "me" is — this cannot assign to anyone else.
      await api.post(`/admin/moderation/${report.id}/assign`, {});
      setFlash({ tone: 'good', title: `Report #${report.id} is yours.`, text: 'Recorded in the audit log.' });
      await refreshAll();
    } catch (err) {
      setFlash({ tone: 'danger', title: 'Could not assign that report', text: serverError(err, 'Could not assign that.') });
    } finally {
      setBusy(null);
    }
  };

  const release = async (report) => {
    if (!canAssign || !report) return;
    setBusy({ id: report.id, action: 'release' });
    setFlash(null);
    try {
      await api.post(`/admin/moderation/${report.id}/assign`, { user_id: null });
      setFlash({ tone: 'info', title: `Report #${report.id} is back in the unassigned pile.`, text: 'Recorded in the audit log.' });
      await refreshAll();
    } catch (err) {
      setFlash({ tone: 'danger', title: 'Could not release that report', text: serverError(err, 'Could not release that.') });
    } finally {
      setBusy(null);
    }
  };

  // Returns an outcome object to the dialog rather than closing it, so a
  // refused (floored) priority change can be shown in place.
  const submitPriority = async (report, { priority: next, reason }) => {
    if (!canAction || !report) return { ok: false, error: 'Your role does not allow that.' };
    setBusy({ id: report.id, action: 'priority' });
    try {
      const body = { priority: next };
      if (reason) body.reason = reason;
      const r = await api.post(`/admin/moderation/${report.id}/priority`, body);
      const applied = r.data?.priority || next;
      const floored = !!r.data?.floored;
      await refreshAll();
      if (!floored) {
        setFlash({
          tone: 'good',
          title: `Report #${report.id} is now ${applied}.`,
          text: 'Recorded in the audit log.',
        });
      } else {
        // Also surfaced in the dialog; repeated here so it survives the close.
        setFlash({
          tone: 'danger',
          title: floorMessage(report.reason, applied),
          text: `Report #${report.id} was not moved to ${next}.`,
        });
      }
      return { ok: true, floored, priority: applied, message: floorMessage(report.reason, applied) };
    } catch (err) {
      return { ok: false, error: serverError(err, 'Could not set the priority.') };
    } finally {
      setBusy(null);
    }
  };

  const submitResolve = async (report, { resolution, note, reason }) => {
    if (!canAction || !report) return { ok: false, error: 'Your role does not allow that.' };
    setBusy({ id: report.id, action: 'resolve' });
    try {
      const body = { resolution };
      if (note) body.note = note;
      if (reason) body.reason = reason;
      await api.post(`/admin/moderation/${report.id}/resolve`, body);
      setOpenId((id) => (id === report.id ? null : id));
      await refreshAll();
      setFlash({
        tone: 'good',
        title: resolution === 'escalated'
          ? `Report #${report.id} escalated.`
          : `Report #${report.id} closed as “${resolution.replace(/_/g, ' ')}”.`,
        text: 'Your name and reason are in the audit log. Recording an outcome does not itself change the account or the content — do that in the Users or Posts panel.',
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: serverError(err, 'Could not resolve that report.') };
    } finally {
      setBusy(null);
    }
  };

  const widen = async () => {
    if (!mayFetch) return;
    setWidening(true);
    setWidenError('');
    try {
      const results = await Promise.all(
        ALL_STATUSES.map((s) => api.get('/admin/moderation/queue', { params: { status: s } }))
      );
      const merged = results.flatMap((r) => (Array.isArray(r.data) ? r.data.filter(Boolean) : []));
      setExtra(merged);
      setWidened(true);
    } catch (err) {
      setWidenError(serverError(err, 'Could not load the other statuses.'));
    } finally {
      setWidening(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const visible = useMemo(() => {
    const list = csaeOnly ? rows.filter((r) => isCsae(r?.reason)) : rows;
    const rank = (p) => {
      const i = PRIORITIES.indexOf(p);
      return i < 0 ? PRIORITIES.length : i;
    };
    return [...list].sort((a, b) => {
      const byPriority = rank(a?.priority) - rank(b?.priority);
      if (byPriority !== 0) return byPriority;
      // Child safety first within its band, then oldest first.
      const byCsae = (isCsae(a?.reason) ? 0 : 1) - (isCsae(b?.reason) ? 0 : 1);
      if (byCsae !== 0) return byCsae;
      return (parseTs(a?.created_at)?.getTime() ?? 0) - (parseTs(b?.created_at)?.getTime() ?? 0);
    });
  }, [rows, csaeOnly]);

  const groups = useMemo(() => {
    const known = PRIORITIES.map((p) => ({
      key: p,
      meta: priorityMeta(p),
      items: visible.filter((r) => r?.priority === p),
    }));
    const unknown = visible.filter((r) => !PRIORITIES.includes(r?.priority));
    if (unknown.length) {
      known.push({
        key: 'unknown',
        meta: { ...priorityMeta(null), label: 'UNRECOGNISED PRIORITY', color: C.purple },
        items: unknown,
      });
    }
    return known.filter((g) => g.items.length > 0);
  }, [visible]);

  const corpus = useMemo(() => {
    const seen = new Map();
    for (const r of [...rows, ...extra]) if (r && !seen.has(r.id)) seen.set(r.id, r);
    return Array.from(seen.values());
  }, [rows, extra]);

  const corpusStatuses = widened ? ALL_STATUSES : [status];
  const openReport = openId == null ? null : visible.find((r) => r?.id === openId) || null;
  const csaeOpen = Number(counts?.csae);
  const csaeInView = useMemo(() => rows.filter((r) => isCsae(r?.reason)).length, [rows]);

  const pendingBreakdown = useMemo(() => {
    const rowsB = Array.isArray(counts?.breakdown) ? counts.breakdown : [];
    const out = {};
    for (const b of rowsB) {
      if (!b || b.status !== status) continue;
      const key = PRIORITIES.includes(b.priority) ? b.priority : 'other';
      out[key] = (out[key] || 0) + (Number(b.c) || 0);
    }
    return out;
  }, [counts, status]);

  const closeDialog = () => setDialog(null);

  // ── Render ────────────────────────────────────────────────────────────────

  // Still establishing who is signed in. Asking the queue first would mean
  // painting buttons and then taking them away.
  if (identity.loading) {
    return <LoadingState label="Checking what your role allows…" />;
  }

  // Known to lack reports.read: say so in the console's own words rather than
  // firing a request whose only possible answer is 403.
  if (permsKnown && !canRead) {
    return (
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">🔒</div>
        <div style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          Moderation is not part of your role
        </div>
        <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
          Viewing the report queue needs the <code style={codeStyle}>reports.read</code> permission.
          {myRole ? <> Your role is <strong style={{ color: C.text }}>{myRole}</strong>.</> : null}{' '}
          An owner can grant it in the Roles panel.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* What this console is, and is not. */}
      <Notice tone="info" icon="🛡️">
        <strong style={{ color: C.text }}>This screen shows reported content and the names of the people
        involved.</strong>{' '}
        Private message content is never rendered here, and nothing on this panel tracks individual
        behaviour beyond the reports themselves. Every action you take — assign, re-prioritise, resolve —
        is written to the audit log with your name{myRole ? `, your role (${myRole})` : ''} and your
        reason. Reading the queue is not itself recorded, so treat what you see here as need-to-know.
      </Notice>

      {!permsKnown && (
        <Notice tone="warn" icon="🔒" title="Read-only — your permissions could not be established">
          {identity.error || 'No permission set was supplied and the server could not be asked.'}
          {' '}Every action button is withheld rather than offered and refused. Pass the signed-in
          admin's permission set to this panel as a <code style={codeStyle}>permissions</code> prop to
          enable assignment, triage and resolution.
        </Notice>
      )}

      {/* ── CHILD SAFETY ── the one thing that must never be missed. */}
      {Number.isFinite(csaeOpen) && csaeOpen > 0 && (
        <div
          role="alert"
          style={{
            background: CSAE_BG, border: `2px solid ${C.red}`, borderRadius: 14,
            padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1.1 }}>🚨</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 900, color: '#fff',
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
            }}>
              Child safety — {csaeOpen} open report{csaeOpen === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: 12.5, color: '#ffd9dd', lineHeight: 1.65 }}>
              These are pinned to P0 and cannot be triaged down. Work them first, and follow the
              escalation path before recording any resolution. Every child-safety report is retained.
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn
                tone="danger"
                onClick={() => { setCsaeOnly(true); setStatus('pending'); setPriority(''); setAssigned('all'); }}
                style={{ background: C.red, color: '#fff', borderColor: C.red }}
              >
                Show only child-safety reports
              </Btn>
              {csaeOnly && (
                <Btn onClick={() => setCsaeOnly(false)}>Clear this filter</Btn>
              )}
            </div>
          </div>
        </div>
      )}

      {counts && csaeOpen === 0 && (
        <Notice tone="good" icon="✓">No open child-safety reports.</Notice>
      )}

      {/* Counts */}
      {countsError ? (
        <Notice tone="warn" icon="⚠️" title="Counts unavailable">
          {countsError} The queue below is unaffected.
        </Notice>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          <StatTile icon="📋" label="Open reports" value={counts?.open ?? null} color={C.accent} />
          <StatTile
            icon="🚨"
            label="Child safety, open"
            value={counts?.csae ?? null}
            color={C.red}
            emphasis={Number(counts?.csae) > 0}
            sub={Number(counts?.csae) > 0 ? 'Work these first' : undefined}
          />
          <StatTile icon="🙋" label="Unassigned" value={counts?.unassigned ?? null} color={C.amber} />
        </div>
      )}

      {/* Filters */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor={statusId} style={labelStyle}>Status</label>
            <select
              id={statusId}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setOpenId(null); }}
              style={selectStyle}
            >
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor={priorityId} style={labelStyle}>Priority</label>
            <select
              id={priorityId}
              value={priority}
              onChange={(e) => { setPriority(e.target.value); setOpenId(null); }}
              style={selectStyle}
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{priorityMeta(p).label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor={assignedId} style={labelStyle}>Assignment</label>
            <select
              id={assignedId}
              value={assigned}
              onChange={(e) => { setAssigned(e.target.value); setOpenId(null); }}
              style={selectStyle}
            >
              {ASSIGNMENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
            {csaeOnly && (
              <Btn tone="danger" onClick={() => setCsaeOnly(false)}>
                Child-safety only · clear
              </Btn>
            )}
            <span style={{ fontSize: 11.5, color: C.textFaint }}>
              {loadedAt ? `Updated ${new Date(loadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
            <Btn tone="accent" onClick={refreshAll} disabled={loading}>
              {loading ? 'Loading…' : '↻ Refresh'}
            </Btn>
          </div>
        </div>

        {/* Stored-priority breakdown, with the caveat that makes it honest. */}
        {counts && Object.keys(pendingBreakdown).length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {status} by stored priority
              </span>
              {[...PRIORITIES, 'other'].filter((p) => pendingBreakdown[p]).map((p) => (
                <span key={p} style={{ fontSize: 12, color: C.textMuted }}>
                  <strong style={{ color: priorityMeta(p === 'other' ? null : p).color }}>{p}</strong>{' '}
                  {pendingBreakdown[p]}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6, lineHeight: 1.5 }}>
              These are the priorities stored on the rows. The queue re-applies the severity floor when it
              reads, so a report counted as P2 here can correctly appear as P0 in the table below.
            </div>
          </div>
        )}
      </Card>

      {flash && (
        <Notice
          tone={flash.tone}
          icon={flash.tone === 'danger' ? '⚠️' : flash.tone === 'good' ? '✓' : 'ℹ️'}
          title={flash.title}
          live={flash.tone === 'danger'}
          onDismiss={() => setFlash(null)}
        >
          {flash.text}
        </Notice>
      )}

      {/* The queue */}
      {loading && rows.length === 0 ? (
        <LoadingState label="Loading the queue…" />
      ) : error ? (
        <ErrorState title="Could not load the queue" message={error} onRetry={loadQueue} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={csaeOnly ? '🔍' : '✅'}
          title={csaeOnly ? 'No child-safety reports in this view' : `Nothing ${status} here`}
        >
          {csaeOnly
            ? 'No loaded report matches the child-safety filter. Clear it to see the rest of the queue.'
            : 'No reports match these filters. Try another status, priority or assignment.'}
        </EmptyState>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <caption style={{
                captionSide: 'top', textAlign: 'left', padding: '14px 16px',
                color: C.textMuted, fontSize: 12.5,
              }}>
                {visible.length} report{visible.length === 1 ? '' : 's'} shown, most severe first
                {csaeInView > 0 && !csaeOnly && (
                  <strong style={{ color: C.red }}> · {csaeInView} child-safety</strong>
                )}
                . The queue returns up to 200 rows per status.
              </caption>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {COLUMNS.map((h) => (
                    <th key={h} scope="col" style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              {/* One tbody per priority band, so the band header is a real
                  header for the rows it introduces rather than a styled row. */}
              {groups.map((group) => {
                const isP0 = group.key === 'P0';
                const csaeCount = group.items.filter((r) => isCsae(r?.reason)).length;
                return (
                  <tbody key={group.key}>
                      <tr>
                        <th
                          scope="rowgroup"
                          colSpan={COLSPAN}
                          style={{
                            textAlign: 'left',
                            padding: isP0 ? '12px 16px' : '10px 16px',
                            background: isP0 ? C.red : group.meta.color + '14',
                            borderTop: `1px solid ${C.border}`,
                            borderBottom: `1px solid ${isP0 ? C.red : C.border}`,
                          }}
                        >
                          <span style={{
                            fontSize: isP0 ? 13 : 12,
                            fontWeight: isP0 ? 900 : 700,
                            letterSpacing: isP0 ? 0.8 : 0.4,
                            color: isP0 ? '#fff' : group.meta.color,
                            textTransform: 'uppercase',
                          }}>
                            {group.meta.label} · {group.items.length}
                          </span>
                          <span style={{
                            fontSize: 11.5, fontWeight: 500, marginLeft: 10,
                            color: isP0 ? '#ffd9dd' : C.textFaint,
                          }}>
                            {group.meta.desc}
                          </span>
                          {csaeCount > 0 && (
                            <span style={{
                              marginLeft: 10, fontSize: 11.5, fontWeight: 800,
                              color: isP0 ? '#fff' : C.red,
                            }}>
                              · {csaeCount} CHILD SAFETY
                            </span>
                          )}
                        </th>
                      </tr>

                      {group.items.map((report) => (
                        <QueueRow
                          key={report.id}
                          report={report}
                          expanded={openId === report.id}
                          canAssign={canAssign}
                          canAction={canAction}
                          currentUserId={myId}
                          busyAction={busy?.id === report.id ? busy.action : null}
                          onToggleDetail={(r) => setOpenId((id) => (id === r.id ? null : r.id))}
                          onAssignToMe={assignToMe}
                          onRelease={release}
                          onChangePriority={(r) => setDialog({ type: 'priority', report: r })}
                          onResolve={(r) => setDialog({ type: 'resolve', report: r })}
                          detail={openId === report.id ? (
                            <ReportDetail
                              report={report}
                              corpus={corpus}
                              corpusStatuses={corpusStatuses}
                              widened={widened}
                              widening={widening}
                              widenError={widenError}
                              onWiden={widen}
                              canAssign={canAssign}
                              canAction={canAction}
                              currentUserId={myId}
                              busyAction={busy?.id === report.id ? busy.action : null}
                              onAssignToMe={assignToMe}
                              onRelease={release}
                              onChangePriority={(r) => setDialog({ type: 'priority', report: r })}
                              onResolve={(r) => setDialog({ type: 'resolve', report: r })}
                            />
                          ) : null}
                        />
                      ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        </Card>
      )}

      {openReport == null && openId != null && (
        <Notice tone="info" icon="ℹ️">
          The report you had open is no longer in this view — it may have been resolved or filtered out.
        </Notice>
      )}

      {/* Dialogs */}
      {dialog?.type === 'priority' && (
        <PriorityDialog
          report={dialog.report}
          onClose={closeDialog}
          onSubmit={(payload) => submitPriority(dialog.report, payload)}
        />
      )}
      {dialog?.type === 'resolve' && (
        <ResolveDialog
          report={dialog.report}
          onClose={closeDialog}
          onSubmit={(payload) => submitResolve(dialog.report, payload)}
        />
      )}
    </div>
  );
}

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: C.textMuted,
  textTransform: 'uppercase', letterSpacing: 0.5,
};

const selectStyle = {
  background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10,
  padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none',
  fontFamily: 'inherit', cursor: 'pointer', minWidth: 170,
};

const codeStyle = {
  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4,
  padding: '1px 5px', fontSize: 12, color: C.text,
};
