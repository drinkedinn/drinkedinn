// server/test/clientCountry.test.js
// Country resolution decides the age gate, the prohibited-territory block and
// whether alcohol ads may be served. A client must not be able to choose it.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { countryOf, trustedCountryOf, normalise, stripUntrustedGeoHeaders } =
  require('../lib/clientCountry');

const req = (headers) => ({ headers });

describe('countryOf', () => {
  test('uses the Cloudflare edge header', () => {
    assert.equal(countryOf(req({ 'cf-ipcountry': 'FR' })), 'FR');
  });

  test('IGNORES x-vercel-ip-country — a client can forge it on Cloudflare', () => {
    // The bypass this exists to prevent: India requires 25 and is ad-banned,
    // so claiming GB would buy an 18 gate and ad eligibility.
    const forged = req({ 'cf-ipcountry': 'IN', 'x-vercel-ip-country': 'GB' });
    assert.equal(countryOf(forged), 'IN', 'edge header must win');
  });

  test('a forged header alone does not establish a country', () => {
    assert.equal(countryOf(req({ 'x-vercel-ip-country': 'GB' })), '');
  });

  test('falls back to a self-declared value only when the edge is silent', () => {
    assert.equal(countryOf(req({}), 'de'), 'DE');
    assert.equal(countryOf(req({ 'cf-ipcountry': 'US' }), 'de'), 'US');
  });

  test('a self-declared value cannot override the edge', () => {
    assert.equal(countryOf(req({ 'cf-ipcountry': 'IN' }), 'GB'), 'IN');
  });

  test('placeholder codes are not treated as countries', () => {
    // XX = ungeolocatable, T1 = Tor. Neither has a drinking age.
    for (const code of ['XX', 'T1', 'A1', 'A2', 'O1']) {
      assert.equal(countryOf(req({ 'cf-ipcountry': code })), '', `${code} must not resolve`);
    }
  });

  test('junk input yields no country rather than a wrong one', () => {
    for (const v of [undefined, null, '', '1', 'GBR!', '<script>', 12, {}]) {
      assert.equal(normalise(v), '', `${JSON.stringify(v)} must normalise to ''`);
    }
  });

  test('a missing headers object does not throw', () => {
    assert.equal(countryOf({}), '');
    assert.equal(countryOf(undefined, 'FR'), 'FR');
  });
});

describe('trustedCountryOf', () => {
  test('never falls back to anything the user controls', () => {
    assert.equal(trustedCountryOf(req({}), 'GB'), '');
    assert.equal(trustedCountryOf(req({ 'x-vercel-ip-country': 'GB' })), '');
    assert.equal(trustedCountryOf(req({ 'cf-ipcountry': 'GB' })), 'GB');
  });
});

describe('stripUntrustedGeoHeaders', () => {
  test('removes the forgeable header before routes see it', () => {
    const r = req({ 'x-vercel-ip-country': 'GB', 'cf-ipcountry': 'IN' });
    let called = false;
    stripUntrustedGeoHeaders(r, {}, () => { called = true; });
    assert.equal(called, true);
    assert.equal(r.headers['x-vercel-ip-country'], undefined);
    assert.equal(r.headers['cf-ipcountry'], 'IN', 'the trustworthy one survives');
  });
});
