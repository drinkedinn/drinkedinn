// src/components/explore/Rail.js
// A titled horizontal rail. One component so every section on Explore snaps,
// pads and spaces identically — including the ones that come from other
// modules, which use the same 16pt gutter and 12pt gap.

import React from 'react';
import { View, FlatList } from 'react-native';
import SectionHeader from './SectionHeader';

const GAP = 12;

export default function Rail({
  title,
  subtitle,
  actionLabel,
  onAction,
  data,
  itemWidth,
  renderItem,
  keyExtractor,
}) {
  const items = Array.isArray(data) ? data : [];
  if (!items.length) return null;

  return (
    <View style={{ marginBottom: 22 }}>
      <SectionHeader title={title} subtitle={subtitle} actionLabel={actionLabel} onAction={onAction} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: GAP, paddingVertical: 4 }}
        snapToInterval={itemWidth ? itemWidth + GAP : undefined}
        decelerationRate={itemWidth ? 'fast' : 'normal'}
        initialNumToRender={4}
        windowSize={5}
        removeClippedSubviews={false}
      />
    </View>
  );
}
