// server/lib/ageAssurance.js
// Age assurance through a third-party provider.
//
// The whole point of this module is that DrinkedInn NEVER receives, transmits or
// stores an identity document. The provider runs the check in their own hosted
// flow; we get back a session reference and, later, a signed webhook carrying a
// pass/fail and an age band. That is all we persist.
//
// Assurance levels:
//   0  self-declared date of birth (default at signup)
//   1  age estimated from a selfie — no document, no identity captured
//   2  document + liveness — strongest, most intrusive, use sparingly
//
// PROVIDER is selected by env. `stub` is the local/dev default: it creates a
// session that resolves immediately so the whole flow can be exercised without
// credentials or spend.

const crypto = require('crypto');
const config = require('../config');

const PROVIDER = (process.env.AGE_PROVIDER || 'stub').toLowerCase();
const API_KEY = process.env.AGE_PROVIDER_KEY || '';
const WEBHOOK_SECRET = process.env.AGE_WEBHOOK_SECRET || '';

const LEVEL_BY_METHOD = { estimation: 1, document: 2 };

// The stub auto-passes every check and accepts unsigned webhooks. That is fine
// locally and catastrophic in production — it would let anyone grant themselves
// a verified age. Refuse to start rather than ship a silent bypass.
if (PROVIDER === 'stub' && config.isProd) {
  throw new Error(
    '[ageAssurance] AGE_PROVIDER is "stub" in production. Set a real provider ' +
      'plus AGE_PROVIDER_KEY and AGE_WEBHOOK_SECRET, or age verification is trivially forgeable.'
  );
}

function isConfigured() {
  if (PROVIDER === 'stub') return !config.isProd;
  return !!API_KEY && !!WEBHOOK_SECRET;
}

/**
 * Start a hosted verification session.
 * @param {object} o
 * @param {number} o.userId
 * @param {string} o.method     'estimation' | 'document'
 * @param {number} o.minAge     threshold the provider must confirm
 * @param {string} o.country
 * @returns {Promise<{ref: string, url: string|null, immediate?: object}>}
 */
async function createSession({ userId, method, minAge, country }) {
  const ref = `di_${crypto.randomBytes(12).toString('hex')}`;

  if (PROVIDER === 'stub') {
    // Dev mode: no network call. The route resolves this immediately so the
    // client, storage and gating logic can all be tested end to end.
    return {
      ref,
      url: null,
      immediate: { status: 'passed', ageBand: `${minAge}+`, method },
    };
  }

  // ── Real provider ────────────────────────────────────────────────────────
  // Each vendor (Persona, Yoti, Veriff, Stripe Identity) differs only in this
  // request shape and the field names on the response. Consult their current
  // docs — deliberately not hardcoded here, because guessing an API contract is
  // how integrations silently break.
  //
  // The contract this function must satisfy:
  //   - create a hosted session scoped to `ref`
  //   - configure it for an age-threshold check at `minAge`
  //   - return the URL the user should be sent to
  //
  // Example shape (adapt to your provider):
  //
  //   const res = await fetch(`${VENDOR_BASE}/v1/sessions`, {
  //     method: 'POST',
  //     headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       reference_id: ref,
  //       check: method === 'document' ? 'document+liveness' : 'age_estimation',
  //       threshold_age: minAge,
  //       country,
  //       redirect_url: `${config.publicBaseUrl}/age/return`,
  //     }),
  //   });
  //   const data = await res.json();
  //   return { ref, url: data.hosted_url };

  throw new Error(
    `[ageAssurance] Provider "${PROVIDER}" is selected but its session call is not implemented. ` +
      'Add the vendor request in lib/ageAssurance.js createSession().'
  );
}

/**
 * Verify a webhook came from the provider and hasn't been tampered with.
 * Uses a timing-safe comparison — a plain === leaks the signature byte by byte.
 *
 * @param {Buffer|string} rawBody  the EXACT bytes received, before JSON parsing
 * @param {string} signature       value of the provider's signature header
 * @param {string} [timestamp]     optional, for replay protection
 */
function verifyWebhook(rawBody, signature, timestamp) {
  // Only ever bypass outside production, and never once a secret is configured.
  if (PROVIDER === 'stub' && !config.isProd && !WEBHOOK_SECRET) return true;
  if (!WEBHOOK_SECRET || !signature) return false;

  // Reject anything older than five minutes to blunt replay attacks.
  if (timestamp) {
    const age = Math.abs(Date.now() - Number(timestamp) * (String(timestamp).length <= 10 ? 1000 : 1));
    if (!Number.isFinite(age) || age > 5 * 60 * 1000) return false;
  }

  const payload = timestamp ? `${timestamp}.${rawBody}` : String(rawBody);
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature).replace(/^sha256=/, ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Normalise a provider webhook into our own shape.
 * Adapt the field names to your provider; the OUTPUT contract is fixed.
 */
function parseWebhook(body) {
  const ref = body.reference_id || body.referenceId || body.ref || null;
  const raw = String(body.status || body.outcome || '').toLowerCase();

  const status =
    ['passed', 'approved', 'completed', 'verified', 'success'].includes(raw) ? 'passed'
      : ['failed', 'declined', 'rejected'].includes(raw) ? 'failed'
      : ['expired', 'abandoned', 'cancelled'].includes(raw) ? 'expired'
      : 'pending';

  const method = body.check_type === 'document+liveness' || body.method === 'document' ? 'document' : 'estimation';

  return {
    ref,
    status,
    method,
    ageBand: body.age_band || body.ageBand || null,
    level: status === 'passed' ? (LEVEL_BY_METHOD[method] || 1) : 0,
  };
}

module.exports = {
  PROVIDER,
  isConfigured,
  createSession,
  verifyWebhook,
  parseWebhook,
  LEVEL_BY_METHOD,
};
