// client/src/admin/moderation/theme.js
//
// The admin shell's palette. AdminApp.jsx defines `C` as a module-local const
// and does not export it, and this panel may not edit that file, so the values
// below are copied from it verbatim. If the shell's palette moves, move it
// here too — a panel that looks foreign is a bug.

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

// A red deep enough to sit under white text. Used only for child-safety
// treatment, so that signal means one thing in this console and nothing else
// borrows it.
export const CSAE_BG = '#2b0b10';

export const inputStyle = {
  background: C.bg,
  border: `1.5px solid ${C.border}`,
  borderRadius: 10,
  padding: '10px 14px',
  color: C.text,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

export const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: C.textMuted,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  whiteSpace: 'nowrap',
};

export const tdStyle = {
  padding: '12px 16px',
  verticalAlign: 'top',
  fontSize: 13,
};
