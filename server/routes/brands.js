// server/routes/brands.js
// Brand, campaign and creative management, plus the compliance reporting a
// brand's legal team will ask for before they sign anything.
//
// Verification and creative approval are admin-only by design. A self-serve
// alcohol ad platform is a compliance incident waiting to happen — every
// placement on DrinkedInn is reviewed by a person before it can run.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../lib/audit');
const { screenContent } = require('../lib/contentFilter');
const jurisdictions = require('../lib/jurisdictions');
const delivery = require('../lib/adDelivery');

const router = express.Router();

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function assertBrandAccess(req, brandId) {
  if (req.user.is_admin === 1) return true;
  const row = await db.get(
    'SELECT 1 AS ok FROM brand_members WHERE brand_id = ? AND user_id = ?',
    [brandId, req.user.id]
  );
  return !!row;
}

// ── Public: brand profile ───────────────────────────────────────────────────
router.get('/:slug', auth, async (req, res) => {
  const brand = await db.get(
    'SELECT id, name, slug, avatar, bio, website, verified FROM brands WHERE slug = ? AND status = ?',
    [req.params.slug, 'active']
  );
  if (!brand) return res.status(404).json({ error: 'Brand not found' });
  res.json({ brand });
});

// ── Apply to become a brand ─────────────────────────────────────────────────
// Creates a pending record only. Nothing serves until an admin verifies it.
router.post('/apply', auth, async (req, res) => {
  const { name, legal_entity, contact_email, website } = req.body || {};
  if (!name || !legal_entity || !contact_email) {
    return res.status(400).json({ error: 'Brand name, legal entity and contact email are required.' });
  }
  try {
    const slug = slugify(name);
    const exists = await db.get('SELECT id FROM brands WHERE slug = ?', [slug]);
    if (exists) return res.status(409).json({ error: 'A brand with that name already exists.' });

    const { lastInsertRowid } = await db.run(
      `INSERT INTO brands (name, slug, legal_entity, contact_email, website, verified, status, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 'pending', ?)`,
      [name, slug, legal_entity, contact_email, website || null, Date.now()]
    );
    await db.run(
      'INSERT INTO brand_members (brand_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
      [lastInsertRowid, req.user.id, 'owner', Date.now()]
    );
    res.status(201).json({ ok: true, brandId: lastInsertRowid, status: 'pending' });
  } catch (err) {
    console.error('[brands/apply]', err.message);
    res.status(500).json({ error: 'Could not submit application.' });
  }
});

// ── Campaigns ───────────────────────────────────────────────────────────────
router.post('/:brandId/campaigns', auth, async (req, res) => {
  const brandId = parseInt(req.params.brandId, 10);
  if (!(await assertBrandAccess(req, brandId))) return res.status(403).json({ error: 'Forbidden' });

  const { name, target_countries, starts_at, ends_at, daily_impression_cap } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Campaign name is required.' });

  const requested = Array.isArray(target_countries) ? target_countries : [];
  // Silently dropping banned markets would hide a compliance problem from the
  // advertiser. Reject loudly so they know what they asked for.
  const banned = requested.filter((c) => !jurisdictions.adsAllowed(c));
  if (banned.length) {
    return res.status(422).json({
      error: 'Alcohol advertising is not permitted in some of the markets you selected.',
      blocked: banned.map((c) => ({ country: c, reason: jurisdictions.rulesFor(c).note })),
    });
  }
  if (!requested.length) return res.status(400).json({ error: 'Select at least one market.' });

  try {
    const { lastInsertRowid } = await db.run(
      `INSERT INTO ad_campaigns (brand_id, name, status, target_countries, daily_impression_cap, starts_at, ends_at, created_at)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?)`,
      [
        brandId, name, JSON.stringify(requested.map((c) => String(c).toUpperCase())),
        Math.min(daily_impression_cap || delivery.DEFAULT_DAILY_CAP, delivery.DEFAULT_DAILY_CAP),
        starts_at || null, ends_at || null, Date.now(),
      ]
    );
    res.status(201).json({ ok: true, campaignId: lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Could not create campaign.' });
  }
});

// ── Creative — submitted for review, never auto-approved ────────────────────
router.post('/campaigns/:campaignId/creatives', auth, async (req, res) => {
  const campaignId = parseInt(req.params.campaignId, 10);
  const campaign = await db.get('SELECT id, brand_id FROM ad_campaigns WHERE id = ?', [campaignId]);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (!(await assertBrandAccess(req, campaign.brand_id))) return res.status(403).json({ error: 'Forbidden' });

  const { headline, body, image_url, cta_label, cta_url, factual_only } = req.body || {};
  if (!headline) return res.status(400).json({ error: 'Headline is required.' });

  // The same filter that screens user posts screens brand copy. An advertiser
  // gets no exemption from the rules against promoting unsafe drinking.
  const screen = screenContent(`${headline} ${body || ''}`);
  if (!screen.allowed) {
    return res.status(422).json({ error: `Creative rejected: ${screen.reason}`, flags: screen.flags });
  }

  try {
    const { lastInsertRowid } = await db.run(
      `INSERT INTO ad_creatives (campaign_id, headline, body, image_url, cta_label, cta_url, factual_only, review_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [campaignId, headline, body || '', image_url || '', cta_label || 'Learn more', cta_url || null,
       factual_only ? 1 : 0, Date.now()]
    );
    res.status(201).json({ ok: true, creativeId: lastInsertRowid, review_status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: 'Could not submit creative.' });
  }
});

// ── Admin: verification and creative review ─────────────────────────────────
router.get('/admin/queue', auth, requireAdmin, async (req, res) => {
  const brands = await db.all("SELECT * FROM brands WHERE status = 'pending' ORDER BY created_at DESC");
  const creatives = await db.all(
    `SELECT c.*, cam.name AS campaign_name, b.name AS brand_name
       FROM ad_creatives c
       JOIN ad_campaigns cam ON cam.id = c.campaign_id
       JOIN brands b ON b.id = cam.brand_id
      WHERE c.review_status = 'pending'
      ORDER BY c.created_at DESC`
  );
  res.json({ brands, creatives });
});

router.put('/admin/brands/:id', auth, requireAdmin, async (req, res) => {
  const { status, verified } = req.body || {};
  if (!['active', 'pending', 'rejected', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await db.run('UPDATE brands SET status = ?, verified = ? WHERE id = ?', [
    status, verified ? 1 : 0, req.params.id,
  ]);
  await logAdminAction(req.user.id, 'brand.review', {
    targetType: 'brand', targetId: req.params.id, detail: { status, verified: !!verified },
  });
  res.json({ ok: true });
});

router.put('/admin/creatives/:id', auth, requireAdmin, async (req, res) => {
  const { decision, note } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be approved or rejected' });
  }
  await db.run(
    'UPDATE ad_creatives SET review_status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
    [decision, note || null, req.user.id, Date.now(), req.params.id]
  );
  await logAdminAction(req.user.id, 'creative.review', {
    targetType: 'creative', targetId: req.params.id, detail: { decision, note },
  });
  res.json({ ok: true });
});

// ── Compliance reporting ────────────────────────────────────────────────────
// The evidence pack a brand's compliance team asks for: what share of the
// audience that saw this campaign was of legal age, and how many were verified.
router.get('/campaigns/:id/report', auth, async (req, res) => {
  const campaign = await db.get('SELECT id, brand_id, target_countries FROM ad_campaigns WHERE id = ?', [req.params.id]);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (!(await assertBrandAccess(req, campaign.brand_id))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const totals = await db.get(
      `SELECT
         SUM(CASE WHEN kind = 'impression' THEN 1 ELSE 0 END) AS impressions,
         SUM(CASE WHEN kind = 'click' THEN 1 ELSE 0 END) AS clicks,
         SUM(CASE WHEN kind = 'impression' AND age_assured = 1 THEN 1 ELSE 0 END) AS assured_impressions,
         COUNT(DISTINCT user_id) AS reach
       FROM ad_events WHERE campaign_id = ?`,
      [campaign.id]
    );

    let markets = [];
    try { markets = JSON.parse(campaign.target_countries || '[]'); } catch {}
    const composition = [];
    for (const m of markets) {
      const rules = jurisdictions.rulesFor(m);
      const c = await delivery.audienceComposition(m, rules.minAge);
      composition.push({
        country: m,
        legalAge: rules.minAge,
        requiredRatio: rules.adAudience,
        actualRatio: Number(c.ratio.toFixed(4)),
        meetsThreshold: rules.adAudience ? c.ratio >= rules.adAudience : true,
        audienceSampled: c.sampled,
        ageAssured: c.assured,
      });
    }

    const impressions = totals?.impressions || 0;
    res.json({
      campaignId: campaign.id,
      impressions,
      clicks: totals?.clicks || 0,
      reach: totals?.reach || 0,
      // The headline compliance number.
      verifiedAdultShare: impressions > 0
        ? Number(((totals?.assured_impressions || 0) / impressions).toFixed(4))
        : null,
      composition,
      note: 'Audience composition is computed from dates of birth collected at registration, not inferred demographics.',
    });
  } catch (err) {
    console.error('[brands/report]', err.message);
    res.status(500).json({ error: 'Could not build report.' });
  }
});

module.exports = router;
