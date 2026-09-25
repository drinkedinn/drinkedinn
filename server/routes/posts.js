const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { notify: notifyEngine } = require('../lib/notify');
const { touchStreak } = require('../lib/streaks');
const { screenContent } = require('../lib/contentFilter');
const { blockedIds, filterBlocked, isBlocked } = require('../lib/blocking');
const analytics = require('../lib/analytics');

const router = express.Router();

const POST_QUERY = (extra = '') => `
  SELECT p.*, u.name, u.title, u.avatar, u.verified, u.premium, u.badge,
    (SELECT COUNT(*) FROM cheers WHERE post_id = p.id) as cheer_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
    (SELECT COUNT(*) FROM repours WHERE post_id = p.id) as repour_count,
    (SELECT COUNT(*) FROM cheers WHERE post_id = p.id AND user_id = ?) as user_cheered,
    (SELECT COUNT(*) FROM repours WHERE post_id = p.id AND user_id = ?) as user_repoured,
    (SELECT COUNT(*) FROM connections WHERE user_id = ? AND target_id = p.user_id) as user_connected
  FROM posts p JOIN users u ON p.user_id = u.id
  ${extra}
`;

// Delegate to the engagement engine: records the in-app notification (with
// batching) AND fires a throttled Web Push, respecting prefs + quiet hours.
const notify = async (userId, actorId, type, postId = null) => {
  if (userId === actorId) return;
  let actorName = 'Someone';
  try {
    const a = await db.get('SELECT name FROM users WHERE id = ?', [actorId]);
    if (a?.name) actorName = a.name;
  } catch {}
  await notifyEngine({ recipientId: userId, actorId, type, postId, actorName });
};

// Record community participation toward the engagement streak (never throws).
const bumpStreak = async (userId, action) => {
  try { await touchStreak(userId, action); } catch (e) { console.error('[streak]', e.message); }
};

// Blocking is mutual and is supposed to hide both parties from each other
// everywhere (lib/blocking.js). Only the home feed applied it, so a blocked
// user's posts still surfaced in explore, trips, cheered, hashtag results and
// by direct id — which makes the block look broken to the person who set it.
const hideBlocked = async (viewerId, rows) =>
  filterBlocked(rows, await blockedIds(viewerId));

router.get('/', auth, async (req, res) => {
  try {
    // ?scope=following restricts the list to accounts the viewer follows, plus
    // their own posts. Without it the client could only filter the page it had
    // already been given, so a Following tab showed whatever the last 80 posts
    // happened to contain — populated for someone following nobody, and
    // missing people they do follow who had not posted recently.
    const following = String(req.query.scope || '') === 'following';
    const extra = following
      ? `WHERE (p.user_id = ? OR p.user_id IN (SELECT target_id FROM connections WHERE user_id = ?))
         ORDER BY p.created_at DESC LIMIT 80`
      : 'ORDER BY p.created_at DESC LIMIT 80';
    const args = following
      ? [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
      : [req.user.id, req.user.id, req.user.id];
    const posts = await db.all(POST_QUERY(extra), args);
    const blocked = await blockedIds(req.user.id);
    res.json(filterBlocked(posts, blocked).slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.get('/trending', auth, async (req, res) => {
  try {
    const posts = await db.all('SELECT content FROM posts ORDER BY created_at DESC LIMIT 300');
    const counts = {};
    posts.forEach(({ content }) => { (content.match(/#[\w]+/g) || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }); });
    res.json(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

router.get('/explore', auth, async (req, res) => {
  try {
    const posts = await db.all(POST_QUERY('ORDER BY cheer_count DESC, comment_count DESC, p.created_at DESC LIMIT 50'), [req.user.id, req.user.id, req.user.id]);
    res.json(await hideBlocked(req.user.id, posts));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch explore' });
  }
});

router.get('/trips', auth, async (req, res) => {
  try {
    const posts = await db.all(POST_QUERY("WHERE p.location != '' AND p.location IS NOT NULL ORDER BY p.created_at DESC LIMIT 50"), [req.user.id, req.user.id, req.user.id]);
    res.json(await hideBlocked(req.user.id, posts));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

router.get('/cheered', auth, async (req, res) => {
  try {
    const posts = await db.all(POST_QUERY('WHERE p.id IN (SELECT post_id FROM cheers WHERE user_id = ?) ORDER BY p.created_at DESC LIMIT 50'), [req.user.id, req.user.id, req.user.id, req.user.id]);
    res.json(await hideBlocked(req.user.id, posts));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cheered posts' });
  }
});

router.get('/hashtag/:tag', auth, async (req, res) => {
  const tag = req.params.tag.startsWith('#') ? req.params.tag : '#' + req.params.tag;
  try {
    const posts = await db.all(POST_QUERY('WHERE p.content LIKE ? ORDER BY p.created_at DESC LIMIT 50'), [req.user.id, req.user.id, req.user.id, `%${tag}%`]);
    res.json(await hideBlocked(req.user.id, posts));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hashtag posts' });
  }
});

// Single post by id. Declared after the literal GET routes above so it can't
// shadow /trending, /explore, /cheered, etc.
router.get('/:id(\\d+)', auth, async (req, res) => {
  try {
    const post = await db.get(POST_QUERY('WHERE p.id = ?'), [req.user.id, req.user.id, req.user.id, req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    // Same 404 as a genuinely missing post — do not confirm the author exists.
    if (await isBlocked(req.user.id, post.user_id)) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.post('/', auth, async (req, res) => {
  const { content, drink, location, lat, lng, image_url, poll_options } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

  // Pre-publish moderation gate (Apple 1.2 / 1.4.3, Google Play UGC policy).
  const screen = screenContent(`${content} ${location || ''}`);
  if (!screen.allowed) return res.status(422).json({ error: screen.reason });
  const hasPoll = Array.isArray(poll_options) && poll_options.filter(o => o?.trim()).length >= 2;
  try {
    const { lastInsertRowid } = await db.run(
      'INSERT INTO posts (user_id, content, drink, location, lat, lng, image_url, has_poll) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, content.trim(), drink || '🥃', location || '', lat || null, lng || null, image_url || '', hasPoll ? 1 : 0]
    );
    if (hasPoll) {
      for (const opt of poll_options.filter(o => o?.trim())) {
        await db.run('INSERT INTO poll_options (post_id, text) VALUES (?, ?)', [lastInsertRowid, opt.trim()]);
      }
    }
    await bumpStreak(req.user.id, 'post');
    analytics.track('post_created', { userId: req.user.id, props: { has_image: !!image_url, has_poll: hasPoll, drink: drink || '' } });
    const post = await db.get(POST_QUERY('WHERE p.id = ?'), [req.user.id, req.user.id, req.user.id, lastInsertRowid]);
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.post('/:id/cheer', auth, async (req, res) => {
  const { id } = req.params; const uid = req.user.id;
  try {
    const exists = await db.get('SELECT 1 FROM cheers WHERE user_id = ? AND post_id = ?', [uid, id]);
    if (exists) {
      await db.run('DELETE FROM cheers WHERE user_id = ? AND post_id = ?', [uid, id]);
      res.json({ cheered: false });
    } else {
      await db.run('INSERT INTO cheers (user_id, post_id) VALUES (?, ?)', [uid, id]);
      const post = await db.get('SELECT user_id FROM posts WHERE id = ?', [id]);
      if (post) await notify(post.user_id, uid, 'cheer', parseInt(id));
      await bumpStreak(uid, 'cheer');
      analytics.track('post_cheered', { userId: uid });
      res.json({ cheered: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to cheer' });
  }
});

router.post('/:id/repour', auth, async (req, res) => {
  const { id } = req.params; const uid = req.user.id;
  try {
    const exists = await db.get('SELECT 1 FROM repours WHERE user_id = ? AND post_id = ?', [uid, id]);
    if (exists) {
      await db.run('DELETE FROM repours WHERE user_id = ? AND post_id = ?', [uid, id]);
      res.json({ repoured: false });
    } else {
      await db.run('INSERT INTO repours (user_id, post_id) VALUES (?, ?)', [uid, id]);
      const post = await db.get('SELECT user_id FROM posts WHERE id = ?', [id]);
      if (post) await notify(post.user_id, uid, 'repour', parseInt(id));
      res.json({ repoured: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to repour' });
  }
});

router.get('/:id/comments', auth, async (req, res) => {
  try {
    const comments = await db.all('SELECT c.*, u.name, u.avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC', [req.params.id]);
    res.json(await hideBlocked(req.user.id, comments));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/:id/comments', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment required' });

  const screen = screenContent(content);
  if (!screen.allowed) return res.status(422).json({ error: screen.reason });

  try {
    const { lastInsertRowid } = await db.run('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)', [req.user.id, req.params.id, content.trim()]);
    const post = await db.get('SELECT user_id FROM posts WHERE id = ?', [req.params.id]);
    if (post) await notify(post.user_id, req.user.id, 'comment', parseInt(req.params.id));
    await bumpStreak(req.user.id, 'comment');
    analytics.track('post_commented', { userId: req.user.id });
    const comment = await db.get('SELECT c.*, u.name, u.avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [lastInsertRowid]);
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await db.get('SELECT user_id FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not your post' });
    for (const t of ['cheers','comments','repours','notifications','poll_votes','poll_options']) {
      try { await db.run(`DELETE FROM ${t} WHERE post_id = ?`, [req.params.id]); } catch {}
    }
    await db.run('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
