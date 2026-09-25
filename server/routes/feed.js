// server/routes/feed.js
// Ranked home feed. Pulls a recent candidate set, ranks by relevance, and pins
// Pour of the Day on the first page. Mounted behind auth.
//
// Adapted to DrinkedInn's real schema:
//   connections(user_id=follower, target_id=following), posts.created_at is ISO text.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { rankPosts } = require('../lib/feedRank');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page || '0', 10));
    const pageSize = 20;
    // Home has two feeds — For You (the ranked candidate set) and Following
    // (restricted to accounts the viewer follows). Same shape, different
    // candidate pool. mode=for-you (default) preserves prior behaviour exactly.
    const mode = String(req.query.mode || 'for-you').toLowerCase();
    const followingOnly = mode === 'following';

    // Who do I follow? (affinity input) — target_id is the followed user.
    const followRows = await db.all(
      'SELECT target_id FROM connections WHERE user_id = ?',
      [req.user.id]
    );
    const followingSet = new Set(followRows.map((r) => r.target_id));

    // Candidate set: the most recent posts with engagement counts. We rank the
    // whole recent window — the freshness weight in feedRank handles recency, so
    // no hard date cutoff (which would empty the feed on low-activity days).
    // created_at is ISO text → convert to ms epoch for the ranker.
    // Optional filter: when Following is picked, keep only followed authors.
    // Own posts still appear.
    const followedIds = [...followingSet, req.user.id];
    const inClause = followedIds.length ? `AND p.user_id IN (${followedIds.map(() => '?').join(',')})` : '';
    const candArgs = followingOnly ? followedIds : [];

    const candidates = await db.all(
      `SELECT p.id,
              p.user_id AS author_id,
              CAST(strftime('%s', p.created_at) AS INTEGER) * 1000 AS created_at,
              (SELECT COUNT(*) FROM cheers   c  WHERE c.post_id = p.id)  AS cheers,
              (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comments
         FROM posts p
        WHERE 1=1 ${followingOnly ? inClause : ''}
        ORDER BY p.created_at DESC
        LIMIT 400`,
      candArgs
    );

    const ranked = rankPosts(candidates, followingSet);
    const slice = ranked.slice(page * pageSize, page * pageSize + pageSize);

    // Pin Pour of the Day on page 0.
    let potdId = null;
    if (page === 0) {
      const potd = await db.get(
        'SELECT post_id FROM featured_posts ORDER BY created_at DESC LIMIT 1'
      );
      potdId = potd?.post_id || null;
    }

    res.json({
      page,
      mode: followingOnly ? 'following' : 'for-you',
      potd_post_id: potdId,
      post_ids: slice.map((p) => p.id),
    });
  } catch (err) {
    console.error('[feed]', err.message);
    res.status(500).json({ error: 'Failed to build feed' });
  }
});

module.exports = router;
