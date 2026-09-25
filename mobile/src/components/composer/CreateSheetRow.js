// src/components/composer/CreateSheetRow.js
// One choice inside the Create sheet: tinted icon chip, label, one-line hint.
//
// Plain Pressable rather than <Bounce> on purpose — a row that springs while
// the sheet underneath it is also animating reads as jitter. The pressed
// background is the feedback; the haptic fires in the sheet.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';

export default function CreateSheetRow({ action, first, onPress, disabled }) {
  const { t } = useTheme();
  if (!action) return null;

  const { label, subtitle, icon } = action;

  return (
    <Pressable
      onPress={disabled ? undefined : () => onPress?.(action)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={subtitle || undefined}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? t.surfacePress : 'transparent',
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: t.divider,
        },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={[styles.chip, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
        <Icon name={icon || 'ellipse-outline'} size={19} color={t.accent} />
      </View>

      <View style={styles.text}>
        <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
          {label}
        </Text>
        {!!subtitle && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <Icon name="chevron-forward" size={16} color={t.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 64,
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
});
