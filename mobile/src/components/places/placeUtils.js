// src/components/places/placeUtils.js
// Pure formatting helpers for the Places pillar. No React, no network — so the
// rows stay dumb and every edge case (null dates, missing coordinates, junk
// country codes) is handled in exactly one place.

import { Platform, Linking } from 'react-native';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// SQLite hands back "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker. Treating
// that as local time shifts every timestamp by the device offset, so normalise
// before parsing — the rest of the app does the same.
export function parseDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
  const raw = String(ts).trim();
  if (!raw) return null;
  const d = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Compact age, matching PostCard: now / 5m / 3h / 2d / 4w. */
export function timeAgo(ts) {
  const d = parseDate(ts);
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 0) return 'now';
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

/** Roomier phrasing for the Trips rows: "3 days ago", "2 months ago". */
export function relativeLabel(ts) {
  const d = parseDate(ts);
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 0 || s < 90) return 'just now';
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** Absolute, short: "12 Mar 2025". Falls back if Intl is unavailable. */
export function shortDate(ts) {
  const d = parseDate(ts);
  if (!d) return '';
  try {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
}

/** "800 m", "2.4 km", "37 km". Returns null when there is nothing to show. */
export function distanceLabel(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 0.05) return 'Right here';
  if (n < 1) {
    const metres = Math.max(50, Math.round((n * 1000) / 50) * 50);
    return `${metres} m`;
  }
  if (n < 10) return `${n.toFixed(1)} km`;
  return `${Math.round(n)} km`;
}

const COUNTRY_NAMES = {
  AE: 'United Arab Emirates', AR: 'Argentina', AT: 'Austria', AU: 'Australia',
  BE: 'Belgium', BG: 'Bulgaria', BR: 'Brazil', CA: 'Canada', CH: 'Switzerland',
  CL: 'Chile', CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CZ: 'Czechia',
  DE: 'Germany', DK: 'Denmark', EE: 'Estonia', EG: 'Egypt', ES: 'Spain',
  FI: 'Finland', FR: 'France', GB: 'United Kingdom', GR: 'Greece',
  HK: 'Hong Kong', HR: 'Croatia', HU: 'Hungary', ID: 'Indonesia', IE: 'Ireland',
  IL: 'Israel', IN: 'India', IS: 'Iceland', IT: 'Italy', JP: 'Japan',
  KE: 'Kenya', KR: 'South Korea', LT: 'Lithuania', LU: 'Luxembourg',
  LV: 'Latvia', MA: 'Morocco', MX: 'Mexico', MY: 'Malaysia', NG: 'Nigeria',
  NL: 'Netherlands', NO: 'Norway', NZ: 'New Zealand', PE: 'Peru',
  PH: 'Philippines', PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania',
  RS: 'Serbia', SA: 'Saudi Arabia', SE: 'Sweden', SG: 'Singapore',
  SI: 'Slovenia', SK: 'Slovakia', TH: 'Thailand', TR: 'Türkiye', TW: 'Taiwan',
  UA: 'Ukraine', US: 'United States', UY: 'Uruguay', VN: 'Vietnam', ZA: 'South Africa',
};

export function normaliseCountry(code) {
  const c = String(code || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : '';
}

export function countryName(code) {
  const c = normaliseCountry(code);
  if (!c) return '';
  return COUNTRY_NAMES[c] || c;
}

/**
 * Regional-indicator flag for a 2-letter code. Android's system font has no
 * flag glyphs, so it renders the two letters instead — which is exactly the
 * fallback we want. Returns null for anything that isn't a valid code.
 */
export function countryFlag(code) {
  const c = normaliseCountry(code);
  if (!c) return null;
  try {
    return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  } catch {
    return null;
  }
}

/** "Wine bar · Lisbon, PT" — whatever of that actually exists. */
export function placeSubtitle(place) {
  if (!place) return '';
  const country = normaliseCountry(place.country);
  const where = [place.city, country].filter(Boolean).join(', ');
  return [place.category, where].filter((s) => !!String(s || '').trim()).join(' · ');
}

const CATEGORY_ICONS = [
  [/coffee|caf[eé]|espresso|roast/i, 'cafe-outline'],
  [/wine|vineyard|winery|cellar|enoteca/i, 'wine-outline'],
  [/brew|beer|tap ?room|pub|bar|lounge|cantina|izakaya/i, 'beer-outline'],
  [/club|music|live|venue|dance/i, 'musical-notes-outline'],
  [/restaurant|kitchen|bistro|trattoria|diner|eatery|food/i, 'restaurant-outline'],
  [/hotel|inn|resort|lodge|hostel/i, 'bed-outline'],
  [/beach|island|coast/i, 'sunny-outline'],
  [/park|garden|trail|mountain/i, 'leaf-outline'],
  [/museum|gallery|theat/i, 'color-palette-outline'],
  [/market|shop|store|bottle/i, 'storefront-outline'],
];

/** A venue-appropriate Ionicon, never an emoji. */
export function categoryIcon(category) {
  const c = String(category || '');
  for (const [re, icon] of CATEGORY_ICONS) if (re.test(c)) return icon;
  return 'location-outline';
}

/** First letter of the name, for the gradient cover monogram. */
export function monogram(name) {
  const n = String(name || '').trim();
  if (!n) return '?';
  const ch = [...n][0];
  return (ch || '?').toUpperCase();
}

export function hasCoords(place) {
  return (
    !!place &&
    Number.isFinite(Number(place.lat)) &&
    Number.isFinite(Number(place.lng)) &&
    !(Number(place.lat) === 0 && Number(place.lng) === 0)
  );
}

/**
 * Open the platform maps app at a place. Apple Maps on iOS, the geo: intent on
 * Android, google.com/maps as the universal fallback if neither resolves.
 * Returns true when something opened.
 */
export async function openDirections(place) {
  if (!hasCoords(place)) return false;
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  const label = encodeURIComponent(String(place.name || 'Place').slice(0, 80));
  const web = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  // iOS gets the https maps.apple.com form rather than `maps:` — a custom
  // scheme needs an LSApplicationQueriesSchemes entry to be probed at all,
  // while the https URL is handed to Maps by the system with no manifest work.
  const native = Platform.select({
    ios: `https://maps.apple.com/?daddr=${lat},${lng}&q=${label}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    default: web,
  });

  // openURL directly rather than canOpenURL first: on Android 11+ canOpenURL
  // answers false for any scheme missing from <queries>, which would send every
  // device with a maps app to the browser instead.
  try {
    await Linking.openURL(native);
    return true;
  } catch {
    /* no handler for the native scheme — fall through to the web map */
  }
  try {
    await Linking.openURL(web);
    return true;
  } catch {
    return false;
  }
}

/** Plural helper used across the rows so the copy stays consistent. */
export function plural(n, one, many) {
  const c = Number(n) || 0;
  return `${c} ${c === 1 ? one : many}`;
}
