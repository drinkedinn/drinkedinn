// src/admin/content/ui.jsx
// Visual primitives for the Content & Places panel.
//
// AdminApp.jsx does not export its palette or its Card/Badge helpers, and this
// panel is not allowed to edit that file, so the values are restated here —
// byte for byte the same colours, radii and paddings. If the shell's palette
// ever moves, this is the one file in this folder that has to follow it.

// ─── Palette (mirrors AdminApp.jsx `C`) ──────────────────────────────────────
export const C = {
  bg:        '#0f1117',
  sidebar:   '#13161e',
  card:      '#1a1d27',
  cardHover: '#1f2233',
  border:    '#2a2d3e',
  accent:    '#0a66c2',
  accentHi:  '#1d8fe8',
  accentSoft:'rgba(10,102,194,0.12)',
  text:      '#f0f2f8',
  textMuted: '#8b8fa8',
  textFaint: '#555870',
  green:     '#22c55e',
  red:       '#ef4444',
  amber:     '#f59e0b',
  purple:    '#8b5cf6',
  pink:      '#ec4899',
  teal:      '#14b8a6',
};

// ─── Shells ───────────────────────────────────────────────────────────────────
export const Card = ({ children, style = {}, ...rest }) => (
  <div {...rest} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, ...style }}>
    {children}
  </div>
);

export const Badge = ({ label, color, bg, title }) => (
  <span title={title} style={{ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

/** A muted explanatory strip — used to state limits of the data honestly. */
export const Notice = ({ icon = 'ℹ️', tone = C.accentHi, children }) => (
  <Card style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', background: tone + '11', borderColor: tone + '44' }}>
    <span aria-hidden="true" style={{ fontSize: 15, lineHeight: '1.5' }}>{icon}</span>
    <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>{children}</div>
  </Card>
);

/** Server-message-first error. Never shows a raw axios message. */
export const ErrorBanner = ({ message, onRetry }) => (
  <Card style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', background: C.red + '11', borderColor: C.red + '44' }}>
    <span aria-hidden="true" style={{ fontSize: 16 }}>⚠️</span>
    <div role="alert" style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
      {message || 'Something went wrong.'}
    </div>
    {onRetry && (
      <button type="button" onClick={onRetry} style={actionBtn(C.textMuted)}>Retry</button>
    )}
  </Card>
);

export const EmptyState = ({ icon = '📭', title = 'Nothing here', hint }) => (
  <Card style={{ padding: 40, textAlign: 'center' }}>
    <div aria-hidden="true" style={{ fontSize: 42, marginBottom: 12 }}>{icon}</div>
    <div style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
    {hint && <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>{hint}</div>}
  </Card>
);

export const Loading = ({ label = 'Loading…' }) => (
  <Card style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
    <span role="status">{label}</span>
  </Card>
);

// ─── Form + control styles ────────────────────────────────────────────────────
export const labelStyle = {
  fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
};

export const inputStyle = {
  background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10,
  padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

export const selectStyle = { ...inputStyle, cursor: 'pointer' };

/** Tinted button in the shell's house style. */
export const actionBtn = (tone = C.textMuted, disabled = false) => ({
  background: disabled ? C.border : tone + '22',
  color: disabled ? C.textFaint : tone,
  border: `1px solid ${disabled ? C.border : tone + '44'}`,
  borderRadius: 8, padding: '6px 14px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
  opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
});

export const pagerBtn = (disabled) => ({
  background: disabled ? C.border : C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '7px 18px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  color: disabled ? C.textFaint : C.text,
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  opacity: disabled ? 0.5 : 1,
});

export const thStyle = {
  padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.textMuted,
  fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
};

export const tdStyle = { padding: '12px 16px', color: C.text, fontSize: 13, verticalAlign: 'top' };

// ─── Data helpers ─────────────────────────────────────────────────────────────
/**
 * SQLite writes CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC. Handing
 * that straight to `new Date()` makes most engines read it as LOCAL time, so
 * anything east of UTC gets posts dated in the future and a "today" filter
 * that quietly drops rows. Normalise to an explicit UTC instant first.
 */
export function parseDbDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value);
  const sqlite = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw);
  const d = new Date(sqlite ? raw.replace(' ', 'T') + 'Z' : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(value) {
  const d = parseDbDate(value);
  return d ? d.toLocaleString() : '—';
}

export function fmtDate(value) {
  const d = parseDbDate(value);
  return d ? d.toLocaleDateString() : '—';
}

export function fmtCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

/**
 * User text for display. Returns a plain string — callers render it as a text
 * node, never as HTML. Control characters are stripped so a crafted post
 * cannot smuggle bidi or zero-width tricks into an operator's reading of it.
 */
export function plainPreview(text, max = 220) {
  if (text == null) return '';
  const cleaned = String(text)
    // Control characters, then the bidi and zero-width ranges. Written as
    // explicit escapes: the literal characters are invisible in an editor, so
    // a future edit could delete one without anyone seeing it go.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd() + '…';
}

/** Server message first, then a specific fallback. Never err.message. */
export function apiError(err, fallback) {
  return err?.response?.data?.error || fallback;
}
