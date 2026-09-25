// src/components/taste/TasteSkeleton.js
// Loading placeholders that match the three list densities in the Taste hub.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Shimmer } from '../ui/Skeleton';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';

function CardSkeleton({ height = 78 }) {
  const { t, elevation } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, height }, elevation(t, 1)]}>
      <Shimmer style={{ width: 56, height: 56, borderRadius: radius.md }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Shimmer style={{ width: '58%', height: 12, borderRadius: 6 }} />
        <Shimmer style={{ width: '38%', height: 10, borderRadius: 5, marginTop: 8 }} />
      </View>
      <Shimmer style={{ width: 44, height: 22, borderRadius: radius.sm }} />
    </View>
  );
}

export default function TasteSkeleton({ rows = 4 }) {
  return (
    <View style={{ paddingTop: 6 }}>
      {Array.from({ length: rows }).map((_, i) => <CardSkeleton key={i} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
