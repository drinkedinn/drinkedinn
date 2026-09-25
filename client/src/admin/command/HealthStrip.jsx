// client/src/admin/command/HealthStrip.jsx
// System health from GET /api/admin/command/health.
//
// Gated separately on `health.read`: the dashboard needs analytics.read, and
// a role could in principle hold one without the other, so this strip fetches
// on its own and fails on its own without taking the dashboard down with it.

import { C, MONO, clockTime } from './theme';
import { Card, SectionLabel, SkeletonLine } from './ui';

// Values the server can return for each subsystem, and how to read them.
const STATE = {
  ok:           { label: 'OK',          color: C.green,     hint: 'responding normally' },
  'local-disk': { label: 'LOCAL DISK',  color: C.amber,     hint: 'uploads are NOT on durable storage — they vanish when the instance restarts' },
  error:        { label: 'ERROR',       color: C.red,       hint: 'the check failed' },
  unknown:      { label: 'UNKNOWN',     color: C.textMuted, hint: 'the server could not determine this' },
};

const stateOf = (v) => STATE[String(v ?? 'unknown')] || { label: String(v).toUpperCase(), color: C.textMuted, hint: 'unrecognised status' };

function Pill({ name, value }) {
  const s = stateOf(value);
  return (
    <div
      title={s.hint}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 12,
        background: C.bg, border: `1px solid ${s.color === C.textMuted ? C.border : s.color + '44'}`,
        flex: '1 1 200px', minWidth: 180,
      }}
    >
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{name}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: s.color, marginTop: 1 }}>{s.label}</div>
      </div>
      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.textFaint, textAlign: 'right', lineHeight: 1.4, maxWidth: 150 }}>{s.hint}</span>
    </div>
  );
}

export default function HealthStrip({ health, loading, error, denied, role }) {
  const worst = !health ? null
    : [health.db, health.r2].some((v) => v === 'error') ? C.red
    : [health.db, health.r2].some((v) => v === 'local-disk' || v === 'unknown') ? C.amber
    : C.green;

  return (
    <Card style={{ padding: '16px 22px', borderColor: worst && worst !== C.green ? worst + '44' : C.border }}>
      <SectionLabel
        right={health?.checked_at
          ? <span style={{ fontSize: 10.5, color: C.textFaint, fontFamily: MONO }}>checked {clockTime(health.checked_at)}</span>
          : null}
      >
        System health
      </SectionLabel>

      {denied ? (
        <div style={{ fontSize: 12.5, color: C.textMuted }}>
          Health checks need the <code style={{ color: C.accentHi }}>health.read</code> permission
          {role ? <> — your role is <strong style={{ color: C.text }}>{role}</strong></> : null}.
        </div>
      ) : error ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span aria-hidden="true">⚠️</span>
          <span style={{ fontSize: 12.5, color: C.red, wordBreak: 'break-word' }}>{error}</span>
        </div>
      ) : loading && !health ? (
        <div style={{ display: 'flex', gap: 12 }}><SkeletonLine height={44} /><SkeletonLine height={44} /></div>
      ) : !health ? (
        <div style={{ fontSize: 12.5, color: C.textMuted }}>No health data returned.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Pill name="Database" value={health.db} />
            <Pill name="Object storage (R2)" value={health.r2} />
          </div>
          {health.db_error && (
            <div style={{ marginTop: 12, background: C.red + '11', border: `1px solid ${C.red}44`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Database error</div>
              <div style={{ fontSize: 12, color: C.textMuted, fontFamily: MONO, wordBreak: 'break-word', lineHeight: 1.5 }}>{String(health.db_error)}</div>
            </div>
          )}
          {health.r2 === 'local-disk' && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: C.amber, lineHeight: 1.6 }}>
              Uploads are being written to the instance's own disk. Anything uploaded now is lost on the next deploy or restart.
            </div>
          )}
        </>
      )}
    </Card>
  );
}
