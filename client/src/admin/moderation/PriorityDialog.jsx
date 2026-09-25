// client/src/admin/moderation/PriorityDialog.jsx
//
// Re-triage one report.
//
// The server applies a severity FLOOR derived from the reason the REPORTER
// chose, so severity is decided by the claim rather than by whoever picks the
// ticket up. When it overrides the choice it answers `floored: true`, and this
// dialog stays open and says so in words. A moderator must never walk away
// believing they moved a child-safety report down the queue.

import { useId, useState } from 'react';
import { C } from './theme';
import { Btn, Field, Modal, Notice, PrimaryBtn, TextArea } from './ui';
import { PRIORITIES, floorFor, priorityMeta } from './constants';
import { splitReason } from './format';

const MIN_REASON = 8;

export default function PriorityDialog({ report, onSubmit, onClose }) {
  const groupId = useId();
  const reasonId = useId();
  const reasonHintId = useId();

  const current = report?.priority;
  const [choice, setChoice] = useState(PRIORITIES.includes(current) ? current : 'P2');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState(null); // { floored, priority, message }

  const floor = floorFor(report?.reason);
  const reasonText = splitReason(report?.reason).head || 'this report';

  // Lowering severity is the direction that can bury something. That one needs
  // a typed reason; raising severity does not.
  //
  // An unrecognised current priority is treated as the P2 default the server
  // falls back to, so a row with a junk value does not make every choice look
  // like a downgrade.
  const rank = (p) => {
    const i = PRIORITIES.indexOf(p);
    return i < 0 ? PRIORITIES.indexOf('P2') : i;
  };
  const isDowngrade = rank(choice) > rank(current);
  const reasonRequired = isDowngrade;
  const reasonOk = !reasonRequired || reason.trim().length >= MIN_REASON;
  const unchanged = choice === current;

  const submit = async () => {
    if (busy || !reasonOk || unchanged) return;
    setBusy(true);
    setError('');
    const result = await onSubmit({ priority: choice, reason: reason.trim() });
    setBusy(false);
    if (!result?.ok) {
      setError(result?.error || 'Could not set the priority.');
      return;
    }
    if (result.floored) {
      // Surfaced here, in place, rather than as a toast behind a closing dialog.
      setOutcome({ floored: true, priority: result.priority, message: result.message });
      return;
    }
    onClose?.();
  };

  if (outcome?.floored) {
    return (
      <Modal
        title="The queue kept its priority"
        subtitle={`Report #${report?.id} was not moved to ${choice}.`}
        onClose={onClose}
        footer={<PrimaryBtn onClick={onClose}>Understood</PrimaryBtn>}
      >
        <Notice tone="danger" icon="🔒" title={outcome.message} live>
          Severity here is set by what the reporter claimed, not by triage. The report is now at{' '}
          <strong style={{ color: C.text }}>{outcome.priority}</strong> and stays in the{' '}
          {priorityMeta(outcome.priority).label} group.
        </Notice>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Change priority · report #${report?.id ?? '?'}`}
      subtitle={`Currently ${priorityMeta(current).label}. Reported as “${reasonText}”.`}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
          <PrimaryBtn onClick={submit} disabled={busy || !reasonOk || unchanged}>
            {busy ? 'Saving…' : `Set to ${choice}`}
          </PrimaryBtn>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {floor && (
          <Notice tone="danger" icon="🔒" title={floor.message}>
            This report's reason pins it at <strong style={{ color: C.text }}>{floor.priority}</strong>.
            Any other choice will be corrected back by the server.
          </Notice>
        )}

        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{
            fontSize: 12, fontWeight: 600, color: C.textMuted,
            textTransform: 'uppercase', letterSpacing: 0.5, padding: 0, marginBottom: 8,
          }}>
            New priority
          </legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRIORITIES.map((p) => {
              const meta = priorityMeta(p);
              const selected = choice === p;
              const id = `${groupId}-${p}`;
              return (
                <label
                  key={p}
                  htmlFor={id}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
                    background: selected ? C.accentSoft : C.bg,
                    border: `1.5px solid ${selected ? C.accent : C.border}`,
                    borderRadius: 10, padding: '10px 14px',
                  }}
                >
                  <input
                    id={id}
                    type="radio"
                    name={groupId}
                    value={p}
                    checked={selected}
                    onChange={() => setChoice(p)}
                    style={{ marginTop: 3, accentColor: C.accent }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: meta.color }}>
                      {meta.label}
                      {p === current && (
                        <span style={{ color: C.textFaint, fontWeight: 600, marginLeft: 8 }}>· current</span>
                      )}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: C.textMuted, marginTop: 2, lineHeight: 1.5 }}>
                      {meta.desc}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field
          label={reasonRequired ? 'Why lower it?' : 'Why (optional)'}
          required={reasonRequired}
          htmlFor={reasonId}
          hintId={reasonHintId}
          hint={reasonRequired
            ? `Required when you lower a priority — at least ${MIN_REASON} characters. Recorded in the audit log with your name.`
            : 'Recorded in the audit log with your name.'}
        >
          <TextArea
            id={reasonId}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby={reasonHintId}
            placeholder={reasonRequired ? 'e.g. Duplicate of #482, already actioned there' : 'Optional context for the next moderator'}
            style={{ width: '100%' }}
          />
        </Field>

        {reasonRequired && !reasonOk && reason.trim().length > 0 && (
          <div style={{ fontSize: 12, color: C.amber }}>
            {MIN_REASON - reason.trim().length} more character{MIN_REASON - reason.trim().length === 1 ? '' : 's'} needed.
          </div>
        )}

        {unchanged && (
          <div style={{ fontSize: 12, color: C.textFaint }}>
            That is already this report's priority.
          </div>
        )}

        {error && <Notice tone="danger" icon="⚠️" title="The server refused that" live>{error}</Notice>}
      </div>
    </Modal>
  );
}
