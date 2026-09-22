// src/components/places/Chip.js
// Small token-only pill used for distance, visit counts and the country filter.
// tone: 'muted' (default) | 'accent' | 'solid'.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

function Chip({ icon, label, tone = 'muted', onPress, onDismiss, dismissLabel }) {
  const { t } = useTheme();

  const palette = {
    muted: { bg: t.surfaceAlt, fg: t.textSecondary, border: 'transparent' },
    accent: { bg: t.accentSoft, fg: t.accentText, border: t.accentBorder },
    solid: { bg: t.accent, fg: t.textOnAccent, border: 'transparent' },
  }[tone] || { bg: t.surfaceAlt, fg: t.textSecondary, border: 'transparent' };

  const body = (
    <View style={[styles.chip, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {!!icon && <Icon name={icon} size={12} color={palette.fg} />}
      <Text style={[type.caption, { color: palette.fg, fontWeight: '600' }]} numberOfLines={1}>
        {label}
      </Text>
      {!!onDismiss && (
        <Bounce
          onPress={onDismiss}
          haptic="light"
          hitSlop={10}
          accessibilityLabel={dismissLabel || `Clear ${label}`}
        >
          <Icon name="close" size={13} color={palette.fg} />
        </Bounce>
      )}
    </View>
  );

  if (!onPress) return body;
  return (
    <Bounce onPress={onPress} haptic="light" scaleTo={0.96} accessibilityLabel={label}>
      {body}
    </Bounce>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
});

export default memo(Chip);
