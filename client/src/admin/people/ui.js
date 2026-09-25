// client/src/admin/people/ui.js
// Shared look-and-feel for the People panel.
//
// The palette and the card/table/badge treatment are copied verbatim from
// AdminApp.jsx rather than imported, because AdminApp does not export them and
// this panel must not edit it. If AdminApp's palette ever moves into a shared
// module, delete this copy and import that instead.

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

// ─── Dates ───────────────────────────────────────────────────────────────────
// created_at arrives as a SQLite DATETIME ('2024-05-01 18:22:03', UTC) on users
// and as epoch milliseconds on admin_roles.granted_at. Date parsing of the
// space-separated form is not portable, so normalise before trusting it.
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (/^\d+$/.test(s)) {
    const d = new Date(Number(s));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString() : '—';
}

export function fmtDateTime(value) {
  const d = toDate(value);
  return d ? d.toLocaleString() : '—';
}

/** "1 yr 2 mo on the platform" — plain language, no false precision. */
export function accountAge(value) {
  const d = toDate(value);
  if (!d) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 0) return '—';
  if (days === 0) return 'joined today';
  if (days === 1) return '1 day';
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months`;
  const years = Math.floor(days / 365);
  const rem = Math.floor((days % 365) / 30);
  return rem ? `${years} yr ${rem} mo` : `${years} yr`;
}

export function fmtNum(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString() : '—';
}

// ─── Primitives ──────────────────────────────────────────────────────────────
export const card = (extra = {}) => ({
  background: C.card,
  borderRadius: 16,
  border: `1px solid ${C.border}`,
  ...extra,
});

export const th = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: C.textMuted,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  whiteSpace: 'nowrap',
};

export const td = { padding: '12px 16px', verticalAlign: 'middle' };

export const input = {
  background: C.bg,
  border: `1.5px solid ${C.border}`,
  borderRadius: 10,
  padding: '10px 14px',
  color: C.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

export const label = {
  fontSize: 12,
  fontWeight: 600,
  color: C.textMuted,
  display: 'block',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

export const btn = ({ tone = 'quiet', disabled = false, size = 'sm' } = {}) => {
  const tones = {
    quiet:   { bg: C.card,          fg: C.textMuted, bd: C.border },
    neutral: { bg: C.cardHover,     fg: C.text,      bd: C.border },
    primary: { bg: C.accent + '22', fg: C.accentHi,  bd: C.accent + '66' },
    danger:  { bg: C.red + '22',    fg: C.red,       bd: C.red + '44' },
    warn:    { bg: C.amber + '22',  fg: C.amber,     bd: C.amber + '44' },
    good:    { bg: C.green + '22',  fg: C.green,     bd: C.green + '44' },
  };
  const t = tones[tone] || tones.quiet;
  const pad = size === 'lg' ? '10px 20px' : size === 'md' ? '8px 16px' : '5px 10px';
  return {
    background: disabled ? C.card : t.bg,
    color: disabled ? C.textFaint : t.fg,
    border: `1px solid ${disabled ? C.border : t.bd}`,
    borderRadius: 8,
    padding: pad,
    fontSize: size === 'lg' ? 14 : 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };
};

export const pagerBtn = (disabled) => ({
  background: disabled ? C.border : C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '7px 18px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  color: disabled ? C.textFaint : C.text,
  fontSize: 13,
  fontWeight: 600,
  opacity: disabled ? 0.5 : 1,
  fontFamily: 'inherit',
});
