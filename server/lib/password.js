// server/lib/password.js
// Password hashing that works within Cloudflare Workers' free-tier CPU budget.
//
// WHY NOT BCRYPT
// bcryptjs is pure JavaScript. At cost 12 it burns roughly 300ms of CPU, and
// the Workers free tier allows 10ms per invocation, so every login would fail.
// PBKDF2 through WebCrypto runs as native code and is dramatically cheaper.
//
// THE HONEST TRADEOFF
// PBKDF2-HMAC-SHA256 at 100,000 iterations is WEAKER than bcrypt cost 12 against
// GPU cracking, and 100,000 is a hard ceiling — Cloudflare rejects more, to stop
// Workers being used for DoS. OWASP would prefer 600,000.
//
// We close that gap with a server-side PEPPER: the password is HMAC'd with a
// secret held in Workers secrets, never in the database, before PBKDF2 runs.
// A stolen database is then not crackable at all without also stealing the
// secret store — which is a stronger property than raw iteration count.
//
// Legacy bcrypt hashes still verify, and are transparently upgraded on the next
// successful login.

const ITERATIONS = 100_000; // Cloudflare's maximum
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const DIGEST = 'SHA-256';
const PREFIX = 'pbkdf2';

// WebCrypto is global on Workers and on Node 18+.
const subtle = globalThis.crypto?.subtle;

function b64(bytes) {
  return Buffer.from(bytes).toString('base64');
}
function unb64(str) {
  return new Uint8Array(Buffer.from(str, 'base64'));
}

/**
 * Mix in the server-side pepper. Without the pepper a leaked database cannot be
 * attacked offline at all. Absence is a hard error in production rather than a
 * silent downgrade — a missing pepper would quietly halve the security model.
 */
async function pepper(password) {
  const secret = process.env.PASSWORD_PEPPER || '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[password] PASSWORD_PEPPER is not set. Refusing to hash without it.');
    }
    return new TextEncoder().encode(password);
  }
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: DIGEST },
    false,
    ['sign']
  );
  const mac = await subtle.sign('HMAC', key, new TextEncoder().encode(password));
  return new Uint8Array(mac);
}

async function derive(passwordBytes, salt, iterations) {
  const key = await subtle.importKey('raw', passwordBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: DIGEST },
    key,
    KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

/** Hash a new password. Returns `pbkdf2$<iterations>$<salt>$<hash>`. */
async function hash(plain) {
  if (typeof plain !== 'string' || !plain) throw new Error('Password required');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derive(await pepper(plain), salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${b64(salt)}$${b64(derived)}`;
}

/** Constant-time comparison — a plain === leaks the answer one byte at a time. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function isLegacyBcrypt(stored) {
  return typeof stored === 'string' && /^\$2[aby]\$/.test(stored);
}

/**
 * Verify a password against either format.
 * @returns {Promise<boolean>}
 */
async function verify(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string' || !stored) return false;

  if (isLegacyBcrypt(stored)) {
    // Expensive, and the reason this module exists — but it has to keep working
    // until every account has logged in once and been migrated.
    try {
      const bcrypt = require('bcryptjs');
      return await bcrypt.compare(plain, stored);
    } catch {
      return false;
    }
  }

  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== PREFIX) return false;

  const iterations = parseInt(parts[1], 10);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false;

  try {
    const salt = unb64(parts[2]);
    const expected = unb64(parts[3]);
    const actual = await derive(await pepper(plain), salt, iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * True when a stored hash should be replaced after a successful login —
 * either it is legacy bcrypt, or it predates the current iteration count.
 */
function needsRehash(stored) {
  if (isLegacyBcrypt(stored)) return true;
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== PREFIX) return true;
  return parseInt(parts[1], 10) < ITERATIONS;
}

module.exports = { hash, verify, needsRehash, isLegacyBcrypt, ITERATIONS };
