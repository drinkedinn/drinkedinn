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

// Workers has no startup hook, and async I/O is forbidden at global scope, so
// the schema is ensured on the first request and cached for the isolate's life.
// Every statement is CREATE TABLE IF NOT EXISTS / ALTER guarded, so repeats are
// free. Production schema changes should still be applied deliberately —
// see CLOUDFLARE.md.
let dbReady = null;
function ensureDb() {
  if (!dbReady) {
    dbReady = import('./db.js')
      .then((m) => (m.init ? m.init() : m.default?.init?.()))
      .catch((e) => { dbReady = null; throw e; });
  }
  return dbReady;
}

export default {
  async fetch(request, env, ctx) {
    // Workers exposes bindings on `env`; the app reads process.env, which
    // nodejs_compat populates from vars and secrets. Anything that is a real
    // binding (R2, KV) has to be copied across explicitly.
    globalThis.__CF_ENV__ = env;

    const url = new URL(request.url);

    // Only API routes touch the database; static assets must not pay for it.
    if (url.pathname.startsWith('/api/')) {
      try { await ensureDb(); } catch (e) { console.error('db init failed:', e.message); }
    }

    // Everything under /api belongs to Express. Everything else is the SPA,
    // served from the ASSETS binding — with a fallback to index.html so client
    // routes like /profile/42 don't 404 on a hard refresh.
    if (!url.pathname.startsWith('/api/') && env.ASSETS) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }

    return httpHandler.fetch(request, env, ctx);
  },

  // Cron triggers replace the timers Node used.
  async scheduled(event, env, ctx) {
    globalThis.__CF_ENV__ = env;
    await ensureDb().catch((e) => console.error('db init failed:', e.message));

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
