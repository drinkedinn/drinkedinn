// src/screens/profile/tabs/TaggedPillar.js
// Pillar 6 — Tagged. Moments other people put this member in.
//
// Server: GET /users/:id/tagged (server/routes/users.js) → posts joined to
// their author: { ...post, name, title, avatar }. Two things about that shape
// drive this file:
//   • There are no engagement columns (cheer_count, user_cheered, …), so a
//     full PostCard would render a row of confident zeroes. Compact rows that
//     never claim a count are the honest rendering.
//   • Every row here is someone ELSE's content, on a profile that is not
//     theirs. That makes Report + Block mandatory per author, not optional,
//     and it is why each row carries its own "…" (App Store 1.2 / Play UGC).
//
// The server match is a v1 heuristic ("@firstname" in the body), so a row can
// be a false positive. The copy never asserts the member was there.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import api from '../../../api';
import { useTheme } from '../../../theme/ThemeContext';
import { radius, type } from '../../../theme/tokens';
import { Avatar, Bounce, Icon } from '../../../components/ui';
import useProfileResource from '../useProfileResource';
import {
  GUTTER, OptionsButton, PillarEmpty, PillarError, PillarSkeleton,
  SectionHeading, ShowAll, Thumb, navigateByName, plural, timeAgo,
} from '../pillarKit';

const CAP = 6;

function TaggedRow({ post, onPress, onProfile, onOptions }) {
  const { t } = useTheme();
  return (
    <View style={{ paddingHorizontal: GUTTER, marginBottom: 10 }}>
      <Bounce
        onPress={onPress}
        haptic="light"
        scaleTo={0.99}
        accessibilityLabel={`Open moment by ${post?.name || 'a member'}`}
        style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
      >
        <View style={styles.head}>
          <Bounce
            onPress={onProfile}
            haptic={null}
            scaleTo={0.96}
            accessibilityLabel={`Open ${post?.name || 'member'}'s profile`}
          >
            <Avatar uri={post?.avatar} name={post?.name || 'Member'} size={34} />
          </Bounce>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[type.label, { color: t.text }]} numberOfLines={1}>
              {post?.name || 'A member'}
            </Text>
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {[post?.location, timeAgo(post?.created_at)].filter(Boolean).join(' · ') ||
                'Shared a moment'}
            </Text>
          </View>
          {onOptions ? <OptionsButton onPress={onOptions} label="Moment options" /> : null}
        </View>

        <View style={styles.body}>
          <Text style={[type.body, { color: t.text, flex: 1, lineHeight: 21 }]} numberOfLines={3}>
            {String(post?.content || '').trim() || 'A moment'}
          </Text>
          {!!post?.image_url && (
            <View style={{ marginLeft: 12 }}>
              <Thumb uri={post.image_url} width={62} height={62} icon="image-outline" />
            </View>
          )}
        </View>
      </Bounce>
    </View>
  );
}

export default function TaggedPillar({
  userId, isMe, token, navigation, ugc, meId, blockedIds, onError,
}) {
  const { t } = useTheme();
  const [showAll, setShowAll] = useState(false);

  const tagged = useProfileResource(
    async () => {
      const res = await api.get(`/users/${encodeURIComponent(userId)}/tagged`);
      return Array.isArray(res?.data) ? res.data : [];
    },
    { token, key: `tagged:${userId}`, onError },
  );

  // Blocking somebody has to take effect on screen immediately, or the block
  // looks broken. blockedIds is owned by ProfilePillars so every pillar drops
  // the same author at once; the next fetch drops them server-side too.
  const all = (Array.isArray(tagged.data) ? tagged.data : []).filter(
    (p) => !blockedIds?.has?.(String(p?.user_id)),
  );
  const visible = showAll ? all : all.slice(0, CAP);

  // Pass the id only, not the row. PostDetailScreen keeps whatever object it
  // is handed when that object has `content`, and this endpoint returns no
  // cheer_count / comment_count / user_cheered — so handing it the row would
  // render a confident row of zeroes. With just an id it hydrates from
  // GET /posts/:id and shows the real numbers.
  const openPost = (post) => navigateByName(navigation, 'PostDetail', { post: { id: post?.id } });
  const openProfile = (id) => {
    if (id == null) return;
    if (meId != null && String(id) === String(meId)) navigateByName(navigation, 'Account');
    else navigateByName(navigation, 'User', { userId: id });
  };

  if (tagged.loading && tagged.data == null) return <PillarSkeleton variant="rows" />;

  if (tagged.error && !all.length) {
    return <PillarError message={tagged.error} onRetry={tagged.reload} />;
  }

  if (!all.length) {
    return (
      <PillarEmpty
        icon="pricetag-outline"
        title="No tags yet"
        body={
          isMe
            ? 'When someone mentions you in a moment, it lands here — the nights other people remember you in.'
            : 'Moments other people mention them in will show up here.'
        }
        actionLabel={isMe ? 'Find people' : undefined}
        onAction={isMe ? () => navigateByName(navigation, 'Discover') : undefined}
      />
    );
  }

  return (
    <View>
      {!!tagged.error && (
        <View style={{ marginBottom: 14 }}>
          <PillarError message={tagged.error} onRetry={tagged.reload} />
        </View>
      )}

      <SectionHeading
        title="Mentioned in"
        caption={`${plural(all.length, 'moment')} from other people`}
      />

      {visible.map((post) => {
        const mine = meId != null && String(post?.user_id) === String(meId);
        return (
          <TaggedRow
            key={String(post.id)}
            post={post}
            onPress={() => openPost(post)}
            onProfile={() => openProfile(post?.user_id)}
            onOptions={
              mine
                ? undefined
                : () =>
                    ugc?.openMenu?.({
                      targetType: 'post',
                      targetId: post.id,
                      authorId: post.user_id,
                      authorName: post.name,
                      noun: 'moment',
                    })
            }
          />
        );
      })}

      <ShowAll hidden={showAll ? 0 : all.length - visible.length} onPress={() => setShowAll(true)} />

      <View style={styles.hintRow}>
        <Icon name="information-circle-outline" size={13} color={t.textMuted} />
        <Text style={[type.caption, { color: t.textMuted, flex: 1, lineHeight: 17 }]}>
          Mentions are matched by name, so the odd one may not be about them.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center' },
  body: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 11 },
  hintRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: GUTTER, marginTop: 10,
  },
});
