// The pre-publish moderation gate. Apple 1.4.3 rejects apps that encourage
// excessive drinking, so a false negative here is a store risk — but a false
// positive silences a legitimate member, which is its own failure.

const { test, describe } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-32';
const { screenContent } = require('../lib/contentFilter');

const blocked = (s) => screenContent(s).allowed === false;
const allowed = (s) => screenContent(s).allowed === true;

describe('unsafe drinking is blocked', () => {
  test('drink driving in its common phrasings', () => {
    assert.ok(blocked('drinking and driving home lol'));
    assert.ok(blocked('drunk driving again'));
    assert.ok(blocked('drank then drove back'));
  });

  test('rapid-consumption challenges', () => {
    assert.ok(blocked('beer bong at the party'));
    assert.ok(blocked('who wants to chug a pint'));
    assert.ok(blocked('shotgunning these'));
    assert.ok(blocked('chugging contest tonight'));
  });

  test('volume challenges', () => {
    assert.ok(blocked('10 shots in an hour'));
    assert.ok(blocked('24 beers in one night'));
  });

  test('glorifying blackout drinking', () => {
    assert.ok(blocked('got blackout drunk again'));
  });

  test('minors and alcohol, in either word order', () => {
    assert.ok(blocked('gave my kid a beer haha'));
    assert.ok(blocked('underage drinking is fine'));
  });

  test('named drinking games', () => {
    assert.ok(blocked('power hour starts now'));
    assert.ok(blocked('neknomination time'));
  });
});

describe('hate and abuse are blocked', () => {
  test('self-harm encouragement', () => {
    assert.ok(blocked('kys'));
    assert.ok(blocked('go kill yourself'));
  });
});

describe('ordinary drink talk is allowed', () => {
  const fine = [
    'Lovely Yamazaki 18 tonight, no rush.',
    'Great natural wine from Bordeaux #wine',
    'Laphroaig 10 is peaty and medicinal — if you know, you know.',
    'Shared a bottle with friends over a long dinner.',
    'This mocktail is genuinely better than the cocktail.',
    'The nose is all sherry and dried fruit.',
    'Had a pint after work and watched the sunset.',
  ];
  for (const s of fine) {
    test(`allows: ${s.slice(0, 44)}`, () => {
      assert.ok(allowed(s), `wrongly blocked: ${s}`);
    });
  }
});

describe('false positives that would silence real members', () => {
  test('the word "shot" in an innocent context is not a challenge', () => {
    assert.ok(allowed('That photo is a great shot.'));
    assert.ok(allowed('Espresso shot with dessert.'));
  });

  test('discussing responsible drinking is not itself unsafe', () => {
    assert.ok(allowed('Please never drink and then get behind a wheel — call a cab.'),
      'a responsible-drinking message must not be blocked');
  });
});

describe('structural limits', () => {
  test('over-long posts are rejected', () => {
    assert.ok(blocked('a'.repeat(6000)));
  });

  test('empty input is allowed — emptiness is the caller\'s validation, not the filter\'s', () => {
    assert.ok(allowed(''));
  });

  test('a blocked result always explains itself', () => {
    const r = screenContent('beer bong');
    assert.strictEqual(r.allowed, false);
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0, 'must carry a user-facing reason');
    assert.ok(Array.isArray(r.flags) && r.flags.length > 0, 'must carry a machine-readable flag');
  });
});

describe('soft flags surface without blocking', () => {
  test('links are flagged but permitted', () => {
    const r = screenContent('Read more at https://example.com');
    assert.strictEqual(r.allowed, true);
    assert.ok(r.flags.includes('contains a link'));
  });
});
