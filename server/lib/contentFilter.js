// server/lib/contentFilter.js
// First-pass moderation. Apple guideline 1.2 requires "a method for filtering
// objectionable material from being posted to the app", and Google Play requires
// ongoing moderation proportionate to the content type.
//
// This is a deterministic pre-publish gate, not a replacement for human review:
// it blocks the clearly-prohibited, flags the borderline for the admin queue,
// and lets everything else through. Two categories matter here beyond the usual
// slur/spam checks, because of what this platform is:
//
//   - Content encouraging excessive or rapid drinking. Apple 1.4.3 rejects apps
//     that "encourage consumption of ... excessive amounts of alcohol".
//   - Content mixing alcohol with driving or with minors.

// Slurs and explicit sexual terms are matched on word boundaries to avoid the
// Scunthorpe problem. Kept deliberately short and severe — over-blocking a
// social feed is its own kind of failure.
const HARD_BLOCK = [
  /\b(n[i1]gg(?:er|a)s?)\b/i,
  /\b(f[a@]gg?(?:ot)?s?)\b/i,
  /\b(k[i1]ke|ch[i1]nk|sp[i1]c|tr[a@]nny)\b/i,
  /\b(c[u*]nt)\b/i,
  /\b(rape|raping)\s+(her|him|them|you)\b/i,
  /\b(kill|murder)\s+(yourself|urself|ur ?self)\b/i,
  /\bkys\b/i,
  /\b(child|minor|underage|teen)\s?(porn|nudes?|sex)\b/i,
];

// Alcohol-specific harm patterns — the category that gets this app rejected.
const ALCOHOL_HARM = [
  // "drove" does not start with "driv", so an alternation on driv\w+ alone
  // missed the most natural past tense: "drank then drove home".
  { re: /\b(drink|drank|drunk|drinking)\b.{0,12}\b(driv\w+|drove|ride|riding|rode)\b/i, why: 'drink driving' },
  { re: /\b(driv\w+|drove)\b.{0,12}\b(drunk|hammered|wasted|tipsy)\b/i, why: 'drink driving' },
  { re: /\bdrunk\s?driv\w*\b/i, why: 'drink driving' },
  { re: /\b(shots?|shot)\s?gunn?\w*\b/i, why: 'rapid-consumption challenge' },
  { re: /\b(chug|chugg\w+|sculling|skulling|funnel(?:ing|ling)?)\b/i, why: 'rapid-consumption challenge' },
  { re: /\bbeer\s?bong\b/i, why: 'rapid-consumption challenge' },
  { re: /\b(black(?:ed)?\s?out|blackout)\s+(drunk|wasted)\b/i, why: 'glorifying blackout drinking' },
  { re: /\b(power\s?hour|century\s?club|edward\s?fortyhands|neknomination)\b/i, why: 'drinking game' },
  { re: /\b\d{2,}\s+(shots?|pints?|beers?|drinks?)\s+in\b/i, why: 'volume challenge' },
  // No trailing \b on the drink terms — it prevented matching inflections, so
  // "underage drinking" slipped through while "underage drink" was caught.
  { re: /\b(under\s?age|underage|minor|kids?|children)\b.{0,24}\b(drink|drunk|beer|vodka|booze|wine|spirits)/i, why: 'minors and alcohol' },
  { re: /\b(drink|beer|vodka|booze|wine)\w*\b.{0,24}\b(under\s?age|underage|my kid|my son|my daughter)\b/i, why: 'minors and alcohol' },
];

// Softer signals — allowed, but surfaced to moderators.
const FLAG = [
  { re: /\b(https?:\/\/|www\.)\S+/i, why: 'contains a link' },
  { re: /\b(buy|sell|selling|dm me|whats ?app)\b.{0,20}\b(bottle|crate|case|stock)\b/i, why: 'possible unlicensed sale' },
  { re: /(.)\1{9,}/, why: 'spam-like repetition' },
];

const MAX_LEN = 5000;

/**
 * Screen a piece of user text before it is stored.
 * @param {string} text
 * @returns {{ allowed: boolean, reason: string|null, flags: string[] }}
 */
function screenContent(text) {
  const body = String(text || '');
  const flags = [];

  if (body.length > MAX_LEN) {
    return { allowed: false, reason: 'That post is too long.', flags };
  }

  for (const re of HARD_BLOCK) {
    if (re.test(body)) {
      return {
        allowed: false,
        reason: 'That post breaks our community guidelines. Please rephrase it.',
        flags: ['hate-or-abuse'],
      };
    }
  }

  for (const { re, why } of ALCOHOL_HARM) {
    if (re.test(body)) {
      return {
        allowed: false,
        reason:
          'We don\'t allow posts that encourage unsafe drinking. Read our community guidelines for what that covers.',
        flags: [why],
      };
    }
  }

  for (const { re, why } of FLAG) {
    if (re.test(body)) flags.push(why);
  }

  return { allowed: true, reason: null, flags };
}

module.exports = { screenContent, MAX_LEN };
