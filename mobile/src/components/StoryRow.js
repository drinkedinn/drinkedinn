// src/components/StoryRow.js — horizontal gradient-ring "stories" strip.
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import Bounce from './Bounce';
import { colors, font } from '../theme';

export default function StoryRow({ me, people = [], onOpenProfile }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <View style={styles.item}>
        <View>
          <Avatar uri={me?.avatar} name={me?.name} size={58} />
          <View style={styles.plus}><Text style={styles.plusText}>+</Text></View>
        </View>
        <Text style={styles.label} numberOfLines={1}>Your pour</Text>
      </View>

      {people.map((p) => (
        <Bounce key={p.id} onPress={() => onOpenProfile?.(p.id)} haptic={false} style={styles.item} scaleTo={0.92}>
          <Avatar uri={p.avatar} name={p.name} size={58} ring />
          <Text style={styles.label} numberOfLines={1}>{(p.name || '').split(' ')[0]}</Text>
        </Bounce>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 14, paddingVertical: 14, gap: 16 },
  item: { alignItems: 'center', width: 70 },
  label: { color: colors.textDim, ...font.caption, marginTop: 7, maxWidth: 66 },
  plus: {
    position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.whisky, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: colors.bg,
  },
  plusText: { color: '#1a1206', fontWeight: '900', fontSize: 14, lineHeight: 16 },
});
