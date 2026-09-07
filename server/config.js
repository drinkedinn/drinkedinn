// server/config.js
// Centralised configuration.
//
// Secrets are validated on FIRST USE rather than at import. The security
// property is unchanged — nothing can sign or verify a token with a missing or
// weak secret, and the error is loud — but the module can be imported without
// one present.
//
// That matters because Cloudflare validates a Worker by importing it at deploy
// time, before any secret is readable. Throwing at import made the first deploy
// impossible: secrets cannot be set until the Worker exists, and the Worker
// could not be created without them.

function required(name, { minLength = 0 } = {}) {
  const v = process.env[name];
  if (!v || v.length < minLength) {
    throw new Error(
      `[config] Env var ${name} is missing or too short` +
        (minLength ? ` (need >= ${minLength} chars).` : '.') +
        ' Set it with `wrangler secret put ' + name + '` (or in .env locally).'
    );
  }
  return v;
}

const config = {
  // Throws on access if unset — the check simply happens when something
  // actually needs the value.
  get jwtSecret() { return required('JWT_SECRET', { minLength: 32 }); },
  get JWT_SECRET() { return required('JWT_SECRET', { minLength: 32 }); },

  get tursoUrl() { return process.env.TURSO_DB_URL; },
  get tursoToken() { return process.env.TURSO_DB_AUTH_TOKEN; },

  get publicBaseUrl() { return process.env.PUBLIC_BASE_URL || 'https://www.drinkedinn.com'; },
  get minAge() { return parseInt(process.env.MIN_AGE || '18', 10); },

  jwt: {
    expiresIn: '7d',
  },

  get mail() {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.MAIL_FROM || 'DrinkedInn <no-reply@drinkedinn.app>',
    };
  },

  get isProd() { return process.env.NODE_ENV === 'production'; },

  /**
   * Explicit startup check for runtimes that have a startup phase. Node calls
   * this so a misconfigured server still dies immediately rather than serving
   * broken requests.
   */
  assertReady() {
    required('JWT_SECRET', { minLength: 32 });
    return true;
  },
};

module.exports = config;
