// src/components/safety/reportCatalog.js
// The shared vocabulary and constants behind the Safety Center.
//
// Server contract (server/routes/reports.js):
//   POST /reports              { target_type, target_id, reason }  — all required
//   POST /reports/child-safety { details, target_type?, target_id? }
// A reason whose text starts with "csae" is raised to P0 and is never
// deduplicated, so the one child-safety key below is deliberately prefixed.

import { ORIGIN } from '../../api';

/** target_type values the server accepts. Anything else is a 400. */
export const TARGET_TYPES = [
  'post', 'user', 'comment', 'story', 'message',
  'group', 'group_post', 'event', 'place', 'ai_output',
];

// Reasons for member content and member profiles already live beside the
// surfaces that file them — src/hooks/usePostActions.js and
// src/screens/explore/useExploreUserActions.js. A third copy here would only
// drift out of step, so this file carries the vocabulary those two lack.

/**
 * Something the Innkeeper (our AI) said. Play's generative-AI policy requires
 * an in-app way to flag generated output, including the child-safety case —
 * which is why the last key carries the server's csae prefix.
 */
export const AI_REASONS = [
  { key: 'unsafe_advice', label: 'Unsafe or harmful advice' },
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'inaccurate', label: 'Wrong or misleading' },
  { key: 'harassment', label: 'Hateful or demeaning' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'csae_ai', label: 'Sexualises or endangers a child' },
  { key: 'other', label: 'Something else' },
];

/** True for any reason the server will treat as a P0 child-safety report. */
export const isChildSafetyReason = (key) => String(key || '').toLowerCase().startsWith('csae');

export const SAFETY_EMAIL = 'childsafety@drinkedinn.com';

/** Shown when a link or the mail app refuses to open — never leave a dead end. */
export const SAFETY_EMAIL_HINT = `Could not open that. Write to ${SAFETY_EMAIL}.`;

export const SAFETY_URLS = {
  guidelines: `${ORIGIN}/guidelines`,
  childSafety: `${ORIGIN}/child-safety`,
};

/**
 * Where to go when the danger is not ours to handle. Shown after a child-safety
 * report so nobody is left thinking an in-app form is the end of the road.
 */
export const CHILD_SAFETY_RESOURCES = [
  {
    key: 'cybertip',
    label: 'NCMEC CyberTipline',
    note: 'United States · report.cybertip.org',
    url: 'https://report.cybertip.org',
  },
  {
    key: 'iwf',
    label: 'Internet Watch Foundation',
    note: 'United Kingdom · report.iwf.org.uk',
    url: 'https://report.iwf.org.uk',
  },
];

/**
 * A stable, positive integer id for something that has no row on the server —
 * an Innkeeper reply, for instance. The reports table declares
 * `target_id INTEGER NOT NULL`, so a string id would land in an integer column;
 * hashing keeps the column honest and makes a second report of the same reply
 * collapse onto the first instead of filling the queue with duplicates.
 */
export function stableTargetId(seed) {
  const s = String(seed == null ? '' : seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const id = (h >>> 0) % 2147483647;
  return id === 0 ? 1 : id;
}

/** Collapse whitespace and clip, so a quoted excerpt survives the 500-char column. */
export function excerpt(text, max = 380) {
  const clean = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
