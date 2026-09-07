// server/lib/clientCountry.js
// One place that decides which country a request came from.
//
// This is a security boundary, not a convenience. Every jurisdiction decision
// hangs off it: the signup age gate, the prohibited-territory block, whether
// age assurance is demanded, and whether alcohol ads may be served at all.
//
// The rule is that only a header the EDGE sets can be trusted. Cloudflare
// overwrites `cf-ipcountry` on every inbound request, so a client cannot forge
// it. `x-vercel-ip-country` had the same property — on Vercel. Running on
// Cloudflare, nothing sets or strips it, so it is just another client-supplied
// string; it was previously read FIRST at seven call sites, which meant a
// one-line curl header could move you to a permissive jurisdiction:
//
//   curl -H 'x-vercel-ip-country: GB' …   # 18+, ads allowed, no assurance
//
// It is therefore ignored unless TRUST_VERCEL_GEO=1 explicitly says this
// deployment sits behind Vercel.

const TRUST_VERCEL_GEO = process.env.TRUST_VERCEL_GEO === '1';

// Cloudflare sends XX when it cannot geolocate, T1 for Tor exit nodes. Neither
// is a country, and neither should be allowed to look like one.
const NOT_A_COUNTRY = new Set(['XX', 'T1', 'A1', 'A2', 'O1']);

// Strict: exactly two letters, no truncation.
//
// The previous form sliced the first two characters off whatever it was given,
// which turns a three-letter code into a different real country: AUT (Austria,
// drinking age 16) becomes AU (Australia, 18), CAN becomes CA by luck and ARE
// becomes AR by accident. Silently answering with the wrong jurisdiction is
// worse than answering "unknown", which callers already handle.
function normalise(value) {
  const code = String(value == null ? '' : value).toUpperCase().trim();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  if (NOT_A_COUNTRY.has(code)) return '';
  return code;
}

/**
 * Resolve the request's country, most trustworthy source first.
 *
 * @param {import('express').Request} req
 * @param {string} [fallback]  a self-declared value (signup form, stored
 *                             profile) — used only when the edge said nothing.
 * @returns {string} ISO-3166-1 alpha-2, or '' if genuinely unknown.
 */
function countryOf(req, fallback) {
  const headers = (req && req.headers) || {};

  // 1. Cloudflare's own header. Set by the edge on every request, and
  //    overwritten if a client tries to supply it.
  const edge = normalise(headers['cf-ipcountry']);
  if (edge) return edge;

  // 2. Vercel's equivalent, only where Vercel is actually terminating.
  if (TRUST_VERCEL_GEO) {
    const vercel = normalise(headers['x-vercel-ip-country']);
    if (vercel) return vercel;
  }

  // 3. Self-declared. Weakest: the user chose it. Callers that must not accept
  //    a self-declared answer should check the return of trustedCountryOf().
  return normalise(fallback);
}

/**
 * Like countryOf, but returns '' rather than falling back to anything the user
 * controls. Use where a wrong answer means breaking the law, and where
 * "unknown" should fail closed instead of trusting a claim.
 */
function trustedCountryOf(req) {
  const headers = (req && req.headers) || {};
  const edge = normalise(headers['cf-ipcountry']);
  if (edge) return edge;
  if (TRUST_VERCEL_GEO) return normalise(headers['x-vercel-ip-country']);
  return '';
}

/**
 * Express middleware that deletes the forgeable header before any route sees
 * it, so a future call site cannot reintroduce the bug by reading it directly.
 */
function stripUntrustedGeoHeaders(req, res, next) {
  if (!TRUST_VERCEL_GEO && req.headers) delete req.headers['x-vercel-ip-country'];
  next();
}

module.exports = { countryOf, trustedCountryOf, stripUntrustedGeoHeaders, normalise };
