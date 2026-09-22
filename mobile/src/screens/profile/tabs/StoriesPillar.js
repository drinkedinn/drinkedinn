// src/screens/profile/tabs/StoriesPillar.js
// Pillar 1 — Stories. What's live right now, and what's worth keeping.
//
// Two bands:
//   • Live — this member's moments from the last 24 hours. GET /stories is the
//     only story endpoint and it already applies the 24-hour window server-side
//     (server/routes/stories.js), so the client filters by author and nothing
//     else. Tapping one opens the existing full-screen viewer.
//   • Highlights — moments with a photo from the last 90 days, ordered by how
//     many people raised a glass to them. This is the "past highlights" strip:
//     the nights that stuck, not a second copy of the grid.
//
// Stories carry a drink glyph rather than an image (the stories table has no
// media column), so a live tile is a warm gradient with the member's glyph on
// it — the same treatment StoryViewerScreen uses, so the two never look like
// different features.

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../api';
import { useTheme } from '../../../theme/ThemeContext';
import { radius, type } from '../../../theme/tokens';
import { Icon, Bounce } from '../../../components/ui';
import useProfileResource from '../useProfileResource';
import {
  GUTTER, PillarEmpty, PillarError, PillarSkeleton, SectionHeading, Thumb,
  OptionsButton, navigateByName, parseDate, plural, timeAgo,
} from '../pillarKit';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_HIGHLIGHTS = 12;

// Glassware under bar light. Indexed by story id so a tile keeps its colour
// between renders instead of flickering to a new one.
const GRADIENTS = [
  ['#3B1F0E', '#8E4A1E'],
  ['#1F2A44', '#5B3F86'],
  ['#3A1A2A', '#B24E68'],
  ['#1E2B1F', '#4A6D3C'],
  ['#241826', '#7E4E9B'],
];

function gradientFor(id) {
  const n = Math.abs(parseInt(id, 10) || 0);
  return GRADIENTS[n % GRADIENTS.length];
}

function LiveTile({ story, onPress, onOptions }) {
  const { t } = useTheme();
  const colors = gradientFor(story?.id);
  return (
    <View style={{ alignItems: 'center', width: 76 }}>
      <Bounce
        onPress={onPress}
        haptic="light"
        scaleTo={0.93}
        accessibilityLabel={`Open moment from ${timeAgo(story?.created_at) || 'today'}`}
      >
        <LinearGradient
          colors={[t.accent, '#D9698A', '#7B61C9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ring}
        >
          <View style={[styles.ringInner, { backgroundColor: t.bg }]}>
            <LinearGradient colors={colors} style={styles.liveFace}>
              <Text style={{ fontSize: 24 }}>{story?.drink || '🍹'}</Text>
            </LinearGradient>
          </View>
        </LinearGradient>
      </Bounce>
      <Text style={[type.caption, { color: t.textMuted, marginTop: 7 }]} numberOfLines={1}>
        {timeAgo(story?.created_at) || 'now'}
      </Text>
      {onOptions ? (
        <OptionsButton onPress={onOptions} label="Moment options" style={{ marginTop: 2 }} />
      ) : null}
    </View>
  );
}

function AddTile({ onPress }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', width: 76 }}>
      <Bounce
        onPress={onPress}
        haptic="medium"
        scaleTo={0.93}
        accessibilityLabel="Share a moment"
      >
        <View style={[styles.addFace, { borderColor: t.accentBorder, backgroundColor: t.accentSoft }]}>
          <Icon name="add" size={24} color={t.accent} />
        </View>
      </Bounce>
      <Text style={[type.caption, { color: t.textSecondary, marginTop: 7 }]} numberOfLines={1}>
        Share
      </Text>
    </View>
  );
}

function HighlightTile({ post, onPress, onOptions }) {
  const { t } = useTheme();
  const cheers = Number(post?.cheer_count) || 0;
  return (
    <View>
      <Bounce
        onPress={onPress}
        haptic="light"
        scaleTo={0.97}
        accessibilityLabel={`Open highlight${post?.content ? `: ${String(post.content).slice(0, 60)}` : ''}`}
        style={[styles.highlight, { borderColor: t.border, backgroundColor: t.surface }]}
      >
        <Thumb uri={post?.image_url} width={132} height={176} round={radius.md} icon="image-outline" iconSize={24} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.68)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.highlightFoot} pointerEvents="none">
          {cheers > 0 && (
            <View style={styles.cheerRow}>
              <Icon name="beer" size={12} color="#FFFFFF" />
              <Text style={styles.cheerText}>{cheers}</Text>
            </View>
          )}
          <Text style={styles.highlightWhen} numberOfLines={1}>
            {timeAgo(post?.created_at)}
          </Text>
        </View>
      </Bounce>
      {onOptions ? <OptionsButton onPress={onOptions} label="Highlight options" overlay /> : null}
    </View>
  );
}

export default function StoriesPillar({
  userId, isMe, token, navigation, ugc, posts, onError,
}) {
  const stories = useProfileResource(
    async () => {
      const res = await api.get('/stories');
      const list = Array.isArray(res?.data) ? res.data : [];
      return list
        .filter((s) => s && String(s.user_id) === String(userId))
        .sort((a, b) => (parseDate(b?.created_at)?.getTime() || 0) - (parseDate(a?.created_at)?.getTime() || 0));
    },
    { token, key: `stories:${userId}`, onError },
  );

  const highlights = useMemo(() => {
    const list = Array.isArray(posts?.data) ? posts.data : [];
    const cutoff = Date.now() - NINETY_DAYS_MS;
    return list
      .filter((p) => {
        if (!p?.image_url) return false;
        const d = parseDate(p.created_at);
        return !d || d.getTime() >= cutoff;
      })
      .sort((a, b) => {
        const diff = (Number(b?.cheer_count) || 0) - (Number(a?.cheer_count) || 0);
        if (diff !== 0) return diff;
        return (parseDate(b?.created_at)?.getTime() || 0) - (parseDate(a?.created_at)?.getTime() || 0);
      })
      .slice(0, MAX_HIGHLIGHTS);
  }, [posts?.data]);

  const live = Array.isArray(stories.data) ? stories.data : [];
  const busy = (stories.loading && stories.data == null) || (posts?.loading && posts?.data == null);
  const bothFailed = !!stories.error && !!posts?.error;

  const openViewer = () => navigateByName(navigation, 'StoryViewer', { userId });
  const openCompose = () => navigateByName(navigation, 'CreateStory');
  const openPost = (post) => navigateByName(navigation, 'PostDetail', { post });

  const retry = () => {
    if (stories.error) stories.reload();
    if (posts?.error) posts.reload?.();
  };

  if (busy) return <PillarSkeleton variant="rail" />;

  if (bothFailed) {
    return <PillarError message={stories.error || posts?.error} onRetry={retry} />;
  }

  if (!live.length && !highlights.length) {
    return (
      <View>
        {(!!stories.error || !!posts?.error) && (
          <View style={{ marginBottom: 14 }}>
            <PillarError message={stories.error || posts?.error} onRetry={retry} />
          </View>
        )}
        <PillarEmpty
          icon="sparkles-outline"
          title={isMe ? 'Nothing live right now' : 'No moments yet'}
          body={
            isMe
              ? 'Share a moment and it stays up for 24 hours. The people you know see it first.'
              : 'When they share a moment, it lands here for the next 24 hours.'
          }
          actionLabel={isMe ? 'Share a moment' : undefined}
          onAction={isMe ? openCompose : undefined}
        />
      </View>
    );
  }

  return (
    <View>
      {(!!stories.error || !!posts?.error) && (
        <View style={{ marginBottom: 16 }}>
          <PillarError message={stories.error || posts?.error} onRetry={retry} />
        </View>
      )}

      {(live.length > 0 || isMe) && (
        <View style={{ marginBottom: highlights.length ? 24 : 4 }}>
          <SectionHeading
            title="Live now"
            caption={live.length ? `${plural(live.length, 'moment')} · up for 24 hours` : 'Nothing live yet'}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {isMe && <AddTile onPress={openCompose} />}
            {live.map((s) => (
              <LiveTile
                key={String(s.id)}
                story={s}
                onPress={openViewer}
                onOptions={
                  isMe
                    ? undefined
                    : () =>
                        ugc?.openMenu?.({
                          targetType: 'story',
                          targetId: s.id,
                          authorId: s.user_id,
                          authorName: s.name,
                          noun: 'moment',
                        })
                }
              />
            ))}
          </ScrollView>
        </View>
      )}

      {highlights.length > 0 && (
        <View>
          <SectionHeading
            title="Highlights"
            caption="The last 90 days, by the ones people raised a glass to"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {highlights.map((p) => (
              <HighlightTile
                key={String(p.id)}
                post={p}
                onPress={() => openPost(p)}
                onOptions={
                  isMe
                    ? undefined
                    : () =>
                        ugc?.openMenu?.({
                          targetType: 'post',
                          targetId: p.id,
                          authorId: p.user_id,
                          authorName: p.name,
                          noun: 'moment',
                        })
                }
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: GUTTER, gap: 12, paddingBottom: 2 },
  ring: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 65, height: 65, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  liveFace: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  addFace: {
    width: 70, height: 70, borderRadius: 35, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  highlight: { width: 132, height: 176, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  highlightFoot: {
    position: 'absolute', left: 10, right: 10, bottom: 9,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  cheerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  cheerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  highlightWhen: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '600' },
});
