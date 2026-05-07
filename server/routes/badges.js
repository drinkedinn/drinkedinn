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

router.get('/:userId', auth, (req, res) => {
  const uid = req.params.userId;
  const { count: posts }     = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(uid);
  const { count: connections }= db.prepare('SELECT COUNT(*) as count FROM connections WHERE user_id = ?').get(uid);
  const { count: cheers_received } = db.prepare('SELECT COUNT(*) as count FROM cheers c JOIN posts p ON c.post_id = p.id WHERE p.user_id = ?').get(uid);
  const { count: comments_made } = db.prepare('SELECT COUNT(*) as count FROM comments WHERE user_id = ?').get(uid);
  const { count: ratings }   = db.prepare('SELECT COUNT(*) as count FROM drink_ratings WHERE user_id = ?').get(uid);
  const { count: collection } = db.prepare('SELECT COUNT(*) as count FROM collection WHERE user_id = ?').get(uid);
  const { count: bucket_checked } = db.prepare("SELECT COUNT(*) as count FROM bucket_list WHERE user_id = ? AND checked = 1").get(uid);
  const { count: groups_created } = db.prepare('SELECT COUNT(*) as count FROM drink_groups WHERE created_by = ?').get(uid);
  const { count: challenges_joined } = db.prepare('SELECT COUNT(*) as count FROM challenge_entries WHERE user_id = ?').get(uid);
  const locs = db.prepare("SELECT COUNT(DISTINCT location) as count FROM posts WHERE user_id = ? AND location != ''").get(uid);
  const locations = locs.count;

  const stats = { posts, connections, cheers_received, comments_made, ratings, collection, bucket_checked, groups_created, challenges_joined, locations };
  const earned = BADGE_DEFS.filter(b => b.check(stats)).map(b => ({ ...b, check: undefined }));
  const all = BADGE_DEFS.map(b => ({ ...b, earned: b.check(stats), check: undefined }));
  res.json({ earned, all, stats });
});

module.exports = router;
