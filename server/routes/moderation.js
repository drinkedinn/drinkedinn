// server/routes/moderation.js
// The report queue. Mounted under /api/admin/moderation.
//
// The queue is ordered by SEVERITY, then age — not by arrival. A chronological
// list is how a child-safety report ends up behind four hundred spam reports,
// which is the specific failure this exists to prevent.
//
// P0  immediate safety or legal risk — child safety, credible threats, self-harm
// P1  serious harassment, underage concerns, dangerous behaviour
// P2  spam, impersonation, inappropriate content (default)
// P3  minor community-quality issues

const express = require('express');
const db = require('../db');
const { requirePermission } = require('../middleware/adminAuth');

const router = express.Router();

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

// Reason prefixes that must never be triaged below P0/P1, whatever a moderator
// sets. Derived from the reason the REPORTER chose, so severity is decided by
// the claim, not by whoever picks the ticket up.
const FLOOR = [
  { test: /^csae/i, priority: 'P0' },
  { test: /self[_-]?harm|suicide/i, priority: 'P0' },
  { test: /threat|violence/i, priority: 'P1' },
  { test: /underage|minor/i, priority: 'P1' },
  { test: /harassment|hate/i, priority: 'P1' },
  { test: /unsafe_drinking/i, priority: 'P1' },
];

function flooredPriority(reason, requested) {
  for (const f of FLOOR) {
    if (f.test.test(String(reason || ''))) return f.priority;
  }
  return PRIORITIES.includes(requested) ? requested : 'P2';
}

// GET /api/admin/moderation/queue?status=&priority=&assigned=
router.get('/queue', requirePermission('reports.read'), async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const clauses = ['r.status = ?'];
    const args = [status];
    if (PRIORITIES.includes(req.query.priority)) {
      clauses.push('r.priority = ?');
      args.push(req.query.priority);
    }
    if (req.query.assigned === 'me') {
      clauses.push('r.assigned_to = ?');
      args.push(req.user.id);
    } else if (req.query.assigned === 'none') {
      clauses.push('r.assigned_to IS NULL');
    }

    const rows = await db.all(
      `SELECT r.*,
              rep.name  AS reporter_name,
              asg.name  AS assignee_name,
              CASE WHEN r.target_type = 'post' THEN (SELECT content FROM posts WHERE id = r.target_id) END AS post_content,
              CASE WHEN r.target_type = 'user' THEN (SELECT name    FROM users WHERE id = r.target_id) END AS target_user_name,
              (SELECT COUNT(*) FROM reports x
                WHERE x.target_type = r.target_type AND x.target_id = r.target_id) AS reports_on_target
         FROM reports r
    LEFT JOIN users rep ON rep.id = r.reporter_id
    LEFT JOIN users asg ON asg.id = r.assigned_to
        WHERE ${clauses.join(' AND ')}
     ORDER BY CASE r.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
              r.created_at ASC
        LIMIT 200`,
      args
    );

    // Recompute the floor on read as well as write, so a queue built before the
    // floor existed still surfaces its P0s at the top.
    const withFloor = rows.map((r) => ({ ...r, priority: flooredPriority(r.reason, r.priority) }));
    withFloor.sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
    res.json(withFloor);
  } catch (e) {
    console.error('[moderation] queue', e.message);
    res.status(500).json({ error: 'Could not load the queue.' });
  }
});

// Counts for the command centre.
router.get('/counts', requirePermission('reports.read'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT priority, status, COUNT(*) AS c FROM reports GROUP BY priority, status`
    );
    const open = await db.get("SELECT COUNT(*) AS c FROM reports WHERE status = 'pending'");
    const csae = await db.get(
      "SELECT COUNT(*) AS c FROM reports WHERE status = 'pending' AND reason LIKE 'csae%'"
    );
    const unassigned = await db.get(
      "SELECT COUNT(*) AS c FROM reports WHERE status = 'pending' AND assigned_to IS NULL"
    );
    res.json({ open: open?.c || 0, csae: csae?.c || 0, unassigned: unassigned?.c || 0, breakdown: rows });
  } catch (e) {
    console.error('[moderation] counts', e.message);
    res.status(500).json({ error: 'Could not load counts.' });
  }
});

router.post('/:id/assign', requirePermission('reports.assign'), async (req, res) => {
  try {
    const to = req.body.user_id === null ? null : parseInt(req.body.user_id ?? req.user.id, 10);
    await db.run('UPDATE reports SET assigned_to = ? WHERE id = ?', [to, req.params.id]);
    res.json({ ok: true, assigned_to: to });
  } catch (e) {
    console.error('[moderation] assign', e.message);
    res.status(500).json({ error: 'Could not assign that.' });
  }
});

router.post('/:id/priority', requirePermission('reports.action'), async (req, res) => {
  try {
    const report = await db.get('SELECT reason FROM reports WHERE id = ?', [req.params.id]);
    if (!report) return res.status(404).json({ error: 'No such report.' });
    // A moderator cannot triage a child-safety report down the queue.
    const priority = flooredPriority(report.reason, req.body.priority);
    await db.run('UPDATE reports SET priority = ? WHERE id = ?', [priority, req.params.id]);
    res.json({ ok: true, priority, floored: priority !== req.body.priority });
  } catch (e) {
    console.error('[moderation] priority', e.message);
    res.status(500).json({ error: 'Could not set priority.' });
  }
});

// Resolve: what was done, and why. Both are recorded.
router.post('/:id/resolve', requirePermission('reports.action'), async (req, res) => {
  try {
    const resolution = String(req.body.resolution || '').trim();
    const ALLOWED = ['no_action', 'content_removed', 'user_warned', 'user_suspended', 'user_banned', 'escalated'];
    if (!ALLOWED.includes(resolution)) {
      return res.status(400).json({ error: `resolution must be one of: ${ALLOWED.join(', ')}` });
    }
    const note = String(req.body.note || '').trim().slice(0, 500);
    await db.run(
      `UPDATE reports SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ?
        WHERE id = ?`,
      [resolution === 'escalated' ? 'escalated' : 'resolved', `${resolution}${note ? `: ${note}` : ''}`,
       req.user.id, Date.now(), req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[moderation] resolve', e.message);
    res.status(500).json({ error: 'Could not resolve that.' });
  }
});

module.exports = router;
module.exports.flooredPriority = flooredPriority;
