// server/routes/memories.js
// Memories — auto-grouped past posts as cards for the top of Home.
//
// The grouping is deliberately simple and predictable at this stage:
//   - Bucket the viewer's own past posts by (year-month, city_or_country).
//   - Only surface buckets whose middle date fell at least 30 days ago; older
//     buckets are the ones worth remembering, not last week's.
//   - The cover is the most-engaged post in the bucket.
//   - Coparticipants ("5 people") = distinct users who cheered or commented on
//     the posts in the bucket, minus the viewer.
//
// Kept server-side rather than client-side so a very active user with 1000
// posts doesn't pay the CPU on every launch. The response is small (≤10 cards)
// and cheap for the client to render.

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// The list and the detail endpoint MUST agree about two things, or a card
// opens onto posts that belong to a different card:
//
//   AGE_FILTER   which posts are old enough to be a memory at all
//   BUCKET_KEY   how a post's location resolves to a bucket
//
// They are defined once here and used by both queries. Previously the detail
// query omitted the age filter entirely (so a card advertising 4 stories
// played 7) and matched location with a loose `city = ? OR country = ?` (so a
// card keyed on a city also swept in posts keyed on its country).
const AGE_FILTER = "p.created_at < datetime('now','-30 days')";

// City wins over country, matching the list's `post.place_city || post.place_country`.
const BUCKET_KEY = "CASE WHEN COALESCE(pl.city,'') <> '' THEN pl.city ELSE COALESCE(pl.country,'') END";

router.get('/', auth, async (req, res) => {
  try {
    // Only posts >= 30 days old — the retention hook is "remember this NIGHT",
    // not "remember what you did on Tuesday".
    const posts = await db.all(
      `SELECT p.id, p.content, p.image_url, p.created_at, p.place_id,
              pl.name AS place_name, pl.city AS place_city, pl.country AS place_country,
              strftime('%Y-%m', p.created_at) AS ym,
              (SELECT COUNT(*) FROM cheers   c  WHERE c.post_id = p.id) AS cheers,
              (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comments
         FROM posts p
    LEFT JOIN places pl ON pl.id = p.place_id
        WHERE p.user_id = ?
          AND ${AGE_FILTER}
     ORDER BY p.created_at DESC
        LIMIT 500`,
      [req.user.id]
    );

    const buckets = new Map();
    for (const post of posts) {
      const locKey = post.place_city || post.place_country || '';
      const key = `${post.ym}|${locKey}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(post);
    }

    const cards = [];
    for (const [key, group] of buckets) {
      if (group.length < 2) continue; // one-post buckets are not memories
      const cover = group.reduce((best, p) =>
        (p.cheers + p.comments) > (best.cheers + best.comments) ? p : best
      , group[0]);
      const postIds = group.map((p) => p.id);
      const placeholders = postIds.map(() => '?').join(',');

      // People — anyone who reacted, minus the viewer.
      const people = await db.get(
        `SELECT COUNT(DISTINCT u) AS n FROM (
           SELECT user_id AS u FROM cheers   WHERE post_id IN (${placeholders}) AND user_id != ?
           UNION
           SELECT user_id AS u FROM comments WHERE post_id IN (${placeholders}) AND user_id != ?
         )`,
        [...postIds, req.user.id, ...postIds, req.user.id]
      );

      const [year, month] = key.split('|')[0].split('-');
      const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(month, 10) - 1] || 'This month';
      const loc = cover.place_city || cover.place_country || '';

      cards.push({
        key,
        title: loc ? `${monthName} in ${loc}` : `Looking back to ${monthName} ${year}`,
        subtitle: `${group.length} stories · ${people?.n || 0} people`,
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        location: loc,
        story_count: group.length,
        people_count: people?.n || 0,
        place_count: new Set(group.map((p) => p.place_id).filter(Boolean)).size,
        cover_post_id: cover.id,
        cover_image_url: cover.image_url || null,
        post_ids: postIds,
      });
    }

    cards.sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
    res.json(cards.slice(0, 10));
  } catch (e) {
    console.error('[memories] list', e.message);
    res.status(500).json({ error: 'Could not load memories.' });
  }
});

// GET /api/memories/:key/posts — the actual posts inside a memory card.
router.get('/:key/posts', auth, async (req, res) => {
  try {
    const [ym, loc] = String(req.params.key).split('|');
    if (!/^\d{4}-\d{2}$/.test(ym)) return res.status(400).json({ error: 'Bad key.' });
    // Reproduce the list's bucketing exactly. An empty `loc` is a real bucket
    // ("posts with no place"), not "any location" — matching it loosely pulled
    // in every located post as well.
    const locClause = loc
      ? `AND ${BUCKET_KEY} = ?`
      : `AND ${BUCKET_KEY} = ''`;
    const rows = await db.all(
      `SELECT p.id, p.content, p.image_url, p.created_at, p.user_id,
              pl.name AS place_name, pl.city AS place_city,
              (SELECT COUNT(*) FROM cheers   c  WHERE c.post_id = p.id) AS cheers,
              (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comments
         FROM posts p
    LEFT JOIN places pl ON pl.id = p.place_id
        WHERE p.user_id = ?
          AND ${AGE_FILTER}
          AND strftime('%Y-%m', p.created_at) = ?
          ${locClause}
     ORDER BY p.created_at ASC`,
      [req.user.id, ym, ...(loc ? [loc] : [])]
    );
    res.json(rows);
  } catch (e) {
    console.error('[memories] detail', e.message);
    res.status(500).json({ error: 'Could not load that memory.' });
  }
});

module.exports = router;
