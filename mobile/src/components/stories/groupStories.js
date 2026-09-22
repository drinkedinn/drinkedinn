// src/components/stories/groupStories.js
// Turn a flat GET /stories response into per-user groups sorted for the rail.
//
// Server contract (server/routes/stories.js):
//   GET /stories → [{ id, user_id, drink, created_at, name, avatar, ... }]
// Any additional fields the server may add later (image_url, caption, media)
// pass through untouched, so the rail and viewer will pick them up as they
// arrive without a client change.

export function groupStoriesByUser(list, { currentUserId, seenSet } = {}) {
  const arr = Array.isArray(list) ? list : [];
  const byUser = new Map();

  for (const s of arr) {
    if (!s || s.user_id == null) continue;
    const uid = s.user_id;
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        userId: uid,
        name: s.name || 'Member',
        avatar: s.avatar || null,
        stories: [],
      });
    }
    byUser.get(uid).stories.push(s);
  }

  // Oldest → newest within each group so the viewer plays chronologically.
  const groups = Array.from(byUser.values()).map((g) => {
    const stories = [...g.stories].sort((a, b) => tsOf(a) - tsOf(b));
    const latest = stories[stories.length - 1];
    const anyUnseen = seenSet
      ? stories.some((s) => !seenSet.has(String(s.id)))
      : true;
    return {
      ...g,
      stories,
      latestAt: tsOf(latest),
      hasUnseen: anyUnseen,
      isMine: currentUserId != null && String(g.userId) === String(currentUserId),
    };
  });

  // Unseen groups first (a bar-at-night sort), then by most-recent story.
  groups.sort((a, b) => {
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return b.latestAt - a.latestAt;
  });

  return groups;
}

function tsOf(s) {
  if (!s?.created_at) return 0;
  const raw = String(s.created_at);
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  const n = d.getTime();
  return isNaN(n) ? 0 : n;
}

export function timeAgoShort(ts) {
  if (!ts) return '';
  const raw = String(ts);
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(s) || s < 0) return 'now';
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
