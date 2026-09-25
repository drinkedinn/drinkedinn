// Upload sanitisation. Two independent risks: serving back something that
// isn't an image, and publishing the GPS coordinates of a member's home.

const { test, describe } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-32';
const { sniff, stripJpegMetadata, sanitiseImage } = require('../lib/imageSafety');

// A valid minimal JPEG carrying an EXIF (APP1) segment with GPS text.
function jpegWithExif() {
  const exif = Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from('GPSLatitude:51.5074 GPSLongitude:-0.1278')]);
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1]),
    Buffer.from([(exif.length + 2) >> 8, (exif.length + 2) & 0xff]),
    exif,
  ]);
  const sofBody = Buffer.from([0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x11, 0x00]);
  const sof = Buffer.concat([Buffer.from([0xff, 0xc0]), Buffer.from([0, sofBody.length + 2]), sofBody]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, sof, sos]);
}

describe('identification by content, not filename', () => {
  test('recognises the formats we accept', () => {
    assert.strictEqual(sniff(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]))?.mime, 'image/jpeg');
    assert.strictEqual(sniff(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]))?.mime, 'image/png');
    assert.strictEqual(sniff(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)]))?.mime, 'image/gif');
    assert.strictEqual(sniff(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]))?.mime, 'image/webp');
  });

  test('rejects executable content renamed to an image extension', () => {
    assert.strictEqual(sniff(Buffer.from('<?php system($_GET[0]); ?>          ')), null);
    assert.strictEqual(sniff(Buffer.from('#!/bin/sh\nrm -rf /                 ')), null);
  });

  test('rejects SVG — it can carry script and is not a raster format', () => {
    assert.strictEqual(sniff(Buffer.from('<svg onload=alert(1)>               ')), null);
  });

  test('rejects HTML that merely starts with image-ish bytes', () => {
    assert.strictEqual(sniff(Buffer.from('<html><body>hello</body></html>     ')), null);
  });

  test('rejects truncated input rather than guessing', () => {
    assert.strictEqual(sniff(Buffer.from([0xff, 0xd8])), null, 'too short to identify');
    assert.strictEqual(sniff(Buffer.alloc(0)), null);
    assert.strictEqual(sniff('not a buffer'), null);
  });
});

describe('EXIF stripping', () => {
  test('removes GPS coordinates from a JPEG', () => {
    const original = jpegWithExif();
    assert.ok(original.includes('GPSLatitude'), 'fixture must actually contain GPS');

    const cleaned = stripJpegMetadata(original);
    assert.ok(!cleaned.includes('GPSLatitude'), 'latitude must be gone');
    assert.ok(!cleaned.includes('GPSLongitude'), 'longitude must be gone');
    assert.ok(!cleaned.includes('Exif'), 'the EXIF marker itself must be gone');
  });

  test('the result is still a decodable JPEG', () => {
    const cleaned = stripJpegMetadata(jpegWithExif());
    assert.strictEqual(cleaned[0], 0xff);
    assert.strictEqual(cleaned[1], 0xd8, 'must retain SOI');
    const hex = cleaned.toString('hex');
    assert.ok(hex.includes('ffc0'), 'must retain the frame header');
    assert.ok(hex.includes('ffda'), 'must retain the scan header');
    assert.ok(hex.endsWith('ffd9'), 'must retain EOI');
  });

  test('image data survives untouched', () => {
    const cleaned = stripJpegMetadata(jpegWithExif());
    assert.ok(cleaned.toString('hex').includes('1234'), 'compressed scan data must be preserved');
  });

  test('a malformed JPEG is returned UNCHANGED rather than truncated', () => {
    // Keeping metadata is far better than corrupting someone's photo.
    const malformed = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0xff]), Buffer.from('truncated')]);
    const out = stripJpegMetadata(malformed);
    assert.ok(out.equals(malformed), 'must fall back to the original on a bad segment table');
  });

  test('non-JPEG formats pass through untouched', () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('data')]);
    assert.ok(stripJpegMetadata(png).equals(png));
  });
});

describe('sanitiseImage', () => {
  test('accepts a real image and returns cleaned bytes', () => {
    const r = sanitiseImage(jpegWithExif());
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.mime, 'image/jpeg');
    assert.strictEqual(r.ext, '.jpg');
    assert.ok(!r.buffer.includes('GPSLatitude'), 'must return stripped bytes, not the original');
  });

  test('rejects oversized uploads', () => {
    const r = sanitiseImage(Buffer.alloc(9 * 1024 * 1024));
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /MB/);
  });

  test('rejects empty input', () => {
    assert.strictEqual(sanitiseImage(Buffer.alloc(0)).ok, false);
  });

  test('rejects a non-image with a helpful message', () => {
    const r = sanitiseImage(Buffer.from('<?php echo 1; ?>                    '));
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /JPEG|PNG|GIF|WebP/i);
  });
});
