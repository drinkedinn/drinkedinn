// src/components/places/PlaceStoryCard.js
// A story told at this place. Two shapes from one component:
//   variant="grid" — square tile for the two-column Top stories grid
//   variant="list" — full-width row for Recent stories
//
// Both carry an options button. This is user-generated content, so Report and
// Block have to be reachable from the content itself (App Store 1.2, Play UGC).

import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Avatar, Bounce } from '../ui';
import { timeAgo } from './placeUtils';

function OptionsButton({ onPress, name, onDark }) {
  const { t } = useTheme();
  if (!onPress) return null;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={onDark ? [styles.floatingOptions, { backgroundColor: t.scrim }] : { padding: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`Options for ${name || 'this story'}`}
    >
      <Icon name="ellipsis-horizontal" size={16} color={onDark ? '#FFFFFF' : t.textMuted} />
    </Pressable>
  );
}

function PlaceStoryCard({ story, variant = 'list', width, onOpen, onMenu, onProfile }) {
  const { t, elevation } = useTheme();
  if (!story) return null;

  const img = mediaUrl(story.image_url);
  const author = story.name || 'A member';
  const body = String(story.content || '').trim();
  const cheers = Number(story.cheer_count) || 0;
  const open = onOpen ? () => onOpen(story) : undefined;
  const menu = onMenu ? () => onMenu(story) : undefined;

  if (variant === 'grid') {
    return (
      <View style={[styles.tile, width ? { width } : { flex: 1 }]}>
        <Bounce
          onPress={open}
          haptic="light"
          scaleTo={0.97}
          accessibilityLabel={`Story by ${author}${body ? `: ${body.slice(0, 80)}` : ''}`}
        >
          <View style={[styles.tileMedia, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            {img ? (
              <Image
                source={{ uri: img }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <Text
                style={[type.body, { color: t.textSecondary, padding: 12, lineHeight: 20 }]}
                numberOfLines={5}
              >
                {body || 'A moment shared here.'}
              </Text>
            )}
            {cheers > 0 && (
              <View style={[styles.cheerPill, { backgroundColor: t.scrim }]}>
                <Icon name="beer" size={11} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{cheers}</Text>
              </View>
            )}
            <View style={styles.tileOptions}>
              <OptionsButton onPress={menu} name={author} onDark={!!img} />
            </View>
          </View>
        </Bounce>

        <Bounce
          onPress={onProfile ? () => onProfile(story) : undefined}
          haptic={null}
          scaleTo={0.98}
          accessibilityLabel={`${author}, open profile`}
        >
          <View style={styles.tileFoot}>
            <Avatar uri={story.avatar} name={author} size={20} />
            <Text style={[type.caption, { color: t.textSecondary, flex: 1 }]} numberOfLines={1}>
              {author}
            </Text>
          </View>
        </Bounce>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <View style={styles.head}>
        <Bounce
          onPress={onProfile ? () => onProfile(story) : undefined}
          haptic={null}
          scaleTo={0.98}
          accessibilityLabel={`${author}, open profile`}
        >
          <View style={styles.headRow}>
            <Avatar uri={story.avatar} name={author} size={34} />
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <Text style={[type.label, { color: t.text }]} numberOfLines={1}>
                {author}
              </Text>
              <Text style={[type.caption, { color: t.textMuted, marginTop: 1 }]} numberOfLines={1}>
                {timeAgo(story.created_at) || 'here'}
              </Text>
            </View>
          </View>
        </Bounce>
        <View style={{ flex: 1 }} />
        <OptionsButton onPress={menu} name={author} />
      </View>

      <Bounce
        onPress={open}
        haptic="light"
        scaleTo={0.99}
        accessibilityLabel={`Story by ${author}${body ? `: ${body.slice(0, 80)}` : ''}`}
      >
        <View>
          {!!body && (
            <Text style={[type.body, { color: t.text, lineHeight: 21, paddingHorizontal: 14 }]} numberOfLines={4}>
              {body}
            </Text>
          )}
          {!!img && (
            <Image
              source={{ uri: img }}
              style={[styles.media, { backgroundColor: t.surfaceAlt, marginTop: body ? 11 : 0 }]}
              contentFit="cover"
              transition={220}
              cachePolicy="memory-disk"
            />
          )}
          {cheers > 0 && (
            <View style={styles.cheerRow}>
              <Icon name="beer-outline" size={13} color={t.textMuted} />
              <Text style={[type.caption, { color: t.textMuted }]}>
                {cheers} cheer{cheers === 1 ? '' : 's'}
              </Text>
            </View>
          )}
        </View>
      </Bounce>
    </View>
  );
}

const styles = StyleSheet.create({
  // grid — vertical rhythm comes from the container's rowGap, not from here.
  tile: {},
  tileMedia: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  tileOptions: { position: 'absolute', top: 4, right: 4 },
  tileFoot: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  cheerPill: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  floatingOptions: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // list
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingBottom: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  media: { width: '100%', aspectRatio: 1.45 },
  cheerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, marginTop: 11 },
});

export default memo(PlaceStoryCard);
