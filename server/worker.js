// server/worker.js
// Cloudflare Workers entry point.
//
// Runs the same Express app as Node via `httpServerHandler`, which bridges
// node:http to the Workers fetch runtime. Requires the nodejs_compat flag —
// see wrangler.jsonc.
//
// Two things differ from Node and are handled here:
//   - static assets are served by the ASSETS binding, not express.static
//   - scheduled work runs on cron triggers, not setInterval

import { httpServerHandler } from 'cloudflare:node';
import { createApp } from './app.js';
import errorReporter from './lib/errorReporter.js';

const PORT = 8787;

const app = createApp({ isWorker: true });

// Error handler last, after every route.
app.use(errorReporter.expressHandler());

app.listen(PORT);

const httpHandler = httpServerHandler({ port: PORT });

// The schema is deliberately NOT created here.
//
// It used to be: ensureDb() ran db.init() on the first request of each isolate,
// on the theory that CREATE TABLE IF NOT EXISTS is free to repeat. That theory
// holds on Node. It does not hold on Workers.
//
// Every statement is an HTTP round trip to Turso, and a single Worker invocation
// may make at most 50 subrequests on the free plan. A full init() measures 76.
// So it was killed 26 statements short EVERY time — which is why production sat
// with a half-applied schema (places and admin_roles existed; blocked_users,
// age_checks, analytics_events and device_tokens did not).
//
// The worse half: init() ran BEFORE the route handler, so it spent the whole
// 50-subrequest budget on a doomed migration and left nothing for the request
// itself. Every /api call then failed on its first real query, while
// /api/health?deep=0 — which touches no database — happily answered 200. The
// error was caught and logged, so this looked like a database outage rather
// than a self-inflicted budget exhaustion.
//
// Schema is now applied out of band, from Node, where no such limit exists:
//     node scripts/sync-schema.js
// See CLOUDFLARE.md.

// A path with a file extension in its last segment is an asset request, not a
// client route. "/profile/42" is a route; "/assets/index-a1b2.js" is a file.
function looksLikeFile(pathname) {
  const last = pathname.split('/').pop() || '';
  return /\.[a-z0-9]{2,8}$/i.test(last);
}

// Content types we will serve back with their real type. Anything outside this
// list is downloaded as an opaque blob rather than rendered.
//
// This matters because uploads share an origin with the app. A file stored as
// image/svg+xml — or as text/html with an image extension — would otherwise run
// script under www.drinkedinn.com and could read the caller's session. So the
// type is derived from the extension here and never taken from stored metadata,
// which the uploader influences.
const SAFE_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', m4a: 'audio/mp4', mp3: 'audio/mpeg',
};

async function serveUpload(url, request, env) {
  const text = (body, status, extra = {}) =>
    new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...extra } });

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return text('Method not allowed', 405, { allow: 'GET, HEAD' });
  }
  if (!env.UPLOADS) return text('Uploads are not configured', 503);

  let key;
  try {
    key = decodeURIComponent(url.pathname.slice(1));
  } catch {
    return text('Bad request', 400);
  }
  // R2 keys are flat strings, so "../" has no traversal meaning to R2 itself —
  // rejected anyway so nothing downstream has to reason about it.
  if (key.length > 512 || key.includes('..') || key.includes('\\')) return text('Not found', 404);

  const object = await env.UPLOADS.get(key, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!object) return text('Not found', 404);

  const ext = (key.split('.').pop() || '').toLowerCase();
  const safeType = SAFE_TYPES[ext];

  const headers = new Headers();
  headers.set('content-type', safeType || 'application/octet-stream');
  headers.set('content-disposition', safeType ? 'inline' : 'attachment');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('x-content-type-options', 'nosniff');
  // Defence in depth: even if something slips past the type whitelist, it has
  // no script execution, no network and an opaque origin.
  headers.set('content-security-policy', "default-src 'none'; sandbox");

  // A failed `onlyIf` precondition yields metadata with no body — that is the
  // 304 case, and it must be detected by the missing body, not by re-reading
  // the request headers.
  if (!object.body) return new Response(null, { status: 304, headers });
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  const range = object.range;
  if (request.headers.has('range') && range && typeof range.offset === 'number' && typeof range.length === 'number') {
    headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }

  return new Response(object.body, { status: 200, headers });
}

export default {
  async fetch(request, env, ctx) {
    // Workers exposes bindings on `env`; the app reads process.env, which
    // nodejs_compat populates from vars and secrets. Anything that is a real
    // binding (R2, KV) has to be copied across explicitly.
    globalThis.__CF_ENV__ = env;

    const url = new URL(request.url);

    // User uploads live in R2, not in the asset bundle. Without this they fell
    // through to the SPA fallback below, so a missing image answered 200 with
    // an HTML page — an <img> would show as broken with no clue why, and a
    // cache would happily store the HTML under the image's URL.
    if (url.pathname.startsWith('/uploads/')) {
      return serveUpload(url, request, env);
    }

    // Everything under /api belongs to Express. Everything else is the SPA.
    //
    // The decision is made HERE rather than by reacting to the binding's
    // status, because the binding's not-found behaviour is not a clean 404:
    // it 307-redirects unknown paths, and even /index.html redirects to /.
    // Branching on those responses produced a redirect where the page should
    // have been. Classifying the path up front is deterministic.
    if (!url.pathname.startsWith('/api/') && env.ASSETS) {
      // A path naming a file is an asset request. Pass the binding's answer
      // through, including its 404 — handing back HTML for a missing script
      // makes the browser report "Unexpected token '<'", which points nowhere
      // near the real cause.
      if (looksLikeFile(url.pathname)) {
        const asset = await env.ASSETS.fetch(request);
        if (asset.status === 404) {
          return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
        }
        return asset;
      }

      // Anything else is a client route. Serve the SPA shell as the response to
      // this URL — not a redirect, so /profile/42 survives a hard refresh with
      // its path intact for the router to read.
      const shell = await env.ASSETS.fetch(new Request(new URL('/', request.url), {
        method: 'GET',
        headers: request.headers,
      }));
      if (!shell.ok) return shell;
      return new Response(shell.body, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          // The shell is rebuilt on every deploy and its asset URLs are
          // content-hashed, so it must never be cached as-is.
          'cache-control': 'no-cache',
        },
      });
    }

    return httpHandler.fetch(request, env, ctx);
  },

  // Cron triggers replace the timers Node used.
  async scheduled(event, env, ctx) {
    globalThis.__CF_ENV__ = env;
    ctx.waitUntil((async () => {
      try {
        if (event.cron === '0 16 * * *') {
          const { runLifecycleEmails } = await import('./lib/lifecycle.js');
          const result = await runLifecycleEmails({});
          console.log('lifecycle digest:', JSON.stringify(result));
        } else {
          const autopost = await import('./autopost.js');
          if (typeof autopost.runOnce === 'function') await autopost.runOnce();
        }
      } catch (e) {
        console.error('scheduled task failed:', e.message);
      }
    })());
  },
};
