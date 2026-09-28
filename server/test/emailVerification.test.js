// server/test/emailVerification.test.js
//
// Verification had three problems, none of which a test would have caught
// because nothing exercised the flow: the token was stored in plaintext, it
// never expired, and a second GET returned a raw JSON 400 in the browser —
// which is what a mail-security scanner causes by fetching the link before
// the human does. There was also no way to get a new link.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const { db, setup } = require('./helpers');

// Patched before routes/auth.js loads, which destructures at require time.
const mailer = require('../lib/mailer');
let captured = null;
mailer.sendVerificationEmail = async (to, link) => { captured = { to, link }; return { via: 'test' }; };

const http = require('http');
const { createApp } = require('../app');

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 2 * 60 * 1000;

let server, port;

function call(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      port, method, path,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (d) => { raw += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ code: res.statusCode, body: json, raw, location: res.headers.location || null });
      });
    });
    req.on('error', () => resolve({ code: 0, body: null, raw: '', location: null }));
    if (data) req.write(data);
    req.end();
  });
}

const tokenFrom = (link) => {
  assert.ok(link, 'no verification email was sent');
  return new URL(link).searchParams.get('token');
};

let email, session;

async function freshAccount(suffix) {
  email = `verify-${suffix}@example.com`;
  captured = null;
  const res = await call('POST', '/api/auth/register', {
    name: 'Verify Tester', email, password: 'Password12345', date_of_birth: '1990-05-05',
  });
  assert.equal(res.code, 201, `register failed: ${res.raw.slice(0, 120)}`);
  session = res.body.token;
  return { res, link: captured && captured.link };
}

// Lets the resend cooldown lapse without sleeping through it.
const passCooldown = () =>
  db.run('UPDATE users SET verify_sent_at = ? WHERE email = ?', [Date.now() - COOLDOWN_MS - 1000, email]);

before(async () => {
  await setup();
  server = http.createServer(createApp({ isWorker: false }));
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});

after(() => { if (server) server.close(); });

describe('email verification', () => {
  test('verifies once, and says so honestly at registration', async () => {
    const { res, link } = await freshAccount('happy');

    // The mailer is stubbed to report via:'test', so this must not claim
    // nothing was sent — and must not claim it was when the provider is a no-op.
    assert.equal(res.body.emailSent, true);
    assert.match(res.body.message, /Check your email/);

    const token = tokenFrom(link);

    // Plaintext storage would make a database read enough to verify anyone.
    const row = await db.get('SELECT verify_token FROM users WHERE email = ?', [email]);
    assert.notEqual(row.verify_token, token, 'the raw verify token is stored in the database');

    const hit = await call('GET', `/api/auth/verify?token=${token}`);
    assert.equal(hit.code, 302);
    assert.match(hit.location, /verified=1/);
    assert.equal(Number((await db.get('SELECT email_verified FROM users WHERE email = ?', [email])).email_verified), 1);
  });

  test('a second visit redirects instead of printing JSON at the user', async () => {
    // This is the scanner case: Safe Links et al. GET the link first, spend
    // the single-use token, and the human's click lands on the miss branch.
    const { link } = await freshAccount('scanner');
    const token = tokenFrom(link);

    await call('GET', `/api/auth/verify?token=${token}`);          // the scanner
    const human = await call('GET', `/api/auth/verify?token=${token}`);  // the user

    assert.equal(human.code, 302, 'a spent link still returns an error page');
    assert.match(human.location, /verified=already/);
    assert.ok(!human.raw.includes('"error"'), 'raw JSON was returned to a browser');
  });

  test('an expired link is refused', async () => {
    const { link } = await freshAccount('expired');
    const token = tokenFrom(link);
    await db.run('UPDATE users SET verify_sent_at = ? WHERE email = ?',
      [Date.now() - VERIFY_TTL_MS - 1000, email]);

    const hit = await call('GET', `/api/auth/verify?token=${token}`);
    assert.match(hit.location, /verified=expired/);
    assert.equal(Number((await db.get('SELECT email_verified FROM users WHERE email = ?', [email])).email_verified), 0);
  });

  test('a missing or garbage token redirects, never 500s', async () => {
    assert.match((await call('GET', '/api/auth/verify')).location, /verified=missing/);
    assert.match((await call('GET', '/api/auth/verify?token=nonsense')).location, /verified=already/);
  });

  describe('resend', () => {
    test('issues a new link and kills the old one', async () => {
      const { link } = await freshAccount('resend');
      const first = tokenFrom(link);

      await passCooldown();
      captured = null;
      const again = await call('POST', '/api/auth/resend-verification', {}, session);
      assert.equal(again.code, 200);
      assert.equal(again.body.emailSent, true);

      const second = tokenFrom(captured && captured.link);
      assert.notEqual(first, second);

      // The superseded link must not still verify the account.
      assert.match((await call('GET', `/api/auth/verify?token=${first}`)).location, /verified=already/);
      assert.match((await call('GET', `/api/auth/verify?token=${second}`)).location, /verified=1/);
    });

    test('is throttled', async () => {
      await freshAccount('throttle');
      await passCooldown();
      assert.equal((await call('POST', '/api/auth/resend-verification', {}, session)).code, 200);

      const immediate = await call('POST', '/api/auth/resend-verification', {}, session);
      assert.equal(immediate.code, 429, 'resend can be called in a loop');
    });

    test('is a no-op once the address is already verified', async () => {
      const { link } = await freshAccount('already');
      await call('GET', `/api/auth/verify?token=${tokenFrom(link)}`);

      await passCooldown();
      const res = await call('POST', '/api/auth/resend-verification', {}, session);
      assert.equal(res.code, 200);
      assert.equal(res.body.alreadyVerified, true);
    });

    test('needs a session', async () => {
      assert.equal((await call('POST', '/api/auth/resend-verification', {})).code, 401);
    });
  });
});
