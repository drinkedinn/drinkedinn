require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Required for correct client IPs in rate limiting behind Vercel's proxy
app.set('trust proxy', 1);

// Security headers (second layer behind vercel.json)
try {
  const helmet = require('helmet');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
} catch {}

// WebSocket for agent real-time updates
let wss;
try {
  const { WebSocketServer } = require('ws');
  wss = new WebSocketServer({ server });
} catch {
  console.log('⚠️  ws package not installed — agent real-time updates disabled');
}

// Rate limiting (optional dep)
// Key by the real client IP from X-Forwarded-For (Vercel's edge sets this).
// Without a custom key generator the in-memory limiter buckets ALL users under
// one key on serverless, which locks everyone out once the ceiling is hit.
try {
  const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
  const clientIp = (req) => {
    const xff = req.headers['x-forwarded-for'];
    const ip = xff ? String(xff).split(',')[0].trim() : (req.ip || 'unknown');
    return ipKeyGenerator ? ipKeyGenerator(ip) : ip;
  };
  // Generous global ceiling — per IP. Brute-force is handled by account lockout.
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000, max: 1000,
    standardHeaders: true, legacyHeaders: false,
    keyGenerator: clientIp,
    message: { error: 'Too many requests.' },
  }));
  // Tighter, but only on the credential endpoints (login/register), per IP.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 40,
    standardHeaders: true, legacyHeaders: false,
    keyGenerator: clientIp,
    message: { error: 'Too many auth attempts. Try again shortly.' },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
} catch (e) {
  console.warn('⚠️  rate limiter setup failed:', e.message);
}

// On Vercel, /var/task is read-only — use /tmp/uploads instead
const uploadsDir = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.warn('⚠️  Could not create uploads dir:', e.message);
}

// On Vercel: kick off DB init immediately at module load (non-blocking).
// All API requests wait for this promise before being processed.
const db = require('./db');
let _dbReady = null;
if (process.env.VERCEL) {
  _dbReady = db.init().catch(e => console.error('DB init error:', e.message));
}

const allowedOrigins = [
  'http://localhost:3000',
  'https://drinkedinn.com',
  'https://www.drinkedinn.com',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.some(o => origin.startsWith(o))),
  credentials: true
}));
// Keep the exact received bytes. Webhook signatures are computed over the raw
// body — re-serialising the parsed object would change it and every signature
// check would fail.
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use('/uploads', express.static(uploadsDir));

// Wait for DB to be ready before processing any request (Vercel cold start)
app.use(async (req, res, next) => {
  if (_dbReady) { try { await _dbReady; } catch {} }
  next();
});

// Health check for Railway / Vercel
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Serve promo video page
app.use('/promo', express.static(path.join(__dirname, '../promo')));

// Existing DrinkedInn routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/posts',       require('./routes/posts'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/stories',     require('./routes/stories'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/upload',      require('./routes/upload'));
app.use('/api/search',      require('./routes/search'));
app.use('/api/events',      require('./routes/events'));
app.use('/api/ratings',     require('./routes/ratings'));
app.use('/api/collection',  require('./routes/collection'));
app.use('/api/bucketlist',  require('./routes/bucketlist'));
app.use('/api/polls',       require('./routes/polls'));
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/messages',    require('./routes/messages'));
app.use('/api/challenges',  require('./routes/challenges'));
app.use('/api/badges',      require('./routes/badges'));
app.use('/api/sommelier',   require('./routes/sommelier'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/referrals',   require('./routes/referrals'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/featured',    require('./routes/featured'));
app.use('/api/notifprefs',  require('./routes/notifprefs'));
app.use('/api/feed',        require('./routes/feed'));
app.use('/api/onboarding',  require('./routes/onboarding'));
app.use('/api/jobs',        require('./routes/jobs'));
app.use('/api/blocks',      require('./routes/blocks'));
app.use('/api/age',         require('./routes/age'));
app.use('/api/ads',         require('./routes/ads'));
app.use('/api/brands',      require('./routes/brands'));

// ===== AI Agent System =====
const Orchestrator = require('./agents/orchestrator');
const orchestrator = new Orchestrator(db, {
  orgName: 'DrinkedInn',
  orgIndustry: 'Social / Beverages',
  maxAutoSpend: 500,
  llm: { provider: process.env.LLM_PROVIDER || 'simulation' }
});

// Agent API routes
const agentRoutes = require('./routes/agents')(orchestrator);
app.use('/api/agents', agentRoutes);

// WebSocket connections for agent dashboard
if (wss) {
  wss.on('connection', async (ws) => {
    console.log('🤖 Agent dashboard client connected');
    orchestrator.addWSClient(ws);
    try {
      ws.send(JSON.stringify({
        event: 'init',
        data: {
          agents: orchestrator.getAllStates(),
          stats: await orchestrator.getStats(),
          activities: orchestrator.getActivityFeed(20),
          pendingApprovals: orchestrator.decisionEngine.getPendingApprovals()
        }
      }));
    } catch (e) {}
    ws.on('close', () => {
      orchestrator.removeWSClient(ws);
      console.log('🤖 Agent dashboard client disconnected');
    });
  });
}

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
}

// Export app for Vercel serverless
module.exports = app;

// Only start the HTTP server when not running in Vercel
if (!process.env.VERCEL) {
  async function startServer() {
    await db.init();

    // Seed 50 demo accounts on first run (after db is fully initialized)
    try { require('./seedDemo'); } catch (e) { console.error('Demo seed error:', e.message); }

    // Start auto-posting engine (demo accounts post daily)
    try { require('./autopost').start(); } catch (e) { console.error('AutoPost error:', e.message); }

    server.listen(PORT, () => {
      console.log(`🍺 DrinkedInn API → http://localhost:${PORT}`);
      console.log(`🤖 Agent System: ${Object.keys(orchestrator.agents).length} agents active (${orchestrator.getStats().orgAgents} org + ${orchestrator.getStats().platformAgents} platform)`);
      console.log(`🧠 LLM Provider: ${orchestrator.llm.provider}`);
    });
  }

  startServer().catch(console.error);
}
