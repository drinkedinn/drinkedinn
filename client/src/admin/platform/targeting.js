// client/src/admin/platform/targeting.js
//
// Read/write the `targeting` JSON column, and say in plain words what a draft
// will actually do. Every rule below is read off evaluate() in
// server/routes/flags.js — if that function changes, this file is wrong.
//
//   1. enabled = 0  → false. Before anything else. Beats the allow-list.
//   2. user_ids     → an ALLOW-list: listed ids return true immediately.
//                     It never excludes anyone; it only forces people on.
//   3. countries    → a FILTER: anyone not in the list returns false.
//                     Compared upper-case; a user with no country never matches.
//   4. staff_only   → returns is_admin and STOPS. Rollout is not consulted.
//   5. rollout_pct  → 0 off, 100 on, otherwise a deterministic per-(flag,user)
//                     bucket, so the same people stay in the slice.

// The route stores JSON.stringify(targeting).slice(0, 2000). A payload longer
// than that is stored TRUNCATED, which is invalid JSON, which evaluate()
// swallows in its try/catch — leaving the flag with no targeting at all and no
// error anywhere. So we refuse to send it instead.
export const TARGETING_MAX_JSON = 2000;
const TARGETING_WARN_JSON = 1700;

export const DESCRIPTION_MAX = 200; // route slices at 200
export const REASON_MIN = 8;        // requirePermission() rejects shorter

const KNOWN_KEYS = ['user_ids', 'countries', 'staff_only'];

/**
 * Parse a flag row's `targeting` text into editable parts.
 * Never throws: a malformed value is reported, not crashed on.
 */
export function parseTargeting(raw) {
  const out = {
    user_ids: [],
    countries: [],
    staff_only: false,
    extra: {},        // keys evaluate() ignores — preserved so a save cannot silently drop them
    malformed: false,
  };
  if (raw == null || raw === '') return out;

  let obj;
  if (typeof raw === 'object') obj = raw;
  else {
    try { obj = JSON.parse(String(raw)); }
    catch { out.malformed = true; return out; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    out.malformed = true;
    return out;
  }

  if (Array.isArray(obj.user_ids)) {
    out.user_ids = obj.user_ids.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v));
  }
  if (Array.isArray(obj.countries)) {
    out.countries = obj.countries.filter((v) => typeof v === 'string').map((v) => v.toUpperCase());
  }
  out.staff_only = !!obj.staff_only;

  for (const [k, v] of Object.entries(obj)) {
    if (!KNOWN_KEYS.includes(k)) out.extra[k] = v;
  }
  return out;
}

/** Short chips for the table row. */
export function summarizeTargeting(t) {
  const chips = [];
  if (t.malformed) chips.push({ label: 'unreadable JSON', tone: 'bad' });
  if (t.user_ids.length) chips.push({ label: `${t.user_ids.length} allow-listed`, tone: 'info' });
  if (t.countries.length) {
    const shown = t.countries.slice(0, 4).join(', ');
    chips.push({ label: t.countries.length > 4 ? `${shown} +${t.countries.length - 4}` : shown, tone: 'info' });
  }
  if (t.staff_only) chips.push({ label: 'staff only', tone: 'warn' });
  const extras = Object.keys(t.extra);
  if (extras.length) chips.push({ label: `${extras.length} unused key${extras.length > 1 ? 's' : ''}`, tone: 'muted' });
  return chips;
}

/** "12, 44 55\n9" → { ids: [12,44,55,9], bad: [] } */
export function parseIdList(text) {
  const ids = [];
  const bad = [];
  const seen = new Set();
  for (const tokRaw of String(text || '').split(/[\s,;]+/)) {
    const tok = tokRaw.trim();
    if (!tok) continue;
    if (!/^\d+$/.test(tok)) { bad.push(tok); continue; }
    const n = Number(tok);
    // evaluate() does user_ids.includes(user.id) with a NUMBER, so "12" as a
    // string would silently never match. Ids are stored as numbers.
    if (!Number.isSafeInteger(n) || n <= 0) { bad.push(tok); continue; }
    if (seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
  }
  return { ids, bad };
}

/** "gb, ie" → { codes: ['GB','IE'], bad: [] } */
export function parseCountryList(text) {
  const codes = [];
  const bad = [];
  const seen = new Set();
  for (const tokRaw of String(text || '').split(/[\s,;]+/)) {
    const tok = tokRaw.trim();
    if (!tok) continue;
    if (!/^[A-Za-z]{2}$/.test(tok)) { bad.push(tok); continue; }
    const up = tok.toUpperCase();
    if (seen.has(up)) continue;
    seen.add(up);
    codes.push(up);
  }
  return { codes, bad };
}

/**
 * Build the targeting object to send, plus any reason not to send it.
 * Empty values are omitted so the stored JSON reflects what is actually set.
 */
export function buildTargeting({ ids, codes, staffOnly, extra }) {
  const obj = { ...(extra || {}) };
  delete obj.user_ids; delete obj.countries; delete obj.staff_only;
  if (ids && ids.length) obj.user_ids = ids;
  if (codes && codes.length) obj.countries = codes;
  if (staffOnly) obj.staff_only = true;

  const json = JSON.stringify(obj);
  return { obj, json, size: json.length, tooBig: json.length > TARGETING_MAX_JSON, nearLimit: json.length > TARGETING_WARN_JSON };
}

/**
 * Plain-language consequence of a draft, in evaluation order.
 * tone: 'off' | 'info' | 'warn'
 */
export function explainDraft({ enabled, rolloutPct, ids, codes, staffOnly }) {
  const lines = [];
  const idCount = ids?.length || 0;
  const codeList = (codes || []).join(', ');

  if (!enabled) {
    lines.push({ tone: 'off', text: 'Off. No one receives this feature, on any platform, from the next evaluation onwards.' });
    if (idCount) {
      lines.push({ tone: 'warn', text: `The ${idCount} allow-listed user id${idCount > 1 ? 's do' : ' does'} NOT override this. An off flag is off for them too.` });
    }
    if (codes?.length || staffOnly || rolloutPct > 0) {
      lines.push({ tone: 'off', text: 'Country filter, staff-only and the rollout percent are not consulted while the flag is off. They are kept, and apply again when it is switched on.' });
    }
    return lines;
  }

  if (idCount) {
    lines.push({ tone: 'info', text: `Always on for the ${idCount} allow-listed user id${idCount > 1 ? 's' : ''} — they skip the country filter, staff-only and the rollout entirely.` });
  }
  if (codes?.length) {
    lines.push({ tone: 'info', text: `Everyone else must be in ${codeList}. A user with no country recorded is excluded.` });
  }
  if (staffOnly) {
    lines.push({ tone: 'warn', text: 'Then staff only: admins get it, everyone else does not — and the rollout percent below is never reached.' });
    if (rolloutPct > 0) {
      lines.push({ tone: 'warn', text: `Rollout is set to ${rolloutPct}% but is ignored while staff-only is on.` });
    }
    return lines;
  }

  if (rolloutPct <= 0) {
    lines.push({ tone: idCount ? 'info' : 'off', text: idCount ? 'Everyone else: off (rollout 0%).' : 'Rollout 0% — off for everyone. The flag is on, but it reaches no one.' });
  } else if (rolloutPct >= 100) {
    lines.push({ tone: 'info', text: codes?.length ? `On for everyone in ${codeList} (rollout 100%).` : 'On for everyone (rollout 100%).' });
  } else {
    lines.push({ tone: 'info', text: `On for a fixed ${rolloutPct}% slice — the same users on every request. The slice is hashed per flag, so it is not the same people as another flag's ${rolloutPct}%.` });
  }
  return lines;
}
