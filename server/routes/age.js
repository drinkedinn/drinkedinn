// server/routes/age.js
// Age assurance flow.
//
//   POST /age/session   start a hosted check, returns a URL to open
//   POST /age/webhook   provider callback — the ONLY thing that grants a level
//   GET  /age/status    current assurance level for the signed-in user
//
// The client never asserts its own result. A user returning to the app from the
// provider's page proves nothing — the signed webhook is the source of truth.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const jurisdictions = require('../lib/jurisdictions');
const assurance = require('../lib/ageAssurance');

const router = express.Router();

// Apply an outcome to both the attempt row and the user. Idempotent: a provider
// retrying a webhook must not double-apply or downgrade an existing level.
async function applyOutcome({ ref, status, method, ageBand, level }) {
  const check = await db.get(
    'SELECT id, user_id, status FROM age_checks WHERE provider = ? AND provider_ref = ?',
    [assurance.PROVIDER, ref]
  );
  if (!check) return { ok: false, reason: 'unknown_ref' };
  if (check.status !== 'pending') return { ok: true, reason: 'already_resolved' };

  await db.run(
    'UPDATE age_checks SET status = ?, method = ?, age_band = ?, level = ?, resolved_at = ? WHERE id = ?',
    [status, method, ageBand, level, Date.now(), check.id]
  );

  if (status === 'passed' && level > 0) {
    // Never lower an existing level — someone who did a document check keeps it.
    await db.run(
      `UPDATE users
          SET age_assurance_level = MAX(COALESCE(age_assurance_level, 0), ?),
              age_assurance_at = ?,
              age_assurance_ref = ?
        WHERE id = ?`,
      [level, Date.now(), ref, check.user_id]
    );
  }
  return { ok: true, userId: check.user_id };
}

// ── Start a check ───────────────────────────────────────────────────────────
router.post('/session', auth, async (req, res) => {
  const method = req.body?.method === 'document' ? 'document' : 'estimation';

  if (!assurance.isConfigured()) {
    return res.status(503).json({ error: 'Age verification is not available right now.' });
  }

  try {
    const user = await db.get(
      'SELECT id, country_code, age_assurance_level FROM users WHERE id = ?',
      [req.user.id]
    );
    const country = (req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || user?.country_code || '')
      .toUpperCase().slice(0, 2);
    const rules = jurisdictions.rulesFor(country);

    const wanted = assurance.LEVEL_BY_METHOD[method];
    if ((user?.age_assurance_level || 0) >= wanted) {
      return res.json({ alreadyVerified: true, level: user.age_assurance_level });
    }

    const session = await assurance.createSession({
      userId: user.id,
      method,
      minAge: rules.minAge,
      country,
    });

    await db.run(
      `INSERT INTO age_checks (user_id, provider, provider_ref, method, status, country_code, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [user.id, assurance.PROVIDER, session.ref, method, country || null, Date.now()]
    );

    // Dev/stub provider resolves inline so the flow is testable end to end.
    if (session.immediate) {
      const parsed = {
        ref: session.ref,
        status: session.immediate.status,
        method: session.immediate.method,
        ageBand: session.immediate.ageBand,
        level: assurance.LEVEL_BY_METHOD[session.immediate.method] || 1,
      };
      await applyOutcome(parsed);
      return res.json({ ref: session.ref, url: null, resolved: true, level: parsed.level });
    }

    res.json({ ref: session.ref, url: session.url, resolved: false, minAge: rules.minAge });
  } catch (err) {
    console.error('[age/session]', err.message);
    res.status(500).json({ error: 'Could not start verification.' });
  }
});

// ── Provider webhook ────────────────────────────────────────────────────────
// Signature is verified against req.rawBody, captured by the json parser's
// verify hook in index.js — the parsed object would not reproduce the bytes.
router.post('/webhook', async (req, res) => {
  const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const signature = req.headers['x-signature'] || req.headers['persona-signature'] || req.headers['x-yoti-signature'] || '';
  const timestamp = req.headers['x-timestamp'] || null;

  if (!assurance.verifyWebhook(raw, signature, timestamp)) {
    console.warn('[age/webhook] rejected: bad signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : (() => {
    try { return JSON.parse(raw); } catch { return null; }
  })();
  if (!body) return res.status(400).json({ error: 'Malformed payload' });

  const parsed = assurance.parseWebhook(body);
  if (!parsed.ref) return res.status(400).json({ error: 'Missing reference' });

  try {
    await applyOutcome(parsed);
    // Always 200 on a valid signature — a non-2xx makes providers retry forever.
    res.json({ received: true });
  } catch (err) {
    console.error('[age/webhook]', err.message);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// ── Status ──────────────────────────────────────────────────────────────────
router.get('/status', auth, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT country_code, age_assurance_level, age_assurance_at FROM users WHERE id = ?',
      [req.user.id]
    );
    const country = (req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || user?.country_code || '')
      .toUpperCase().slice(0, 2);
    const rules = jurisdictions.rulesFor(country);
    const level = user?.age_assurance_level || 0;

    const pending = await db.get(
      "SELECT provider_ref FROM age_checks WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );

    res.json({
      level,
      verifiedAt: user?.age_assurance_at || null,
      country: rules.country,
      minAge: rules.minAge,
      required: rules.assurance === 'enhanced',
      satisfied: rules.assurance !== 'enhanced' || level >= 1,
      pendingRef: pending?.provider_ref || null,
      available: assurance.isConfigured(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not load verification status.' });
  }
});

module.exports = router;
