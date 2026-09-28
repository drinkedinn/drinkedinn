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
const { sendVerificationEmail, sendResetEmail } = require('../lib/mailer');
const jurisdictions = require('../lib/jurisdictions');
const analytics = require('../lib/analytics');

const { countryOf } = require('../lib/clientCountry');
let z;
try { ({ z } = require('zod')); } catch {}

const router = express.Router();

// Emailed tokens are random; only their SHA-256 is stored. A leaked backup
// or a stray SELECT then yields nothing usable. Shared by BOTH flows —
// verification kept its token in plaintext until now, while reset did not.
const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

// A verification link is good for a day. It had no expiry at all, so one
// captured from an old mailbox stayed valid forever.
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFY_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

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
        hashToken(verifyToken), Date.now(),
      ]
    );

    // Send verification email (non-fatal if no provider is configured).
    //
    // The RESULT is kept, because sendMail does not throw when nothing is
    // configured — it logs and returns {via:'log'}. This handler answered
    // "Account created. Check your email to verify." in that case, which is
    // a lie: there is no mail to check. With no provider on the Worker that
    // was EVERY registration.
    let emailSent = false;
    try {
      const link = `${config.publicBaseUrl}/api/auth/verify?token=${verifyToken}`;
      const result = await sendVerificationEmail(email.toLowerCase(), link);
      emailSent = !!result && result.via !== 'log';
    } catch (e) {
      console.warn('[register] verification email failed:', e.message);
    }

    const user = await db.get(
      'SELECT id, name, email, title, avatar, bio, drinks, onboarded, is_admin, token_version FROM users WHERE id = ?',
      [lastInsertRowid]
    );
    analytics.track('signup_completed', { userId: user.id, country, props: { has_dob: !!date_of_birth } });
    const token = signToken(user);
    res.status(201).json({
      token,
      user,
      verified: false,
      emailSent,
      message: emailSent
        ? 'Account created. Check your email to verify.'
        : "Account created. We couldn't send the verification email just now — you can ask for it again from your profile.",
    });
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
  if (!token) return res.redirect(`${config.publicBaseUrl}/?verified=missing`);

  try {
    const user = await db.get(
      'SELECT id, verify_sent_at FROM users WHERE verify_token = ?',
      [hashToken(token)]
    );

    // Expired counts as a miss and redirects the same way — the link is dead
    // either way, and the difference is not something the visitor can act on.
    if (user && Number(user.verify_sent_at || 0) + VERIFY_TTL_MS < Date.now()) {
      return res.redirect(`${config.publicBaseUrl}/?verified=expired`);
    }

    // A miss is NOT an error page. This is a URL opened in a browser from an
    // email, and it is routinely fetched before the human gets to it: Outlook
    // Safe Links, Proofpoint, Barracuda and various inbox prefetchers GET every
    // link they see. Verification is single-use (the UPDATE below clears
    // verify_token), so the scanner spends the token and the user's own click
    // lands here — as did any refresh or second click, with no scanner
    // involved at all.
    //
    // Returning res.status(400).json(...) meant they saw the literal text
    // {"error":"Invalid or expired verification link"} in their browser, while
    // their account was in fact verified. There is no resend route, so that
    // dead end was permanent. Redirecting instead makes the second visit
    // harmless and idempotent.
    if (!user) return res.redirect(`${config.publicBaseUrl}/?verified=already`);

    await db.run(
      'UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?',
      [user.id]
    );
    return res.redirect(`${config.publicBaseUrl}/?verified=1`);
  } catch (e) {
    console.error('[auth] verify failed:', e.message);
    return res.redirect(`${config.publicBaseUrl}/?verified=error`);
  }
});

// ── Resend verification ─────────────────────────────────────────────────────
// There was no way to get a second verification email. Verification is
// single-use, and mail security scanners (Outlook Safe Links, Proofpoint)
// routinely GET links before the human does, so the first link could be spent
// before anyone saw it — permanently, with no route to reissue. Registration
// could also fail to send at all and still tell the user to check their inbox.
//
// Authenticated, because /register already returns a session token: an
// unverified account is signed in, it just has an unverified address.
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, email, email_verified, verify_sent_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (user.email_verified === 1) return res.json({ ok: true, alreadyVerified: true });

    // Same cooldown shape as the password reset, for the same reason: this
    // sends mail on request. Unlike that one there is no enumeration concern —
    // the caller is authenticated and can only ever target their own address —
    // so saying plainly that they are being throttled is safe and more useful.
    const last = Number(user.verify_sent_at || 0);
    if (last && Date.now() - last < VERIFY_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((VERIFY_RESEND_COOLDOWN_MS - (Date.now() - last)) / 1000);
      return res.status(429).json({ error: `Please wait ${wait}s before asking again.` });
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await db.run(
      'UPDATE users SET verify_token = ?, verify_sent_at = ? WHERE id = ?',
      [hashToken(verifyToken), Date.now(), user.id]
    );

    let emailSent = false;
    try {
      const link = `${config.publicBaseUrl}/api/auth/verify?token=${verifyToken}`;
      const result = await sendVerificationEmail(user.email, link);
      emailSent = !!result && result.via !== 'log';
    } catch (e) {
      console.error('[auth] resend verification failed:', e.message);
    }

    // Reports honestly whether anything was actually sent, so the client can
    // say "check your inbox" only when that is true.
    return res.json({ ok: true, emailSent });
  } catch (e) {
    console.error('[auth] resend-verification failed:', e.message);
    return res.status(500).json({ error: 'Could not resend the verification email.' });
  }
});

// ── Password reset ──────────────────────────────────────────────────────────
// These two endpoints did not exist. client/src/api.js has listed
// /auth/forgot-password and /auth/reset-password among its credential checks
// since before this file was written, the password_resets table has been in
// db.js the whole time, and lib/mailer.js already exports sendResetEmail —
// but nothing ever wired them together. So the web app called a 404 and the
// mobile app fell back to telling people to email hello@drinkedinn.app, a
// domain that is not registered and has no MX. Forgetting your password was
// unrecoverable.

const RESET_TTL_MS = 60 * 60 * 1000;      // a link is good for one hour
const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // and at most one is sent every two minutes

// The emailed token is random; only its SHA-256 lands in the database. A leaked
// backup or a SELECT therefore yields nothing usable, which is not true of the
// verify_token column above (raw) — worth fixing there too, but not in this
// change.
const hashResetToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  // ALWAYS the same answer, whether or not the address exists. Saying "no
  // account with that email" turns this endpoint into a membership oracle:
  // anyone could test an address against the user table.
  const sameAnswer = () =>
    res.json({ ok: true, message: 'If that address has an account, a reset link is on its way.' });

  if (!email) return sameAnswer();

  try {
    const user = await db.get('SELECT id, email FROM users WHERE email = ?', [email]);
    if (!user) return sameAnswer();

    // Throttle HERE, in the database, not in middleware.
    //
    // app.js mounts express-rate-limit inside `if (!isWorker)`, because an
    // in-process limiter is meaningless when every isolate has its own memory.
    // Production IS Workers. So adding these routes to that limiter — which is
    // what I did first — protects local development and nothing else: in
    // production this endpoint would mail an arbitrary address as fast as it
    // could be called, which is a spam cannon aimed at other people's inboxes
    // and at the sending reputation of drinkedinn.com.
    //
    // password_resets has no created_at, but expires_at is exactly
    // created + RESET_TTL_MS, so the creation time is recoverable without a
    // schema change.
    const recent = await db.get(
      'SELECT 1 AS x FROM password_resets WHERE user_id = ? AND used = 0 AND expires_at > ?',
      [user.id, Date.now() + RESET_TTL_MS - RESEND_COOLDOWN_MS]
    );
    // Returns the same answer as everything else here. Telling the caller they
    // are being throttled confirms the address exists, which is the one thing
    // this endpoint is built not to reveal. Crucially it does NOT supersede the
    // outstanding link first — otherwise a double-click would invalidate the
    // link already in the user's inbox and send nothing to replace it.
    if (recent) return sameAnswer();

    // Supersede any outstanding link, so requesting a second one invalidates
    // the first rather than leaving several live at once.
    await db.run('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', [user.id]);

    const raw = crypto.randomBytes(32).toString('hex');
    await db.run(
      'INSERT INTO password_resets (user_id, token, expires_at, used) VALUES (?, ?, ?, 0)',
      [user.id, hashResetToken(raw), Date.now() + RESET_TTL_MS]
    );

    const link = `${config.publicBaseUrl}/reset-password?token=${raw}`;
    try {
      await sendResetEmail(user.email, link);
    } catch (e) {
      // A provider outage must not tell the caller whether the address exists,
      // so this is logged and swallowed rather than surfaced.
      console.error('[auth] reset email failed:', e.message);
    }
    return sameAnswer();
  } catch (e) {
    console.error('[auth] forgot-password failed:', e.message);
    return sameAnswer();
  }
});

router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token || '');
  const newPassword = String(req.body?.password || req.body?.newPassword || '');

  if (!token) return res.status(400).json({ error: 'Missing reset token.' });
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const row = await db.get(
      'SELECT id, user_id, expires_at, used FROM password_resets WHERE token = ?',
      [hashResetToken(token)]
    );
    // One message for missing, spent and expired alike — which of the three it
    // is tells an attacker something and tells the user nothing useful.
    const dead = () => res.status(400).json({ error: 'That reset link is invalid or has expired.' });
    if (!row || row.used === 1 || Number(row.expires_at) < Date.now()) return dead();

    const hash = await password_.hash(newPassword);

    await db.batch([
      // token_version invalidates every existing session. Someone resetting a
      // password may be doing it because another party holds their old one.
      //
      // failed_logins and locked_until are cleared deliberately: eight bad
      // attempts locks the account for LOCK_MINUTES, and forgetting a password
      // is exactly how people get locked out. Without this the reset appears to
      // work and the next login still fails.
      {
        sql: `UPDATE users
                 SET password = ?,
                     token_version = COALESCE(token_version, 0) + 1,
                     failed_logins = 0,
                     locked_until = NULL
               WHERE id = ?`,
        args: [hash, row.user_id],
      },
      { sql: 'UPDATE password_resets SET used = 1 WHERE id = ?', args: [row.id] },
      // Any other outstanding link for this account dies with it.
      { sql: 'UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', args: [row.user_id] },
    ]);

    // Signed in immediately, at the NEW token_version. Returning only
    // {ok:true} would hand back nothing usable and the bump above has already
    // killed every prior session, so the user would be bounced to sign-in
    // straight after a successful reset.
    const updated = await db.get('SELECT id, token_version FROM users WHERE id = ?', [row.user_id]);
    return res.json({ ok: true, token: signToken(updated) });
  } catch (e) {
    console.error('[auth] reset-password failed:', e.message);
    return res.status(500).json({ error: 'Could not reset the password.' });
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
