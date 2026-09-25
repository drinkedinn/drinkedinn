// server/routes/auth.js
// Hardened auth routes: login lockout, token versioning, email verification, age check.
// Admin is only granted via DB (scripts/promoteAdmin.js) — no email→admin escalation.

const express = require('express');
const bcrypt = require('bcryptjs');
const password_ = require('../lib/password');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { sendVerificationEmail } = require('../lib/mailer');
const jurisdictions = require('../lib/jurisdictions');
const analytics = require('../lib/analytics');

const { countryOf } = require('../lib/clientCountry');
let z;
try { ({ z } = require('zod')); } catch {}

const router = express.Router();

const LOCK_THRESHOLD = 8;
const LOCK_MINUTES = 15;

function signToken(user) {
  // `purpose` marks this as a session token. Single-purpose tokens signed with
  // the same secret (the digest unsubscribe link in lib/lifecycle.js) carry a
  // different purpose, and middleware/auth.js accepts only this one.
  return jwt.sign(
    { sub: user.id, tv: user.token_version ?? 0, purpose: 'session' },
    config.jwtSecret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function ageFromDob(dob) {
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// ── Local rules ─────────────────────────────────────────────────────────────
// The client calls this before rendering the sign-up form so the age gate shows
// the correct minimum for the visitor's country rather than a hardcoded 18.
router.get('/rules', (req, res) => {
  const country = countryOf(req, req.query.country);
  const r = jurisdictions.rulesFor(country);
  res.json({
    country: r.country,
    minAge: r.minAge,
    available: !jurisdictions.isProhibited(country),
    enhancedAssurance: r.assurance === 'enhanced',
    // Deliberately not exposing ad eligibility to the client — that's a
    // server-side delivery decision, not something a client should assert.
  });
});

// ── Register ────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, title, date_of_birth, country_code, ref: bodyRef } = req.body;
  const ref = bodyRef || req.query.ref || null;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Jurisdiction drives the age gate — a flat 18 is wrong in most markets.
  // Trust the client hint only as a starting point; the edge header wins.
  const country = countryOf(req, country_code);
  const rules = jurisdictions.rulesFor(country);

  if (jurisdictions.isProhibited(country)) {
    return res.status(451).json({ error: 'DrinkedInn is not available in your country.' });
  }

  if (!date_of_birth) {
    return res.status(400).json({ error: 'Date of birth is required to confirm your age.' });
  }
  const age = ageFromDob(date_of_birth);
  if (age === null) {
    return res.status(400).json({ error: 'Enter your date of birth as YYYY-MM-DD.' });
  }
  if (age < rules.minAge) {
    return res.status(403).json({
      error: `You must be at least ${rules.minAge} to join from your country.`,
    });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: 'Could not create account with those details.' });
    }

    const hash = await password_.hash(password);
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=b45309,d97706`;
    const referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const verifyToken = crypto.randomBytes(32).toString('hex');

    let referredBy = null;
    if (ref) {
      const referrer = await db.get('SELECT id FROM users WHERE referral_code = ?', [ref]);
      if (referrer) referredBy = referrer.id;
    }

    const { lastInsertRowid } = await db.run(
      `INSERT INTO users
         (name, email, password, title, avatar, onboarded,
          referral_code, referred_by, date_of_birth, country_code,
          email_verified, verify_token, verify_sent_at,
          is_admin, token_version)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?, ?, 0, 0)`,
      [
        name, email.toLowerCase(), hash,
        title || 'DrinkedInn Member', avatar,
        referralCode, referredBy, date_of_birth, country || null,
        verifyToken, Date.now(),
      ]
    );

    // Send verification email (non-fatal if SMTP not configured)
    try {
      const link = `${config.publicBaseUrl}/api/auth/verify?token=${verifyToken}`;
      await sendVerificationEmail(email.toLowerCase(), link);
    } catch (e) {
      console.warn('[register] verification email failed:', e.message);
    }

    const user = await db.get(
      'SELECT id, name, email, title, avatar, bio, drinks, onboarded, is_admin, token_version FROM users WHERE id = ?',
      [lastInsertRowid]
    );
    analytics.track('signup_completed', { userId: user.id, country, props: { has_dob: !!date_of_birth } });
    const token = signToken(user);
    res.status(201).json({ token, user, verified: false, message: 'Account created. Check your email to verify.' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Could not create account with those details.' });
    }
    console.error('[register]', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Verify email ────────────────────────────────────────────────────────────
router.get('/verify', async (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    const user = await db.get('SELECT id FROM users WHERE verify_token = ?', [token]);
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });

    await db.run(
      'UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?',
      [user.id]
    );
    return res.redirect(`${config.publicBaseUrl}/?verified=1`);
  } catch (e) {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// ── Login ───────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await db.get(
      `SELECT id, email, password, is_admin, email_verified,
              token_version, failed_logins, locked_until
         FROM users WHERE email = ?`,
      [email.toLowerCase()]
    );

    const fail = async () => {
      // Do equivalent work for a missing account so response time doesn't
      // reveal whether the email exists.
      if (!user) await password_.verify(password, 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
      return res.status(401).json({ error: 'Invalid email or password' });
    };

    if (!user) return fail();

    if (user.locked_until && user.locked_until > Date.now()) {
      return res.status(429).json({ error: 'Account temporarily locked. Try again later.' });
    }

    const ok = await password_.verify(password, user.password);
    if (!ok) {
      const failed = (user.failed_logins ?? 0) + 1;
      const lock = failed >= LOCK_THRESHOLD ? Date.now() + LOCK_MINUTES * 60_000 : null;
      await db.run(
        'UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?',
        [failed, lock, user.id]
      );
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await db.run('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', [user.id]);

    // Transparently upgrade legacy bcrypt hashes now that we have the plaintext.
    // This is the only moment it is possible, and it happens at most once per
    // account. Failure here must never block a valid login.
    if (password_.needsRehash(user.password)) {
      try {
        const upgraded = await password_.hash(password);
        await db.run('UPDATE users SET password = ? WHERE id = ?', [upgraded, user.id]);
      } catch (e) {
        console.warn('[login] password upgrade failed:', e.message);
      }
    }

    const { password: _, ...safeUser } = user;
    return res.json({
      token: signToken(user),
      user: safeUser,
      verified: user.email_verified === 1,
      is_admin: user.is_admin === 1,
    });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Change password ─────────────────────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  try {
    const user = await db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const valid = await password_.verify(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await password_.hash(newPassword);
    // Bump token_version so every existing session dies.
    await db.run(
      'UPDATE users SET password = ?, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?',
      [hash, req.user.id]
    );

    // "Every existing session" includes the caller's own. Returning only
    // {success:true} left the client holding a token that the request had just
    // invalidated, so changing your password silently signed you out of the
    // device you changed it on — which reads as the change having failed.
    // Hand back a token minted at the new version instead.
    const updated = await db.get('SELECT id, token_version FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, token: signToken(updated) });
  } catch (err) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

// ── Logout everywhere (revoke all tokens for this user) ─────────────────────
router.post('/logout-all', requireAuth, async (req, res) => {
  await db.run('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?', [req.user.id]);
  return res.json({ ok: true });
});

module.exports = router;
