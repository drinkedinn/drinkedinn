// client/src/admin/command/FreshnessMeter.jsx
// "updated Ns ago" + pause + refresh.
//
// It owns its own one-second tick so that the clock re-renders this little
// strip and nothing else. Putting the tick in the dashboard would re-render
// every tile, every second, all day, on a screen that is left open.

import { useEffect, useState } from 'react';
import { C, agoLabel } from './theme';

export default function FreshnessMeter({
  lastUpdated,
  paused,
  busy,
  onTogglePause,
  onRefresh,
  intervalMs = 30000,
  stale = false,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = lastUpdated ? (now - lastUpdated) / 1000 : null;
  const everySec = Math.round(intervalMs / 1000);
  // Amber once the data is older than twice the refresh interval — that means
  // refreshes are failing or paused, and a stale number on a wall monitor is
  // worse than no number.
  const isStale = stale || (seconds != null && !paused && seconds > (intervalMs / 1000) * 2);

  const dotColor = busy ? C.accentHi : paused ? C.amber : isStale ? C.red : C.green;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          aria-hidden="true"
          className={busy || (!paused && !isStale) ? 'di-cmd-pulse' : undefined}
          style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }}
        />
        <span style={{ fontSize: 12, color: isStale ? C.red : C.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          {lastUpdated == null
            ? (busy ? 'loading…' : 'not loaded yet')
            : `updated ${agoLabel(seconds)}`}
        </span>
      </div>

      <span style={{ fontSize: 11, color: C.textFaint }}>
        {paused ? 'auto-refresh paused' : `every ${everySec}s`}
      </span>

      <button
        type="button"
        className="di-cmd-focus"
        onClick={onTogglePause}
        aria-pressed={paused}
        aria-label={paused ? `Resume auto-refresh every ${everySec} seconds` : 'Pause auto-refresh'}
        style={{
          background: paused ? C.amber + '22' : C.card,
          border: `1px solid ${paused ? C.amber + '44' : C.border}`,
          borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, color: paused ? C.amber : C.textMuted, fontFamily: 'inherit',
        }}
      >
        {paused ? '▶ Resume' : '⏸ Pause'}
      </button>

      <button
        type="button"
        className="di-cmd-focus"
        onClick={onRefresh}
        disabled={busy}
        aria-label="Refresh now"
        style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '5px 12px', cursor: busy ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 600, color: busy ? C.textFaint : C.textMuted,
          opacity: busy ? 0.6 : 1, fontFamily: 'inherit',
        }}
      >
        ↻ Refresh
      </button>
    </div>
  );
}
