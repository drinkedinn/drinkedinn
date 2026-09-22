// src/components/explore/ExploreSkeleton.js
// The shape Explore takes while it loads. Deliberately mirrors the real
// layout's widths and heights so nothing jumps when the content lands.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';
import { Shimmer } from '../ui';
import { STORY_CARD_WIDTH } from './StoryRailCard';
import { PLACE_CARD_WIDTH } from './PlaceRailCard';

function RailHeadSkeleton() {
  return (
    <View style={styles.head}>
      <Shimmer style={{ width: '52%', height: 16, borderRadius: 8 }} />
      <Shimmer style={{ width: '34%', height: 10, borderRadius: 5, marginTop: 8 }} />
    </View>
  );
}

function CardSkeleton({ width, mediaHeight, bodyHeight }) {
  const { t } = useTheme();
  return (
    <View style={[styles.card, { width, backgroundColor: t.surface, borderColor: t.border }]}>
      <Shimmer style={{ width: '100%', height: mediaHeight }} />
      <View style={{ padding: 12, height: bodyHeight }}>
        <Shimmer style={{ width: '70%', height: 12, borderRadius: 6 }} />
        <Shimmer style={{ width: '45%', height: 10, borderRadius: 5, marginTop: 10 }} />
      </View>
    </View>
  );
}

export function StoryRailSkeleton() {
  return (
    <View style={styles.section}>
      <RailHeadSkeleton />
      <View style={styles.rail}>
        {[0, 1].map((i) => (
          <CardSkeleton key={i} width={STORY_CARD_WIDTH} mediaHeight={132} bodyHeight={86} />
        ))}
      </View>
    </View>
  );
}

export function PlaceRailSkeleton() {
  return (
    <View style={styles.section}>
      <RailHeadSkeleton />
      <View style={styles.rail}>
        {[0, 1, 2].map((i) => (
          <CardSkeleton key={i} width={PLACE_CARD_WIDTH} mediaHeight={96} bodyHeight={68} />
        ))}
      </View>
    </View>
  );
}

export function PeopleSkeleton({ rows = 3 }) {
  return (
    <View style={{ paddingHorizontal: 16, gap: 18, paddingTop: 4 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.person}>
          <Shimmer style={{ width: 48, height: 48, borderRadius: 24 }} />
          <View style={{ flex: 1 }}>
            <Shimmer style={{ width: '45%', height: 11, borderRadius: 6 }} />
            <Shimmer style={{ width: '65%', height: 9, borderRadius: 5, marginTop: 8 }} />
          </View>
          <Shimmer style={{ width: 88, height: 32, borderRadius: 16 }} />
        </View>
      ))}
    </View>
  );
}

/** The whole resting screen, pre-content. */
export default function ExploreSkeleton() {
  return (
    <View style={{ paddingTop: 4 }}>
      <StoryRailSkeleton />
      <PlaceRailSkeleton />
      <PeopleSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 22 },
  head: { paddingHorizontal: 16, marginBottom: 12 },
  rail: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
