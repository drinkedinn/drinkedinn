// client/src/admin/moderation/ReportDetail.jsx
//
// One report, expanded: everything the reporter wrote, what it points at, how
// often this reporter files reports, and what else has been filed against the
// same target. Nine reports on one account is a different problem from one.
//
// Two honesty rules hold this screen together:
//
//   * There is no GET /queue/:id on the server, so this view is fed from the
//     rows already loaded. Where a number is therefore partial, it SAYS it is
//     partial — "3 of 9 loaded here", never a confident 3.
//   * It shows what the reporter wrote and who they are, because a moderator
//     cannot judge a report otherwise. It does not show private message
//     content, and it does not build a picture of anyone's behaviour beyond
//     the reports themselves.

import { C } from './theme';
import { Badge, Btn, Card, Notice } from './ui';
import { isCsae, priorityMeta, resolutionMeta, targetLabel } from './constants';
import { age, clip, hasTarget, personLabel, prettySlug, reasonLabel, splitReason, targetPreview, whenFull } from './format';

const STATUS_TONE = {
  pending:   { color: C.amber, bg: C.amber + '22', label: 'Pending' },
  resolved:  { color: C.green, bg: C.green + '22', label: 'Resolved' },
  escalated: { color: C.purple, bg: C.purple + '22', label: 'Escalated' },
};

const statusTone = (s) => STATUS_TONE[s] || { color: C.textMuted, bg: C.border, label: s || 'Unknown' };

const Section = ({ title, children, style = {} }) => (
  <div style={{ ...style }}>
    <div style={{
      fontSize: 11, fontWeight: 700, color: C.textFaint,
      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
    }}>
      {title}
    </div>
    {children}
  </div>
);

const Line = ({ label, children }) => (
  <div style={{ display: 'flex', gap: 10, fontSize: 12.5, lineHeight: 1.7, flexWrap: 'wrap' }}>
    <span style={{ color: C.textFaint, minWidth: 96 }}>{label}</span>
    <span style={{ color: C.textMuted, flex: 1, minWidth: 140, wordBreak: 'break-word' }}>{children}</span>
  </div>
);

export default function ReportDetail({
  report,
  corpus = [],
  corpusStatuses = [],
  widened = false,
  widening = false,
  widenError = '',
  onWiden,
  canAssign = false,
  canAction = false,
  currentUserId = null,
  busyAction = null,
  onAssignToMe,
  onRelease,
  onChangePriority,
  onResolve,
}) {
  if (!report) return null;

  const csae = isCsae(report.reason);
  const meta = priorityMeta(report.priority);
  const reason = splitReason(report.reason);
  const preview = targetPreview(report);
  const tone = statusTone(report.status);
  const open = report.status === 'pending';

  const assignedToMe = currentUserId != null && report.assigned_to === currentUserId;
  const assigned = report.assigned_to != null;

  // Derived from what is loaded, not from a count the server gave us.
  const byReporter = corpus.filter(
    (r) => r && report.reporter_id != null && r.reporter_id === report.reporter_id
  );

  // A report filed without a target id (child-safety reports can be) stores
  // target_id 0, so matching on it would pool unrelated reports together. Do
  // not pretend those are "other reports on this target".
  const identified = hasTarget(report);
  const onSameTarget = identified
    ? corpus.filter(
      (r) => r
        && r.id !== report.id
        && r.target_type === report.target_type
        && String(r.target_id) === String(report.target_id)
    )
    : [];

  const serverOnTarget = Number(report.reports_on_target);
  const serverOnTargetKnown = identified && Number.isFinite(serverOnTarget);

  const loadedScope = corpusStatuses.length
    ? corpusStatuses.join(', ')
    : 'the current filter';

  const resolutionParts = (() => {
    const raw = String(report.resolution || '').trim();
    if (!raw) return null;
    const idx = raw.indexOf(':');
    const key = idx > 0 ? raw.slice(0, idx).trim() : raw;
    const note = idx > 0 ? raw.slice(idx + 1).trim() : '';
    return { label: resolutionMeta(key)?.label || prettySlug(key), note };
  })();

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {csae && (
        <Notice tone="danger" icon="🚨" title={`CHILD SAFETY — report #${report.id}`} live>
          This is a child sexual abuse and exploitation report. It is pinned to P0 and cannot be triaged
          down. Follow the escalation path before recording any resolution.
        </Notice>
      )}

      {/* Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Report #{report.id}</span>
        <Badge
          label={meta.short}
          color={report.priority === 'P0' ? '#fff' : meta.color}
          bg={report.priority === 'P0' ? C.red : meta.color + '22'}
        />
        <Badge label={tone.label} color={tone.color} bg={tone.bg} />
        <span style={{ fontSize: 12, color: C.textFaint }}>
          filed {age(report.created_at)} ago · {whenFull(report.created_at)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

        {/* What was claimed — every word of it. */}
        <Section title="What the reporter said">
          <Card style={{ padding: '14px 16px', background: C.card }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: csae ? C.red : C.text, marginBottom: reason.detail ? 8 : 0 }}>
              {reasonLabel(reason.head) || 'No short reason'}
            </div>
            {reason.detail ? (
              <p style={{
                margin: 0, fontSize: 12.5, color: C.textMuted, lineHeight: 1.65,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {reason.detail}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: C.textFaint, fontStyle: 'italic' }}>
                The reporter gave no further detail.
              </p>
            )}
          </Card>
        </Section>

        {/* What it points at. */}
        <Section title="Target">
          <Card style={{ padding: '14px 16px', background: C.card }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>
              {targetLabel(report.target_type)}
              {identified
                ? <span style={{ color: C.textFaint, fontWeight: 500 }}> #{report.target_id}</span>
                : <span style={{ color: C.amber, fontWeight: 700, fontSize: 11.5 }}> · NO TARGET ID</span>}
            </div>
            <div style={{
              fontSize: 12.5, lineHeight: 1.65, maxHeight: 180, overflowY: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              color: preview.muted ? C.textFaint : C.textMuted,
              fontStyle: preview.muted ? 'italic' : 'normal',
            }}>
              {preview.quoted ? `“${preview.text}”` : preview.text}
            </div>
          </Card>
        </Section>

        {/* Handling. */}
        <Section title="Handling">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Line label="Status">{tone.label}</Line>
            <Line label="Assigned">
              {assigned
                ? (assignedToMe ? 'You' : personLabel(report.assignee_name, report.assigned_to))
                : 'Nobody yet'}
            </Line>
            <Line label="Filed">{whenFull(report.created_at)}</Line>
            {report.resolved_at != null && <Line label="Closed">{whenFull(report.resolved_at)}</Line>}
            {report.resolved_by != null && (
              <Line label="Closed by">
                {`Admin #${report.resolved_by}`}
                <span style={{ color: C.textFaint }}> (the queue returns the id, not the name)</span>
              </Line>
            )}
            {resolutionParts && (
              <Line label="Recorded">
                <strong style={{ color: C.text }}>{resolutionParts.label}</strong>
                {resolutionParts.note && <span> — “{resolutionParts.note}”</span>}
              </Line>
            )}
          </div>
        </Section>

        {/* The reporter. */}
        <Section title="Reporter">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Line label="Account">{personLabel(report.reporter_name, report.reporter_id)}</Line>
            <Line label="Reports filed">
              {report.reporter_id == null ? (
                <span style={{ fontStyle: 'italic' }}>
                  No reporter on this row — nothing to count.
                </span>
              ) : (
                <>
                  <strong style={{ color: C.text }}>{byReporter.length}</strong>
                  <span> loaded in this console, including this one ({loadedScope})</span>
                </>
              )}
            </Line>
          </div>
          <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 8, lineHeight: 1.6 }}>
            A count of what is loaded here, not a lifetime total — the queue returns up to 200 rows per
            status and there is no per-reporter endpoint. A high number can mean a diligent reporter or a
            retaliatory one; it is context, not a verdict.
          </div>
        </Section>
      </div>

      {/* Other reports on the same target. */}
      <Section title="Other reports on this target">
        <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
          {serverOnTargetKnown ? (
            <>
              <strong style={{ color: serverOnTarget >= 3 ? C.amber : C.text }}>
                {serverOnTarget} report{serverOnTarget === 1 ? '' : 's'}
              </strong>{' '}
              filed against this {targetLabel(report.target_type).toLowerCase()} in total, across every status.{' '}
              {onSameTarget.length} other{onSameTarget.length === 1 ? '' : 's'} loaded here.
            </>
          ) : identified ? (
            <>The queue did not return a count for this target.</>
          ) : (
            <>
              This report has <strong style={{ color: C.amber }}>no target id</strong>, so there is nothing
              to count against. The reporter described what they saw rather than pointing at one post or
              account — the account to act on, if any, is named in the report text above.
            </>
          )}
        </div>

        {!identified ? null : onSameTarget.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.textFaint }}>
            No others loaded in this console.
            {!widened && (
              <>
                {' '}
                <Btn small onClick={onWiden} disabled={widening}>
                  {widening ? 'Loading…' : 'Look in resolved and escalated too'}
                </Btn>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {onSameTarget.slice(0, 12).map((r) => {
              const m = priorityMeta(r.priority);
              const t = statusTone(r.status);
              const rr = splitReason(r.reason);
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                    background: C.card, border: `1px solid ${isCsae(r.reason) ? C.red : C.border}`,
                    borderRadius: 8, padding: '8px 12px',
                  }}
                >
                  <span style={{ color: C.textFaint, fontSize: 11.5, fontWeight: 700 }}>#{r.id}</span>
                  <Badge
                    label={m.short}
                    color={r.priority === 'P0' ? '#fff' : m.color}
                    bg={r.priority === 'P0' ? C.red : m.color + '22'}
                  />
                  {isCsae(r.reason) && <Badge label="⚠ CHILD SAFETY" color="#fff" bg={C.red} />}
                  <span style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>
                    {reasonLabel(rr.head) || clip(rr.detail, 40) || 'No reason given'}
                  </span>
                  <Badge label={t.label} color={t.color} bg={t.bg} />
                  <span style={{ fontSize: 11.5, color: C.textFaint, marginLeft: 'auto' }}>
                    {age(r.created_at)} old
                  </span>
                </div>
              );
            })}
            {onSameTarget.length > 12 && (
              <div style={{ fontSize: 11.5, color: C.textFaint }}>
                and {onSameTarget.length - 12} more loaded here.
              </div>
            )}
            {!widened && (
              <div>
                <Btn small onClick={onWiden} disabled={widening}>
                  {widening ? 'Loading…' : 'Look in resolved and escalated too'}
                </Btn>
              </div>
            )}
          </div>
        )}

        {widenError && (
          <div style={{ marginTop: 10 }}>
            <Notice tone="danger" icon="⚠️" title="Could not widen the search" live>{widenError}</Notice>
          </div>
        )}
      </Section>

      {/* Actions — same permission rules as the row. */}
      {(canAssign || canAction) && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          borderTop: `1px solid ${C.border}`, paddingTop: 16,
        }}>
          {canAssign && !assignedToMe && (
            <Btn tone="accent" disabled={!!busyAction} onClick={() => onAssignToMe?.(report)}>
              {busyAction === 'assign' ? 'Assigning…' : assigned ? 'Take over' : 'Assign to me'}
            </Btn>
          )}
          {canAssign && assignedToMe && (
            <Btn disabled={!!busyAction} onClick={() => onRelease?.(report)}>
              {busyAction === 'release' ? 'Releasing…' : 'Release'}
            </Btn>
          )}
          {canAction && (
            <Btn disabled={!!busyAction} onClick={() => onChangePriority?.(report)}>Change priority</Btn>
          )}
          {canAction && open && (
            <Btn tone="good" disabled={!!busyAction} onClick={() => onResolve?.(report)}>Resolve…</Btn>
          )}
          <span style={{ fontSize: 11.5, color: C.textFaint, marginLeft: 'auto' }}>
            Every action you take here is recorded in the audit log with your name, role and reason.
          </span>
        </div>
      )}
    </div>
  );
}
