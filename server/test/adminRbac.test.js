// server/test/adminRbac.test.js
// Least privilege, and the guarantees that must not regress.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { ROLE_NAMES, ROLES, permissionsFor, HIGH_IMPACT, isValidRole, PERMISSIONS } =
  require('../lib/permissions');
const { flooredPriority } = require('../routes/moderation');
const { evaluate, bucketOf } = require('../routes/flags');

describe('roles', () => {
  test('every role grants only real permissions', () => {
    const known = new Set(PERMISSIONS);
    for (const role of ROLE_NAMES) {
      for (const p of ROLES[role]) {
        assert.ok(known.has(p), `${role} grants unknown permission "${p}"`);
      }
    }
  });

  test('only owner can hand out roles', () => {
    const canGrant = ROLE_NAMES.filter((r) => permissionsFor(r).has('roles.write'));
    assert.deepEqual(canGrant, ['owner'],
      'a compromised super_admin must not be able to mint more admins');
  });

  test('support and marketing cannot ban, delete or remove content', () => {
    for (const role of ['support', 'marketing', 'analytics', 'finance', 'read_only']) {
      const p = permissionsFor(role);
      for (const forbidden of ['users.ban', 'users.delete', 'content.remove', 'roles.write']) {
        assert.ok(!p.has(forbidden), `${role} must not have ${forbidden}`);
      }
    }
  });

  test('a moderator can act on content but not on the rules', () => {
    const p = permissionsFor('moderator');
    assert.ok(p.has('content.remove'));
    assert.ok(p.has('reports.action'));
    assert.ok(!p.has('compliance.publish'), 'moderators must not rewrite jurisdiction rules');
    assert.ok(!p.has('users.ban'));
    assert.ok(!p.has('flags.write'));
  });

  test('compliance can propose but not publish alone', () => {
    const p = permissionsFor('compliance');
    assert.ok(p.has('compliance.propose'));
    assert.ok(!p.has('compliance.publish'));
  });

  test('destructive permissions are marked high-impact so a reason is demanded', () => {
    for (const p of ['users.delete', 'users.ban', 'roles.write', 'compliance.publish', 'flags.write']) {
      assert.ok(HIGH_IMPACT.has(p), `${p} must require a typed reason`);
    }
  });

  test('an unknown role is rejected', () => {
    assert.ok(!isValidRole('administrator'));
    assert.ok(!isValidRole(''));
    assert.ok(isValidRole('moderator'));
  });
});

describe('moderation priority floor', () => {
  test('child-safety reports cannot be triaged below P0', () => {
    assert.equal(flooredPriority('csae: something', 'P3'), 'P0');
    assert.equal(flooredPriority('CSAE', 'P2'), 'P0');
  });

  test('self-harm is P0 and threats are at least P1', () => {
    assert.equal(flooredPriority('self_harm concern', 'P3'), 'P0');
    assert.equal(flooredPriority('threat of violence', 'P3'), 'P1');
  });

  test('ordinary reports keep the requested priority', () => {
    assert.equal(flooredPriority('spam', 'P3'), 'P3');
    assert.equal(flooredPriority('other', 'P2'), 'P2');
  });

  test('an invalid priority falls back to P2, not to nothing', () => {
    assert.equal(flooredPriority('spam', 'URGENT'), 'P2');
    assert.equal(flooredPriority('spam', undefined), 'P2');
  });
});

describe('feature flags', () => {
  const user = { id: 42, is_admin: 0, country_code: 'GB' };

  test('the kill switch beats every form of targeting', () => {
    const flag = {
      key: 'f', enabled: 0, rollout_pct: 100,
      targeting: JSON.stringify({ user_ids: [42], staff_only: false }),
    };
    assert.equal(evaluate(flag, user), false, 'enabled=0 must win over an explicit allow-list');
  });

  test('100% on means on, 0% means off', () => {
    assert.equal(evaluate({ key: 'f', enabled: 1, rollout_pct: 100, targeting: '{}' }, user), true);
    assert.equal(evaluate({ key: 'f', enabled: 1, rollout_pct: 0, targeting: '{}' }, user), false);
  });

  test('bucketing is deterministic for a user/flag pair', () => {
    const a = bucketOf('alpha', 42);
    assert.equal(a, bucketOf('alpha', 42), 'a user must not flip between requests');
    assert.ok(a >= 0 && a < 100);
  });

  test('bucketing differs per flag, so one cohort does not get every experiment', () => {
    const keys = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    const buckets = keys.map((k) => bucketOf(k, 42));
    assert.ok(new Set(buckets).size > 1, 'the same user must not sit at the same percentile everywhere');
  });

  test('country targeting excludes non-matching countries', () => {
    const flag = { key: 'f', enabled: 1, rollout_pct: 100, targeting: JSON.stringify({ countries: ['US'] }) };
    assert.equal(evaluate(flag, user), false);
    assert.equal(evaluate(flag, { ...user, country_code: 'US' }), true);
  });

  test('malformed targeting JSON does not throw', () => {
    assert.doesNotThrow(() =>
      evaluate({ key: 'f', enabled: 1, rollout_pct: 100, targeting: '{not json' }, user));
  });
});
