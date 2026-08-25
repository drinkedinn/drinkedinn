// server/routes/auth.js
// Hardened auth routes: login lockout, token versioning, email verification, age check.
// Admin is only granted via DB (scripts/promoteAdmin.js) — no email→admin escalation.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { sendVerificationEmail } = require('../lib/mailer');

let z;
try { ({ z } = require('zod')); } catch {}

const router = express.Router();

const LOCK_THRESHOLD = 8;
const LOCK_MINUTES = 15;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, tv: user.token_version ?? 0 },
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

// ── Register ────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, title, date_of_birth, ref: bodyRef } = req.body;
  const ref = bodyRef || req.query.ref || null;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Age gate: only enforced when date_of_birth is provided
  if (date_of_birth) {
    const age = ageFromDob(date_of_birth);
    if (age === null || age < config.minAge) {
      return res.status(403).json({ error: `You must be at least ${config.minAge} to join.` });
    }
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: 'Could not create account with those details.' });
    }

    const hash = await bcrypt.hash(password, 12);
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
          referral_code, referred_by, date_of_birth,
          email_verified, verify_token, verify_sent_at,
          is_admin, token_version)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, 0, 0)`,
      [
        name, email.toLowerCase(), hash,
        title || 'DrinkedInn Member 🥃', avatar,
        referralCode, referredBy, date_of_birth || null,
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
      // Always run bcrypt compare to equalize timing (prevent user enumeration)
      if (!user) await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinv');
      return res.status(401).json({ error: 'Invalid email or password' });
    };

    if (!user) return fail();

    if (user.locked_until && user.locked_until > Date.now()) {
      return res.status(429).json({ error: 'Account temporarily locked. Try again later.' });
    }

    const ok = await bcrypt.compare(password, user.password);
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
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    // Also bump token_version to revoke all other sessions
    await db.run(
      'UPDATE users SET password = ?, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?',
      [hash, req.user.id]
    );
    res.json({ success: true });
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
