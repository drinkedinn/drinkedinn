// src/components/explore/LinkRow.js
// A single full-width link out of Explore. Same visual weight as SettingsRow
// but standalone, so one row doesn't have to pretend to be a settings group.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export default function LinkRow({ icon = 'chevron-forward', label, description, onPress, disabled }) {
  const { t } = useTheme();
  return (
    <Bounce
      onPress={onPress}
      haptic="light"
      scaleTo={0.99}
      disabled={disabled}
      style={styles.wrap}
      accessibilityLabel={description ? `${label}. ${description}` : label}
    >
      <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: t.surfaceAlt }]}>
          <Icon name={icon} size={18} color={t.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: t.text, fontWeight: '600' }]} numberOfLines={1}>{label}</Text>
          {!!description && (
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
        <Icon name="chevron-forward" size={17} color={t.textMuted} />
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 22 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 60,
  },
  iconWrap: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
