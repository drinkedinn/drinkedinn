// server/routes/adminRoles.js
// Who can do what. Mounted under /api/admin/roles.
//
// Only `owner` may write here — see lib/permissions.js for why super_admin
// deliberately cannot mint more admins.

const express = require('express');
const db = require('../db');
const { requirePermission } = require('../middleware/adminAuth');
const { ROLE_NAMES, ROLES, isValidRole } = require('../lib/permissions');

const router = express.Router();

// The catalogue, so the UI can render roles and what each one actually grants
// rather than hard-coding a list that drifts from the server's.
router.get('/catalogue', requirePermission('roles.read'), (req, res) => {
  res.json(ROLE_NAMES.map((role) => ({ role, permissions: ROLES[role] })));
});

router.get('/', requirePermission('roles.read'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT r.user_id, r.role, r.granted_at, r.granted_by,
              u.name, u.email, u.avatar,
              g.name AS granted_by_name
         FROM admin_roles r
         JOIN users u ON u.id = r.user_id
    LEFT JOIN users g ON g.id = r.granted_by
     ORDER BY r.granted_at DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error('[adminRoles] list', e.message);
    res.status(500).json({ error: 'Could not load roles.' });
  }
});

// Grant or change a role. requirePermission already demanded a typed reason.
router.put('/:userId', requirePermission('roles.write'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const role = String(req.body.role || '');
    if (!isValidRole(role)) {
      return res.status(400).json({ error: `Unknown role. One of: ${ROLE_NAMES.join(', ')}` });
    }
    const target = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!target) return res.status(404).json({ error: 'No such member.' });

    // Never let the last owner demote themselves — that locks everyone out of
    // role management permanently, with no path back that does not involve a
    // database console.
    if (req.user.id === userId && role !== 'owner') {
      const owners = await db.get("SELECT COUNT(*) AS c FROM admin_roles WHERE role = 'owner'");
      if ((owners?.c || 0) <= 1) {
        return res.status(409).json({ error: 'You are the only owner. Promote another owner first.' });
      }
    }

    await db.run(
      `INSERT INTO admin_roles (user_id, role, granted_by, granted_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET role = excluded.role,
                                          granted_by = excluded.granted_by,
                                          granted_at = excluded.granted_at`,
      [userId, role, req.user.id, Date.now()]
    );
    // Keep the legacy boolean in step so anything still reading is_admin agrees.
    await db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [userId]);
    res.json({ ok: true, user_id: userId, role });
  } catch (e) {
    console.error('[adminRoles] grant', e.message);
    res.status(500).json({ error: 'Could not set that role.' });
  }
});

router.delete('/:userId', requirePermission('roles.write'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const row = await db.get('SELECT role FROM admin_roles WHERE user_id = ?', [userId]);
    if (!row) return res.status(404).json({ error: 'That member has no admin role.' });
    if (row.role === 'owner') {
      const owners = await db.get("SELECT COUNT(*) AS c FROM admin_roles WHERE role = 'owner'");
      if ((owners?.c || 0) <= 1) {
        return res.status(409).json({ error: 'That is the only owner. Promote another first.' });
      }
    }
    await db.run('DELETE FROM admin_roles WHERE user_id = ?', [userId]);
    await db.run('UPDATE users SET is_admin = 0 WHERE id = ?', [userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[adminRoles] revoke', e.message);
    res.status(500).json({ error: 'Could not revoke that role.' });
  }
});

module.exports = router;
