// server/routes/ads.js
// Serving and measurement. Brands and campaigns are managed in routes/brands.js.
//
// Nothing here decides eligibility for itself — every serve goes through
// adDelivery.eligibleFor(). A refusal is returned as an empty result, never an
// error, so a blocked market simply sees no brand content rather than a broken UI.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const delivery = require('../lib/adDelivery');
const jurisdictions = require('../lib/jurisdictions');

const router = express.Router();

function countryOf(req, user) {
  return String(
    req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || user?.country_code || ''
  ).toUpperCase().slice(0, 2);
}

// ── Serve ───────────────────────────────────────────────────────────────────
// Returns at most one placement. The feed asks for this separately from posts
// so an ad failure can never take the feed down with it.
router.get('/serve', auth, async (req, res) => {
  try {
    const user = await db.get(
      `SELECT id, date_of_birth, country_code, age_assurance_level, brand_content_opt_out
         FROM users WHERE id = ?`,
      [req.user.id]
    );
    const country = countryOf(req, user);

    const check = await delivery.eligibleFor(user, country);
    if (!check.eligible) {
      // 200 with an empty payload: "no ad for you" is a normal outcome.
      return res.json({ ad: null, reason: check.reason });
    }

    const now = Date.now();
    const candidates = await db.all(
      `SELECT c.id, c.headline, c.body, c.image_url, c.cta_label, c.cta_url, c.factual_only,
              cam.id AS campaign_id, cam.target_countries, cam.min_age_override,
              cam.daily_impression_cap,
              b.name AS brand_name, b.slug AS brand_slug, b.avatar AS brand_avatar
         FROM ad_creatives c
         JOIN ad_campaigns cam ON cam.id = c.campaign_id
         JOIN brands b ON b.id = cam.brand_id
        WHERE c.review_status = 'approved'
          AND cam.status = 'active'
          AND b.status = 'active' AND b.verified = 1
          AND (cam.starts_at IS NULL OR cam.starts_at <= ?)
          AND (cam.ends_at IS NULL OR cam.ends_at >= ?)
        LIMIT 50`,
      [now, now]
    );

    // Filter to campaigns that actually target this market, then re-run the
    // per-campaign gate (age override, tighter cap).
    const eligible = [];
    for (const c of candidates) {
      let targets = [];
      try { targets = JSON.parse(c.target_countries || '[]'); } catch {}
      if (!Array.isArray(targets) || !targets.includes(country)) continue;

      const per = await delivery.eligibleFor(user, country, { campaign: c });
      if (per.eligible) eligible.push({ creative: c, ctx: per });
    }

    if (!eligible.length) return res.json({ ad: null, reason: 'no_matching_campaign' });

    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    const { creative, ctx } = pick;

    // France and similar: factual product information only, no lifestyle copy.
    if (ctx.restricted && creative.factual_only !== 1) {
      return res.json({ ad: null, reason: 'creative_not_permitted_in_restricted_market' });
    }

    await delivery.record('impression', {
      creativeId: creative.id,
      campaignId: creative.campaign_id,
      userId: user.id,
      country,
      assured: (user.age_assurance_level || 0) > 0,
    });

    res.json({
      ad: {
        id: creative.id,
        brand: { name: creative.brand_name, slug: creative.brand_slug, avatar: creative.brand_avatar },
        headline: creative.headline,
        body: creative.body,
        image_url: creative.image_url,
        cta_label: creative.cta_label,
        cta_url: creative.cta_url,
        // Disclosure and responsible-drinking messaging are attached by the
        // server, not left to the client or the advertiser to remember.
        disclosure: 'Paid partnership',
        responsibility: 'Enjoy responsibly. Never drink and drive.',
      },
    });
  } catch (err) {
    console.error('[ads/serve]', err.message);
    // Never let advertising break the feed.
    res.json({ ad: null, reason: 'error' });
  }
});

// ── Click tracking ──────────────────────────────────────────────────────────
router.post('/:id/click', auth, async (req, res) => {
  try {
    const creative = await db.get('SELECT id, campaign_id FROM ad_creatives WHERE id = ?', [req.params.id]);
    if (!creative) return res.status(404).json({ error: 'Not found' });

    const user = await db.get('SELECT id, country_code, age_assurance_level FROM users WHERE id = ?', [req.user.id]);
    await delivery.record('click', {
      creativeId: creative.id,
      campaignId: creative.campaign_id,
      userId: req.user.id,
      country: countryOf(req, user),
      assured: (user?.age_assurance_level || 0) > 0,
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // measurement must never block the user
  }
});

// ── Opt out ─────────────────────────────────────────────────────────────────
router.put('/preferences', auth, async (req, res) => {
  const optOut = req.body?.brand_content === false || req.body?.opt_out === true ? 1 : 0;
  try {
    await db.run('UPDATE users SET brand_content_opt_out = ? WHERE id = ?', [optOut, req.user.id]);
    res.json({ ok: true, brand_content_opt_out: optOut });
  } catch {
    res.status(500).json({ error: 'Could not save preference.' });
  }
});

router.get('/preferences', auth, async (req, res) => {
  const u = await db.get('SELECT brand_content_opt_out, age_assurance_level, country_code FROM users WHERE id = ?', [req.user.id]);
  const rules = jurisdictions.rulesFor(countryOf(req, u));
  res.json({
    brand_content_opt_out: u?.brand_content_opt_out === 1,
    // Tell the user honestly why they may not see brand content.
    eligible: rules.ads === 'allowed' && (u?.age_assurance_level || 0) >= delivery.MIN_ASSURANCE_FOR_ADS,
    market_allows_ads: rules.ads === 'allowed',
    needs_verification: (u?.age_assurance_level || 0) < delivery.MIN_ASSURANCE_FOR_ADS,
  });
});

module.exports = router;
