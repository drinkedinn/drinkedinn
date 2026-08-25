// server/routes/jobs.js
// Scheduled-job endpoints. The lifecycle digest is triggered daily by Vercel Cron
// (see vercel.json "crons"). Cron requests are authenticated by CRON_SECRET:
// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when that env
// var is set. We also accept ?key= for manual/admin runs.

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { runLifecycleEmails } = require('../lib/lifecycle');

const router = express.Router();

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // refuse to run if no secret is configured
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return bearer === secret || req.query.key === secret;
}

// Daily re-engagement digest. GET so Vercel Cron can call it.
router.get('/lifecycle', async (req, res) => {
  if (!cronAuthorized(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const dryRun = req.query.dryRun === '1';
    const result = await runLifecycleEmails({ dryRun });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[jobs/lifecycle]', e.message);
    res.status(500).json({ error: 'Lifecycle run failed' });
  }
});

// One-click unsubscribe from the email footer (token is a signed JWT).
router.get('/unsubscribe', async (req, res) => {
  const token = String(req.query.token || '');
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.purpose !== 'digest_unsub' || !payload.sub) throw new Error('bad token');
    // Ensure a prefs row exists, then turn digest emails off.
    await db.run('INSERT OR IGNORE INTO notification_prefs (user_id) VALUES (?)', [payload.sub]);
    await db.run('UPDATE notification_prefs SET digest_email = 0 WHERE user_id = ?', [payload.sub]);
    res
      .status(200)
      .send(
        `<html><body style="font-family:sans-serif;text-align:center;padding:60px;">
           <h2>You're unsubscribed 🥃</h2>
           <p>You won't get re-engagement emails anymore. You can turn them back on in your notification settings.</p>
           <p><a href="${config.publicBaseUrl}">Back to DrinkedInn</a></p>
         </body></html>`
      );
  } catch {
    res.status(400).send('Invalid or expired unsubscribe link.');
  }
});

module.exports = router;
