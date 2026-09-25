// src/components/explore/StoryRailCard.js
// A moment, sized for a horizontal rail. People first: the author's face and
// name lead, the words follow, and the drink is a small detail in the corner
// of the photo — never the subject.
//
// The options control is not decoration. Every surface that shows someone
// else's content has to offer report and block (App Store 1.2 / Play UGC), and
// a rail is a surface.

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Avatar, Bounce } from '../ui';

export const STORY_CARD_WIDTH = 248;

// Same normalisation PostCard uses: SQLite hands back "YYYY-MM-DD HH:MM:SS"
// with no zone, which Android would otherwise read as local time.
function shortWhen(ts) {
  if (!ts) return '';
  const raw = String(ts);
  const d = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  // A negative age is clock skew, not the future — read it as "just now".
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

function StoryRailCard({ post, onOpen, onProfile, onOptions }) {
  const { t, elevation } = useTheme();
  if (!post) return null;

  const img = mediaUrl(post.image_url);
  const cheers = Number(post.cheer_count) || 0;
  const name = post.name || 'A member';
  const when = shortWhen(post.created_at);

  return (
    <Bounce
      onPress={() => onOpen?.(post)}
      haptic="light"
      scaleTo={0.97}
      accessibilityLabel={
        `Moment from ${name}${when ? `, ${when === 'now' ? 'just now' : `${when} ago`}` : ''}`
      }
    >
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
        {img ? (
          <View>
            <Image
              source={{ uri: img }}
              style={[styles.media, { backgroundColor: t.surfaceAlt }]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            {!!post.drink && (
              <View style={[styles.drink, { backgroundColor: t.scrim }]}>
                <Text style={{ fontSize: 13 }} accessible={false}>{post.drink}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.quote, { backgroundColor: t.accentSoft }]}>
            <Icon name="chatbubble-ellipses-outline" size={18} color={t.accent} />
            <Text style={[type.bodyStrong, { color: t.text, marginTop: 8, lineHeight: 20 }]} numberOfLines={3}>
              {post.content || 'A moment worth remembering.'}
            </Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.person}>
            <Pressable
              onPress={() => onProfile?.(post.user_id)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Open ${name}'s profile`}
            >
              <Avatar uri={post.avatar} name={name} size={26} />
            </Pressable>
            <Text style={[type.label, { color: t.text, flex: 1 }]} numberOfLines={1}>{name}</Text>
            <Pressable
              onPress={() => onOptions?.(post)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Options for ${name}'s moment`}
            >
              <Icon name="ellipsis-horizontal" size={16} color={t.textMuted} />
            </Pressable>
          </View>

          {!!img && !!post.content && (
            <Text style={[type.caption, { color: t.textSecondary, marginTop: 8, lineHeight: 18 }]} numberOfLines={2}>
              {post.content}
            </Text>
          )}

          <View style={styles.meta}>
            <Icon name="beer-outline" size={12} color={t.textMuted} />
            <Text style={[type.caption, { color: t.textMuted }]}>{cheers}</Text>
            {!!post.location && (
              <>
                <Text style={[type.caption, { color: t.textMuted }]}>·</Text>
                <Icon name="location-outline" size={12} color={t.textMuted} />
                <Text style={[type.caption, { color: t.textMuted, flex: 1 }]} numberOfLines={1}>
                  {post.location}
                </Text>
              </>
            )}
            {!post.location && !!when && (
              <Text style={[type.caption, { color: t.textMuted, flex: 1, textAlign: 'right' }]}>{when}</Text>
            )}
          </View>
        </View>
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  card: {
    width: STORY_CARD_WIDTH,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  media: { width: '100%', height: 132 },
  drink: {
    position: 'absolute', top: 10, right: 10,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  quote: { height: 132, padding: 14, justifyContent: 'center' },
  body: { padding: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
});

export default memo(StoryRailCard);
