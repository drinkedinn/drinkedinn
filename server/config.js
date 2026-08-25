// server/config.js
// Centralized, validated configuration. Fails fast at boot if JWT_SECRET is
// missing or too short — prevents the app from ever running with a forgeable secret.

function required(name, { minLength = 0 } = {}) {
  const v = process.env[name];
  if (!v || v.length < minLength) {
    throw new Error(
      `[config] Env var ${name} is missing or too short` +
        (minLength ? ` (need >= ${minLength} chars).` : '.')
    );
  }
  return v;
}

const config = {
  jwtSecret: required('JWT_SECRET', { minLength: 32 }),
  tursoUrl: process.env.TURSO_DB_URL,
  tursoToken: process.env.TURSO_DB_AUTH_TOKEN,

  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'https://www.drinkedinn.com',
  minAge: parseInt(process.env.MIN_AGE || '18', 10),

  jwt: {
    expiresIn: '7d',
  },

  mail: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'DrinkedInn <no-reply@drinkedinn.app>',
  },

  isProd: process.env.NODE_ENV === 'production',
};

// Backward-compat: older imports destructure { JWT_SECRET }
config.JWT_SECRET = config.jwtSecret;

module.exports = config;
