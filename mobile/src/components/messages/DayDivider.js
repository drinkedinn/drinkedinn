// src/components/messages/DayDivider.js
// The "Today" / "Yesterday" / "March 12" separator between messages that
// crossed a calendar day.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';

export default function DayDivider({ label }) {
  const { t } = useTheme();
  if (!label) return null;
  return (
    <View style={styles.row}>
      <View style={[styles.rule, { backgroundColor: t.divider }]} />
      <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>{label}</Text>
      <View style={[styles.rule, { backgroundColor: t.divider }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    marginVertical: 14,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
