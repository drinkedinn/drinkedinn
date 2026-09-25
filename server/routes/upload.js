// server/routes/upload.js
// Image upload. Buffers in memory, validates by content, strips location
// metadata, then persists to durable object storage.
//
// Previously this wrote to disk with multer's diskStorage and trusted the file
// extension. On Vercel that disk is ephemeral, so uploads vanished; and an
// extension check accepts anything renamed to .jpg.

const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const storage = require('../lib/storage');
const { sanitiseImage } = require('../lib/imageSafety');

const router = express.Router();

const MAX_BYTES = 8 * 1024 * 1024;

// Memory storage: nothing touches the filesystem, so there's no ephemeral-disk
// dependency and no partial file left behind if a request fails.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

router.post('/', auth, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'That image is over 8MB.'
        : 'Could not read that upload.';
      return res.status(400).json({ error: msg });
    }
    if (!req.file?.buffer) return res.status(400).json({ error: 'No image provided' });

    // Identify by magic bytes and strip EXIF (GPS lives there).
    const safe = sanitiseImage(req.file.buffer, MAX_BYTES);
    if (!safe.ok) return res.status(415).json({ error: safe.error });

    try {
      const saved = await storage.put(safe.buffer, {
        prefix: `u/${req.user.id}`,
        ext: safe.ext,
        contentType: safe.mime,
      });

      if (!storage.isDurable) {
        console.warn('[upload] stored on local disk — configure R2 before production');
      }
      res.json({ url: saved.url, key: saved.key });
    } catch (e) {
      console.error('[upload]', e.message);
      res.status(500).json({ error: 'Upload failed. Try again.' });
    }
  });
});

module.exports = router;
