// server/lib/audit.js
// Records admin actions to the admin_audit table.
// Call from every admin route handler.

const db = require('../db');

async function logAdminAction(actorId, action, { targetType, targetId, detail } = {}) {
  try {
    await db.run(
      `INSERT INTO admin_audit (actor_id, action, target_type, target_id, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        actorId,
        action,
        targetType || null,
        targetId != null ? String(targetId) : null,
        detail ? JSON.stringify(detail) : null,
        Date.now(),
      ]
    );
  } catch (e) {
    console.error('[audit] failed to log action', action, e.message);
  }
}

module.exports = { logAdminAction };
