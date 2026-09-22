const express = require('express');
const db = require('../db');
const { requireAuth: auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Every surface a report can come from. Google Play's UGC policy requires a
// reporting affordance wherever user content appears — so the list must cover
// every content type the app renders, not just the three it started with.
// 'ai_output' covers Innkeeper responses (Play's generative-AI policy requires
// an in-app way to flag problematic generated content).
const TARGET_TYPES = [
  'post', 'user', 'comment', 'story', 'message',
  'group', 'group_post', 'event', 'place', 'ai_output',
];

// Child sexual abuse and exploitation. Play requires a dedicated in-app
// reporting path, and these must never be silently deduped, rate-limited or
// auto-closed — every submission is retained for review and, where the law
// requires it, onward reporting. Kept as a distinct reason prefix so the
// moderation queue can raise them to P0 without parsing free text.
const CSAE_REASON = 'csae';

// Report a piece of content or an account.
router.post('/', auth, async (req, res) => {
  const { target_type, target_id, reason } = req.body;
  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ error: 'target_type, target_id, and reason required' });
  }
  if (!TARGET_TYPES.includes(target_type)) {
    return res.status(400).json({ error: `target_type must be one of: ${TARGET_TYPES.join(', ')}` });
  }
  const isCsae = String(reason).toLowerCase().startsWith(CSAE_REASON);
  try {
    // Duplicate suppression — EXCEPT for child-safety reports, which are always
    // recorded. A second CSAE report may carry new evidence, and silently
    // answering "already reported" to a child-safety escalation is not a
    // behaviour this app should ever have.
    if (!isCsae) {
      const existing = await db.get(
        'SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ?',
        [req.user.id, target_type, target_id]
      );
      if (existing) return res.json({ ok: true, message: 'Already reported' });
    }

    await db.run(
      'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)',
      [req.user.id, target_type, target_id, String(reason).slice(0, 500)]
    );
    res.json({ ok: true, priority: isCsae ? 'P0' : 'normal' });
  } catch (err) {
    console.error('[reports] submit', err.message);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Child-safety report. A separate endpoint so the path is unambiguous in logs
// and in the moderation queue, and so it can accept a free-text account of what
// was seen without a target id (a reporter may be describing behaviour rather
// than pointing at one post).
router.post('/child-safety', auth, async (req, res) => {
  const { details, target_type, target_id } = req.body || {};
  if (!details || String(details).trim().length < 10) {
    return res.status(400).json({ error: 'Please describe what you saw so the team can act on it.' });
  }
  try {
    await db.run(
      'INSERT INTO reports (reporter_id, target_type, target_id, reason, status) VALUES (?, ?, ?, ?, ?)',
      [
        req.user.id,
        TARGET_TYPES.includes(target_type) ? target_type : 'user',
        Number.isInteger(+target_id) ? +target_id : 0,
        `${CSAE_REASON}: ${String(details).slice(0, 1000)}`,
        'pending',
      ]
    );
    // Deliberately no detail in the response — the reporter should not be able
    // to infer what the team already knows about an account.
    res.json({ ok: true, priority: 'P0' });
  } catch (err) {
    console.error('[reports] child-safety', err.message);
    res.status(500).json({ error: 'Could not submit that report. Email safety@drinkedinn.com.' });
  }
});

// Admin: view reports
router.get('/', auth, requireAdmin, async (req, res) => {
  try {
    const reports = await db.all(`
      SELECT r.*, u.name as reporter_name, u.avatar as reporter_avatar,
        CASE WHEN r.target_type = 'post' THEN (SELECT content FROM posts WHERE id = r.target_id) ELSE NULL END as post_content,
        r.target_id as post_id
      FROM reports r JOIN users u ON r.reporter_id = u.id
      ORDER BY r.created_at DESC LIMIT 50
    `);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Admin: resolve report
router.put('/:id', auth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    await db.run('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

module.exports = router;
