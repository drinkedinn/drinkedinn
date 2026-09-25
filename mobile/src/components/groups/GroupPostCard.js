// src/components/groups/GroupPostCard.js
// A visual sibling of ../PostCard for posts that live inside a group.
//
// The main PostCard's cheer / repour / delete actions call /posts/:id, which
// is a different SQL table from group_posts — reusing it would flip the wrong
// rows. This lighter card keeps the same shape and rhythm, but only wires up
// what the group-post server contract actually supports: opening the author's
// profile, and the report / block menu on the ellipsis button.

import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Avatar, Bounce } from '../ui';
import { useAuth } from '../../context/AuthContext';

function timeAgo(ts) {
  if (!ts) return '';
  const raw = String(ts);
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(s) || s < 0) return '';
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

function GroupPostCard({ post, onProfile, onReport }) {
  const { t, elevation } = useTheme();
  const { user } = useAuth();
  if (!post) return null;

  const mine = post.user_id === user?.id;
  const img = mediaUrl(post.image_url);

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <View style={styles.header}>
        <Bounce
          onPress={() => onProfile?.(post.user_id)}
          haptic={null}
          scaleTo={0.98}
          style={styles.headRow}
        >
          <Avatar uri={post.avatar} name={post.name} size={40} />
          <View style={{ marginLeft: 11, flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[type.h3, { color: t.text }]} numberOfLines={1}>
                {post.name || 'A member'}
              </Text>
              {!!post.verified && <Icon name="checkmark-circle" size={15} color={t.blue} />}
            </View>
            <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>
              {post.title || 'DrinkedInn Member'} · {timeAgo(post.created_at)}
            </Text>
          </View>
        </Bounce>

        {!mine && (
          <Pressable
            onPress={() => onReport?.(post)}
            hitSlop={10}
            style={{ padding: 4 }}
            accessibilityLabel="Post options"
          >
            <Icon name="ellipsis-horizontal" size={18} color={t.textMuted} />
          </Pressable>
        )}
      </View>

      {!!post.content && (
        <Text
          style={[
            type.body,
            { color: t.text, lineHeight: 22, paddingHorizontal: 16, paddingBottom: img ? 12 : 14 },
          ]}
        >
          {post.content}
        </Text>
      )}

      {!!img && (
        <View>
          <Image
            source={{ uri: img }}
            style={[styles.image, { backgroundColor: t.surfaceAlt }]}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
          />
          {!!post.drink && (
            <View style={[styles.drinkPill, { backgroundColor: t.scrim }]}>
              <Text style={{ fontSize: 15 }}>{post.drink}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  image: { width: '100%', aspectRatio: 1.2 },
  drinkPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(GroupPostCard);
