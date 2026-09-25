// client/src/admin/people/ActionDialog.jsx
// The one way a consequential action leaves this panel.
//
// Three things it refuses to skip:
//   1. A typed reason of at least 8 characters — the same floor
//      middleware/adminAuth.js enforces for high-impact permissions, checked
//      here so the admin finds out before the request, not after a 400.
//   2. A plain sentence saying what will happen and to whom. Not "Are you
//      sure?" — the actual effect, the actual person.
//   3. For irreversible actions, the member's name typed out. There is no
//      one-click ban and no one-click deletion.

import { useEffect, useRef, useState } from 'react';
import { C, btn, input, label } from './ui';

const MIN_REASON = 8;

export default function ActionDialog({
  title,
  tone = 'primary',
  summary,
  confirmName = null,
  submitLabel = 'Confirm',
  auditNote = 'This action and your reason are written to the admin audit log with your name against them.',
  busy = false,
  error = '',
  children = null,
  onCancel,
  onSubmit,
}) {
  const [reason, setReason] = useState('');
  const [typedName, setTypedName] = useState('');
  const reasonRef = useRef(null);

  useEffect(() => {
    reasonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const trimmed = reason.trim();
  const reasonOk = trimmed.length >= MIN_REASON;
  const nameOk = !confirmName || typedName.trim() === String(confirmName).trim();
  const canSubmit = reasonOk && nameOk && !busy;

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit?.(trimmed);
  };

  const accent = tone === 'danger' ? C.red : tone === 'warn' ? C.amber : tone === 'good' ? C.green : C.accentHi;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(7,8,12,0.72)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-dialog-title"
        style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
          width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <form onSubmit={submit}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
            <h2 id="people-dialog-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: accent }}>
              {title}
            </h2>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: C.bg, border: `1px solid ${accent}44`, borderRadius: 12,
              padding: '14px 16px', color: C.text, fontSize: 13, lineHeight: 1.65,
            }}>
              {summary}
            </div>

            {children}

            <div>
              <label htmlFor="people-dialog-reason" style={label}>Reason (required)</label>
              <textarea
                id="people-dialog-reason"
                ref={reasonRef}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="What are you acting on? Be specific — this is the record."
                aria-describedby="people-dialog-reason-help"
                style={{ ...input, width: '100%', resize: 'vertical' }}
              />
              <div
                id="people-dialog-reason-help"
                style={{ fontSize: 11, color: reasonOk ? C.textFaint : C.amber, marginTop: 6, lineHeight: 1.5 }}
              >
                {reasonOk
                  ? `${trimmed.length} characters. ${auditNote}`
                  : `At least ${MIN_REASON} characters — the server rejects the action otherwise. ${auditNote}`}
              </div>
            </div>

            {confirmName && (
              <div>
                <label htmlFor="people-dialog-confirm" style={label}>
                  Type {confirmName} to confirm
                </label>
                <input
                  id="people-dialog-confirm"
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  autoComplete="off"
                  style={{ ...input, width: '100%' }}
                />
              </div>
            )}

            {error && (
              <div role="alert" style={{
                background: C.red + '22', border: `1px solid ${C.red}44`, borderRadius: 10,
                padding: '10px 14px', color: C.red, fontSize: 13, lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}
          </div>

          <div style={{
            padding: '16px 24px', borderTop: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            <button type="button" onClick={onCancel} disabled={busy} style={btn({ tone: 'neutral', size: 'md', disabled: busy })}>
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit} style={btn({ tone, size: 'md', disabled: !canSubmit })}>
              {busy ? 'Working…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
