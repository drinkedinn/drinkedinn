// src/components/places/PlaceSkeletons.js
// Loading placeholders that mirror the real rows exactly, so nothing shifts
// when the data lands.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Shimmer } from '../ui/Skeleton';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';

export function PlaceRowSkeleton() {
  const { t, elevation } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <Shimmer style={{ width: 54, height: 54, borderRadius: radius.sm }} />
      <View style={{ flex: 1 }}>
        <Shimmer style={{ width: '62%', height: 13, borderRadius: 6 }} />
        <Shimmer style={{ width: '40%', height: 10, borderRadius: 5, marginTop: 9 }} />
        <Shimmer style={{ width: 72, height: 18, borderRadius: 999, marginTop: 10 }} />
      </View>
    </View>
  );
}

export function TripRowSkeleton() {
  const { t, elevation } = useTheme();
  return (
    <View style={[styles.trip, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <View style={styles.tripHead}>
        <Shimmer style={{ width: 46, height: 46, borderRadius: radius.sm }} />
        <View style={{ flex: 1 }}>
          <Shimmer style={{ width: '46%', height: 13, borderRadius: 6 }} />
          <Shimmer style={{ width: '32%', height: 10, borderRadius: 5, marginTop: 9 }} />
        </View>
      </View>
      <View style={[styles.tripMetrics, { borderTopColor: t.divider }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Shimmer style={{ width: 26, height: 14, borderRadius: 6 }} />
            <Shimmer style={{ width: 40, height: 9, borderRadius: 5, marginTop: 6 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function PlaceProfileSkeleton() {
  const { t } = useTheme();
  return (
    <View>
      <Shimmer style={{ width: '100%', height: 210 }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Shimmer style={{ width: '64%', height: 22, borderRadius: 8 }} />
        <Shimmer style={{ width: '44%', height: 12, borderRadius: 6, marginTop: 10 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} style={{ flex: 1, height: 44, borderRadius: radius.md }} />
          ))}
        </View>
        <Shimmer style={{ width: 120, height: 11, borderRadius: 5, marginTop: 28 }} />
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <Shimmer key={i} style={{ width: 54, height: 54, borderRadius: 27 }} />
          ))}
        </View>
        <Shimmer style={{ width: 120, height: 11, borderRadius: 5, marginTop: 28 }} />
        <Shimmer
          style={{ width: '100%', height: 120, borderRadius: radius.md, marginTop: 14, backgroundColor: t.skeleton }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  trip: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  tripMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default PlaceRowSkeleton;
