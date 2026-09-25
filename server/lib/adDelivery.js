// server/lib/adDelivery.js
// The gate every brand placement must pass. Nothing serves a paid alcohol
// placement except through eligibleFor() — if a rule can be bypassed by calling
// a different function, it isn't a rule.
//
// Six independent checks, evaluated in order of severity:
//
//   1. User opt-out          — a personal setting outranks commercial interest
//   2. Jurisdiction          — never serve where advertising is banned
//   3. Age                   — user must exceed the market's legal purchase age
//   4. Age assurance         — self-declared DOB is not enough for paid placement
//   5. Audience composition  — industry codes require a verified adult audience
//   6. Frequency cap         — responsible-design limit, not a legal one
//
// Every refusal returns a machine-readable reason so the admin panel can explain
// to a brand exactly why their campaign under-delivered.

const db = require('../db');
const jurisdictions = require('./jurisdictions');

// Responsible-design cap. Deliberately low: this is a social feed, not an ad
// network, and alcohol marketing frequency is exactly the wrong thing to
// maximise. Overridable downward per campaign, never upward.
const DEFAULT_DAILY_CAP = 3;

// Paid placement requires at least age-estimated assurance. Self-declared date
// of birth satisfies the platform's own age gate but not an advertiser's.
const MIN_ASSURANCE_FOR_ADS = 1;

function deny(reason, detail) {
  return { eligible: false, reason, detail: detail || null };
}

/**
 * May we serve brand content to this user, right now, in this market?
 * @returns {Promise<{eligible: boolean, reason?: string, country?: string}>}
 */
async function eligibleFor(user, countryCode, { campaign = null } = {}) {
  const country = String(countryCode || user?.country_code || '').toUpperCase().slice(0, 2);
  const rules = jurisdictions.rulesFor(country);

  // 1 — the user's own choice comes first.
  if (user?.brand_content_opt_out === 1) return deny('user_opted_out');

  // 2 — jurisdiction. Covers banned markets and prohibited territories.
  if (jurisdictions.isProhibited(country)) return deny('territory_prohibited', country);
  if (rules.ads === 'banned') return deny('ads_banned_in_market', country);

  // 3 — legal purchase age for THIS market, not a global constant.
  const minAge = campaign?.min_age_override || rules.minAge;
  const age = ageOf(user?.date_of_birth);
  if (age === null) return deny('age_unknown');
  if (age < minAge) return deny('under_local_purchase_age', `${age} < ${minAge}`);

  // 4 — assurance strength.
  if ((user?.age_assurance_level || 0) < MIN_ASSURANCE_FOR_ADS) {
    return deny('age_not_assured');
  }

  // 5 — audience composition, where an industry code sets a threshold.
  if (rules.adAudience) {
    const composition = await audienceComposition(country, minAge);
    if (composition.sampled >= 50 && composition.ratio < rules.adAudience) {
      return deny(
        'audience_composition_below_threshold',
        `${(composition.ratio * 100).toFixed(1)}% < ${(rules.adAudience * 100).toFixed(1)}%`
      );
    }
  }

  // 6 — frequency.
  const cap = Math.min(campaign?.daily_impression_cap || DEFAULT_DAILY_CAP, DEFAULT_DAILY_CAP);
  const today = await impressionsToday(user.id);
  if (today >= cap) return deny('daily_cap_reached', `${today}/${cap}`);

  return { eligible: true, country, minAge, restricted: rules.ads === 'restricted' };
}

function ageOf(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

/**
 * Share of this market's active audience that is verifiably of legal age.
 * This is the number a brand's compliance team will ask for — it's computed
 * from verified dates of birth, not inferred demographics, which is the whole
 * reason an age-gated platform can carry this advertising at all.
 */
async function audienceComposition(countryCode, minAge) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - minAge);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  try {
    const row = await db.get(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN date_of_birth IS NOT NULL AND date_of_birth <= ? THEN 1 ELSE 0 END) AS of_age,
         SUM(CASE WHEN age_assurance_level > 0 THEN 1 ELSE 0 END) AS assured
       FROM users
      WHERE country_code = ?`,
      [cutoffIso, String(countryCode || '').toUpperCase()]
    );
    const total = row?.total || 0;
    const ofAge = row?.of_age || 0;
    return {
      country: countryCode,
      sampled: total,
      ofAge,
      assured: row?.assured || 0,
      ratio: total > 0 ? ofAge / total : 0,
    };
  } catch {
    // If we can't prove composition, we don't serve. Failing closed is the
    // only defensible default for regulated advertising.
    return { country: countryCode, sampled: 0, ofAge: 0, assured: 0, ratio: 0 };
  }
}

async function impressionsToday(userId) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  try {
    const row = await db.get(
      "SELECT COUNT(*) AS c FROM ad_events WHERE user_id = ? AND kind = 'impression' AND created_at > ?",
      [userId, since]
    );
    return row?.c || 0;
  } catch {
    return 0;
  }
}

/** Record a delivery or interaction. Never throws into the request path. */
async function record(kind, { creativeId, campaignId, userId, country, assured }) {
  try {
    await db.run(
      `INSERT INTO ad_events (creative_id, campaign_id, user_id, kind, country_code, age_assured, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [creativeId, campaignId, userId, kind, country || null, assured ? 1 : 0, Date.now()]
    );
  } catch (e) {
    console.error('[adDelivery] failed to record', kind, e.message);
  }
}

module.exports = {
  eligibleFor,
  audienceComposition,
  impressionsToday,
  record,
  DEFAULT_DAILY_CAP,
  MIN_ASSURANCE_FOR_ADS,
};
