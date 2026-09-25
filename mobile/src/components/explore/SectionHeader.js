// src/components/explore/SectionHeader.js
// One header shape for every editorial section on Explore, so the rails stack
// with a single consistent rhythm. Matches the spacing TonightRail already
// uses (16pt gutter, 10pt below) so the imported rails line up with ours.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export default function SectionHeader({ title, subtitle, actionLabel = 'See all', onAction }) {
  const { t } = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[type.h2, { color: t.text }]} numberOfLines={2}>{title}</Text>
        {!!subtitle && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!onAction && (
        <Bounce
          onPress={onAction}
          haptic="light"
          scaleTo={0.94}
          hitSlop={10}
          accessibilityLabel={`${actionLabel}, ${title}`}
        >
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 1 },
});
