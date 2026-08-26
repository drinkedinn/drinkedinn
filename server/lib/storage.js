// server/lib/storage.js
// Object storage for user uploads.
//
// WHY THIS EXISTS: uploads previously went to /tmp/uploads on Vercel, which is
// per-instance and ephemeral — every photo a user shared would disappear within
// minutes, silently. Cloudflare R2 is S3-compatible, has a generous free tier
// and, importantly for an image-heavy social app, charges no egress.
//
// Falls back to local disk when R2 isn't configured, so local development
// works with no credentials. The fallback refuses to run in production, because
// silently writing to ephemeral storage is exactly the bug this replaces.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');

const BUCKET = process.env.R2_BUCKET || '';
const ACCOUNT = process.env.R2_ACCOUNT_ID || '';
const KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const SECRET = process.env.R2_SECRET_ACCESS_KEY || '';
// Public base for serving objects: an r2.dev domain or your own CDN hostname.
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE || '').replace(/\/$/, '');

const useR2 = !!(BUCKET && ACCOUNT && KEY_ID && SECRET);

if (!useR2 && config.isProd) {
  console.error(
    '[storage] R2 is not configured in production. Uploads would be written to ' +
      'ephemeral disk and lost. Set R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
      'R2_SECRET_ACCESS_KEY and R2_PUBLIC_BASE.'
  );
}

let client = null;
function s3() {
  if (client) return client;
  const { S3Client } = require('@aws-sdk/client-s3');
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET },
  });
  return client;
}

const localDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '../uploads');

function newKey(prefix, ext) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}/${stamp}/${crypto.randomBytes(16).toString('hex')}${ext}`;
}

/**
 * Store an object and return the URL it will be served from.
 * @returns {Promise<{url: string, key: string, backend: 'r2'|'local'}>}
 */
async function put(buffer, { prefix = 'uploads', ext = '.jpg', contentType = 'application/octet-stream' } = {}) {
  const key = newKey(prefix, ext);

  if (useR2) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3().send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Long cache: keys are random and content never changes under a key.
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    const base = PUBLIC_BASE || `${config.publicBaseUrl}/uploads`;
    return { url: `${base}/${key}`, key, backend: 'r2' };
  }

  // Local fallback — development only.
  const full = path.join(localDir, key);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, buffer);
  return { url: `/uploads/${key}`, key, backend: 'local' };
}

/** Remove an object. Best-effort — never throws into a request. */
async function remove(key) {
  try {
    if (useR2) {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    } else {
      await fs.promises.unlink(path.join(localDir, key)).catch(() => {});
    }
  } catch (e) {
    console.error('[storage] delete failed', key, e.message);
  }
}

module.exports = { put, remove, useR2, localDir, isDurable: useR2 };
