// src/components/onboarding/SuggestionSkeleton.js
// Placeholder row shown while /onboarding/suggestions is fetching. Uses the
// shared Shimmer so it stays consistent with the feed skeleton.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Shimmer } from '../ui/Skeleton';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';

export default function SuggestionSkeleton() {
  const { t } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Shimmer style={{ width: 48, height: 48, borderRadius: 24 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Shimmer style={{ width: '50%', height: 12, borderRadius: 6 }} />
        <Shimmer style={{ width: '72%', height: 10, borderRadius: 5, marginTop: 8 }} />
      </View>
      <Shimmer style={{ width: 88, height: 32, borderRadius: 999 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
