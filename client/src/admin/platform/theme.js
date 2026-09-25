// client/src/admin/platform/theme.js
//
// The palette is a copy of the `C` object in AdminApp.jsx. AdminApp does not
// export it and this panel is not allowed to edit that file, so the values are
// mirrored here rather than guessed. If the shell's palette changes, change
// this file to match — a panel that looks foreign is a bug.

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

export const FONT = "'Inter', 'SF Pro Display', sans-serif";
export const MONO = "'SF Mono', Menlo, Consolas, monospace";

export const inputStyle = {
  width: '100%',
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

export const tdStyle = { padding: '12px 16px', verticalAlign: 'top' };

// Button variants. `kill` is deliberately the only solid-red control in the
// panel so it can never be mistaken for the ordinary save.
export function btn(variant = 'ghost', disabled = false) {
  const base = {
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit',
    lineHeight: 1.4,
  };
  if (variant === 'primary') {
    return {
      ...base,
      background: disabled ? C.border : 'linear-gradient(135deg, #0a66c2, #1d8fe8)',
      border: 'none',
      color: disabled ? C.textFaint : '#fff',
      fontWeight: 700,
      padding: '9px 20px',
      fontSize: 13,
      boxShadow: disabled ? 'none' : '0 4px 16px rgba(10,102,194,0.35)',
    };
  }
  if (variant === 'kill') {
    return {
      ...base,
      background: disabled ? C.border : C.red,
      border: `1px solid ${disabled ? C.border : C.red}`,
      color: disabled ? C.textFaint : '#fff',
      fontWeight: 800,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      padding: '9px 18px',
      fontSize: 12,
    };
  }
  if (variant === 'danger') {
    return {
      ...base,
      background: C.red + '22',
      border: `1px solid ${C.red}44`,
      color: C.red,
    };
  }
  return { ...base, background: C.card, border: `1px solid ${C.border}`, color: C.text };
}

/** Milliseconds-since-epoch → { abs, rel }, or null when the value is unusable. */
export function formatWhen(ms) {
  const n = Number(ms);
  if (!n || !Number.isFinite(n)) return null;
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return null;

  const diff = Date.now() - n;
  let rel;
  if (diff < 0) rel = 'just now';
  else if (diff < 60_000) rel = 'just now';
  else if (diff < 3_600_000) rel = `${Math.floor(diff / 60_000)}m ago`;
  else if (diff < 86_400_000) rel = `${Math.floor(diff / 3_600_000)}h ago`;
  else if (diff < 30 * 86_400_000) rel = `${Math.floor(diff / 86_400_000)}d ago`;
  else rel = d.toLocaleDateString();

  return { abs: d.toLocaleString(), rel };
}
