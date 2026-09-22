// src/components/taste/TypePicker.js
// A horizontally-scrolling chip row for choosing a drink type.
// Renders every option in DRINK_TYPES — Zero-proof and No-low ABV included
// alongside the others so they read as first-class picks, not an afterthought.

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';
import TYPES from './DRINK_TYPES';

export default function TypePicker({ value, onChange, style }) {
  const { t } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={style}
      keyboardShouldPersistTaps="handled"
    >
      {TYPES.map((opt) => {
        const active = value === opt.key;
        return (
          <Bounce
            key={opt.key}
            onPress={() => onChange(opt.key)}
            haptic="light"
            scaleTo={0.94}
            accessibilityLabel={opt.key}
            style={[
              styles.chip,
              {
                backgroundColor: active ? t.accentSoft : t.surface,
                borderColor: active ? t.accentBorder : t.border,
              },
            ]}
          >
            <Icon name={opt.icon} size={15} color={active ? t.accent : t.textSecondary} />
            <Text
              style={[
                type.label,
                { color: active ? t.accentText : t.textSecondary },
              ]}
              numberOfLines={1}
            >
              {opt.key}
            </Text>
          </Bounce>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
