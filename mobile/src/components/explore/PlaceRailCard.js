// src/components/explore/PlaceRailCard.js
// A place, sized for a horizontal rail. The headline number is how many
// stories people have told there — a place is interesting because of what
// happened in it, not because of what it pours.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export const PLACE_CARD_WIDTH = 176;

function subtitleFor(place) {
  const parts = [place?.category, place?.city].map((s) => String(s || '').trim()).filter(Boolean);
  return parts.join(' · ');
}

function distanceLabel(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1) return `${Math.max(100, Math.round((n * 1000) / 100) * 100)}m away`;
  return `${n < 10 ? n.toFixed(1) : Math.round(n)}km away`;
}

function PlaceRailCard({ place, onOpen, showDistance }) {
  const { t, elevation } = useTheme();
  if (!place) return null;

  const cover = mediaUrl(place.cover_url);
  const stories = Number(place.story_count) || 0;
  const visits = Number(place.visit_count) || 0;
  const name = place.name || 'A place';
  const subtitle = subtitleFor(place);
  const distance = showDistance ? distanceLabel(place.distance_km) : '';

  const footLabel = distance
    || (stories > 0 ? `${stories} ${stories === 1 ? 'story' : 'stories'}` : '')
    || (visits > 0 ? `${visits} ${visits === 1 ? 'visit' : 'visits'}` : 'New here');

  return (
    <Bounce
      onPress={() => onOpen?.(place)}
      haptic="light"
      scaleTo={0.96}
      accessibilityLabel={`${name}${subtitle ? `, ${subtitle}` : ''}, ${footLabel}`}
    >
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={[styles.cover, { backgroundColor: t.surfaceAlt }]}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.cover, styles.coverFallback, { backgroundColor: t.accentSoft }]}>
            <Icon name="storefront-outline" size={22} color={t.accent} />
          </View>
        )}

        <View style={styles.body}>
          <Text style={[type.h3, { color: t.text }]} numberOfLines={2}>{name}</Text>
          {!!subtitle && (
            <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          <View style={styles.foot}>
            <Icon
              name={distance ? 'navigate-outline' : stories > 0 ? 'book-outline' : 'footsteps-outline'}
              size={12}
              color={t.accent}
            />
            <Text style={[type.caption, { color: t.textSecondary, flex: 1 }]} numberOfLines={1}>
              {footLabel}
            </Text>
            {!!place.saved && <Icon name="bookmark" size={12} color={t.accent} />}
          </View>
        </View>
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PLACE_CARD_WIDTH,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: { width: '100%', height: 96 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 12, minHeight: 92 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
});

export default memo(PlaceRailCard);
