// server/lib/feedRank.js
// Relevance ranking for the home feed. The point is to surface what a user
// actually wants to see (people they follow, fresh + appreciated pours), which is
// what makes a feed worth returning to. Weights are explicit and tunable — no
// hidden engagement-maximizing tricks.

const WEIGHTS = {
  affinity: 3.0,    // you follow the author
  engagement: 1.0,  // cheers + comments (log-damped)
  freshness: 2.0,   // recency
};
const HALF_LIFE_HOURS = 18; // a pour's freshness halves every 18h

function freshnessScore(createdAtMs, now = Date.now()) {
  const ageHours = Math.max(0, (now - createdAtMs) / 3_600_000);
  return Math.pow(0.5, ageHours / HALF_LIFE_HOURS); // 1.0 → 0 as it ages
}

/**
 * @param {Array} posts each: { id, author_id, created_at(ms), cheers, comments }
 * @param {Set}   followingSet author_ids the viewer follows
 * @returns ranked copy of posts (desc by score), each annotated with _score
 */
function rankPosts(posts, followingSet, now = Date.now()) {
  return posts
    .map((p) => {
      const affinity = followingSet.has(p.author_id) ? 1 : 0;
      const engagement = Math.log1p((p.cheers || 0) + (p.comments || 0));
      const freshness = freshnessScore(p.created_at, now);
      const score =
        WEIGHTS.affinity * affinity +
        WEIGHTS.engagement * engagement +
        WEIGHTS.freshness * freshness;
      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score);
}

module.exports = { rankPosts, freshnessScore, WEIGHTS };
