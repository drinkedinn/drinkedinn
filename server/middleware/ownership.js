// server/middleware/ownership.js
// IDOR protection: confirm the authenticated user owns the requested resource.
//
// Usage:
//   router.delete('/posts/:id', requireAuth, ownsResource('posts', 'user_id'), handler)

const db = require('../db');

function ownsResource(table, ownerCol = 'user_id', idParam = 'id') {
  return async (req, res, next) => {
    const id = req.params[idParam];
    const row = await db.get(
      `SELECT ${ownerCol} AS owner FROM ${table} WHERE id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.owner !== req.user.id && req.user.is_admin !== 1) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function ownsConversation(table = 'messages') {
  return async (req, res, next) => {
    const id = req.params.id;
    const row = await db.get(
      `SELECT sender_id, recipient_id FROM ${table} WHERE id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    const uid = req.user.id;
    if (uid !== row.sender_id && uid !== row.recipient_id && req.user.is_admin !== 1) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { ownsResource, ownsConversation };
