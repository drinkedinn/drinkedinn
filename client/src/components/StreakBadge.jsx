// client/src/components/StreakBadge.jsx
// Shows the user's community engagement streak. Intentionally gentle: it
// celebrates participation, never threatens loss ("Don't break your streak!" is
// exactly the manipulative framing we're avoiding). No countdown timers.

export default function StreakBadge({ current = 0, longest = 0 }) {
  if (current < 2) return null; // don't nag people about a 0/1-day "streak"
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999, background: '#fff4e5', color: '#9a5b00', fontSize: 13,
    }} title={`Longest: ${longest} days`}>
      🔥 {current}-day streak
    </div>
  );
}
