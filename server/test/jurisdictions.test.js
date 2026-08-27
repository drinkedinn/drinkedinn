// Per-country rules. These decide who may sign up and where alcohol brand
// content may be shown — getting one wrong is a legal problem, not a bug.

const { test, describe } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-32';
const j = require('../lib/jurisdictions');

describe('minimum age by market', () => {
  test('United States is 21, not 18', () => {
    assert.strictEqual(j.minAgeFor('US'), 21);
  });

  test('markets with a higher-than-18 age are correct', () => {
    assert.strictEqual(j.minAgeFor('CA'), 19, 'Canada');
    assert.strictEqual(j.minAgeFor('JP'), 20, 'Japan');
    assert.strictEqual(j.minAgeFor('NO'), 20, 'Norway');
    assert.strictEqual(j.minAgeFor('SE'), 20, 'Sweden');
  });

  test('split-age markets take the HIGHER value, since the platform covers spirits', () => {
    // Germany allows beer/wine at 16 but spirits at 18.
    assert.strictEqual(j.minAgeFor('DE'), 18);
    assert.strictEqual(j.minAgeFor('BE'), 18);
  });

  test('unlisted countries fall back to conservative defaults, never to zero', () => {
    const r = j.rulesFor('ZZ');
    assert.strictEqual(r.listed, false);
    assert.ok(r.minAge >= 18, 'default age must not be permissive');
    assert.notStrictEqual(r.ads, 'allowed', 'must not permit ads in an unknown market');
  });

  test('an empty or malformed country code still returns a safe rule', () => {
    for (const input of ['', null, undefined, '!!', 'toolong']) {
      const r = j.rulesFor(input);
      assert.ok(r.minAge >= 18, `unsafe age for input ${JSON.stringify(input)}`);
    }
  });
});

describe('advertising legality', () => {
  test('advertising is banned where the law bans it', () => {
    for (const cc of ['IN', 'NO', 'SE']) {
      assert.strictEqual(j.adsAllowed(cc), false, `${cc} must not permit alcohol advertising`);
    }
  });

  test('France is restricted rather than allowed — Loi Evin permits factual only', () => {
    assert.strictEqual(j.rulesFor('FR').ads, 'restricted');
    assert.strictEqual(j.adsAllowed('FR'), false, 'restricted must not pass the allowed check');
  });

  test('core launch markets permit advertising', () => {
    for (const cc of ['GB', 'US', 'AU', 'CA', 'DE']) {
      assert.strictEqual(j.adsAllowed(cc), true, `${cc} should be sellable`);
    }
  });

  test('markets that allow ads carry an audience threshold', () => {
    assert.strictEqual(j.rulesFor('US').adAudience, 0.738, 'DISCUS / Beer Institute standard');
    assert.ok(j.rulesFor('GB').adAudience > 0);
  });
});

describe('prohibited territories', () => {
  test('the platform refuses to operate where alcohol is prohibited', () => {
    assert.strictEqual(j.isProhibited('SA'), true);
    assert.strictEqual(j.isProhibited('PK'), true);
  });

  test('normal markets are not prohibited', () => {
    for (const cc of ['GB', 'US', 'IN', 'DE']) {
      assert.strictEqual(j.isProhibited(cc), false, `${cc} should be operable`);
    }
  });

  test('India is operable but never advertisable', () => {
    assert.strictEqual(j.isProhibited('IN'), false);
    assert.strictEqual(j.adsAllowed('IN'), false);
  });
});

describe('case and whitespace handling', () => {
  test('lowercase and padded codes resolve identically', () => {
    assert.strictEqual(j.minAgeFor('us'), 21);
    assert.strictEqual(j.minAgeFor('  gb '), 18);
  });
});
