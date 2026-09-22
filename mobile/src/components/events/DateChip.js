// src/components/events/DateChip.js
// Calendar-tear-off style date chip used on event cards and the detail hero.
// Two sizes: `md` for cards, `lg` for the detail header.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { chipParts } from './dateUtils';

export default function DateChip({ date, size = 'md' }) {
  const { t } = useTheme();
  const { top, bottom } = chipParts(date);
  const s = SIZES[size] || SIZES.md;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: s.w,
          backgroundColor: t.surface,
          borderColor: t.border,
        },
      ]}
    >
      <View style={[styles.top, { backgroundColor: t.accent }]}>
        <Text
          style={{
            color: t.textOnAccent,
            fontSize: s.topFont,
            fontWeight: '800',
            letterSpacing: 0.8,
          }}
        >
          {top || '—'}
        </Text>
      </View>
      <View style={styles.bottom}>
        <Text
          style={{
            color: t.text,
            fontSize: s.bottomFont,
            fontWeight: '700',
            letterSpacing: -0.5,
          }}
        >
          {bottom || '?'}
        </Text>
      </View>
    </View>
  );
}

const SIZES = {
  md: { w: 46, topFont: 10, bottomFont: 18, topH: 16, bottomH: 30 },
  lg: { w: 64, topFont: 12, bottomFont: 26, topH: 22, bottomH: 42 },
};

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'stretch',
  },
  top: { paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  bottom: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
});
