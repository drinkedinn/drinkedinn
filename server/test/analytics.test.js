// Analytics. Two things must hold: the numbers are right, and member content
// can never leak into the event store.

const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { setup, db } = require('./helpers');
const a = require('../lib/analytics');

const DAY = 86400000;

before(async () => { await setup(); });
beforeEach(async () => { await db.run('DELETE FROM analytics_events'); });

const seed = (userId, name, daysAgo, props) =>
  db.run('INSERT INTO analytics_events (user_id, name, props, created_at) VALUES (?, ?, ?, ?)',
    [userId, name, props ? JSON.stringify(props) : null, Date.now() - daysAgo * DAY]);

describe('privacy: prop whitelisting', () => {
  test('drops keys that are not declared for the event', async () => {
    await a.track('post_created', {
      userId: 501,
      props: { has_image: true, content: 'MY PRIVATE POST TEXT', drink: '🍺' },
    });
    const row = await db.get('SELECT props FROM analytics_events WHERE user_id = 501');
    assert.ok(!row.props.includes('PRIVATE'), 'member content must never be stored');
    assert.ok(row.props.includes('has_image'), 'declared props must survive');
  });

  test('rejects unknown event names outright', async () => {
    const r = await a.track('exfiltrate_everything', { userId: 502 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'unknown_event');
    const row = await db.get('SELECT COUNT(*) c FROM analytics_events WHERE user_id = 502');
    assert.strictEqual(row.c, 0, 'nothing should have been written');
  });

  test('discards long strings, objects and arrays', async () => {
    await a.track('search_performed', {
      userId: 503,
      props: { tab: 'x'.repeat(200), has_results: { nested: 'object' } },
    });
    const row = await db.get('SELECT props FROM analytics_events WHERE user_id = 503');
    assert.ok(!row.props || !row.props.includes('xxxxxxxxxx'), 'long strings must be dropped');
    assert.ok(!row.props || !row.props.includes('nested'), 'objects must be dropped');
  });

  test('never stores an IP address field even if passed', async () => {
    await a.track('app_opened', { userId: 504, props: { platform: 'ios', ip: '203.0.113.5' } });
    const row = await db.get('SELECT props FROM analytics_events WHERE user_id = 504');
    assert.ok(!row.props.includes('203.0.113'), 'IP must never be persisted');
  });
});

describe('active user counts', () => {
  test('counts distinct users, not events', async () => {
    await seed(1, 'app_opened', 0);
    await seed(1, 'app_opened', 0);
    await seed(2, 'app_opened', 0);
    assert.strictEqual(await a.activeUsers(1), 2, 'two people, three events');
  });

  test('respects the window boundary', async () => {
    await seed(1, 'app_opened', 0);
    await seed(2, 'app_opened', 3);
    await seed(3, 'app_opened', 20);
    assert.strictEqual(await a.activeUsers(1), 1);
    assert.strictEqual(await a.activeUsers(7), 2);
    assert.strictEqual(await a.activeUsers(30), 3);
  });
});

describe('cohort retention', () => {
  test('computes day-1, day-7 and day-30 correctly', async () => {
    // 10 signed up 40 days ago; 6 returned on day 1, 3 on day 7, 1 on day 30.
    for (let u = 1; u <= 10; u += 1) await seed(u, 'signup_completed', 40);
    for (let u = 1; u <= 6; u += 1) await seed(u, 'app_opened', 39);
    for (let u = 1; u <= 3; u += 1) await seed(u, 'app_opened', 33);
    await seed(1, 'app_opened', 10);

    const r = await a.retention([1, 7, 30]);
    assert.strictEqual(r.cohortSize, 10);
    assert.strictEqual(r.points[0].returned, 6, 'day 1');
    assert.strictEqual(r.points[1].returned, 3, 'day 7');
    assert.strictEqual(r.points[2].returned, 1, 'day 30');
    assert.strictEqual(r.points[0].ratio, 0.6);
  });

  test('the cohort window outlasts the furthest offset', async () => {
    // Regression: a fixed 30-day window can never contain anyone eligible for
    // day-30 retention, so the metric silently read 0% forever.
    const r = await a.retention([1, 7, 30]);
    assert.ok(r.windowDays > 30, `window ${r.windowDays} must exceed the furthest offset`);
  });

  test('excludes members who have not yet had the chance to return', async () => {
    // Signed up yesterday — cannot possibly have a day-30 datapoint.
    await seed(1, 'signup_completed', 1);
    const r = await a.retention([1, 30]);
    assert.strictEqual(r.points[1].eligible, 0, 'must not be counted against day 30');
    assert.strictEqual(r.points[1].ratio, null, 'no denominator means no ratio, not zero');
  });

  test('an empty cohort returns a consistent shape rather than throwing', async () => {
    const r = await a.retention([1, 7]);
    assert.strictEqual(r.cohortSize, 0);
    assert.strictEqual(r.points.length, 2);
    assert.strictEqual(r.points[0].eligible, 0);
    assert.strictEqual(r.points[0].ratio, null);
  });
});

describe('funnel', () => {
  test('reports step counts and drop-off', async () => {
    for (let u = 1; u <= 10; u += 1) await seed(u, 'signup_completed', 2);
    for (let u = 1; u <= 5; u += 1) await seed(u, 'post_created', 1);

    const f = await a.funnel(['signup_completed', 'post_created'], 30);
    assert.strictEqual(f[0].count, 10);
    assert.strictEqual(f[1].count, 5);
    assert.strictEqual(f[1].fromPrevious, 0.5, 'half dropped off');
  });

  test('a zero-count step does not divide by zero', async () => {
    const f = await a.funnel(['signup_completed', 'subscription_started'], 30);
    assert.strictEqual(f[1].count, 0);
    assert.ok(Number.isFinite(f[1].fromPrevious) || f[1].fromPrevious === 0);
  });
});
