// src/components/compose/DrinkPicker.js
// Horizontal drink selector. The emoji here is content — it's what the user is
// actually drinking and it ships with the post — not decorative UI chrome.

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Bounce } from '../ui';

export const DRINKS = [
  { emoji: '🥃', label: 'Whisky' },
  { emoji: '🍺', label: 'Beer' },
  { emoji: '🍷', label: 'Wine' },
  { emoji: '🍸', label: 'Cocktail' },
  { emoji: '🍹', label: 'Tiki' },
  { emoji: '🥂', label: 'Bubbles' },
  { emoji: '🍶', label: 'Sake' },
  { emoji: '🧉', label: 'Mate' },
  { emoji: '☕', label: 'Coffee' },
  { emoji: '🧃', label: 'Soft' },
];

export default function DrinkPicker({ value, onChange }) {
  const { t } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {DRINKS.map((d) => {
        const active = d.emoji === value;
        return (
          <Bounce
            key={d.emoji}
            haptic={null}
            scaleTo={0.9}
            onPress={() => { try { Haptics.selectionAsync(); } catch {} onChange(d.emoji); }}
            accessibilityLabel={d.label}
          >
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: active ? t.accentSoft : t.surface,
                  borderColor: active ? t.accent : t.border,
                  borderWidth: active ? 1.8 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 20 }}>{d.emoji}</Text>
              <Text style={[type.caption, { color: active ? t.accentText : t.textMuted, fontWeight: active ? '700' : '500' }]}>
                {d.label}
              </Text>
            </View>
          </Bounce>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 9, paddingVertical: 2 },
  chip: { alignItems: 'center', gap: 3, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, minWidth: 66 },
});
