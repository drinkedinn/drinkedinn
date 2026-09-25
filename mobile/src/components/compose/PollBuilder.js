// src/components/compose/PollBuilder.js
// Optional poll attached to a pour. The API takes poll_options[] and needs at
// least two non-empty choices for has_poll to be set server-side.

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export const MAX_OPTIONS = 4;

export default function PollBuilder({ options, onChange, onClose }) {
  const { t } = useTheme();

  const setAt = (i, val) => {
    const next = [...options];
    next[i] = val;
    onChange(next);
  };

  const removeAt = (i) => {
    if (options.length <= 2) return;
    onChange(options.filter((_, idx) => idx !== i));
  };

  return (
    <View style={[styles.wrap, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
      <View style={styles.head}>
        <Icon name="bar-chart-outline" size={16} color={t.textSecondary} />
        <Text style={[type.label, { color: t.text, flex: 1 }]}>Poll</Text>
        <Bounce onPress={onClose} haptic="light" hitSlop={10} accessibilityLabel="Remove poll">
          <Icon name="close" size={17} color={t.textMuted} />
        </Bounce>
      </View>

      {options.map((opt, i) => (
        <View key={i} style={styles.optRow}>
          <TextInput
            value={opt}
            onChangeText={(v) => setAt(i, v)}
            placeholder={`Option ${i + 1}`}
            placeholderTextColor={t.textMuted}
            maxLength={40}
            style={[styles.input, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
          />
          {options.length > 2 && (
            <Bounce onPress={() => removeAt(i)} haptic="light" hitSlop={8} accessibilityLabel={`Remove option ${i + 1}`}>
              <Icon name="remove-circle-outline" size={20} color={t.textMuted} />
            </Bounce>
          )}
        </View>
      ))}

      {options.length < MAX_OPTIONS && (
        <Bounce onPress={() => onChange([...options, ''])} haptic="light" style={styles.addRow}>
          <Icon name="add-circle-outline" size={17} color={t.accent} />
          <Text style={[type.label, { color: t.accent }]}>Add option</Text>
        </Bounce>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, borderRadius: radius.md, borderWidth: 1, padding: 12, gap: 9 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  input: { flex: 1, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14.5 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4, paddingLeft: 2 },
});
