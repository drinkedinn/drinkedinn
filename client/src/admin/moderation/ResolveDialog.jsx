// client/src/admin/moderation/ResolveDialog.jsx
//
// Close a report: what was decided, and why. Both are recorded.
//
// Two things this dialog is careful to say out loud:
//
//   1. Recording an outcome does not CARRY IT OUT. POST /:id/resolve writes the
//      report row and nothing else — it does not ban an account or delete a
//      post. A moderator who believes "user_banned" bans someone leaves a live
//      account behind and a closed ticket saying it was handled.
//   2. The choice and the note are written to the audit log against their name.

import { useId, useState } from 'react';
import { C } from './theme';
import { Btn, DangerBtn, Field, Modal, Notice, PrimaryBtn, TextArea } from './ui';
import { RESOLUTIONS, isCsae, resolutionMeta, targetLabel } from './constants';
import { personLabel, splitReason } from './format';

const MIN_REASON = 8;
const MAX_NOTE = 500; // routes/moderation.js slices the note at 500 characters.

export default function ResolveDialog({ report, onSubmit, onClose }) {
  const groupId = useId();
  const noteId = useId();
  const noteHintId = useId();

  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const meta = resolutionMeta(choice);
  const csae = isCsae(report?.reason);
  const isP0 = report?.priority === 'P0';

  // A reason is required for anything that asserts an outcome against a person
  // or their content — and for closing a P0 as "no action", because a
  // child-safety report closed with no explanation is the single worst record
  // this console could hold.
  const reasonRequired = !!meta && (meta.enforcement || isP0);
  const reasonOk = !reasonRequired || note.trim().length >= MIN_REASON;
  // Closing a P0 — including closing a child-safety report as "no action" —
  // goes through the same confirmation step as an enforcement outcome. The one
  // case you least want to be a single click is the one at the top of the queue.
  const needsConfirm = !!meta && (meta.enforcement || isP0);

  const targetName = report?.target_type === 'user'
    ? personLabel(report?.target_user_name, report?.target_id)
    : `#${report?.target_id ?? '?'}`;
  const targetPhrase = `${targetLabel(report?.target_type)} ${targetName}`;

  const submit = async () => {
    if (busy || !meta || !reasonOk) return;
    setBusy(true);
    setError('');
    const trimmed = note.trim();
    const result = await onSubmit({
      resolution: choice,
      note: trimmed,
      // Sent as `reason` as well so the audit row carries the explanation in the
      // same field every other admin action uses.
      reason: trimmed,
    });
    setBusy(false);
    if (!result?.ok) {
      setError(result?.error || 'Could not resolve that report.');
      setConfirming(false);
      return;
    }
    onClose?.();
  };

  const primaryAction = () => {
    if (!meta || !reasonOk) return;
    if (needsConfirm && !confirming) { setConfirming(true); return; }
    submit();
  };

  const footer = (
    <>
      <Btn onClick={confirming ? () => setConfirming(false) : onClose} disabled={busy}>
        {confirming ? 'Back' : 'Cancel'}
      </Btn>
      {confirming ? (
        <DangerBtn onClick={submit} disabled={busy}>
          {busy ? 'Recording…' : `Confirm · record ${meta?.label?.toLowerCase()}`}
        </DangerBtn>
      ) : (
        <PrimaryBtn onClick={primaryAction} disabled={busy || !meta || !reasonOk}>
          {busy ? 'Recording…' : needsConfirm ? 'Continue' : 'Record resolution'}
        </PrimaryBtn>
      )}
    </>
  );

  return (
    <Modal
      title={`Resolve report #${report?.id ?? '?'}`}
      subtitle={`Reported as “${splitReason(report?.reason).head || 'no reason given'}” · target: ${targetPhrase}`}
      onClose={onClose}
      busy={busy}
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {csae && (
          <Notice tone="danger" icon="🚨" title="Child-safety report">
            Check the escalation path before closing this. Child-safety reports are retained and,
            where the law requires it, reported onward.
          </Notice>
        )}

        {confirming && meta ? (
          <Notice tone="danger" icon="⚠️" title="Confirm this resolution" live>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                Report <strong style={{ color: C.text }}>#{report?.id}</strong> about{' '}
                <strong style={{ color: C.text }}>{targetPhrase}</strong> will be closed and recorded as{' '}
                <strong style={{ color: C.text }}>{meta.label}</strong>
                {choice === 'escalated' ? ' and moved to the escalated queue.' : '.'}
              </div>
              <div style={{
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '8px 12px', color: C.textMuted, fontStyle: 'italic', wordBreak: 'break-word',
              }}>
                “{note.trim()}”
              </div>
              <div>
                {meta.enforcement ? (
                  <>
                    This records the outcome. It does <strong style={{ color: C.text }}>not</strong> remove
                    content or change the account — do that in the Posts or Users panel.{' '}
                  </>
                ) : (
                  <>Nothing about the content or the account changes. </>
                )}
                Your name, role and this note go to the audit log.
              </div>
            </div>
          </Notice>
        ) : (
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend style={{
              fontSize: 12, fontWeight: 600, color: C.textMuted,
              textTransform: 'uppercase', letterSpacing: 0.5, padding: 0, marginBottom: 8,
            }}>
              Resolution
            </legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RESOLUTIONS.map((r) => {
                const selected = choice === r.value;
                const id = `${groupId}-${r.value}`;
                return (
                  <label
                    key={r.value}
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
                      value={r.value}
                      checked={selected}
                      onChange={() => { setChoice(r.value); setError(''); }}
                      style={{ marginTop: 3, accentColor: C.accent }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.text }}>
                        {r.label}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: C.textMuted, marginTop: 2, lineHeight: 1.5 }}>
                        {r.desc}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {!confirming && (
          <Field
            label={reasonRequired ? 'Reason' : 'Note (optional)'}
            required={reasonRequired}
            htmlFor={noteId}
            hintId={noteHintId}
            hint={reasonRequired
              ? `Required — at least ${MIN_REASON} characters. Stored on the report and recorded in the audit log with your name.`
              : 'Stored on the report and recorded in the audit log with your name.'}
          >
            <TextArea
              id={noteId}
              rows={3}
              maxLength={MAX_NOTE}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={noteHintId}
              placeholder="What did you find, and what did you do about it?"
              style={{ width: '100%' }}
            />
          </Field>
        )}

        {!confirming && reasonRequired && !reasonOk && note.trim().length > 0 && (
          <div style={{ fontSize: 12, color: C.amber }}>
            {MIN_REASON - note.trim().length} more character{MIN_REASON - note.trim().length === 1 ? '' : 's'} needed.
          </div>
        )}

        {!confirming && !meta && (
          <div style={{ fontSize: 12, color: C.textFaint }}>Pick a resolution to continue.</div>
        )}

        {!confirming && meta && !meta.enforcement && (
          <Notice tone="info" icon="ℹ️">
            Closing this report does not change anything about the content or the account.
          </Notice>
        )}

        {error && <Notice tone="danger" icon="⚠️" title="The server refused that" live>{error}</Notice>}
      </div>
    </Modal>
  );
}
