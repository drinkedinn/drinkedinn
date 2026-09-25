// client/src/admin/moderation/QueueRow.jsx
//
// One line of the working queue. It has to answer, at a glance: how bad, what
// was claimed, against what, by whom, how long it has been sitting there, and
// whether this target is being reported over and over.
//
// A child-safety report is marked with a word — CHILD SAFETY — not a colour.
// Colour alone is not a signal; it is a decoration that some people cannot see.

import { CSAE_BG, C, tdStyle } from './theme';
import { Badge, Btn } from './ui';
import { isCsae, priorityMeta, targetLabel } from './constants';
import { age, clip, hasTarget, isOverdue, personLabel, reasonLabel, splitReason, targetPreview, whenFull } from './format';

// The header and every colSpan read from this, so they cannot drift apart.
export const COLUMNS = ['Priority', 'Report', 'Target', 'Reporter', 'Assigned', 'Age', 'On target', 'Actions'];
export const COLSPAN = COLUMNS.length;

export default function QueueRow({
  report,
  expanded = false,
  detail = null,
  canAssign = false,
  canAction = false,
  currentUserId = null,
  busyAction = null, // the action id currently in flight for this row
  onToggleDetail,
  onAssignToMe,
  onRelease,
  onChangePriority,
  onResolve,
}) {
  const csae = isCsae(report?.reason);
  const meta = priorityMeta(report?.priority);
  const reason = splitReason(report?.reason);
  const preview = targetPreview(report);
  const overdue = isOverdue(report);
  const open = report?.status === 'pending';

  // The server counts reports sharing this target_type + target_id. When the
  // report carries no identifiable target (child-safety reports filed without
  // one store target_id 0), that count is pooling unrelated reports and must
  // not be shown as a fact about this target.
  const identified = hasTarget(report);
  const onTarget = Number(report?.reports_on_target);
  const countable = identified && Number.isFinite(onTarget);
  const repeat = countable && onTarget > 1;
  const heavy = countable && onTarget >= 3;

  const assignedToMe = currentUserId != null && report?.assigned_to === currentUserId;
  const assigned = report?.assigned_to != null;

  const baseBg = csae ? CSAE_BG : report?.priority === 'P0' ? C.red + '0d' : 'transparent';
  const busy = !!busyAction;

  return (
    <>
      <tr
        style={{
          borderBottom: `1px solid ${C.border}`,
          background: baseBg,
          borderLeft: csae ? `4px solid ${C.red}` : report?.priority === 'P0' ? `4px solid ${C.red}99` : '4px solid transparent',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = csae ? '#37121a' : C.cardHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = baseBg; }}
      >
        {/* Priority */}
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
            <Badge
              label={meta.short}
              color={report?.priority === 'P0' ? '#fff' : meta.color}
              bg={report?.priority === 'P0' ? C.red : meta.color + '22'}
              title={meta.desc}
            />
            {csae && (
              <Badge
                label="⚠ CHILD SAFETY"
                color="#fff"
                bg={C.red}
                title="Child sexual abuse and exploitation report — pinned to P0"
                style={{ letterSpacing: 0.4 }}
              />
            )}
            {overdue && open && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.amber }}>OVERDUE</span>
            )}
          </div>
        </td>

        {/* Report */}
        <td style={{ ...tdStyle, maxWidth: 300 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: C.textFaint, fontSize: 11.5, fontWeight: 700 }}>#{report?.id}</span>
            <span style={{ fontWeight: 700, color: csae ? '#fff' : C.text }}>
              {reasonLabel(reason.head) || 'Reason given below'}
            </span>
          </div>
          {reason.detail && (
            <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5, marginTop: 4, wordBreak: 'break-word' }}>
              {clip(reason.detail, 120)}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <Btn
              small
              onClick={() => onToggleDetail?.(report)}
              aria-expanded={expanded}
              aria-label={expanded ? `Hide details for report ${report?.id}` : `Show details for report ${report?.id}`}
            >
              {expanded ? '▴ Hide details' : '▾ Details'}
            </Btn>
          </div>
        </td>

        {/* Target */}
        <td style={{ ...tdStyle, maxWidth: 260 }}>
          <div style={{ fontWeight: 600, color: C.text, fontSize: 12.5 }}>
            {targetLabel(report?.target_type)}
            {identified
              ? <span style={{ color: C.textFaint, fontWeight: 500 }}> #{report.target_id}</span>
              : <span style={{ color: C.amber, fontWeight: 700, fontSize: 11 }}> · NO TARGET ID</span>}
          </div>
          <div style={{
            marginTop: 4, fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word',
            color: preview.muted ? C.textFaint : C.textMuted,
            fontStyle: preview.muted ? 'italic' : 'normal',
          }}>
            {preview.quoted ? `“${clip(preview.text, 140)}”` : clip(preview.text, 140)}
          </div>
        </td>

        {/* Reporter */}
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
          <div style={{ color: C.text, fontSize: 12.5 }}>
            {personLabel(report?.reporter_name, report?.reporter_id)}
          </div>
        </td>

        {/* Assigned */}
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
          {assigned ? (
            <Badge
              label={assignedToMe ? 'You' : clip(personLabel(report?.assignee_name, report?.assigned_to), 18)}
              color={assignedToMe ? C.green : C.textMuted}
              bg={assignedToMe ? C.green + '22' : C.border}
            />
          ) : (
            <Badge label="Unassigned" color={C.amber} bg={C.amber + '22'} />
          )}
        </td>

        {/* Age */}
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }} title={whenFull(report?.created_at)}>
          <span style={{ color: overdue && open ? C.amber : C.textMuted, fontWeight: overdue && open ? 700 : 500 }}>
            {age(report?.created_at)}
          </span>
        </td>

        {/* Reports on target */}
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
          {countable ? (
            <span
              title={`${onTarget} report${onTarget === 1 ? '' : 's'} filed against this ${targetLabel(report?.target_type).toLowerCase()}, all statuses`}
              style={{
                color: heavy ? C.amber : repeat ? C.text : C.textMuted,
                fontWeight: repeat ? 700 : 500,
              }}
            >
              {onTarget}
              {heavy && <span style={{ fontSize: 10.5, fontWeight: 700, marginLeft: 6 }}>REPEAT</span>}
            </span>
          ) : (
            <span
              style={{ color: C.textFaint }}
              title={identified
                ? 'The queue did not return a count for this target.'
                : 'This report has no target id, so a per-target count would pool unrelated reports.'}
            >
              n/a
            </span>
          )}
        </td>

        {/* Actions — only what this admin may actually do. */}
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'stretch' }}>
            {canAssign && !assignedToMe && (
              <Btn
                small
                tone="accent"
                disabled={busy}
                onClick={() => onAssignToMe?.(report)}
              >
                {busyAction === 'assign' ? 'Assigning…' : assigned ? 'Take over' : 'Assign to me'}
              </Btn>
            )}
            {canAssign && assignedToMe && (
              <Btn small disabled={busy} onClick={() => onRelease?.(report)}>
                {busyAction === 'release' ? 'Releasing…' : 'Release'}
              </Btn>
            )}
            {canAction && (
              <Btn small disabled={busy} onClick={() => onChangePriority?.(report)}>
                Priority
              </Btn>
            )}
            {canAction && open && (
              <Btn small tone="good" disabled={busy} onClick={() => onResolve?.(report)}>
                Resolve
              </Btn>
            )}
            {!canAssign && !canAction && (
              <span style={{ fontSize: 11, color: C.textFaint }}>View only</span>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
          <td colSpan={COLSPAN} style={{ padding: 0 }}>
            {detail}
          </td>
        </tr>
      )}
    </>
  );
}
