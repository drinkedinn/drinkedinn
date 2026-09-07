// server/app.js
// The Express application, with nothing Node-server-specific in it.
//
// This file must run unchanged on BOTH Node and Cloudflare Workers, so it
// contains no http.createServer, no filesystem access, no WebSocket server and
// no timers. Those live in index.js (Node) and worker.js (Workers) respectively.
//
// IS_WORKER gates the few things that genuinely differ. Everything else — every
// route, all middleware, the whole API — is shared.

const express = require('express');
const cors = require('cors');
const { jsonBody } = require('./lib/jsonBody');

const IS_WORKER = typeof globalThis.caches !== 'undefined' && typeof globalThis.WebSocketPair !== 'undefined';

function createApp({ isWorker = IS_WORKER } = {}) {
  const app = express();

  // Behind Cloudflare (and previously Vercel), the client IP arrives in a
  // forwarded header. Without this, every request looks like it came from the
  // proxy and per-IP logic silently collapses to one bucket.
  app.set('trust proxy', 1);

  try {
    const helmet = require('helmet');
    app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  } catch {}

  // Rate limiting.
  // On Workers each isolate has its own memory, so an in-process limiter is
  // close to useless — edge rate limiting is configured in Cloudflare's
  // dashboard instead (see CLOUDFLARE.md). We keep it for Node/local, where it
  // does work, and skip it on Workers rather than pretend it's protecting us.
  if (!isWorker) {
    try {
      const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
      const clientIp = (req) => {
        const xff = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
        const ip = xff ? String(xff).split(',')[0].trim() : (req.ip || 'unknown');
        return ipKeyGenerator ? ipKeyGenerator(ip) : ip;
      };
      app.use('/api', rateLimit({
        windowMs: 15 * 60 * 1000, max: 1000,
        standardHeaders: true, legacyHeaders: false,
        keyGenerator: clientIp,
        message: { error: 'Too many requests.' },
      }));
      const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, max: 40,
        standardHeaders: true, legacyHeaders: false,
        keyGenerator: clientIp,
        message: { error: 'Too many auth attempts. Try again shortly.' },
      });
      app.use('/api/auth/login', authLimiter);
      app.use('/api/auth/register', authLimiter);
    } catch (e) {
      console.warn('rate limiter setup failed:', e.message);
    }
  }

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4173',
    'https://drinkedinn.com',
    'https://www.drinkedinn.com',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ];
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.some((o) => origin.startsWith(o))),
    credentials: true,
  }));

  // Portable JSON parsing. express.json() cannot be used here: it reaches
  // iconv-lite, which fails to bundle for Workers, and its stream handling
  // aborts every request against the Workers node:http shim. This preserves
  // req.rawBody, which webhook signature checks depend on.
  app.use(jsonBody({ limit: 1024 * 1024 }));

  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', runtime: isWorker ? 'workers' : 'node', ts: Date.now() })
  );

  // ── API routes ────────────────────────────────────────────────────────────
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/posts', require('./routes/posts'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/stories', require('./routes/stories'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/upload', require('./routes/upload'));
  app.use('/api/search', require('./routes/search'));
  app.use('/api/events', require('./routes/events'));
  app.use('/api/ratings', require('./routes/ratings'));
  app.use('/api/collection', require('./routes/collection'));
  app.use('/api/bucketlist', require('./routes/bucketlist'));
  app.use('/api/polls', require('./routes/polls'));
  app.use('/api/groups', require('./routes/groups'));
  app.use('/api/messages', require('./routes/messages'));
  app.use('/api/challenges', require('./routes/challenges'));
  app.use('/api/badges', require('./routes/badges'));
  app.use('/api/sommelier', require('./routes/sommelier'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/referrals', require('./routes/referrals'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/featured', require('./routes/featured'));
  app.use('/api/notifprefs', require('./routes/notifprefs'));
  app.use('/api/feed', require('./routes/feed'));
  app.use('/api/onboarding', require('./routes/onboarding'));
  app.use('/api/jobs', require('./routes/jobs'));
  app.use('/api/blocks', require('./routes/blocks'));
  app.use('/api/age', require('./routes/age'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/errors', require('./routes/errors'));

  // Brand/ads routes are optional — they only exist once that model is present.
  try { app.use('/api/brands', require('./routes/brands')); } catch {}
  try { app.use('/api/ads', require('./routes/ads')); } catch {}

  // AI agent system. Constructing the orchestrator performs I/O, which Workers
  // forbids at global scope, and it is an internal admin surface — so it is
  // simply not available there rather than failing noisily on every cold start.
  if (isWorker) return app;

  try {
    const Orchestrator = require('./agents/orchestrator');
    const db = require('./db');
    const orchestrator = new Orchestrator(db, {
      orgName: 'DrinkedInn',
      orgIndustry: 'Social / Beverages',
      maxAutoSpend: 500,
      llm: { provider: process.env.LLM_PROVIDER || 'simulation' },
    });
    app.use('/api/agents', require('./routes/agents')(orchestrator));
    app.locals.orchestrator = orchestrator;
  } catch (e) {
    console.warn('agent system unavailable:', e.message);
  }

  return app;
}

module.exports = { createApp, IS_WORKER };
