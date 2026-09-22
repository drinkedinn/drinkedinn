// src/screens/explore/exploreLib.js
// Pure helpers behind the editorial Explore screen. No React, no network — so
// the sorting and date rules can be reasoned about (and later tested) on their
// own.
//
// Two things worth knowing about the data this operates on:
//   - posts.created_at comes back from SQLite as "YYYY-MM-DD HH:MM:SS" in UTC
//     (no zone marker). Feeding that straight to new Date() is parsed as LOCAL
//     time on Android, which shifts every timestamp by the viewer's offset and
//     quietly moves Friday-night moments into Thursday. Every parse goes
//     through parseDate() below, which normalises it the same way PostCard and
//     PostDetailScreen already do.
//   - posts.place_id exists but is nullable, and posts.location is free text.
//     A "city" scope therefore has to match on either.

const DAY_MS = 86_400_000;

/** How far back "Weekend stories" looks. */
export const WEEKEND_WINDOW_DAYS = 30;

/** Fri / Sat / Sun as Date#getDay() returns them, in the viewer's own zone. */
const WEEKEND_DAYS = new Set([5, 6, 0]);

/** Parse a server timestamp. Returns null for anything unusable. */
export function parseDate(ts) {
  if (!ts) return null;
  const raw = String(ts);
  const d = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const cheerCount = (post) => Number(post?.cheer_count) || 0;

export const createdMs = (post) => {
  const d = parseDate(post?.created_at);
  return d ? d.getTime() : 0;
};

/** Most-cheered first, newest breaking the tie. */
export function byCheersThenRecent(a, b) {
  const diff = cheerCount(b) - cheerCount(a);
  return diff !== 0 ? diff : createdMs(b) - createdMs(a);
}

/** Most stories first, then most visited. Used for place rails. */
export function byStoryCount(a, b) {
  const diff = (Number(b?.story_count) || 0) - (Number(a?.story_count) || 0);
  return diff !== 0 ? diff : (Number(b?.visit_count) || 0) - (Number(a?.visit_count) || 0);
}

/** A moment shared on a Friday, Saturday or Sunday in the last 30 days. */
export function isWeekendMoment(post, now = Date.now()) {
  const d = parseDate(post?.created_at);
  if (!d) return false;
  const age = now - d.getTime();
  // Negative age = a clock-skewed future timestamp. Keep it: it's "this
  // weekend" by any reading, and dropping it would hide a just-posted moment.
  if (age > WEEKEND_WINDOW_DAYS * DAY_MS) return false;
  return WEEKEND_DAYS.has(d.getDay());
}

// ── Place scope ─────────────────────────────────────────────────────────────

const COUNTRY_FALLBACK = {
  AR: 'Argentina', AT: 'Austria', AU: 'Australia', BE: 'Belgium', BR: 'Brazil',
  CA: 'Canada', CH: 'Switzerland', CL: 'Chile', CN: 'China', CZ: 'Czechia',
  DE: 'Germany', DK: 'Denmark', ES: 'Spain', FI: 'Finland', FR: 'France',
  GB: 'the UK', GR: 'Greece', HK: 'Hong Kong', IE: 'Ireland', IL: 'Israel',
  IN: 'India', IT: 'Italy', JP: 'Japan', KR: 'Korea', MX: 'Mexico',
  NL: 'the Netherlands', NO: 'Norway', NZ: 'New Zealand', PL: 'Poland',
  PT: 'Portugal', SE: 'Sweden', SG: 'Singapore', TH: 'Thailand', TR: 'Türkiye',
  US: 'the States', ZA: 'South Africa',
};

/**
 * A human name for an ISO-3166-1 alpha-2 code. Falls back through a small
 * table and finally the code itself, so the section title is never blank.
 */
export function countryLabel(code) {
  const cc = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  if (COUNTRY_FALLBACK[cc]) return COUNTRY_FALLBACK[cc];
  try {
    // Available on Hermes with Intl; guarded because it is not guaranteed.
    const display = new Intl.DisplayNames(undefined, { type: 'region' });
    const name = display.of(cc);
    if (name && name !== cc) return name;
  } catch {}
  return cc;
}

/**
 * Build the "Popular in …" scope.
 * @param {string} label    what the section is titled after ("Lisbon").
 * @param {Array}  places   rows from /places?city= or /places?country=.
 */
export function makeScope(label, places) {
  const clean = String(label || '').trim();
  if (!clean) return null;
  const placeIds = new Set(
    (Array.isArray(places) ? places : [])
      .map((p) => toId(p?.id))
      .filter((id) => id !== null)
  );
  return { label: clean, needle: clean.toLowerCase(), placeIds };
}

// Number(null) and Number('') are both 0, which is a perfectly finite number
// and a perfectly wrong id. Ids are positive, so anything else is discarded.
function toId(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Does this post belong to the scope? Matches by place first, then location text. */
export function postInScope(post, scope) {
  if (!post || !scope) return false;
  const pid = toId(post.place_id);
  if (pid !== null && scope.placeIds.has(pid)) return true;
  if (!scope.needle) return false;
  return String(post.location || '').toLowerCase().includes(scope.needle);
}

// ── Nearby anchor ───────────────────────────────────────────────────────────

// posts.lat / posts.lng default to NULL, and Number(null) is 0 — so a plain
// Number.isFinite check would read every coordinate-less post as a location on
// Null Island and point "around you" at the Gulf of Guinea.
const isCoord = (v) =>
  v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

/** A { lat, lng } pair, or null. */
export function toAnchor(row) {
  if (!row || !isCoord(row.lat) || !isCoord(row.lng)) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Where "around you" is anchored.
 *
 * The app has no location package in its dependency list, so there is no OS
 * permission to ask for and no coordinate to read. Rather than call
 * /places/nearby without lat/lng (a guaranteed 400) or drop the section, we
 * anchor on the most recent coordinate the viewer themselves attached to a
 * moment, then on the last place they checked into. If neither exists we have
 * no honest idea where "you" is, and the section hides.
 *
 * When a location package is added, replace this with the real fix and the
 * rest of the section keeps working unchanged.
 */
export function findAnchor({ posts = [], visitedPlaces = [], viewerId } = {}) {
  const mine = (Array.isArray(posts) ? posts : [])
    .filter((p) => p && viewerId != null && p.user_id === viewerId)
    .sort((a, b) => createdMs(b) - createdMs(a));

  for (const post of mine) {
    const anchor = toAnchor(post);
    if (anchor) return anchor;
  }
  for (const place of Array.isArray(visitedPlaces) ? visitedPlaces : []) {
    const anchor = toAnchor(place);
    if (anchor) return anchor;
  }
  return null;
}

// ── Navigation ──────────────────────────────────────────────────────────────

/**
 * Pick the first route name that is actually registered somewhere in the
 * navigator tree above this screen.
 *
 * Explore links out to screens owned by other modules (Places, Groups). If one
 * of them has not been registered yet, navigate() logs "was not handled by any
 * navigator" and the tap silently does nothing. Resolving the name first lets
 * the caller fall back to a route that does exist, or skip the tap entirely.
 *
 * @returns {string|null} the first available candidate, or null.
 */
export function resolveRouteName(navigation, candidates = []) {
  const list = candidates.filter(Boolean);
  if (!list.length) return null;

  const known = new Set();
  let nav = navigation;
  for (let depth = 0; nav && depth < 8; depth += 1) {
    try {
      const names = nav.getState?.()?.routeNames;
      if (Array.isArray(names)) names.forEach((n) => known.add(n));
    } catch {}
    nav = nav.getParent?.();
  }

  // If we could not read the tree at all, don't guess — let the caller no-op.
  if (!known.size) return null;
  return list.find((name) => known.has(name)) || null;
}
