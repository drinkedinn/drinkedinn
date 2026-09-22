// src/components/events/DrinkChipPicker.js
// A compact drink-type picker for the events composer. Zero-proof and low-ABV
// options sit alongside the boozy ones — never as an afterthought.

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Bounce } from '../ui';

// A wide, honest set. Zero-proof leads.
const CHIPS = [
  { key: '🍹', label: 'Zero-proof' },
  { key: '🍵', label: 'Low & slow' },
  { key: '🍷', label: 'Wine' },
  { key: '🍺', label: 'Beer' },
  { key: '🍸', label: 'Cocktails' },
  { key: '🥃', label: 'Whisky' },
  { key: '🥂', label: 'Bubbles' },
  { key: '☕', label: 'Coffee' },
  { key: '🍶', label: 'Sake' },
  { key: '🫖', label: 'Tea' },
];

export default function DrinkChipPicker({ value, onChange }) {
  const { t } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      keyboardShouldPersistTaps="handled"
    >
      {CHIPS.map((c) => {
        const active = c.key === value;
        return (
          <Bounce
            key={c.key}
            onPress={() => onChange?.(c.key)}
            haptic="light"
            scaleTo={0.94}
            accessibilityLabel={c.label}
          >
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: active ? t.accentSoft : t.surface,
                  borderColor: active ? t.accentBorder : t.border,
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{c.key}</Text>
              <Text style={[type.caption, { color: active ? t.accentText : t.textSecondary, fontWeight: '600' }]}>
                {c.label}
              </Text>
            </View>
          </Bounce>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: 12, gap: 8, paddingBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
