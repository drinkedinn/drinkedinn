// src/components/safety/SafetyNotice.js
// A calm block of standing guidance — never an error, never a celebration.
// Two tones: neutral for "here is how this works", danger for the one line
// somebody might need to read in a hurry.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';

export default function SafetyNotice({
  icon = 'information-circle-outline',
  tone = 'neutral',
  title,
  body,
  children,
  style,
}) {
  const { t } = useTheme();
  const danger = tone === 'danger';

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: danger ? t.dangerSoft : t.surface,
          borderColor: danger ? t.danger : t.border,
        },
        style,
      ]}
      accessible={!children}
      accessibilityRole={children ? undefined : 'text'}
    >
      <View style={styles.head}>
        <View style={[styles.chip, { backgroundColor: danger ? t.surface : t.surfaceAlt }]}>
          <Icon name={icon} size={16} color={danger ? t.danger : t.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          {!!title && (
            <Text style={[type.h3, { color: danger ? t.danger : t.text }]}>{title}</Text>
          )}
          {!!body && (
            <Text
              style={[
                type.body,
                { color: t.textSecondary, lineHeight: 21, marginTop: title ? 5 : 0 },
              ]}
            >
              {body}
            </Text>
          )}
        </View>
      </View>
      {!!children && <View style={{ marginTop: 12 }}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
  },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  chip: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
