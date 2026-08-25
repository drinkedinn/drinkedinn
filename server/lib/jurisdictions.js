// server/lib/jurisdictions.js
// Per-country rules. Drinking age, advertising legality, and how strong the age
// check has to be all vary enormously — a flat "18+" is wrong almost everywhere.
//
// Fields:
//   minAge      Legal purchase/consumption age we enforce at signup.
//               Where a country splits by beverage type (Germany: 16 beer,
//               18 spirits) we take the HIGHER value — the platform covers spirits.
//   ads         'allowed'    — brand advertising permitted, subject to local codes
//               'restricted' — permitted but severely limited (factual only)
//               'banned'     — do not serve alcohol brand content at all
//   assurance   'self'     — self-declared date of birth is sufficient
//               'enhanced' — law requires "highly effective" age assurance
//   adAudience  Minimum share of audience that must be of legal age before a
//               brand placement may run (industry codes). null where not applicable.
//
// Sources are industry codes and national regulation; treat as an engineering
// default, not legal advice. Verify before entering any market commercially.

const DEFAULT = { minAge: 18, ads: 'restricted', assurance: 'self', adAudience: null, note: 'Unlisted market — conservative defaults applied.' };

const RULES = {
  // ── Core launch markets ────────────────────────────────────────────────
  GB: { minAge: 18, ads: 'allowed', assurance: 'enhanced', adAudience: 0.75, note: 'ASA CAP code. Online Safety Act requires highly effective age assurance.' },
  IE: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: 'Public Health (Alcohol) Act restricts content and placement.' },
  AU: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.80, note: 'ABAC code; pre-vetting advised for brand creative.' },
  NZ: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: 'ASA NZ code.' },
  CA: { minAge: 19, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: 'Provincial variation: 18 in AB/MB/QC, 19 elsewhere. 19 applied as the safe floor.' },

  // ── United States ──────────────────────────────────────────────────────
  US: { minAge: 21, ads: 'allowed', assurance: 'self', adAudience: 0.738, note: 'DISCUS / Beer Institute codes require 73.8% LDA audience. Age is 21, not 18.' },

  // ── Europe ─────────────────────────────────────────────────────────────
  DE: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: 'Spirits 18 (beer/wine 16); higher value applied.' },
  NL: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: null },
  ES: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: null },
  IT: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: null },
  PT: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: null },
  BE: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: 'Spirits 18, beer/wine 16; higher applied.' },
  FR: { minAge: 18, ads: 'restricted', assurance: 'self', adAudience: 0.75, note: 'Loi Évin — factual product information only. No lifestyle or social-success imagery.' },
  NO: { minAge: 20, ads: 'banned', assurance: 'self', adAudience: null, note: 'Near-total advertising ban. Spirits age 20.' },
  SE: { minAge: 20, ads: 'banned', assurance: 'self', adAudience: null, note: 'Severe restrictions; Systembolaget monopoly. Spirits age 20.' },
  FI: { minAge: 20, ads: 'restricted', assurance: 'self', adAudience: null, note: 'Spirits 20; heavy restrictions on social media marketing.' },
  PL: { minAge: 18, ads: 'restricted', assurance: 'self', adAudience: 0.75, note: 'Spirits advertising largely prohibited.' },

  // ── Asia-Pacific ───────────────────────────────────────────────────────
  JP: { minAge: 20, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: null },
  SG: { minAge: 18, ads: 'allowed', assurance: 'self', adAudience: 0.75, note: null },
  KR: { minAge: 19, ads: 'restricted', assurance: 'self', adAudience: 0.75, note: 'Time-of-day restrictions apply to broadcast; digital rules tightening.' },

  // ── Markets to avoid for brand content ─────────────────────────────────
  IN: { minAge: 25, ads: 'banned', assurance: 'self', adAudience: null, note: 'Advertising banned since 2000; surrogate advertising is an unfair trade practice. State ages range 18–25 with dry states; 25 applied as the safe floor.' },
  AE: { minAge: 21, ads: 'banned', assurance: 'enhanced', adAudience: null, note: 'Heavily restricted; emirate-level variation.' },
  SA: { minAge: 99, ads: 'banned', assurance: 'enhanced', adAudience: null, note: 'Alcohol prohibited. Platform should not operate here.' },
  PK: { minAge: 99, ads: 'banned', assurance: 'enhanced', adAudience: null, note: 'Alcohol prohibited for most residents.' },
};

function normalise(code) {
  return String(code || '').trim().toUpperCase().slice(0, 2);
}

/** Rules for a country code, with safe fallbacks. */
function rulesFor(countryCode) {
  const cc = normalise(countryCode);
  const r = RULES[cc];
  return { country: cc || null, ...(r ? r : DEFAULT), listed: !!r };
}

/** Minimum age we will accept at signup for this market. */
function minAgeFor(countryCode) {
  return rulesFor(countryCode).minAge;
}

/** May we show alcohol brand content to someone in this market? */
function adsAllowed(countryCode) {
  return rulesFor(countryCode).ads === 'allowed';
}

/** Does this market legally require stronger-than-self-declared age assurance? */
function needsEnhancedAssurance(countryCode) {
  return rulesFor(countryCode).assurance === 'enhanced';
}

/** Markets where the platform should not operate at all. */
function isProhibited(countryCode) {
  return rulesFor(countryCode).minAge >= 99;
}

module.exports = {
  rulesFor,
  minAgeFor,
  adsAllowed,
  needsEnhancedAssurance,
  isProhibited,
  SUPPORTED: Object.keys(RULES),
};
