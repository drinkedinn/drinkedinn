// client/src/admin/command/SignupsChart.jsx
// 14-day sign-up trend, plain SVG. No chart library (no new dependencies).
//
// The server returns only days that HAD sign-ups
// (`GROUP BY date(created_at)`), so a quiet day is simply absent. Drawing that
// straight would silently compress the axis and make a flat week look busy, so
// missing days are filled with zero here.
//
// Day keys are UTC because SQLite's date()/datetime('now') are UTC; using the
// browser's local day would shift every bar for anyone outside UTC.

import { C, MONO, num } from './theme';
import { Card, SectionLabel, EmptyNote, SkeletonLine } from './ui';

const DAY_MS = 86400000;

const utcKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Normalise the server's `signups` array into a dense, sorted day series. */
export function buildDays(signups, windowDays = 14) {
  const counts = new Map();
  const rows = Array.isArray(signups) ? signups : [];
  for (const row of rows) {
    if (!row || row.day == null) continue;
    const key = String(row.day).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const n = Number(row.c);
    counts.set(key, (counts.get(key) || 0) + (Number.isFinite(n) ? n : 0));
  }

  const keys = new Set(counts.keys());
  const today = Date.now();
  for (let i = windowDays - 1; i >= 0; i -= 1) keys.add(utcKey(today - i * DAY_MS));

  // `created_at > datetime('now','-14 days')` can clip a partial 15th day at
  // the far edge; keep it rather than dropping real rows, but cap the axis so
  // an unexpected payload cannot stretch the chart indefinitely.
  return [...keys].sort().slice(-(windowDays + 1)).map((day) => ({ day, count: counts.get(day) || 0 }));
}

const W = 720;
const H = 188;
const PAD = { l: 38, r: 10, t: 20, b: 28 };

export default function SignupsChart({ signups, loading }) {
  const days = buildDays(signups);
  const counts = days.map((d) => d.count);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  const peak = days.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null);
  const todayKey = utcKey(Date.now());

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const slot = plotW / Math.max(1, days.length);
  const barW = Math.max(4, Math.min(34, slot - 8));
  const y = (v) => PAD.t + plotH - (v / max) * plotH;

  const showEveryLabel = slot >= 26;
  const showValues = slot >= 24;

  const body = () => {
    if (loading && (!Array.isArray(signups) || signups.length === 0)) {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150, padding: '0 4px' }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <SkeletonLine height={20 + ((i * 37) % 100)} />
            </div>
          ))}
        </div>
      );
    }

    return (
      <>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label={
            `Daily sign-ups from ${days[0]?.day ?? 'unknown'} to ${days[days.length - 1]?.day ?? 'unknown'} (UTC). ` +
            `${total} in total, busiest day ${peak?.day ?? 'none'} with ${peak?.count ?? 0}.`
          }
        >
          <title>Sign-ups per day, last 14 days</title>

          {/* gridlines */}
          {[...new Set([max, Math.round(max / 2)])].map((v) => (
            v > 0 ? (
              <g key={`g${v}`}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={C.border} strokeWidth="1" strokeDasharray="3 4" />
                <text x={PAD.l - 8} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill={C.textFaint} fontFamily={MONO}>{v}</text>
              </g>
            ) : null
          ))}

          {/* baseline */}
          <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke={C.border} strokeWidth="1" />

          {days.map((d, i) => {
            const isToday = d.day === todayKey;
            const x = PAD.l + slot * i + (slot - barW) / 2;
            const top = d.count > 0 ? y(d.count) : y(0) - 2;
            const h = Math.max(2, y(0) - top);
            return (
              <g key={d.day}>
                <rect
                  x={x} y={top} width={barW} height={h} rx="3"
                  fill={d.count === 0 ? C.border : isToday ? C.accentHi : C.accent}
                  opacity={d.count === 0 ? 0.7 : 1}
                >
                  <title>{`${d.day} (UTC): ${d.count} sign-up${d.count === 1 ? '' : 's'}${isToday ? ' — today, still counting' : ''}`}</title>
                </rect>
                {showValues && d.count > 0 && (
                  <text x={x + barW / 2} y={top - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={isToday ? C.accentHi : C.textMuted} fontFamily={MONO}>
                    {d.count}
                  </text>
                )}
                {(showEveryLabel || i % 2 === 0 || i === days.length - 1) && (
                  <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize="9.5" fill={isToday ? C.accentHi : C.textFaint} fontFamily={MONO} fontWeight={isToday ? 700 : 400}>
                    {d.day.slice(8, 10)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, fontSize: 11.5, color: C.textFaint }}>
          <span><strong style={{ color: C.text }}>{num(total)}</strong> over the window</span>
          <span><strong style={{ color: C.text }}>{num(Math.round((total / Math.max(1, days.length)) * 10) / 10)}</strong> per day avg</span>
          {peak && peak.count > 0 && <span>peak <strong style={{ color: C.text }}>{num(peak.count)}</strong> on {peak.day}</span>}
          <span style={{ marginLeft: 'auto' }}>days are UTC · today is partial</span>
        </div>
      </>
    );
  };

  const isEmpty = !loading && total === 0;

  return (
    <Card style={{ padding: '18px 22px 16px' }}>
      <SectionLabel right={<span style={{ fontSize: 10.5, color: C.textFaint, fontWeight: 600 }}>{days.length} days</span>}>
        Sign-ups per day
      </SectionLabel>
      {isEmpty ? (
        <EmptyNote icon="📉" title="No sign-ups in the last 14 days" detail="The chart draws as soon as an account is created." />
      ) : body()}
    </Card>
  );
}
