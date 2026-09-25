// server/lib/responsible.js
// The guardrails that keep "engaging" from becoming "manipulative" — and that
// keep an ALCOHOL platform from nudging compulsive drinking. These are enforced
// in code, not just policy.

const MAX_PUSH_PER_DAY = 4;          // hard cap on push (in-app feed is uncapped)
const QUIET_START_HOUR = 22;          // 10pm local — no push
const QUIET_END_HOUR = 8;             // 8am local

// Local hour for a user given their stored tz offset (minutes from UTC).
function localHour(tzOffsetMinutes = 0, now = new Date()) {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const local = new Date(utcMs + tzOffsetMinutes * 60_000);
  return local.getHours();
}

function localDateStr(tzOffsetMinutes = 0, now = new Date()) {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const local = new Date(utcMs + tzOffsetMinutes * 60_000);
  return local.toISOString().slice(0, 10);
}

function inQuietHours(tzOffsetMinutes = 0) {
  const h = localHour(tzOffsetMinutes);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

// Decide whether a PUSH (not in-app) may be sent right now for this user.
// Returns { allowed, reason }.
function canPush(user) {
  if (inQuietHours(user.tz_offset_minutes)) return { allowed: false, reason: 'quiet_hours' };
  const today = localDateStr(user.tz_offset_minutes);
  const countToday = user.push_count_date === today ? user.push_count : 0;
  if (countToday >= MAX_PUSH_PER_DAY) return { allowed: false, reason: 'daily_cap' };
  return { allowed: true, reason: null };
}

// HARD RULE: streaks/challenges/leaderboards must never reward drink VOLUME.
// Allowed engagement actions are about community + appreciation, never "drank more".
const ALLOWED_STREAK_ACTIONS = new Set(['post', 'cheer', 'comment', 'rating', 'story']);
function isVolumeBasedReward(action) {
  // Anything resembling "drinks_logged", "units", "shots", "quantity" is banned.
  return /volume|units|shots|quantity|drinks_logged|ml_consumed/i.test(String(action));
}

// Occasionally attach a responsible-drinking nudge (not on every notification —
// that would be noise). Returns a string or null.
function maybeResponsibleNudge() {
  // ~1 in 12 surfaces a gentle reminder; tune as you like.
  if (Math.random() < 1 / 12) {
    return 'Enjoy responsibly. Know your limits. 🥃';
  }
  return null;
}

module.exports = {
  MAX_PUSH_PER_DAY,
  localDateStr,
  inQuietHours,
  canPush,
  ALLOWED_STREAK_ACTIONS,
  isVolumeBasedReward,
  maybeResponsibleNudge,
};
