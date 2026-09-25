// src/components/memories/memoryLib.js
// Pure helpers shared by the Memories rail, the Memories list and the viewer.
// No React, no side effects — everything here is safe to call with garbage.
//
// Server contract: server/routes/memories.js
//   GET /memories             -> [{ key, title, subtitle, year, month, location,
//                                   story_count, people_count, place_count,
//                                   cover_post_id, cover_image_url, post_ids }]
//   GET /memories/:key/posts  -> [{ id, content, image_url, created_at, user_id,
//                                   place_name, place_city, cheers, comments }]
//
// The card key is built server-side as `${YYYY-MM}|${city-or-country}` — it
// contains a pipe and may contain spaces, so it MUST be percent-encoded before
// it goes into a URL path. Express decodes it back on the other side.

export const MEMORY_ICON = 'time-outline';

// Warm "bar light through glass" pairs used when a memory has no cover photo.
// Deliberately dark so white text sits on them at full contrast in both themes.
const GRADIENTS = [
  ['#3B1F0E', '#8E4A1E'],
  ['#2A1B34', '#7B4E86'],
  ['#3A1A2A', '#A8526A'],
  ['#1E2B29', '#4A6D62'],
  ['#231A12', '#8A6230'],
  ['#1F2436', '#4F6796'],
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function hash(value) {
  const s = String(value ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

/** Deterministic gradient for a memory, so a card never changes colour on re-render. */
export function gradientFor(seed) {
  return GRADIENTS[Math.abs(hash(seed)) % GRADIENTS.length];
}

/** SQLite hands back "YYYY-MM-DD HH:MM:SS" (UTC); ISO also passes through. */
export function parseDate(ts) {
  if (!ts) return null;
  const raw = String(ts);
  const d = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 May 2024" — empty string when the timestamp is missing or unparseable. */
export function longDate(ts) {
  const d = parseDate(ts);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "MAY 2024" for the card overline. Falls back to '' rather than "NaN". */
export function periodLabel(card) {
  const year = Number(card?.year);
  const month = Number(card?.month);
  if (!Number.isFinite(year) || year <= 0) return '';
  const name = MONTHS[month - 1];
  return name ? `${name} ${year}` : String(year);
}

/**
 * "4 stories · 3 people". Built from the counts rather than echoing the
 * server's pre-joined subtitle so the copy stays under our control — but we
 * fall back to the server string if the counts ever go missing.
 */
export function countsLine(card) {
  const stories = Number(card?.story_count);
  const people = Number(card?.people_count);
  const places = Number(card?.place_count);
  const parts = [];

  if (Number.isFinite(stories) && stories > 0) {
    parts.push(`${stories} ${stories === 1 ? 'story' : 'stories'}`);
  }
  if (Number.isFinite(people) && people > 0) {
    parts.push(`${people} ${people === 1 ? 'person' : 'people'}`);
  } else if (Number.isFinite(places) && places > 0) {
    parts.push(`${places} ${places === 1 ? 'place' : 'places'}`);
  }

  if (parts.length) return parts.join(' · ');
  return typeof card?.subtitle === 'string' ? card.subtitle : '';
}

/** Title with a sane fallback — never render "undefined" on a card. */
export function titleFor(card) {
  const raw = typeof card?.title === 'string' ? card.title.trim() : '';
  if (raw) return raw;
  const period = periodLabel(card);
  return period ? `Looking back to ${period}` : 'A night worth remembering';
}

/** Path for the story-viewer fetch. The key carries a '|' so it must be encoded. */
export function memoryPostsPath(key) {
  return `/memories/${encodeURIComponent(String(key ?? ''))}/posts`;
}

/** Drop anything the server didn't give us a usable key for. */
export function normalizeCards(data) {
  if (!Array.isArray(data)) return [];
  return data.filter((c) => c && (typeof c.key === 'string' || typeof c.key === 'number'));
}

/** Drop rows without an id — they can't be keyed, opened or reported. */
export function normalizePosts(data) {
  if (!Array.isArray(data)) return [];
  return data.filter((p) => p && p.id != null);
}

/** "Lisbon" / "The Gin Bar, Lisbon" — whatever the row actually has. */
export function placeLine(post) {
  const name = typeof post?.place_name === 'string' ? post.place_name.trim() : '';
  const city = typeof post?.place_city === 'string' ? post.place_city.trim() : '';
  if (name && city && name !== city) return `${name}, ${city}`;
  return name || city || '';
}

/**
 * navigate() throws if a route isn't registered yet. The rail is decorative and
 * lives on Home — it must never take the feed down with it.
 */
export function safeNavigate(navigation, name, params) {
  try {
    navigation?.navigate?.(name, params);
    return true;
  } catch {
    return false;
  }
}
