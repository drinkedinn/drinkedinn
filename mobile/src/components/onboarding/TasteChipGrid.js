// src/components/onboarding/TasteChipGrid.js
// Multi-select grid of taste categories. Chips use icons from the shared
// Icon component (no emoji as UI), stay legible in both themes, and animate
// selection with a springy scale so the choice feels tactile.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export default function TasteChipGrid({ options, value = [], onToggle }) {
  return (
    <View style={styles.grid}>
      {options.map((opt) => {
        const selected = value.includes(opt.key);
        return (
          <Chip
            key={opt.key}
            option={opt}
            selected={selected}
            onPress={() => onToggle(opt.key)}
          />
        );
      })}
    </View>
  );
}

function Chip({ option, selected, onPress }) {
  const { t } = useTheme();

  const bg = selected ? t.accentSoft : t.surface;
  const border = selected ? t.accent : t.border;
  const tint = selected ? t.accentText : t.textSecondary;

  return (
    <Bounce
      onPress={onPress}
      haptic="light"
      scaleTo={0.94}
      accessibilityLabel={`${option.label}${option.hint ? `, ${option.hint}` : ''}`}
      accessibilityRole="checkbox"
      style={[
        styles.chip,
        { backgroundColor: bg, borderColor: border, borderWidth: selected ? 1.75 : 1 },
      ]}
    >
      <Icon name={option.icon} size={18} color={tint} />
      <Text style={[type.label, { color: selected ? t.text : t.text, flexShrink: 1 }]} numberOfLines={1}>
        {option.label}
      </Text>
      {option.badge ? (
        <View style={[styles.badge, { backgroundColor: selected ? t.accent : t.surfaceAlt }]}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: selected ? t.textOnAccent : t.textMuted, letterSpacing: 0.5 }}>
            {option.badge}
          </Text>
        </View>
      ) : null}
    </Bounce>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.pill,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 2,
  },
});
