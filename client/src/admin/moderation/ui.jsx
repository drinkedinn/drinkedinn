// client/src/admin/moderation/ui.jsx
//
// The shell's card / badge / table treatment, rebuilt here because AdminApp.jsx
// keeps its helpers module-local and this panel may not edit it. Same radii,
// same borders, same type scale — see theme.js.
//
// Every control is a real <button>, every input has a real <label>. A console
// used under time pressure is used by keyboard.

import { useEffect, useId, useRef } from 'react';
import { C, inputStyle } from './theme';

export const Card = ({ children, style = {}, ...rest }) => (
  <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, ...style }} {...rest}>
    {children}
  </div>
);

export const Badge = ({ label, color, bg, title, style = {} }) => (
  <span
    title={title}
    style={{
      background: bg, color, borderRadius: 20, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block', ...style,
    }}
  >
    {label}
  </span>
);

const TONES = {
  neutral: { fg: C.textMuted, bg: C.card,          bd: C.border },
  accent:  { fg: C.accentHi,  bg: C.accent + '22', bd: C.accent + '44' },
  good:    { fg: C.green,     bg: C.green + '22',  bd: C.green + '44' },
  warn:    { fg: C.amber,     bg: C.amber + '22',  bd: C.amber + '44' },
  danger:  { fg: C.red,       bg: C.red + '22',    bd: C.red + '44' },
};

/** A real button. `tone` carries meaning; the label always carries it too. */
export const Btn = ({ tone = 'neutral', small = false, disabled = false, style = {}, children, ...rest }) => {
  const t = TONES[tone] || TONES.neutral;
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        borderRadius: small ? 6 : 8,
        padding: small ? '4px 8px' : '6px 14px',
        fontSize: small ? 11 : 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
};

/** The shell's primary gradient button, for the one committing action on screen. */
export const PrimaryBtn = ({ disabled = false, style = {}, children, ...rest }) => (
  <button
    type="button"
    disabled={disabled}
    style={{
      background: disabled ? C.border : 'linear-gradient(135deg, #0a66c2, #1d8fe8)',
      border: 'none', borderRadius: 10, padding: '10px 22px',
      color: disabled ? C.textFaint : '#fff', fontWeight: 700, fontSize: 13,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      boxShadow: disabled ? 'none' : '0 4px 16px rgba(10,102,194,0.35)',
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);

/** A danger-weighted commit button, for the step that actually records something. */
export const DangerBtn = ({ disabled = false, style = {}, children, ...rest }) => (
  <button
    type="button"
    disabled={disabled}
    style={{
      background: disabled ? C.border : C.red,
      border: 'none', borderRadius: 10, padding: '10px 22px',
      color: disabled ? C.textFaint : '#fff', fontWeight: 700, fontSize: 13,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);

/** label + control, wired by id. `hint` is described to screen readers too. */
export const Field = ({ label, hint, required = false, htmlFor, hintId, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label
      htmlFor={htmlFor}
      style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}
    >
      {label}
      {required && <span style={{ color: C.red, marginLeft: 4 }} aria-hidden="true">*</span>}
      {required && <span style={SR_ONLY}> (required)</span>}
    </label>
    {children}
    {hint && (
      <div id={hintId} style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.5 }}>{hint}</div>
    )}
  </div>
);

const SR_ONLY = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

export const Select = ({ style = {}, ...rest }) => (
  <select style={{ ...inputStyle, cursor: 'pointer', ...style }} {...rest} />
);

export const TextArea = ({ style = {}, ...rest }) => (
  <textarea style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, ...style }} {...rest} />
);

const NOTICE_TONES = {
  info:   { fg: C.textMuted, bd: C.border,        bg: C.card },
  accent: { fg: C.accentHi,  bd: C.accent + '44', bg: C.accent + '11' },
  good:   { fg: C.green,     bd: C.green + '44',  bg: C.green + '11' },
  warn:   { fg: C.amber,     bd: C.amber + '44',  bg: C.amber + '11' },
  danger: { fg: C.red,       bd: C.red + '55',    bg: C.red + '14' },
};

/**
 * An inline message. `live` makes it an assertive alert — used for action
 * failures and for a refused priority change, which must never pass unnoticed.
 */
export const Notice = ({ tone = 'info', icon, title, children, onDismiss, live = false, style = {} }) => {
  const t = NOTICE_TONES[tone] || NOTICE_TONES.info;
  return (
    <div
      role={live ? 'alert' : undefined}
      style={{
        background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 12,
        padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', ...style,
      }}
    >
      {icon && <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.3 }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: 13, fontWeight: 700, color: t.fg, marginBottom: children ? 4 : 0 }}>{title}</div>}
        {children && <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>{children}</div>}
      </div>
      {onDismiss && (
        <Btn small onClick={onDismiss} aria-label="Dismiss this message">Dismiss</Btn>
      )}
    </div>
  );
};

export const LoadingState = ({ label = 'Loading…' }) => (
  <Card style={{ padding: 40, textAlign: 'center' }}>
    <div style={{ color: C.textMuted, fontSize: 14 }} role="status">{label}</div>
  </Card>
);

export const EmptyState = ({ icon = '✅', title, children }) => (
  <Card style={{ padding: 40, textAlign: 'center' }}>
    <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">{icon}</div>
    <div style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
    {children && <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6 }}>{children}</div>}
  </Card>
);

/** The server's own words, never a generic apology and never err.message. */
export const ErrorState = ({ message, onRetry, title = 'Could not load this' }) => (
  <Card style={{ padding: 32, textAlign: 'center', borderColor: C.red + '55', background: C.red + '0d' }}>
    <div style={{ fontSize: 32, marginBottom: 10 }} aria-hidden="true">⚠️</div>
    <div style={{ color: C.text, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
    <div role="alert" style={{ color: C.red, fontSize: 13, marginBottom: onRetry ? 16 : 0, lineHeight: 1.6 }}>{message}</div>
    {onRetry && <Btn tone="accent" onClick={onRetry}>Try again</Btn>}
  </Card>
);

export const StatTile = ({ icon, label, value, sub, color = C.accent, emphasis = false }) => (
  <Card style={{
    padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
    borderColor: emphasis ? color + '77' : C.border,
    background: emphasis ? color + '11' : C.card,
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12, background: color + '22', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
    }} aria-hidden="true">{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.text, lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : (value ?? '–')}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 3 }}>{sub}</div>}
    </div>
  </Card>
);

/**
 * A modal dialog: focus moves in on open, Tab stays inside, Escape leaves
 * (unless a request is in flight), and focus returns to whatever opened it.
 */
export function Modal({ title, subtitle, onClose, busy = false, width = 580, children, footer }) {
  const panelRef = useRef(null);
  const busyRef = useRef(busy);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  busyRef.current = busy;
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const node = panelRef.current;

    const focusables = () => Array.from(
      node?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []
    );

    (focusables()[0] || node)?.focus?.();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (busyRef.current) return;
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const idx = list.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && idx === list.length - 1) { e.preventDefault(); list[0].focus(); }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      try { previous?.focus?.(); } catch { /* the opener may be gone */ }
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(6,8,13,0.72)', zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '48px 20px', overflowY: 'auto',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descId : undefined}
        tabIndex={-1}
        style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
          width: '100%', maxWidth: width, outline: 'none',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>{title}</h2>
          {subtitle && (
            <p id={descId} style={{ margin: '6px 0 0', fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>{subtitle}</p>
          )}
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
        {footer && (
          <div style={{
            padding: '16px 24px', borderTop: `1px solid ${C.border}`,
            display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export { SR_ONLY };
