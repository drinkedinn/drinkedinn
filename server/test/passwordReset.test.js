// server/test/passwordReset.test.js
//
// These routes did not exist until now, while client/src/api.js had listed
// /auth/forgot-password and /auth/reset-password among its credential checks
// the whole time and the password_resets table sat unused in db.js. So the
// feature was a 404 behind a working-looking button, and the mobile fallback
// told people to email a domain that is not registered.
//
// Because none of it had ever run, this exercises the whole flow over real
// HTTP rather than asserting on internals: a reset is only "working" if the
// old password stops working and the new one starts.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

// helpers must load FIRST — it sets TURSO_DB_URL and JWT_SECRET, and both db
// and config read process.env at module load.
const { db, setup } = require('./helpers');

// Patched BEFORE routes/auth.js is required, because that file destructures
// sendResetEmail at load time; patching later would leave it holding the real
// one and the suite would try to send mail.
const mailer = require('../lib/mailer');
let captured = null;
mailer.sendResetEmail = async (to, link) => { captured = { to, link }; return { via: 'test' }; };

const http = require('http');
const password = require('../lib/password');
const { createApp } = require('../app');

const EMAIL = 'resettest@example.com';
const OLD = 'OldPassword123';
const NEW = 'BrandNewPassword456';

let server;
let port;

function call(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        port, method, path,
        headers: data
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }
          : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (d) => { raw += d; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(raw); } catch {}
          resolve({ code: res.statusCode, body: json, raw });
        });
      }
    );
    req.on('error', () => resolve({ code: 0, body: null, raw: '' }));
    if (data) req.write(data);
    req.end();
  });
}

const tokenFrom = (link) => {
  assert.ok(link, 'no reset email was sent — was the request throttled?');
  return new URL(link).searchParams.get('token');
};

// forgot-password will not send twice inside RESEND_COOLDOWN_MS. The tests
// below legitimately need several links in a row, so this models time passing
// rather than sleeping through it.
//
// password_resets has no created_at; expires_at is created + RESET_TTL_MS, so
// winding expires_at back is what makes a row look older. The value chosen
// leaves the row comfortably UNEXPIRED (about 58 minutes to run) while placing
// its creation just outside the cooldown — otherwise a test meant to prove a
// link was superseded would pass because it had expired instead.
const RESET_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

async function passCooldown() {
  await db.run(
    'UPDATE password_resets SET expires_at = ? WHERE used = 0',
    [Date.now() + RESET_TTL_MS - RESEND_COOLDOWN_MS - 1000]
  );
}

async function requestReset(email = EMAIL) {
  await passCooldown();
  captured = null;
  const res = await call('POST', '/api/auth/forgot-password', { email });
  return { res, link: captured && captured.link };
}

before(async () => {
  await setup();
  await db.run('DELETE FROM users WHERE email = ?', [EMAIL]);
  await db.run(
    'INSERT INTO users (name, email, password, onboarded, email_verified) VALUES (?, ?, ?, 1, 1)',
    ['Reset Tester', EMAIL, await password.hash(OLD)]
  );
  server = http.createServer(createApp({ isWorker: false }));
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});

after(() => { if (server) server.close(); });

describe('password reset', () => {
  test('emails a link that actually changes the password', async () => {
    const { res, link } = await requestReset();
    assert.equal(res.code, 200);
    assert.ok(link, 'no reset email was sent');
    assert.ok(link.startsWith('https://'), `link is not absolute: ${link}`);
    assert.ok(link.includes('/reset-password?token='), `unexpected link shape: ${link}`);

    const token = tokenFrom(link);
    assert.ok(token && token.length >= 32, 'token too short to be unguessable');

    // The emailed token must not be recoverable from the database.
    const row = await db.get('SELECT token FROM password_resets ORDER BY id DESC LIMIT 1');
    assert.notEqual(row.token, token, 'raw reset token is stored in the database');

    const done = await call('POST', '/api/auth/reset-password', { token, password: NEW });
    assert.equal(done.code, 200);
    assert.ok(done.body.token, 'reset did not return a session token');

    // The only assertions that really matter.
    assert.equal((await call('POST', '/api/auth/login', { email: EMAIL, password: NEW })).code, 200);
    assert.equal((await call('POST', '/api/auth/login', { email: EMAIL, password: OLD })).code, 401);
  });

  test('a token is single use', async () => {
    const { link } = await requestReset();
    const token = tokenFrom(link);
    assert.equal((await call('POST', '/api/auth/reset-password', { token, password: 'FirstUse12345' })).code, 200);

    const replay = await call('POST', '/api/auth/reset-password', { token, password: 'ReplayAttempt12345' });
    assert.equal(replay.code, 400, 'a spent token was accepted a second time');
    assert.equal(
      (await call('POST', '/api/auth/login', { email: EMAIL, password: 'ReplayAttempt12345' })).code,
      401,
      'the replayed password was actually set'
    );
  });

  test('requesting a new link invalidates the previous one', async () => {
    const first = tokenFrom((await requestReset()).link);
    const second = tokenFrom((await requestReset()).link);
    assert.notEqual(first, second);
    assert.equal((await call('POST', '/api/auth/reset-password', { token: first, password: 'StaleLink12345' })).code, 400);
    assert.equal((await call('POST', '/api/auth/reset-password', { token: second, password: 'FreshLink12345' })).code, 200);
  });

  test('an expired token is refused', async () => {
    const token = tokenFrom((await requestReset()).link);
    await db.run('UPDATE password_resets SET expires_at = ? WHERE used = 0', [Date.now() - 1000]);
    assert.equal((await call('POST', '/api/auth/reset-password', { token, password: 'TooLate12345' })).code, 400);
  });

  test('does not reveal whether an address has an account', async () => {
    // Otherwise this endpoint is a membership oracle for the whole user table.
    const known = await call('POST', '/api/auth/forgot-password', { email: EMAIL });
    const unknown = await call('POST', '/api/auth/forgot-password', { email: 'nobody-here@example.com' });
    assert.equal(known.code, unknown.code);
    assert.equal(known.raw, unknown.raw);
  });

  test('clears a login lockout, which is how people get locked out in the first place', async () => {
    await db.run('UPDATE users SET failed_logins = 8, locked_until = ? WHERE email = ?',
      [Date.now() + 900_000, EMAIL]);

    const token = tokenFrom((await requestReset()).link);
    assert.equal((await call('POST', '/api/auth/reset-password', { token, password: 'AfterLockout12345' })).code, 200);

    const user = await db.get('SELECT failed_logins, locked_until FROM users WHERE email = ?', [EMAIL]);
    assert.equal(Number(user.failed_logins), 0, 'failed_logins survived the reset');
    assert.ok(!user.locked_until, 'the account is still locked after a successful reset');

    assert.equal(
      (await call('POST', '/api/auth/login', { email: EMAIL, password: 'AfterLockout12345' })).code,
      200,
      'reset succeeded but the account is still unusable'
    );
  });

  test('will not send a second link inside the cooldown', async () => {
    // Without this the endpoint mails an arbitrary address as fast as it can be
    // called. express-rate-limit does not cover it: app.js mounts the limiter
    // inside `if (!isWorker)`, and production is Workers — so the throttle has
    // to live in the database to mean anything.
    await requestReset();                       // passCooldown, then one send
    captured = null;
    const second = await call('POST', '/api/auth/forgot-password', { email: EMAIL });

    assert.equal(second.code, 200, 'throttling must not be visible in the status');
    assert.equal(captured, null, 'a second email was sent inside the cooldown');
  });

  test('throttling does not invalidate the link already in the inbox', async () => {
    // A double-click must not supersede the link the user already has and then
    // decline to send a replacement, which would leave them with nothing.
    const token = tokenFrom((await requestReset()).link);
    await call('POST', '/api/auth/forgot-password', { email: EMAIL });   // throttled

    const done = await call('POST', '/api/auth/reset-password', { token, password: 'StillValid12345' });
    assert.equal(done.code, 200, 'the original link stopped working after a throttled retry');
  });

  test('rejects garbage input', async () => {
    assert.equal((await call('POST', '/api/auth/reset-password', { token: 'not-a-real-token', password: 'Whatever12345' })).code, 400);
    assert.equal((await call('POST', '/api/auth/reset-password', { token: 'x', password: 'short' })).code, 400);
    assert.equal((await call('POST', '/api/auth/reset-password', { password: 'NoTokenAtAll12345' })).code, 400);
  });
});
