const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

const BADGE_DEFS = [
  { id: 'first_pour',      icon: '🥃', name: 'First Pour',       desc: 'Shared your first drink story',   check: (s) => s.posts >= 1 },
  { id: 'storyteller',     icon: '📖', name: 'Storyteller',       desc: 'Posted 10 or more times',         check: (s) => s.posts >= 10 },
  { id: 'social_butterfly',icon: '🦋', name: 'Social Butterfly',  desc: 'Connected with 5+ pour buddies',  check: (s) => s.connections >= 5 },
  { id: 'crowd_pleaser',   icon: '🌟', name: 'Crowd Pleaser',     desc: 'Received 20+ cheers total',       check: (s) => s.cheers_received >= 20 },
  { id: 'pour_master',     icon: '🏆', name: 'Pour Master',       desc: 'Received 100+ cheers',            check: (s) => s.cheers_received >= 100 },
  { id: 'world_sipper',    icon: '✈️', name: 'World Sipper',      desc: 'Posted from 3+ different places', check: (s) => s.locations >= 3 },
  { id: 'globe_trotter',   icon: '🌍', name: 'Globe Trotter',     desc: 'Posted from 5+ countries',        check: (s) => s.locations >= 5 },
  { id: 'commentator',     icon: '💬', name: 'Commentator',       desc: 'Left 10+ comments',               check: (s) => s.comments_made >= 10 },
  { id: 'tasting_expert',  icon: '🍷', name: 'Tasting Expert',    desc: 'Logged 5+ drink ratings',         check: (s) => s.ratings >= 5 },
  { id: 'collector',       icon: '🗄️', name: 'Collector',         desc: 'Added 3+ bottles to collection',  check: (s) => s.collection >= 3 },
  { id: 'bucket_lister',   icon: '📋', name: 'Bucket Lister',     desc: 'Ticked off 3+ bucket list drinks', check: (s) => s.bucket_checked >= 3 },
  { id: 'group_leader',    icon: '👑', name: 'Group Leader',      desc: 'Created a drink group',           check: (s) => s.groups_created >= 1 },
  { id: 'challenger',      icon: '⚡', name: 'Challenger',        desc: 'Joined a monthly challenge',      check: (s) => s.challenges_joined >= 1 },
];

router.get('/:userId', auth, async (req, res) => {
  const uid = req.params.userId;
  try {
    const [
      postsRow,
      connectionsRow,
      cheersRow,
      commentsRow,
      ratingsRow,
      collectionRow,
      bucketRow,
      groupsRow,
      challengesRow,
      locsRow,
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [uid]),
      db.get('SELECT COUNT(*) as count FROM connections WHERE user_id = ?', [uid]),
      db.get('SELECT COUNT(*) as count FROM cheers c JOIN posts p ON c.post_id = p.id WHERE p.user_id = ?', [uid]),
      db.get('SELECT COUNT(*) as count FROM comments WHERE user_id = ?', [uid]),
      db.get('SELECT COUNT(*) as count FROM drink_ratings WHERE user_id = ?', [uid]),
      db.get('SELECT COUNT(*) as count FROM collection WHERE user_id = ?', [uid]),
      db.get('SELECT COUNT(*) as count FROM bucket_list WHERE user_id = ? AND checked = 1', [uid]),
      db.get('SELECT COUNT(*) as count FROM drink_groups WHERE created_by = ?', [uid]),
      db.get('SELECT COUNT(*) as count FROM challenge_entries WHERE user_id = ?', [uid]),
      db.get("SELECT COUNT(DISTINCT location) as count FROM posts WHERE user_id = ? AND location != ''", [uid]),
    ]);

    const stats = {
      posts: postsRow?.count || 0,
      connections: connectionsRow?.count || 0,
      cheers_received: cheersRow?.count || 0,
      comments_made: commentsRow?.count || 0,
      ratings: ratingsRow?.count || 0,
      collection: collectionRow?.count || 0,
      bucket_checked: bucketRow?.count || 0,
      groups_created: groupsRow?.count || 0,
      challenges_joined: challengesRow?.count || 0,
      locations: locsRow?.count || 0,
    };

    const earned = BADGE_DEFS.filter(b => b.check(stats)).map(b => ({ ...b, check: undefined }));
    const all = BADGE_DEFS.map(b => ({ ...b, earned: b.check(stats), check: undefined }));
    res.json({ earned, all, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

module.exports = router;
