// src/components/places/TripRow.js
// One country in the Trips segment. The flag is data, not an icon: on Android,
// whose system font carries no flag glyphs, the regional-indicator pair renders
// as the two letters — which is exactly the fallback we want, so we do not
// special-case it.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';
import { countryFlag, countryName, normaliseCountry, relativeLabel, plural } from './placeUtils';

function Metric({ value, label }) {
  const { t } = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[type.bodyStrong, { color: t.text, fontVariant: ['tabular-nums'] }]}>
        {Number(value) || 0}
      </Text>
      <Text style={[type.caption, { color: t.textMuted, marginTop: 1 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function TripRow({ trip, onPress }) {
  const { t, elevation } = useTheme();
  if (!trip) return null;

  const code = normaliseCountry(trip.country);
  const flag = countryFlag(code);
  const name = countryName(code) || 'Somewhere';
  const last = relativeLabel(trip.last_visit);

  return (
    <Bounce
      onPress={onPress ? () => onPress(trip) : undefined}
      haptic="light"
      scaleTo={0.985}
      accessibilityLabel={`${name}, ${plural(trip.place_count, 'place', 'places')}, ${plural(
        trip.visit_count,
        'visit',
        'visits'
      )}`}
      accessibilityHint="Shows the places you have been in this country"
    >
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
        <View style={styles.head}>
          <View style={[styles.flagTile, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            {flag ? (
              <Text style={styles.flag} allowFontScaling={false} numberOfLines={1}>
                {flag}
              </Text>
            ) : (
              <Icon name="earth-outline" size={20} color={t.textSecondary} />
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Text style={[type.h3, { color: t.text, flexShrink: 1 }]} numberOfLines={1}>
                {name}
              </Text>
              {!!code && (
                <Text style={[type.overline, { color: t.textMuted }]} allowFontScaling={false}>
                  {code}
                </Text>
              )}
            </View>
            {!!last && (
              <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
                Last there {last}
              </Text>
            )}
          </View>

          <Icon name="chevron-forward" size={17} color={t.textMuted} />
        </View>

        <View style={[styles.metrics, { borderTopColor: t.divider }]}>
          <Metric value={trip.place_count} label="places" />
          <View style={[styles.rule, { backgroundColor: t.divider }]} />
          <Metric value={trip.visit_count} label="visits" />
          <View style={[styles.rule, { backgroundColor: t.divider }]} />
          <Metric value={trip.story_count} label="stories" />
        </View>
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  flagTile: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 24, lineHeight: 30 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metric: { flex: 1, alignItems: 'center' },
  rule: { width: StyleSheet.hairlineWidth, height: 26 },
});

export default memo(TripRow);
