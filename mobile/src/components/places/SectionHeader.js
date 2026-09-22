// src/components/places/SectionHeader.js
// The overline + optional trailing action used between sections on the place
// profile. Matches the overline treatment used in SettingsGroup and PostDetail.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

function SectionHeader({ title, caption, actionLabel, onAction, style }) {
  const { t } = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]} numberOfLines={1}>
          {title}
        </Text>
        {!!caption && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]} numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>
      {!!actionLabel && !!onAction && (
        <Bounce onPress={onAction} haptic="light" hitSlop={10} accessibilityLabel={actionLabel}>
          <View style={styles.action}>
            <Text style={[type.label, { color: t.accent }]}>{actionLabel}</Text>
            <Icon name="chevron-forward" size={14} color={t.accent} />
          </View>
        </Bounce>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 26,
    marginBottom: 12,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});

export default memo(SectionHeader);
