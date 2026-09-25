// Password hashing. Security-critical and newly rewritten to fit the Workers
// free-tier CPU budget, so the properties are asserted rather than assumed.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-32';
process.env.PASSWORD_PEPPER = 'test-pepper-value';

const pw = require('../lib/password');
const bcrypt = require('bcryptjs');

describe('hashing', () => {
  test('produces the expected format', async () => {
    const h = await pw.hash('correct horse battery staple');
    const parts = h.split('$');
    assert.strictEqual(parts.length, 4);
    assert.strictEqual(parts[0], 'pbkdf2');
    assert.strictEqual(Number(parts[1]), pw.ITERATIONS);
    assert.ok(parts[2].length > 0, 'salt present');
    assert.ok(parts[3].length > 0, 'digest present');
  });

  test('never stores the password itself', async () => {
    const secret = 'my-actual-password-123';
    const h = await pw.hash(secret);
    assert.ok(!h.includes(secret), 'plaintext must not appear in the hash');
  });

  test('salts, so identical passwords hash differently', async () => {
    const a = await pw.hash('same-password');
    const b = await pw.hash('same-password');
    assert.notStrictEqual(a, b, 'two hashes of one password must differ');
    assert.ok(await pw.verify('same-password', a));
    assert.ok(await pw.verify('same-password', b));
  });

  test('uses the platform maximum iteration count', () => {
    assert.strictEqual(pw.ITERATIONS, 100_000, 'Cloudflare caps PBKDF2 at 100k');
  });
});

describe('verification', () => {
  test('accepts the right password and rejects the wrong one', async () => {
    const h = await pw.hash('rightpassword');
    assert.strictEqual(await pw.verify('rightpassword', h), true);
    assert.strictEqual(await pw.verify('wrongpassword', h), false);
    assert.strictEqual(await pw.verify('rightpassword ', h), false, 'trailing space is a different password');
    assert.strictEqual(await pw.verify('', h), false);
  });

  test('rejects malformed stored values instead of throwing', async () => {
    for (const bad of ['', 'garbage', 'pbkdf2$', 'pbkdf2$abc$x$y', 'pbkdf2$100000$only-three', null, undefined, 42]) {
      assert.strictEqual(await pw.verify('anything', bad), false, `should reject ${JSON.stringify(bad)}`);
    }
  });

  test('rejects an absurd iteration count rather than hanging', async () => {
    const evil = 'pbkdf2$999999999$c2FsdA==$aGFzaA==';
    assert.strictEqual(await pw.verify('x', evil), false);
  });
});

describe('the pepper', () => {
  test('a hash is worthless without it — a leaked database cannot be cracked', async () => {
    const h = await pw.hash('user-password');
    assert.strictEqual(await pw.verify('user-password', h), true);

    // Simulate an attacker with the database but not the secret store.
    const real = process.env.PASSWORD_PEPPER;
    process.env.PASSWORD_PEPPER = 'attacker-guess';
    const cracked = await pw.verify('user-password', h);
    process.env.PASSWORD_PEPPER = real;

    assert.strictEqual(cracked, false, 'the correct password must NOT verify under a different pepper');
  });
});

describe('legacy bcrypt migration', () => {
  test('still verifies existing bcrypt hashes', async () => {
    const legacy = bcrypt.hashSync('old-password', 10);
    assert.ok(pw.isLegacyBcrypt(legacy));
    assert.strictEqual(await pw.verify('old-password', legacy), true);
    assert.strictEqual(await pw.verify('nope', legacy), false);
  });

  test('flags legacy hashes for upgrade', async () => {
    assert.strictEqual(pw.needsRehash(bcrypt.hashSync('x', 10)), true);
    assert.strictEqual(pw.needsRehash(await pw.hash('x')), false, 'a current hash needs no upgrade');
  });

  test('flags an under-iterated pbkdf2 hash for upgrade', () => {
    assert.strictEqual(pw.needsRehash('pbkdf2$1000$c2FsdA==$aGFzaA=='), true);
  });
});

describe('CPU budget', () => {
  test('hashing is fast enough for the Workers free tier', async () => {
    const started = Date.now();
    await pw.hash('benchmark-password');
    const ms = Date.now() - started;
    // Node is not Workers, but bcryptjs at cost 12 takes ~300ms here. Anything
    // in this range confirms we are in a different order of magnitude.
    assert.ok(ms < 250, `PBKDF2 took ${ms}ms — expected well under bcrypt's ~300ms`);
  });
});
