// src/components/memories/MemoryCard.js
// One memory card, in two sizes:
//   variant="rail" — fixed-width cell for the horizontal rail on Home
//   variant="wide" — full-bleed row for the Memories list screen
//
// The cover photo fills the card and the copy sits on a scrim over it, so a
// memory reads as a photograph rather than as a list row. With no cover we fall
// back to a warm token-independent gradient plus the Memory glyph — the
// gradients are deliberately dark in both themes so the white copy on top keeps
// its contrast either way (same approach as the story viewer).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';
import { Shimmer } from '../ui/Skeleton';
import { MEMORY_ICON, countsLine, gradientFor, periodLabel, titleFor } from './memoryLib';

export const RAIL_CARD_W = 172;
export const RAIL_CARD_H = 214;
export const WIDE_CARD_H = 194;

export default function MemoryCard({ card, variant = 'rail', onPress }) {
  const { t, elevation } = useTheme();

  const rail = variant === 'rail';
  const title = titleFor(card);
  const subtitle = countsLine(card);
  const period = periodLabel(card);
  const cover = mediaUrl(card?.cover_image_url);
  const [g1, g2] = gradientFor(card?.key);

  return (
    <Bounce
      onPress={onPress}
      haptic="light"
      scaleTo={rail ? 0.95 : 0.98}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={rail ? undefined : styles.wideWrap}
    >
      <View
        style={[
          styles.card,
          rail
            ? { width: RAIL_CARD_W, height: RAIL_CARD_H }
            : { width: '100%', height: WIDE_CARD_H },
          { borderColor: t.border, backgroundColor: t.surfaceAlt },
          elevation(t, 1),
        ]}
      >
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            accessible={false}
          />
        ) : (
          <LinearGradient
            colors={[g1, g2]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Bottom scrim — keeps the copy legible over any photograph. */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.80)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.topRow} pointerEvents="none">
          <View style={styles.glyph}>
            <Icon name={MEMORY_ICON} size={14} color="#FFFFFF" />
          </View>
          {!!period && (
            <Text style={[type.overline, styles.period]} numberOfLines={1}>
              {period.toUpperCase()}
            </Text>
          )}
        </View>

        <View style={styles.copy} pointerEvents="none">
          <Text
            style={[rail ? type.h3 : type.h2, styles.title]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[type.caption, styles.subtitle]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </Bounce>
  );
}

/** Placeholder with the exact footprint of a real card, so nothing reflows. */
export function MemoryCardSkeleton({ variant = 'rail' }) {
  const { t } = useTheme();
  const rail = variant === 'rail';
  return (
    <View style={rail ? undefined : styles.wideWrap}>
      <Shimmer
        style={[
          styles.card,
          { borderColor: t.border },
          rail
            ? { width: RAIL_CARD_W, height: RAIL_CARD_H }
            : { width: '100%', height: WIDE_CARD_H },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wideWrap: { marginHorizontal: 16, marginBottom: 14 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  glyph: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  period: {
    color: 'rgba(255,255,255,0.82)',
    flex: 1,
  },
  copy: { paddingHorizontal: 14, paddingBottom: 14 },
  title: { color: '#FFFFFF' },
  subtitle: { color: 'rgba(255,255,255,0.80)', marginTop: 5 },
});
