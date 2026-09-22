// src/components/events/EventCardSkeleton.js
// Loading placeholder that mirrors EventCard's layout so the switch to real
// content doesn't shift anything.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Shimmer } from '../ui/Skeleton';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';

export default function EventCardSkeleton() {
  const { t, elevation } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <Shimmer style={{ width: 46, height: 48, borderRadius: radius.sm }} />
      <View style={{ flex: 1 }}>
        <Shimmer style={{ width: '75%', height: 14, borderRadius: 6 }} />
        <Shimmer style={{ width: '45%', height: 11, borderRadius: 5, marginTop: 10 }} />
        <Shimmer style={{ width: '60%', height: 11, borderRadius: 5, marginTop: 8 }} />
        <View style={styles.footer}>
          <Shimmer style={{ width: 22, height: 22, borderRadius: 11 }} />
          <Shimmer style={{ width: 120, height: 10, borderRadius: 5 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
});
