// src/components/events/dateUtils.js
// Small helpers for parsing and formatting the event.date string.
// The server stores date as TEXT (e.g. '2026-05-10' or '2026-05-10T19:00'), so
// parsing has to be forgiving. Formatters return safe fallbacks on garbage input
// so a screen never crashes on a partial or unexpected value.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse the server's TEXT date. Returns a Date or null. */
export function parseEventDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Bare 'YYYY-MM-DD' — anchor to noon local so DST cannot flip the day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  // 'YYYY-MM-DDTHH:MM' or 'YYYY-MM-DDTHH:MM:SS[.sss][Z|±hh:mm]'.
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** True iff the date string carries a time component. */
export function hasTime(value) {
  if (!value) return false;
  return /T\d{2}:\d{2}/.test(String(value));
}

/** e.g. { top: 'MAY', bottom: '10' } for the calendar chip. */
export function chipParts(value) {
  const d = parseEventDate(value);
  if (!d) return { top: '', bottom: '' };
  return { top: MONTHS_SHORT[d.getMonth()].toUpperCase(), bottom: String(d.getDate()) };
}

/** e.g. 'Sat, May 10 · 7:00 PM'. Omits the time when the date has none. */
export function longDate(value) {
  const d = parseEventDate(value);
  if (!d) return '';
  const day = DAYS_SHORT[d.getDay()];
  const month = MONTHS_SHORT[d.getMonth()];
  const base = `${day}, ${month} ${d.getDate()}`;
  return hasTime(value) ? `${base} · ${formatTime(d)}` : base;
}

/** e.g. 'Saturday, May 10, 2026'. Standalone date, no time. */
export function fullDate(value) {
  const d = parseEventDate(value);
  if (!d) return '';
  return `${DAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** e.g. '7:00 PM'. */
export function formatTime(d) {
  if (!d) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Warm human-scale relative label. Never says quantities. */
export function whenLabel(value) {
  const d = parseEventDate(value);
  if (!d) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDate - startOfToday) / 86400000);
  if (days === 0) return hasTime(value) ? `Tonight · ${formatTime(d)}` : 'Today';
  if (days === 1) return hasTime(value) ? `Tomorrow · ${formatTime(d)}` : 'Tomorrow';
  if (days > 1 && days < 7) return hasTime(value) ? `${DAYS_LONG[d.getDay()]} · ${formatTime(d)}` : DAYS_LONG[d.getDay()];
  return longDate(value);
}

/** Build the string sent to the server: 'YYYY-MM-DDTHH:MM'. */
export function toIsoLocal(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export { MONTHS_SHORT, DAYS_SHORT, DAYS_LONG };
