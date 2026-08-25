// src/components/home/StoryRow.js
// Horizontal "who's pouring" strip. The first cell is the composer entry point.

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Avatar, Icon, Bounce } from '../ui';
import { Shimmer } from '../ui/Skeleton';

export default function StoryRow({ me, people = [], loading, onCompose, onOpenProfile }) {
  const { t } = useTheme();

  if (loading) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.cell}>
            <Shimmer style={{ width: 58, height: 58, borderRadius: 29 }} />
            <Shimmer style={{ width: 40, height: 8, borderRadius: 4, marginTop: 8 }} />
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Bounce onPress={onCompose} haptic="medium" scaleTo={0.92} style={styles.cell} accessibilityLabel="Share a pour">
        <View>
          <Avatar uri={me?.avatar} name={me?.name} size={58} />
          <View style={[styles.plus, { backgroundColor: t.accent, borderColor: t.bg }]}>
            <Icon name="add" size={15} color={t.textOnAccent} />
          </View>
        </View>
        <Text style={[type.caption, { color: t.textSecondary, marginTop: 7 }]} numberOfLines={1}>
          Your pour
        </Text>
      </Bounce>

      {people.map((p) => (
        <Bounce
          key={p.id}
          onPress={() => onOpenProfile?.(p.id)}
          haptic="light"
          scaleTo={0.92}
          style={styles.cell}
          accessibilityLabel={`Open ${p.name}'s profile`}
        >
          <Avatar uri={p.avatar} name={p.name} size={58} ring />
          <Text style={[type.caption, { color: t.textSecondary, marginTop: 7 }]} numberOfLines={1}>
            {String(p.name || '').split(' ')[0]}
          </Text>
        </Bounce>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 14, gap: 15 },
  cell: { alignItems: 'center', width: 66 },
  plus: {
    position: 'absolute', right: -2, bottom: -2, width: 23, height: 23, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5,
  },
});
