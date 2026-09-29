// server/test/uploadPath.test.js
//
// The URL an upload hands back must be one the Worker can actually serve.
// Those are two separate pieces of code that agreed by convention and nothing
// else, and they drifted: routes/upload.js stored under `u/<id>/…` while
// worker.js routes to R2 only for paths beginning /uploads/. Every photo
// posted from the app got a URL that fell through to the SPA asset handler
// and 404'd — a permanently broken image on the first post a reviewer makes.
//
// These pin the contract on both sides.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const UPLOAD_DIR = path.join(os.tmpdir(), `di-upload-test-${process.pid}`);
process.env.UPLOAD_DIR = UPLOAD_DIR;

const storage = require('../lib/storage');

// Exactly what worker.js does: route only /uploads/*, then take the R2 key as
// the pathname minus its leading slash.
const WORKER_PREFIX = '/uploads/';
const keyFromPath = (pathname) => decodeURIComponent(pathname.slice(1));

describe('upload path contract', () => {
  test('the returned URL is on the path the Worker routes to R2', async () => {
    const saved = await storage.put(Buffer.from('not-really-a-jpeg'), {
      prefix: 'uploads/u/42',
      ext: '.jpg',
      contentType: 'image/jpeg',
    });

    const pathname = saved.url.startsWith('http') ? new URL(saved.url).pathname : saved.url;

    assert.ok(
      pathname.startsWith(WORKER_PREFIX),
      `upload URL ${pathname} does not start with ${WORKER_PREFIX}, so worker.js will never hand it to R2`
    );

    // serveUpload looks the object up under exactly this key.
    assert.equal(
      keyFromPath(pathname),
      saved.key,
      'the path the client requests does not resolve to the key the object was stored under'
    );

    assert.ok(!pathname.includes('/uploads/uploads/'), 'the prefix was applied twice');
  });

  test('the route asks for a prefix that satisfies that contract', () => {
    // Asserted against the source because the prefix is the single value that
    // decides whether an image is reachable, and it is easy to "tidy" back.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'upload.js'), 'utf8');
    const match = src.match(/prefix:\s*`([^`]+)`/);
    assert.ok(match, 'routes/upload.js no longer passes a prefix to storage.put');
    assert.ok(
      match[1].startsWith('uploads/'),
      `upload.js passes prefix \`${match[1]}\`, which does not start with "uploads/" — ` +
        'the resulting URL will 404 because worker.js only routes /uploads/* to R2'
    );
  });

  test('a bare prefix is still served sensibly rather than silently double-prefixed', async () => {
    const saved = await storage.put(Buffer.from('x'), { prefix: 'misc', ext: '.png', contentType: 'image/png' });
    const pathname = saved.url.startsWith('http') ? new URL(saved.url).pathname : saved.url;
    assert.ok(!pathname.includes('/uploads/uploads/'), 'double-prefixed');
    assert.equal(keyFromPath(pathname).endsWith(saved.key), true);
  });
});

test.after(() => {
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
});
