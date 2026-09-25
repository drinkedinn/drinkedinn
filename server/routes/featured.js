const express = require('express');
const db = require('../db');
const { requireAuth: auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get today's "Pour of the Day"
router.get('/potd', auth, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    // Check if already featured today
    let featured = await db.get(`
      SELECT p.*, u.name, u.title, u.avatar,
        (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM featured_posts fp
      JOIN posts p ON fp.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE fp.featured_date = ?
    `, [today]);

    if (!featured) {
      // Auto-select: most cheered post from last 7 days not yet featured
      const best = await db.get(`
        SELECT p.id,
          (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count
        FROM posts p
        WHERE p.created_at > datetime('now', '-7 days')
          AND p.id NOT IN (SELECT post_id FROM featured_posts)
          AND p.content != ''
        ORDER BY cheer_count DESC
        LIMIT 1
      `);

      if (best) {
        await db.run('INSERT OR IGNORE INTO featured_posts (post_id, featured_date) VALUES (?, ?)', [best.id, today]);
        featured = await db.get(`
          SELECT p.*, u.name, u.title, u.avatar,
            (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
          FROM posts p JOIN users u ON p.user_id = u.id
          WHERE p.id = ?
        `, [best.id]);
      }
    }

    res.json(featured || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured post' });
  }
});

// Admin: manually feature a post
router.post('/potd/:postId', auth, requireAdmin, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    await db.run('DELETE FROM featured_posts WHERE featured_date = ?', [today]);
    await db.run('INSERT INTO featured_posts (post_id, featured_date) VALUES (?, ?)', [req.params.postId, today]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to feature post' });
  }
});

module.exports = router;
