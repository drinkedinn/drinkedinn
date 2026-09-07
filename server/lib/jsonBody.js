// server/lib/jsonBody.js
// JSON body parsing that works on both Node and Cloudflare Workers.
//
// WHY NOT express.json():
// body-parser reaches raw-body, which reaches iconv-lite, which fails to bundle
// for Workers. Aliasing iconv-lite fixes the build, but body-parser's stream
// handling then aborts every request at runtime against the Workers node:http
// shim ("BadRequestError: request aborted"). Reading the stream directly works
// on both runtimes.
//
// This is deliberately narrower than express.json(): UTF-8 only, no automatic
// gzip decoding. Both clients send plain UTF-8 JSON, and quietly accepting more
// than that was never a feature we used.
//
// req.rawBody is preserved verbatim — webhook signatures are computed over the
// exact received bytes, and a re-serialised object would not reproduce them.

const DEFAULT_LIMIT = 1024 * 1024; // 1MB

function jsonBody({ limit = DEFAULT_LIMIT } = {}) {
  return function jsonBodyMiddleware(req, res, next) {
    const method = req.method || 'GET';
    if (method === 'GET' || method === 'HEAD') { req.body = {}; return next(); }

    const contentType = String(req.headers['content-type'] || '');
    if (!contentType.includes('application/json')) {
      // req.body must always be an object. Leaving it undefined meant every
      // handler that destructures it (`const { email } = req.body`) threw a
      // TypeError inside an async function — and Express 4 does not forward
      // async rejections, so no error handler ran and no response was ever
      // written. A POST to /auth/login with a missing or wrong Content-Type
      // simply hung until the client gave up.
      req.body = {};
      return next();
    }

    let size = 0;
    const chunks = [];
    let settled = false;

    // The stream can emit end and error in either order on Workers; settle once.
    const settle = (fn) => { if (settled) return; settled = true; fn(); };

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        return settle(() => {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Request body is too large.' }));
        });
      }
      chunks.push(chunk);
    });

    req.on('end', () => settle(() => {
      const raw = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
      req.rawBody = raw;

      if (!raw.length) { req.body = {}; return next(); }

      try {
        req.body = JSON.parse(raw.toString('utf8'));
        next();
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Malformed JSON.' }));
      }
    }));

    // A dropped connection must not hang the request. Continue with an empty
    // body and let route validation reject it.
    req.on('error', () => settle(() => { req.body = {}; next(); }));
  };
}

module.exports = { jsonBody };
