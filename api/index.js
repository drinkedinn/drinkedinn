// Vercel serverless entry point
// DB init is handled via middleware inside server/index.js (lazy, on first request)
const app = require('../server/index');
module.exports = app;
