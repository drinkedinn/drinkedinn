// Ad eligibility. Every paid alcohol placement passes through eligibleFor(),
// so a regression here is a regulatory exposure rather than a UX bug.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { setup, makeUser, db } = require('./helpers');
const delivery = require('../lib/adDelivery');

before(async () => { await setup(); });

describe('refusals', () => {
  test('never serves where advertising is banned', async () => {
    for (const cc of ['IN', 'NO', 'SE']) {
      const u = await makeUser({ country_code: cc, age_assurance_level: 1, age: 40 });
      const r = await delivery.eligibleFor(u, cc);
      assert.strictEqual(r.eligible, false, `${cc} must refuse`);
      assert.strictEqual(r.reason, 'ads_banned_in_market');
    }
  });

  test('never serves in a prohibited territory', async () => {
    const u = await makeUser({ country_code: 'SA', age_assurance_level: 1, age: 40 });
    const r = await delivery.eligibleFor(u, 'SA');
    assert.strictEqual(r.eligible, false);
    assert.strictEqual(r.reason, 'territory_prohibited');
  });

  test('applies the LOCAL purchase age, not a global 18', async () => {
    const u = await makeUser({ country_code: 'US', age_assurance_level: 1, age: 19 });
    const r = await delivery.eligibleFor(u, 'US');
    assert.strictEqual(r.eligible, false, 'a 19-year-old in the US is under 21');
    assert.strictEqual(r.reason, 'under_local_purchase_age');
  });

  test('self-declared age is not enough for a paid placement', async () => {
    const u = await makeUser({ country_code: 'GB', age_assurance_level: 0, age: 40 });
    const r = await delivery.eligibleFor(u, 'GB');
    assert.strictEqual(r.eligible, false);
    assert.strictEqual(r.reason, 'age_not_assured');
  });

  test('the member opt-out beats every commercial consideration', async () => {
    const u = await makeUser({ country_code: 'GB', age_assurance_level: 2, age: 40, brand_content_opt_out: 1 });
    const r = await delivery.eligibleFor(u, 'GB');
    assert.strictEqual(r.eligible, false);
    assert.strictEqual(r.reason, 'user_opted_out', 'opt-out must be checked before anything else');
  });

  test('an unknown date of birth fails closed', async () => {
    const u = await makeUser({ country_code: 'GB', age_assurance_level: 1, date_of_birth: null });
    const r = await delivery.eligibleFor(u, 'GB');
    assert.strictEqual(r.eligible, false);
    assert.strictEqual(r.reason, 'age_unknown');
  });
});

describe('approvals', () => {
  test('a verified adult in an ad-legal market is eligible', async () => {
    const u = await makeUser({ country_code: 'GB', age_assurance_level: 1, age: 30 });
    const r = await delivery.eligibleFor(u, 'GB');
    assert.strictEqual(r.eligible, true, r.reason);
  });

  test('a verified 25-year-old passes the US 21 threshold', async () => {
    const u = await makeUser({ country_code: 'US', age_assurance_level: 1, age: 25 });
    const r = await delivery.eligibleFor(u, 'US');
    assert.strictEqual(r.eligible, true, r.reason);
  });

  test('restricted markets are eligible but flagged, so only factual creative runs', async () => {
    const u = await makeUser({ country_code: 'FR', age_assurance_level: 1, age: 30 });
    const r = await delivery.eligibleFor(u, 'FR');

    // Loi Evin permits factual product information but not lifestyle advertising.
    // Blocking France outright would be wrong; the creative gate does the work.
    assert.strictEqual(r.eligible, true, 'a factual creative is lawful in France');
    assert.strictEqual(r.restricted, true, 'must be flagged so the serve route can require factual_only');
  });

  test('an unrestricted market is not flagged as restricted', async () => {
    const u = await makeUser({ country_code: 'GB', age_assurance_level: 1, age: 30 });
    const r = await delivery.eligibleFor(u, 'GB');
    assert.strictEqual(r.restricted, false);
  });
});

describe('frequency capping', () => {
  test('stops at the daily cap and reports it', async () => {
    const u = await makeUser({ country_code: 'GB', age_assurance_level: 1, age: 30 });

    for (let i = 0; i < delivery.DEFAULT_DAILY_CAP; i += 1) {
      const r = await delivery.eligibleFor(u, 'GB');
      assert.strictEqual(r.eligible, true, `impression ${i + 1} should be allowed`);
      await delivery.record('impression', {
        creativeId: 1, campaignId: 1, userId: u.id, country: 'GB', assured: true,
      });
    }

    const over = await delivery.eligibleFor(u, 'GB');
    assert.strictEqual(over.eligible, false);
    assert.strictEqual(over.reason, 'daily_cap_reached');
  });

  test('a campaign cannot raise the cap above the platform default', async () => {
    const u = await makeUser({ country_code: 'GB', age_assurance_level: 1, age: 30 });
    for (let i = 0; i < delivery.DEFAULT_DAILY_CAP; i += 1) {
      await delivery.record('impression', {
        creativeId: 1, campaignId: 2, userId: u.id, country: 'GB', assured: true,
      });
    }
    // A greedy campaign asking for 99/day must still be capped.
    const r = await delivery.eligibleFor(u, 'GB', { campaign: { daily_impression_cap: 99 } });
    assert.strictEqual(r.eligible, false, 'campaign settings must not exceed the platform cap');
    assert.strictEqual(r.reason, 'daily_cap_reached');
  });
});

describe('audience composition', () => {
  test('reports the of-age share for a market', async () => {
    const c = await delivery.audienceComposition('GB', 18);
    assert.ok(c.sampled >= 0);
    assert.ok(c.ratio >= 0 && c.ratio <= 1, 'ratio must be a proportion');
  });

  test('an empty market reports zero rather than dividing by zero', async () => {
    const c = await delivery.audienceComposition('ZZ', 18);
    assert.strictEqual(c.sampled, 0);
    assert.strictEqual(c.ratio, 0, 'must fail closed, not NaN');
  });
});
