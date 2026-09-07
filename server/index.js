// server/index.js
// Node entry point — local development and any Node host.
//
// Everything here is deliberately Node-only: the HTTP server, the WebSocket
// server, local upload serving and the autopost timer. Cloudflare Workers uses
// worker.js instead, which shares the same Express app from app.js.

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const db = require('./db');
const errorReporter = require('./lib/errorReporter');
const { createApp } = require('./app');
const config = require('./config');

// Node has a startup phase, so fail loudly here rather than on first request.
config.assertReady();

errorReporter.installProcessHandlers();

const app = createApp({ isWorker: false });
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Local uploads. In production these live in R2 (see lib/storage.js); this
// path only exists so development works without cloud credentials.
const uploadsDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.warn('could not create uploads dir:', e.message);
}
app.use('/uploads', express.static(uploadsDir));
app.use('/promo', express.static(path.join(__dirname, '../promo')));

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Error handler last — it only sees what the routes above threw.
app.use(errorReporter.expressHandler());

// WebSocket for the agent dashboard. Workers would need Durable Objects for
// this; it is an internal admin surface, so it simply isn't available there.
let wss;
try {
  const { WebSocketServer } = require('ws');
  wss = new WebSocketServer({ server });
} catch {
  console.log('ws not installed — agent real-time updates disabled');
}

if (wss) {
  wss.on('connection', async (ws) => {
    const orchestrator = app.locals.orchestrator;
    if (!orchestrator) return;
    orchestrator.addWSClient(ws);
    try {
      ws.send(JSON.stringify({
        event: 'init',
        data: {
          agents: orchestrator.getAllStates(),
          stats: await orchestrator.getStats(),
          activities: orchestrator.getActivityFeed(20),
          pendingApprovals: orchestrator.decisionEngine.getPendingApprovals(),
        },
      }));
    } catch {}
    ws.on('close', () => orchestrator.removeWSClient(ws));
  });
}

module.exports = app;

if (require.main === module) {
  (async () => {
    await db.init();
    try { require('./seedDemo'); } catch (e) { console.error('Demo seed error:', e.message); }
    // Timer-driven autopost is Node-only; Workers uses a cron trigger.
    try { require('./autopost').start(); } catch (e) { console.error('AutoPost error:', e.message); }

    server.listen(PORT, () => {
      console.log(`DrinkedInn API → http://localhost:${PORT}`);
    });
  })().catch(console.error);
}
