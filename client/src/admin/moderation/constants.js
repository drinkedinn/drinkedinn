// client/src/admin/moderation/constants.js
//
// Vocabulary shared by the queue, the dialogs and the detail view. Every value
// here is taken from server/routes/moderation.js or server/routes/reports.js —
// if a string does not appear there, it is not sent to the server.

import { C } from './theme';

export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

// The wording is deliberately a LABEL, not a colour. A queue that encodes
// severity only in a hue fails for the colour-blind moderator, the projector in
// the war room, and the printed screenshot in the incident review.
export const PRIORITY_META = {
  P0: {
    key: 'P0',
    label: 'P0 — IMMEDIATE',
    short: 'P0 IMMEDIATE',
    color: C.red,
    desc: 'Immediate safety or legal risk — child safety, credible threats, self-harm.',
    slaHours: 1,
  },
  P1: {
    key: 'P1',
    label: 'P1 — URGENT',
    short: 'P1 URGENT',
    color: C.amber,
    desc: 'Serious harassment, under-age concerns, dangerous behaviour.',
    slaHours: 24,
  },
  P2: {
    key: 'P2',
    label: 'P2 — STANDARD',
    short: 'P2 STANDARD',
    color: C.accentHi,
    desc: 'Spam, impersonation, inappropriate content. The default.',
    slaHours: 72,
  },
  P3: {
    key: 'P3',
    label: 'P3 — LOW',
    short: 'P3 LOW',
    color: C.textMuted,
    desc: 'Minor community-quality issues.',
    slaHours: 168,
  },
};

export const priorityMeta = (p) => PRIORITY_META[p] || {
  key: String(p || '?'),
  label: String(p || 'Unknown'),
  short: String(p || 'Unknown'),
  color: C.textMuted,
  desc: 'Unknown priority — the server returned a value this console does not recognise.',
  slaHours: null,
};

// status values the queue route accepts. It takes any string and matches
// r.status = ?, but these are the three the rest of the system writes:
// reports.js inserts 'pending'; moderation resolve writes 'resolved' or
// 'escalated'.
export const STATUSES = [
  { value: 'pending',   label: 'Pending' },
  { value: 'resolved',  label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
];

export const ASSIGNMENTS = [
  { value: 'all',  label: 'Anyone',      param: null },
  { value: 'mine', label: 'Assigned to me', param: 'me' },
  { value: 'none', label: 'Unassigned',  param: 'none' },
];

// POST /:id/resolve — ALLOWED list, verbatim from routes/moderation.js.
//
// `enforcement` marks the outcomes that assert something was done to a person
// or their content. Those demand a typed reason and a confirmation step, and
// the dialog says out loud that recording one does NOT itself carry it out.
export const RESOLUTIONS = [
  {
    value: 'no_action',
    label: 'No action',
    desc: 'The report does not describe a policy breach. The report is closed.',
    enforcement: false,
  },
  {
    value: 'content_removed',
    label: 'Content removed',
    desc: 'Records that the reported content has been taken down.',
    enforcement: true,
  },
  {
    value: 'user_warned',
    label: 'User warned',
    desc: 'Records that the account has been warned.',
    enforcement: true,
  },
  {
    value: 'user_suspended',
    label: 'User suspended',
    desc: 'Records that the account has been suspended.',
    enforcement: true,
  },
  {
    value: 'user_banned',
    label: 'User banned',
    desc: 'Records that the account has been banned.',
    enforcement: true,
  },
  {
    value: 'escalated',
    label: 'Escalated',
    desc: 'Hands this on rather than closing it. The report moves to the escalated queue.',
    enforcement: true,
  },
];

export const resolutionMeta = (v) => RESOLUTIONS.find((r) => r.value === v) || null;

// target_type values, from routes/reports.js TARGET_TYPES.
export const TARGET_LABELS = {
  post: 'Post',
  user: 'Account',
  comment: 'Comment',
  story: 'Story',
  message: 'Message',
  group: 'Group',
  group_post: 'Group post',
  event: 'Event',
  place: 'Place',
  ai_output: 'AI output',
};

export const targetLabel = (t) => TARGET_LABELS[t] || (t ? String(t) : 'Unknown target');

// ── The severity floor ──────────────────────────────────────────────────────
//
// A MIRROR of FLOOR in server/routes/moderation.js. The server is authoritative
// and always has the last word: every priority change reads `floored` off the
// response and shows what the server actually applied. This copy exists only so
// the UI can warn BEFORE the click, instead of letting a moderator believe they
// triaged a child-safety report down and discovering otherwise by accident.
//
// Keep in step with the server. If the two ever disagree, the response wins.
const FLOOR = [
  { test: /^csae/i,                 priority: 'P0', message: 'Child-safety reports stay at P0.' },
  { test: /self[_-]?harm|suicide/i, priority: 'P0', message: 'Self-harm reports stay at P0.' },
  { test: /threat|violence/i,       priority: 'P1', message: 'Threat and violence reports stay at P1.' },
  { test: /underage|minor/i,        priority: 'P1', message: 'Under-age reports stay at P1.' },
  { test: /harassment|hate/i,       priority: 'P1', message: 'Harassment and hate reports stay at P1.' },
  { test: /unsafe_drinking/i,       priority: 'P1', message: 'Unsafe-drinking reports stay at P1.' },
];

/** The rule this report's reason falls under, or null when it is freely triaged. */
export function floorFor(reason) {
  const text = String(reason || '');
  for (const f of FLOOR) if (f.test.test(text)) return f;
  return null;
}

/**
 * What to tell the admin when the server answers `floored: true`.
 * `applied` is the priority the SERVER returned — never the one we asked for.
 */
export function floorMessage(reason, applied) {
  const f = floorFor(reason);
  const pinned = `This report is pinned at ${applied}.`;
  return f ? `${f.message} ${pinned}` : `The severity floor for this report's reason set it to ${applied}.`;
}

/** Child sexual abuse and exploitation. reports.js writes the reason as `csae: …`. */
export function isCsae(reason) {
  return /^\s*csae/i.test(String(reason || ''));
}
