// server/lib/imageSafety.js
// Two jobs, both security rather than cosmetics:
//
// 1. Identify the file by its CONTENT, not its name. A file called photo.jpg
//    can be anything; trusting the extension is how hosts end up serving
//    executable content back to their own users.
//
// 2. Strip EXIF from JPEGs. Phone cameras embed GPS coordinates by default, so
//    a photo taken at home carries the user's home address. On a social app
//    that is a serious privacy leak, and users never expect it.

const SIGNATURES = [
  { mime: 'image/jpeg', ext: '.jpg',  test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png',  ext: '.png',  test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/gif',  ext: '.gif',  test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    mime: 'image/webp', ext: '.webp',
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/**
 * Identify an image from its magic bytes.
 * @returns {{mime: string, ext: string}|null} null if it isn't an image we accept
 */
function sniff(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  for (const s of SIGNATURES) {
    if (s.test(buffer)) return { mime: s.mime, ext: s.ext };
  }
  return null;
}

/**
 * Remove every APPn metadata segment from a JPEG — EXIF (APP1) carries GPS,
 * device serial and timestamps. Other formats are returned untouched: PNG and
 * WebP can also carry metadata, but rewriting them safely needs a real decoder,
 * and returning the original is better than returning a corrupted file.
 *
 * Walks the JPEG segment table rather than pattern-matching, so it can't
 * accidentally cut into entropy-coded image data.
 */
function stripJpegMetadata(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;

  const out = [buffer.subarray(0, 2)]; // SOI
  let i = 2;
  let reachedScan = false; // only a complete walk produces a usable result

  while (i < buffer.length - 1) {
    if (buffer[i] !== 0xff) break; // lost the marker boundary

    const marker = buffer[i + 1];

    // Start of Scan: everything from here is compressed image data.
    if (marker === 0xda) {
      out.push(buffer.subarray(i));
      reachedScan = true;
      break;
    }
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(buffer.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (i + 4 > buffer.length) break;
    const length = buffer.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > buffer.length) break; // malformed segment

    const isMetadata = marker >= 0xe0 && marker <= 0xef; // APP0..APP15
    const isComment = marker === 0xfe;                    // COM
    if (!isMetadata && !isComment) {
      out.push(buffer.subarray(i, i + 2 + length));
    }
    i += 2 + length;
  }

  // If the walk didn't reach the scan data, we cannot trust what we assembled —
  // a truncated image is far worse than one that kept its metadata. Return the
  // original untouched and let the caller decide.
  if (!reachedScan) return buffer;

  const cleaned = Buffer.concat(out);
  return cleaned.length > 4 ? cleaned : buffer;
}

/**
 * Validate and sanitise an uploaded image.
 * @returns {{ok: true, buffer: Buffer, mime: string, ext: string} | {ok: false, error: string}}
 */
function sanitiseImage(buffer, maxBytes = 8 * 1024 * 1024) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: 'Empty file.' };
  }
  if (buffer.length > maxBytes) {
    return { ok: false, error: `Images must be under ${Math.round(maxBytes / 1024 / 1024)}MB.` };
  }

  const kind = sniff(buffer);
  if (!kind) {
    return { ok: false, error: 'That file isn’t a JPEG, PNG, GIF or WebP image.' };
  }

  const cleaned = kind.mime === 'image/jpeg' ? stripJpegMetadata(buffer) : buffer;
  return { ok: true, buffer: cleaned, mime: kind.mime, ext: kind.ext };
}

module.exports = { sniff, stripJpegMetadata, sanitiseImage };
