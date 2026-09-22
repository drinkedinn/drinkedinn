// src/screens/messages/timeAgo.js
// Short and long relative-time helpers used across the messages module.
// SQLite returns UTC datetimes as "YYYY-MM-DD HH:MM:SS"; we normalise that
// to an ISO string with a "Z" so Date() interprets it as UTC on both platforms.

function toDate(ts) {
  if (!ts && ts !== 0) return null;
  if (typeof ts === 'number') return new Date(ts);
  const raw = String(ts);
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Compact ("5m", "3h", "Mon", "Mar 12") — for conversation-list timestamps. */
export function timeAgoShort(ts) {
  const d = toDate(ts);
  if (!d) return '';
  const now = new Date();
  const s = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (s < 0) return 'now';
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 6) return d.toLocaleDateString(undefined, { weekday: 'short' });
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Today", "Yesterday", "Monday", or "March 12, 2024" — for day dividers. */
export function dayLabel(ts) {
  const d = toDate(ts);
  if (!d) return '';
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "3:14 PM" — for inline bubble timestamps. */
export function clockTime(ts) {
  const d = toDate(ts);
  if (!d) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** True when two timestamps fall on different calendar days. */
export function isNewDay(prevTs, nextTs) {
  const a = toDate(prevTs);
  const b = toDate(nextTs);
  if (!a || !b) return !!b;
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

/** True when the gap between two messages warrants an inline timestamp (>5m). */
export function isBigGap(prevTs, nextTs, minutes = 5) {
  const a = toDate(prevTs);
  const b = toDate(nextTs);
  if (!a || !b) return true;
  return Math.abs(b.getTime() - a.getTime()) > minutes * 60 * 1000;
}
