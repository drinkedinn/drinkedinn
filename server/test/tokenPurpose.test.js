// server/test/tokenPurpose.test.js
// A valid signature is not authorisation. These pin the two rules that keep a
// single-purpose token from being spent as a session.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');

const { db, setup, makeUser } = require('./helpers');
const jwt = require('jsonwebtoken');
const config = require('../config');
const requireAuth = require('../middleware/auth');

// Minimal Express doubles — enough to see which branch the middleware took.
function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function run(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = fakeRes();
  let passed = false;
  await requireAuth(req, res, () => { passed = true; });
  return { passed, res, req };
}

describe('session token purpose', () => {
  let user;
  before(async () => {
    await setup();
    user = await makeUser();
  });

  test('a genuine session token is accepted', async () => {
    const token = jwt.sign(
      { sub: user.id, tv: user.token_version ?? 0, purpose: 'session' },
      config.jwtSecret
    );
    const { passed, req } = await run(token);
    assert.equal(passed, true);
    assert.equal(req.user.id, user.id);
  });

  test('a digest unsubscribe token is NOT a session token', async () => {
    // Exactly what lib/lifecycle.js mints for the footer of every
    // re-engagement email — same secret, same algorithm, 60-day life.
    const unsubscribe = jwt.sign(
      { sub: user.id, purpose: 'digest_unsub' },
      config.jwtSecret,
      { expiresIn: '60d' }
    );
    const { passed, res } = await run(unsubscribe);
    assert.equal(passed, false, 'unsubscribe token must not authenticate a session');
    assert.equal(res.statusCode, 401);
  });

  test('any unrecognised purpose is refused', async () => {
    const odd = jwt.sign({ sub: user.id, purpose: 'password_reset' }, config.jwtSecret);
    const { passed, res } = await run(odd);
    assert.equal(passed, false);
    assert.equal(res.statusCode, 401);
  });

  test('a legacy token with no purpose still works', async () => {
    // Tokens issued before the claim existed must not all be invalidated.
    const legacy = jwt.sign({ sub: user.id, tv: 0 }, config.jwtSecret);
    const { passed } = await run(legacy);
    assert.equal(passed, true);
  });
});

describe('revocation', () => {
  let user;
  before(async () => {
    await setup();
    user = await makeUser();
  });

  test('a token with no tv claim is still revoked by bumping token_version', async () => {
    // The old guard skipped the version check whenever `tv` was absent, so a
    // token predating the claim survived "sign out everywhere" and a password
    // change for its full lifetime.
    const noTv = jwt.sign({ sub: user.id }, config.jwtSecret);

    const before_ = await run(noTv);
    assert.equal(before_.passed, true, 'valid while token_version is still 0');

    await db.run('UPDATE users SET token_version = 1 WHERE id = ?', [user.id]);

    const after = await run(noTv);
    assert.equal(after.passed, false, 'must die once the version is bumped');
    assert.equal(after.res.body.error, 'Token revoked');
  });

  test('a session token is revoked when the version moves past it', async () => {
    const u = await makeUser();
    const token = jwt.sign({ sub: u.id, tv: 0, purpose: 'session' }, config.jwtSecret);
    assert.equal((await run(token)).passed, true);

    await db.run('UPDATE users SET token_version = 5 WHERE id = ?', [u.id]);
    const after = await run(token);
    assert.equal(after.passed, false);
    assert.equal(after.res.statusCode, 401);
  });
});

describe('signature', () => {
  test('a token signed with another secret is refused', async () => {
    await setup();
    const u = await makeUser();
    const forged = jwt.sign({ sub: u.id, purpose: 'session' }, 'not-the-real-secret-but-long-enough');
    const { passed, res } = await run(forged);
    assert.equal(passed, false);
    assert.equal(res.statusCode, 401);
  });

  test('an unsigned "alg: none" token is refused', async () => {
    await setup();
    const u = await makeUser();
    const none = jwt.sign({ sub: u.id, purpose: 'session' }, '', { algorithm: 'none' });
    const { passed, res } = await run(none);
    assert.equal(passed, false, 'algorithms are pinned to HS256');
    assert.equal(res.statusCode, 401);
  });
});
