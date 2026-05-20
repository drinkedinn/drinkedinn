// Vercel serverless entry point for Express backend
const db = require('../server/db');
const app = require('../server/index');

// Initialize DB tables on first cold start (Turso)
let dbInitialized = false;
let initPromise = null;

const originalHandler = app;

module.exports = async (req, res) => {
  if (!dbInitialized) {
    if (!initPromise) {
      initPromise = db.init()
        .then(() => {
          dbInitialized = true;
          console.log('✅ Turso DB initialized');
        })
        .catch(e => {
          console.error('DB init error:', e.message);
          // Don't block requests even if init fails
          dbInitialized = true;
        });
    }
    await initPromise;
  }
  return originalHandler(req, res);
};
