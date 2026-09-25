// src/components/places/PlaceRow.js
// One venue in a list. Every Places segment and both search results lists use
// this row — the only thing that changes between them is the `chips` the caller
// hands in (distance for Nearby, recent visits for Trending, last visit for
// Visited), so the lists stay visually identical and only the meaning changes.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';
import PlaceCover from './PlaceCover';
import Chip from './Chip';
import { placeSubtitle, categoryIcon } from './placeUtils';

const THUMB = 54;

function PlaceRow({ place, onPress, chips, trailing = 'chevron', accessibilityHint }) {
  const { t, elevation } = useTheme();
  if (!place) return null;

  const name = String(place.name || '').trim() || 'Unnamed place';
  const subtitle = placeSubtitle(place);
  const meta = (chips || []).filter(Boolean);

  const trailingNode =
    trailing === 'bookmark' ? (
      <Icon name="bookmark" size={18} color={t.accent} />
    ) : trailing === 'none' ? null : trailing === 'chevron' ? (
      <Icon name="chevron-forward" size={17} color={t.textMuted} />
    ) : (
      trailing
    );

  return (
    <Bounce
      onPress={onPress ? () => onPress(place) : undefined}
      haptic="light"
      scaleTo={0.985}
      accessibilityLabel={subtitle ? `${name}, ${subtitle}` : name}
      accessibilityHint={accessibilityHint}
    >
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
        <View>
          <PlaceCover place={place} size={THUMB} rounded={radius.sm} showMonogram={false} />
          {/* Tiny category badge so the venue type reads even without a cover. */}
          <View style={[styles.badge, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Icon name={categoryIcon(place.category)} size={11} color={t.textSecondary} />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={[type.h3, { color: t.text }]} numberOfLines={1}>
            {name}
          </Text>
          {!!subtitle && (
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          {meta.length > 0 && (
            <View style={styles.chips}>
              {meta.map((c, i) => (
                <Chip key={`${c.label}-${i}`} icon={c.icon} label={c.label} tone={c.tone} />
              ))}
            </View>
          )}
        </View>

        {trailingNode}
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  body: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(PlaceRow);
