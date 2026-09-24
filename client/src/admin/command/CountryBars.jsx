// client/src/admin/command/CountryBars.jsx
// Ranked country list. Aggregate only — a count per country code, which is
// exactly what the server returns. There is deliberately no drill-down: a
// per-country user list would turn a health dashboard into a location tracker.

import { C, MONO, num } from './theme';
import { Card, SectionLabel, EmptyNote, SkeletonLine } from './ui';

/** "IN" → 🇮🇳. Returns null for anything that is not two ASCII letters. */
function flagFor(code) {
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  } catch {
    return null;
  }
}

export function normaliseCountries(countries) {
  const rows = Array.isArray(countries) ? countries : [];
  return rows
    .map((r) => ({
      code: String(r?.country ?? '').trim().toUpperCase(),
      count: Number.isFinite(Number(r?.c)) ? Number(r.c) : 0,
    }))
    .filter((r) => r.code.length > 0)
    .sort((a, b) => b.count - a.count);
}

export default function CountryBars({ countries, loading }) {
  const rows = normaliseCountries(countries);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const ranked = rows.reduce((a, r) => a + r.count, 0);

  return (
    <Card style={{ padding: '18px 22px 16px' }}>
      <SectionLabel right={rows.length > 0
        ? <span style={{ fontSize: 10.5, color: C.textFaint, fontWeight: 600 }}>top {rows.length}</span>
        : null}>
        Where people are
      </SectionLabel>

      {loading && rows.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonLine key={i} height={18} />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyNote icon="🌍" title="No country data" detail="Accounts have no country code recorded yet." />
      ) : (
        <>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {rows.map((r, i) => {
              const pct = ranked > 0 ? (r.count / ranked) * 100 : 0;
              return (
                <li key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 18, fontSize: 10.5, fontWeight: 800, color: C.textFaint, fontFamily: MONO, flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span aria-hidden="true" style={{ fontSize: 14, width: 20, flexShrink: 0 }}>{flagFor(r.code) || '·'}</span>
                  <span style={{ width: 30, fontSize: 12, fontWeight: 700, color: C.text, fontFamily: MONO, flexShrink: 0, letterSpacing: 0.5 }}>
                    {r.code}
                  </span>
                  <span style={{ flex: 1, minWidth: 40, height: 8, borderRadius: 4, background: C.bg, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block', height: '100%',
                        width: `${Math.max(2, (r.count / max) * 100)}%`,
                        background: i === 0 ? C.accentHi : C.accent,
                        borderRadius: 4,
                      }}
                    />
                  </span>
                  <span style={{ width: 54, textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {num(r.count)}
                  </span>
                  <span style={{ width: 42, textAlign: 'right', fontSize: 10.5, color: C.textFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {pct >= 0.1 ? `${pct.toFixed(1)}%` : '<0.1%'}
                  </span>
                </li>
              );
            })}
          </ol>
          <div style={{ marginTop: 12, fontSize: 11, color: C.textFaint, lineHeight: 1.6 }}>
            Percentages are shares of the {num(ranked)} accounts in this ranked list, not of every account —
            accounts with no country recorded are not counted, and the list stops at the top 12.
          </div>
        </>
      )}
    </Card>
  );
}
