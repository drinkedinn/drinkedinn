// client/src/admin/platform/ui.jsx
// Shared shells for the Platform panel. Styling matches AdminApp.jsx.

import { useEffect, useRef, useId } from 'react';
import { C, inputStyle, btn, MONO } from './theme';

export const Card = ({ children, style = {}, ...rest }) => (
  <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, ...style }} {...rest}>
    {children}
  </div>
);

export const Badge = ({ label, color, bg }) => (
  <span style={{ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

const CHIP_TONES = {
  info:  { color: C.accentHi, bg: C.accent + '22' },
  warn:  { color: C.amber,    bg: C.amber + '22' },
  bad:   { color: C.red,      bg: C.red + '22' },
  good:  { color: C.green,    bg: C.green + '22' },
  muted: { color: C.textMuted, bg: C.border },
};

export const Chip = ({ label, tone = 'muted' }) => {
  const t = CHIP_TONES[tone] || CHIP_TONES.muted;
  return <Badge label={label} color={t.color} bg={t.bg} />;
};

/** A bordered aside — the amber variant matches the Brand Review notice. */
export const Note = ({ icon = 'ℹ️', tone = 'amber', children, style = {} }) => {
  const c = tone === 'red' ? C.red : tone === 'blue' ? C.accent : C.amber;
  return (
    <Card style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start', background: c + '11', borderColor: c + '44', ...style }}>
      <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }} aria-hidden="true">{icon}</span>
      <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.65, minWidth: 0 }}>{children}</div>
    </Card>
  );
};

export const Loading = ({ label = 'Loading…' }) => (
  <Card style={{ padding: 28, textAlign: 'center', color: C.textMuted, fontSize: 13 }} aria-live="polite">
    ⏳ {label}
  </Card>
);

export const EmptyState = ({ icon = '—', title, children }) => (
  <Card style={{ padding: 36, textAlign: 'center' }}>
    <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden="true">{icon}</div>
    <div style={{ color: C.text, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
    {children && <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>{children}</div>}
  </Card>
);

/** Always shows the server's own sentence. */
export const ErrorBlock = ({ message, onRetry, style = {} }) => (
  <Card style={{ padding: '14px 18px', background: C.red + '11', borderColor: C.red + '44', display: 'flex', gap: 12, alignItems: 'center', ...style }} role="alert">
    <span style={{ fontSize: 16 }} aria-hidden="true">⚠️</span>
    <div style={{ flex: 1, minWidth: 0, color: C.red, fontSize: 13, lineHeight: 1.5 }}>{message}</div>
    {onRetry && (
      <button type="button" onClick={onRetry} style={btn('ghost')}>Retry</button>
    )}
  </Card>
);

export const InlineError = ({ message }) =>
  message ? <div style={{ color: C.red, fontSize: 11.5, marginTop: 5, lineHeight: 1.45 }} role="alert">{message}</div> : null;

/** Label + control + hint, wired with a real htmlFor. */
export const Field = ({ label, hint, error, htmlFor, children, style = {} }) => (
  <div style={{ ...style }}>
    <label
      htmlFor={htmlFor}
      style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}
    >
      {label}
    </label>
    {children}
    {hint && <div style={{ color: C.textFaint, fontSize: 11.5, marginTop: 5, lineHeight: 1.5 }}>{hint}</div>}
    <InlineError message={error} />
  </div>
);

export const TextInput = ({ id, invalid, style = {}, ...rest }) => (
  <input
    id={id}
    aria-invalid={invalid ? 'true' : undefined}
    style={{ ...inputStyle, borderColor: invalid ? C.red : C.border, ...style }}
    onFocus={(e) => { if (!invalid) e.target.style.borderColor = C.accent; }}
    onBlur={(e) => { e.target.style.borderColor = invalid ? C.red : C.border; }}
    {...rest}
  />
);

export const TextArea = ({ id, invalid, style = {}, ...rest }) => (
  <textarea
    id={id}
    aria-invalid={invalid ? 'true' : undefined}
    style={{ ...inputStyle, borderColor: invalid ? C.red : C.border, resize: 'vertical', lineHeight: 1.5, ...style }}
    onFocus={(e) => { if (!invalid) e.target.style.borderColor = C.accent; }}
    onBlur={(e) => { e.target.style.borderColor = invalid ? C.red : C.border; }}
    {...rest}
  />
);

/** A real checkbox, styled. Never a div pretending. */
export const CheckRow = ({ id, checked, onChange, disabled, label, hint }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    <input
      id={id}
      type="checkbox"
      checked={!!checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: 16, height: 16, marginTop: 2, accentColor: C.accent, cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
    />
    <label htmlFor={id} style={{ cursor: disabled ? 'not-allowed' : 'pointer', minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
      {hint && <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
    </label>
  </div>
);

export const Mono = ({ children, style = {} }) => (
  <span style={{ fontFamily: MONO, fontSize: 12.5, ...style }}>{children}</span>
);

/**
 * Typed reason for a high-impact action. The server rejects anything under 8
 * characters, and the text is written to admin_audit against this admin's
 * name — so the UI says both of those things rather than letting a 400 do it.
 */
export function ReasonField({ id, value, onChange, disabled, autoFocus, label = 'Reason (required)', minLength = 8 }) {
  const len = String(value || '').trim().length;
  const short = len > 0 && len < minLength;
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={`At least ${minLength} characters. Recorded in the audit log with your name, the flag and the time.`}
      error={short ? `${minLength - len} more character${minLength - len > 1 ? 's' : ''} needed.` : null}
    >
      <TextArea
        id={id}
        autoFocus={autoFocus}
        rows={2}
        value={value}
        invalid={short}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Checkout errors spiking in EU — rolling back while we investigate"
      />
    </Field>
  );
}

/**
 * Modal confirmation. States exactly what happens and to whom; the caller
 * supplies the sentence. Escape cancels, focus lands inside the dialog.
 */
export function ConfirmDialog({ title, icon = '⚠️', tone = 'red', children, confirmLabel, confirmVariant = 'danger', confirmDisabled, busy, error, onCancel, onConfirm }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const c = tone === 'red' ? C.red : C.amber;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  useEffect(() => {
    if (!panelRef.current) return;
    // Focus the first focusable thing in the dialog so the keyboard lands here.
    const first = panelRef.current.querySelector('textarea, input, button');
    first?.focus();
  }, []);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(7,9,14,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ background: C.card, border: `1px solid ${c}55`, borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.55)' }}
      >
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }} aria-hidden="true">{icon}</span>
          <h2 id={titleId} style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>{title}</h2>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
          {error && <ErrorBlock message={error} />}
        </div>
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={busy} style={btn('ghost', busy)}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy || confirmDisabled} style={btn(confirmVariant, busy || confirmDisabled)}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown instead of controls the signed-in role cannot use. */
export const PermissionNote = ({ permission, action, known }) => (
  <Note icon="🔒" tone="blue">
    {known
      ? <>Your role cannot {action}. That needs <Mono>{permission}</Mono>.</>
      : <>The shell did not pass a permission set to this panel, so write controls are hidden. Pass <Mono>permissions</Mono> (an array or Set of permission strings, e.g. <Mono>{permission}</Mono>) to render them.</>}
  </Note>
);
