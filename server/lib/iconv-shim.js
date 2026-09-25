// Minimal iconv-lite replacement for the Workers bundle.
// raw-body only needs getCodec/decode/encodingExists, and this API speaks UTF-8
// JSON exclusively. Anything non-UTF-8 is rejected rather than mis-decoded.
const SUPPORTED = new Set(['utf8', 'utf-8', 'ascii', 'us-ascii', 'latin1', 'binary', 'iso-8859-1', 'ucs2', 'utf16le']);
const norm = (e) => String(e || 'utf-8').toLowerCase().replace(/[^a-z0-9]/g, '') || 'utf8';
function encodingExists(enc) { return SUPPORTED.has(String(enc || '').toLowerCase()) || SUPPORTED.has(norm(enc)); }
function getCodec(enc) { if (!encodingExists(enc)) return undefined; return { name: norm(enc) }; }
function decode(buf, enc) {
  const n = norm(enc);
  const nodeEnc = n === 'latin1' || n === 'binary' || n === 'iso88591' ? 'latin1'
    : n === 'ucs2' || n === 'utf16le' ? 'utf16le'
    : n === 'ascii' || n === 'usascii' ? 'ascii' : 'utf8';
  return Buffer.isBuffer(buf) ? buf.toString(nodeEnc) : Buffer.from(buf).toString(nodeEnc);
}
function encode(str, enc) { return Buffer.from(String(str), norm(enc) === 'latin1' ? 'latin1' : 'utf8'); }
module.exports = { encodingExists, getCodec, decode, encode, getDecoder: getCodec, getEncoder: getCodec };
