// Error capture. The scrubbing tests matter most: a token or password that
// reaches the error table is a breach, and error logs are where secrets
// classically end up.

const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { setup, db } = require('./helpers');
const reporter = require('../lib/errorReporter');

before(async () => { await setup(); });
beforeEach(async () => {
  await db.run('DELETE FROM error_reports');
  await db.run('DELETE FROM error_occurrences');
});

describe('scrubbing secrets', () => {
  const cases = [
    ['JWT', 'failed for eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.abcdefghijklmnop', 'eyJhbGci'],
    ['email', 'no user found for rahul@drinkedinn.app', '@drinkedinn.app'],
    ['bcrypt hash', 'compare failed $2a$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123', '$2a$12$'],
    ['IP address', 'connection refused from 203.0.113.42', '203.0.113'],
    ['password in a query string', 'POST /login?password=hunter2 failed', 'hunter2'],
    ['bearer token', 'Authorization: Bearer sk_live_abcdef123456', 'sk_live'],
    ['api key assignment', 'api_key="abcd1234efgh5678"', 'abcd1234efgh5678'],
    ['card number', 'charge failed for 4111 1111 1111 1111', '4111'],
  ];

  for (const [label, input, secret] of cases) {
    test(`removes ${label}`, () => {
      const out = reporter.scrub(input);
      assert.ok(!out.includes(secret), `leaked ${label}: ${out}`);
    });
  }

  test('keeps enough context to still be debuggable', () => {
    const out = reporter.scrub('TypeError: cannot read property id of undefined at getUser');
    assert.ok(out.includes('TypeError'));
    assert.ok(out.includes('getUser'), 'function names must survive scrubbing');
  });

  test('handles null and empty input', () => {
    assert.strictEqual(reporter.scrub(null), null);
    assert.strictEqual(reporter.scrub(''), null);
  });
});

describe('grouping', () => {
  test('the same bug with different ids is one group', () => {
    const a = reporter.fingerprintOf({ source: 'server', message: 'Post 41 not found', route: 'GET /api/posts/41' });
    const b = reporter.fingerprintOf({ source: 'server', message: 'Post 92 not found', route: 'GET /api/posts/92' });
    assert.strictEqual(a, b, 'ids must be normalised out of the fingerprint');
  });

  test('genuinely different bugs are different groups', () => {
    const a = reporter.fingerprintOf({ source: 'server', message: 'Post not found', route: 'GET /api/posts/1' });
    const b = reporter.fingerprintOf({ source: 'server', message: 'Database unreachable', route: 'GET /api/posts/1' });
    assert.notStrictEqual(a, b);
  });

  test('the same message from different sources is separated', () => {
    const a = reporter.fingerprintOf({ source: 'server', message: 'Network error' });
    const b = reporter.fingerprintOf({ source: 'mobile', message: 'Network error' });
    assert.notStrictEqual(a, b, 'a server bug and a client bug are not the same bug');
  });
});

describe('recording', () => {
  test('repeats increment a count rather than creating rows', async () => {
    for (let i = 0; i < 5; i += 1) {
      await reporter.report({ source: 'server', message: 'Boom', route: 'GET /api/x' });
    }
    const rows = await db.all("SELECT * FROM error_reports WHERE source = 'server'");
    assert.strictEqual(rows.length, 1, 'five occurrences must be one row');
    assert.strictEqual(rows[0].count, 5);
  });

  test('counts distinct users affected, not occurrences', async () => {
    await reporter.report({ source: 'server', message: 'Boom', route: 'GET /api/y', userId: 1 });
    await reporter.report({ source: 'server', message: 'Boom', route: 'GET /api/y', userId: 1 });
    await reporter.report({ source: 'server', message: 'Boom', route: 'GET /api/y', userId: 2 });

    const row = await db.get("SELECT * FROM error_reports WHERE route = 'GET /api/y'");
    assert.strictEqual(row.count, 3, 'three occurrences');
    assert.strictEqual(row.users_affected, 2, 'but only two people');
  });

  test('a resolved error reopens when it happens again', async () => {
    const r = await reporter.report({ source: 'server', message: 'Regression', route: 'GET /api/z' });
    await db.run("UPDATE error_reports SET status = 'resolved' WHERE fingerprint = ?", [r.fingerprint]);

    await reporter.report({ source: 'server', message: 'Regression', route: 'GET /api/z' });
    const row = await db.get('SELECT status FROM error_reports WHERE fingerprint = ?', [r.fingerprint]);
    assert.strictEqual(row.status, 'open', 'if it is back, it is not fixed');
  });

  test('secrets never reach the stored row', async () => {
    await reporter.report({
      source: 'server',
      message: 'Auth failed for rahul@drinkedinn.app with token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.signature123',
      stack: 'at verify (auth.js:12) password=hunter2',
      route: 'POST /api/auth/login',
    });
    const row = await db.get("SELECT * FROM error_reports WHERE route = 'POST /api/auth/login'");
    const blob = `${row.message} ${row.stack}`;
    assert.ok(!blob.includes('@drinkedinn.app'), 'email leaked into storage');
    assert.ok(!blob.includes('eyJhbGci'), 'JWT leaked into storage');
    assert.ok(!blob.includes('hunter2'), 'password leaked into storage');
  });

  test('never throws, even on rubbish input', async () => {
    await assert.doesNotReject(() => reporter.report({}));
    await assert.doesNotReject(() => reporter.report({ message: null, stack: undefined }));
    await assert.doesNotReject(() => reporter.report({ source: 'server', error: new Error('real') }));
  });
});
