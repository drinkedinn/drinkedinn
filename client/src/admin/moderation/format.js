// client/src/admin/moderation/format.js
//
// Turning server rows into things a human can scan. Everything here tolerates
// null: a report row can arrive with a missing reporter (deleted account), a
// null assignee, and no preview at all.

import { priorityMeta } from './constants';

/**
 * Parse the two timestamp shapes this table holds.
 *
 * reports.created_at is a SQLite DATETIME default (CURRENT_TIMESTAMP), which
 * lands as 'YYYY-MM-DD HH:MM:SS' in UTC with no zone marker. Handed straight to
 * new Date(), Safari returns Invalid Date and Chrome reads it as LOCAL time —
 * so a report filed 20 minutes ago can show up as five hours old, which is
 * exactly the kind of quiet wrongness that buries a P0. Pin it to UTC.
 *
 * reports.resolved_at is Date.now() — a number of milliseconds.
 */
export function parseTs(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;

  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{10,}$/.test(s)) return new Date(Number(s)); // numeric ms as a string

  // Already carries a zone (…Z or …+05:30) — trust it.
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(s);
  if (m) {
    const time = m[2].length === 5 ? `${m[2]}:00` : m[2];
    const d = new Date(`${m[1]}T${time}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole hours since `value`, or null when the timestamp is unusable. */
export function hoursSince(value) {
  const d = parseTs(value);
  if (!d) return null;
  return (Date.now() - d.getTime()) / 3600000;
}

/** Compact age: 2m, 4h, 3d. '—' when we cannot tell, never a wrong number. */
export function age(value) {
  const d = parseTs(value);
  if (!d) return '—';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 0) return 'just now';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function whenFull(value) {
  const d = parseTs(value);
  return d ? d.toLocaleString() : 'Unknown time';
}

/**
 * Past the target response time for its priority.
 *
 * These thresholds are a CONSOLE CONVENTION, not a server rule — nothing in
 * routes/moderation.js knows about an SLA. Labelled "overdue" in words so it is
 * not carried by colour alone.
 */
export function isOverdue(report) {
  const hrs = hoursSince(report?.created_at);
  const sla = priorityMeta(report?.priority).slaHours;
  if (hrs == null || sla == null) return false;
  return hrs > sla;
}

export function clip(text, max) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

/**
 * Reports are stored as free text. reports.js writes child-safety ones as
 * `csae: <what the reporter typed>`; the in-app report form writes a short
 * slug. Split so the queue can show a stable label and the detail view can show
 * every word the reporter wrote.
 */
export function splitReason(reason) {
  const raw = String(reason ?? '').trim();
  if (!raw) return { head: 'No reason given', detail: '', raw: '' };
  const idx = raw.indexOf(':');
  if (idx > 0 && idx <= 40) {
    return { head: raw.slice(0, idx).trim(), detail: raw.slice(idx + 1).trim(), raw };
  }
  return { head: raw.length <= 40 ? raw : '', detail: raw.length <= 40 ? '' : raw, raw };
}

/** 'unsafe_drinking' → 'Unsafe drinking'. */
export function prettySlug(slug) {
  const s = String(slug ?? '').replace(/[_-]+/g, ' ').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A few reason slugs must not be title-cased into something softer than they
// are. 'csae' → 'Csae' reads like a typo; in the one queue where that slug
// matters most, it has to read as what it is.
const REASON_LABELS = {
  csae: 'CSAE — child safety',
  self_harm: 'Self-harm',
  selfharm: 'Self-harm',
  unsafe_drinking: 'Unsafe drinking',
  ai_output: 'AI output',
};

/** The short label for a reason head, honouring the overrides above. */
export function reasonLabel(head) {
  const key = String(head ?? '').trim().toLowerCase();
  if (!key) return '';
  return REASON_LABELS[key] || prettySlug(head);
}

/**
 * Does this report point at an identifiable thing?
 *
 * routes/reports.js POST /child-safety stores target_id 0 when the reporter is
 * describing behaviour rather than pointing at one item. The queue's
 * reports_on_target then counts every report that shares that placeholder, so
 * five unrelated child-safety accounts can read as "5 reports on this account".
 * Anywhere that number is shown, it has to be qualified rather than trusted.
 */
export function hasTarget(report) {
  const id = report?.target_id;
  if (id == null || id === '') return false;
  const n = Number(id);
  return Number.isFinite(n) && n > 0;
}

/** A person, without pretending to know a name we were not given. */
export function personLabel(name, id) {
  const n = String(name ?? '').trim();
  if (n) return n;
  if (id != null && id !== '') return `User #${id}`;
  return 'Unknown';
}

/**
 * What this console is willing to show about the reported thing.
 *
 * The queue route only ever selects a preview for posts (post_content) and a
 * name for accounts (target_user_name). Message content is not selected and
 * must never be rendered here — an operations console that displays private
 * messages is a surveillance tool. Everything else says plainly that there is
 * no preview rather than implying emptiness.
 */
export function targetPreview(report) {
  const type = report?.target_type;
  if (!hasTarget(report)) {
    return {
      text: 'No specific item — the reporter described what they saw rather than pointing at one post or account. Read the report itself.',
      muted: true,
      unidentified: true,
    };
  }
  if (type === 'post') {
    const content = report?.post_content;
    if (content == null || String(content).trim() === '') {
      return { text: 'Post not found — it may already have been deleted.', muted: true };
    }
    return { text: String(content), muted: false, quoted: true };
  }
  if (type === 'user') {
    const name = String(report?.target_user_name ?? '').trim();
    if (!name) return { text: 'Account not found — it may already have been deleted.', muted: true };
    return { text: name, muted: false };
  }
  if (type === 'message') {
    return { text: 'Message content is never shown in this console.', muted: true };
  }
  return { text: 'No preview for this target type.', muted: true };
}
