const jwt = require('jsonwebtoken');
const db = require('../db');
const SECRET = process.env.JWT_SECRET || 'drinkedinn_secret_2024';

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, SECRET);
    // Attach is_admin from DB so it's always fresh (not stale from JWT)
    const row = await db.get('SELECT is_admin FROM users WHERE id = ?', [decoded.id]);
    req.user = { ...decoded, is_admin: row?.is_admin || 0 };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
