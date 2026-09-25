// server/lib/streaks.js
// "Engagement streak" = consecutive days the user participated in the COMMUNITY
// (posted, cheered, commented, rated, shared a story). It is deliberately NOT a
// "days you drank" counter — see responsible.js. No punishing copy, no loss
// aversion traps; it's a gentle reason to come back, capped in tone.

const db = require('../db');
const { ALLOWED_STREAK_ACTIONS, isVolumeBasedReward, localDateStr } = require('./responsible');

function yesterdayStr(tzOffsetMinutes = 0) {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // reuse the tz-aware date formatter against a shifted clock
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000;
  const local = new Date(utcMs + tzOffsetMinutes * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Call when a user performs a community action.
 * @returns {Promise<{current:number, longest:number, advanced:boolean}>}
 */
async function touchStreak(userId, action) {
  if (isVolumeBasedReward(action)) {
    throw new Error(`[streaks] refusing volume-based reward action: ${action}`);
  }
  if (!ALLOWED_STREAK_ACTIONS.has(action)) {
    // Unknown action — record activity but don't error.
    return { current: 0, longest: 0, advanced: false };
  }

  const user = await db.get(
    `SELECT current_streak, longest_streak, streak_date, tz_offset_minutes FROM users WHERE id = ?`,
    [userId]
  );
  if (!user) return { current: 0, longest: 0, advanced: false };

  const today = localDateStr(user.tz_offset_minutes);
  if (user.streak_date === today) {
    return { current: user.current_streak, longest: user.longest_streak, advanced: false }; // already counted today
  }

  const yday = yesterdayStr(user.tz_offset_minutes);
  const current = user.streak_date === yday ? (user.current_streak || 0) + 1 : 1; // continue or reset
  const longest = Math.max(current, user.longest_streak || 0);

  await db.run(
    'UPDATE users SET current_streak = ?, longest_streak = ?, streak_date = ?, last_active_date = ? WHERE id = ?',
    [current, longest, today, today, userId]
  );
  return { current, longest, advanced: true };
}

module.exports = { touchStreak };
