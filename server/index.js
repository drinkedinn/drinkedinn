require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Seed 50 demo accounts on first run (after db is fully initialized)
try { require('./seedDemo'); } catch (e) { console.error('Demo seed error:', e.message); }

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// WebSocket for agent real-time updates
let wss;
try {
  const { WebSocketServer } = require('ws');
  wss = new WebSocketServer({ server });
} catch {
  console.log('⚠️  ws package not installed — agent real-time updates disabled');
}

// Rate limiting (optional dep)
try {
  const { rateLimit } = require('express-rate-limit');
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many auth attempts.' } }));
} catch {}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

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
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Health check for Railway
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

// ===== AI Agent System =====
const db = require('./db');
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
  wss.on('connection', (ws) => {
    console.log('🤖 Agent dashboard client connected');
    orchestrator.addWSClient(ws);
    ws.send(JSON.stringify({
      event: 'init',
      data: {
        agents: orchestrator.getAllStates(),
        stats: orchestrator.getStats(),
        activities: orchestrator.getActivityFeed(20),
        pendingApprovals: orchestrator.decisionEngine.getPendingApprovals()
      }
    }));
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

server.listen(PORT, () => {
  console.log(`🍺 DrinkedInn API → http://localhost:${PORT}`);
  console.log(`🤖 Agent System: ${Object.keys(orchestrator.agents).length} agents active (${orchestrator.getStats().orgAgents} org + ${orchestrator.getStats().platformAgents} platform)`);
  console.log(`🧠 LLM Provider: ${orchestrator.llm.provider}`);
});
