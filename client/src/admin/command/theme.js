// client/src/admin/command/theme.js
//
// The palette below is copied verbatim from the `C` object in
// ../AdminApp.jsx. That object is module-private there (not exported) and the
// brief forbids editing existing files, so it is duplicated rather than
// imported. If AdminApp's palette ever changes, change it here too — a panel
// that looks foreign is a bug.

export const C = {
  bg:         '#0f1117',
  sidebar:    '#13161e',
  card:       '#1a1d27',
  cardHover:  '#1f2233',
  border:     '#2a2d3e',
  accent:     '#0a66c2',
  accentHi:   '#1d8fe8',
  accentSoft: 'rgba(10,102,194,0.12)',
  text:       '#f0f2f8',
  textMuted:  '#8b8fa8',
  textFaint:  '#555870',
  green:      '#22c55e',
  red:        '#ef4444',
  amber:      '#f59e0b',
  purple:     '#8b5cf6',
  pink:       '#ec4899',
  teal:       '#14b8a6',
};

export const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

// ── Shared style fragments, matched to AdminApp's table / card treatment ─────
export const cardShell = {
  background: C.card,
  borderRadius: 16,
  border: `1px solid ${C.border}`,
};

export const inputStyle = {
  background: C.bg,
  border: `1.5px solid ${C.border}`,
  borderRadius: 10,
  padding: '8px 12px',
  color: C.text,
  fontSize: 13,
  outlineOffset: 2,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

// ── Formatting helpers. Every one of these has to survive null/undefined ─────
/**
 * Format a count. Missing is '—', never 0: Number(null) and Number('') are
 * both 0, so a naive Number() would report "no data" as "zero reports", which
 * on a safety dashboard is the worst possible way to be wrong.
 */
export function num(v) {
  const n = count(v);
  return n == null ? '—' : n.toLocaleString();
}

/**
 * The numeric value behind a count, or null when there isn't one.
 *
 * Same rule as num(), so `num(v) === '—'` exactly when `count(v) === null`:
 * the tile and the caption that sits under it can never disagree about
 * whether a figure arrived.
 */
export function count(v) {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Epoch ms → "14:32:07". Returns '—' for anything unparseable. */
export function clockTime(ms) {
  const d = toDate(ms);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}

/** Epoch ms → "24 Sep". Returns '—' for anything unparseable. */
export function shortDate(ms) {
  const d = toDate(ms);
  return d ? d.toLocaleDateString([], { day: 'numeric', month: 'short' }) : '—';
}

export function fullStamp(ms) {
  const d = toDate(ms);
  return d ? d.toLocaleString() : 'unknown time';
}

export function toDate(ms) {
  if (ms == null || ms === '') return null;
  const d = new Date(typeof ms === 'string' && /^\d+$/.test(ms) ? Number(ms) : ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Seconds → "12s ago" / "4m ago" / "2h ago". */
export function agoLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'just now';
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
