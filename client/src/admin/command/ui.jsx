// client/src/admin/command/ui.jsx
// Small presentational pieces shared by CommandCentre and AuditLog. Kept in
// one file because none of them is more than a few lines, and splitting them
// further would cost more to read than it saves.

import { C, cardShell, num } from './theme';

/** Card shell — same radius, border and background as AdminApp's Card. */
export const Card = ({ children, style = {}, ...rest }) => (
  <div style={{ ...cardShell, ...style }} {...rest}>{children}</div>
);

/** Pill badge — same shape as AdminApp's Badge. */
export const Badge = ({ label, color = C.textMuted, bg = C.border, title }) => (
  <span
    title={title}
    style={{ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
  >
    {label}
  </span>
);

/** Uppercase section eyebrow. */
export const SectionLabel = ({ children, tone = C.textMuted, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: tone, textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </span>
    {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
  </div>
);

/**
 * Dense metric: label on top, number below. Denser than AdminApp's StatTile
 * because a wall-monitor dashboard is read at a glance, not browsed.
 */
export const Metric = ({ label, value, sub, color = C.text, alarm = false }) => (
  <div
    style={{
      flex: '1 1 120px',
      minWidth: 108,
      padding: '12px 14px',
      borderRadius: 12,
      background: alarm ? C.red + '1f' : C.bg,
      border: `1px solid ${alarm ? C.red + '66' : C.border}`,
    }}
  >
    <div style={{ fontSize: 10.5, fontWeight: 700, color: alarm ? C.red : C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: alarm ? C.red : color, lineHeight: 1.15, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
      {num(value)}
    </div>
    {sub && <div style={{ fontSize: 10.5, color: alarm ? C.red : C.textFaint, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
  </div>
);

/** Muted explanatory note. `tone` tints the left rule and the icon. */
export const Note = ({ icon = 'ℹ️', tone = C.border, children, style = {} }) => (
  <div
    style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${tone}`,
      borderRadius: 10, padding: '10px 14px', ...style,
    }}
  >
    <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1.5 }}>{icon}</span>
    <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>{children}</div>
  </div>
);

/** Server error. Always shows the server's own message, never err.message. */
export const ErrorNote = ({ message, onRetry }) => (
  <Card style={{ padding: '14px 18px', background: C.red + '11', borderColor: C.red + '44', display: 'flex', gap: 12, alignItems: 'center' }}>
    <span aria-hidden="true" style={{ fontSize: 18 }}>⚠️</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 2 }}>The server refused this request</div>
      <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5, wordBreak: 'break-word' }}>{message}</div>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0, fontFamily: 'inherit' }}
      >
        Try again
      </button>
    )}
  </Card>
);

/**
 * Shown instead of a panel when the signed-in admin's role does not carry the
 * permission. Nothing is requested from the server in this state.
 */
export const PermissionNote = ({ permission, role }) => (
  <Card style={{ padding: 36, textAlign: 'center' }}>
    <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
    <div style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Not available to your role</div>
    <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
      This view needs the <code style={{ color: C.accentHi }}>{permission}</code> permission.
      {role ? <> Your role is <strong style={{ color: C.text }}>{role}</strong>.</> : null} Ask an owner to adjust your role if you need it.
    </div>
  </Card>
);

/** Empty state. */
export const EmptyNote = ({ icon = '—', title, detail }) => (
  <div style={{ padding: 28, textAlign: 'center' }}>
    <div aria-hidden="true" style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
    <div style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</div>
    {detail && <div style={{ color: C.textMuted, fontSize: 12.5, lineHeight: 1.6 }}>{detail}</div>}
  </div>
);

/** Loading placeholder bar. */
export const SkeletonLine = ({ height = 14, width = '100%' }) => (
  <div className="di-cmd-pulse" style={{ height, width, borderRadius: 6, background: C.cardHover }} />
);

/**
 * Keyframes used by the live dot, the CSAE alarm and skeletons. Inline styles
 * cannot express keyframes, so one <style> block carries them. Motion is
 * behind prefers-reduced-motion.
 */
export const PanelStyles = () => (
  <style>{`
    @media (prefers-reduced-motion: no-preference) {
      @keyframes diCmdPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }
      @keyframes diCmdAlarm {
        0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.45) }
        50%     { box-shadow: 0 0 0 6px rgba(239,68,68,0) }
      }
      .di-cmd-pulse { animation: diCmdPulse 1.6s ease-in-out infinite }
      .di-cmd-alarm { animation: diCmdAlarm 2s ease-out infinite }
    }
    .di-cmd-focus:focus-visible { outline: 2px solid ${C.accentHi}; outline-offset: 2px; border-radius: 6px }
  `}</style>
);
