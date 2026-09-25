// src/components/messages/UnreadBadge.js
// Small numeric pill used on the header icon and in conversation rows.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';

export default function UnreadBadge({ count = 0, size = 'md', style }) {
  const { t } = useTheme();
  if (!count || count <= 0) return null;

  const label = count > 99 ? '99+' : String(count);
  const dims =
    size === 'sm'
      ? { h: 16, pad: 5, font: 10 }
      : size === 'lg'
      ? { h: 22, pad: 8, font: 12 }
      : { h: 18, pad: 6, font: 11 };

  return (
    <View
      accessibilityLabel={`${count} unread`}
      style={[
        styles.badge,
        {
          backgroundColor: t.accent,
          height: dims.h,
          minWidth: dims.h,
          paddingHorizontal: dims.pad,
        },
        style,
      ]}
    >
      <Text
        style={[
          type.caption,
          { color: t.textOnAccent, fontWeight: '800', fontSize: dims.font, lineHeight: dims.font + 2 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
