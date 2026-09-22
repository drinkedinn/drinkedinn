// src/components/safety/ResourceLink.js
// An outbound row to an organisation that can act where we cannot.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';
import { openWeb } from './safetyLinks';

export default function ResourceLink({ label, note, url, icon = 'open-outline', onFail }) {
  const { t } = useTheme();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await openWeb(url);
    if (!ok) onFail?.(url);
    setBusy(false);
  };

  return (
    <Pressable
      onPress={open}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={note ? `${label}. ${note}` : label}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? t.surfacePress : t.surfaceAlt,
          borderColor: t.border,
          opacity: busy ? 0.6 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: t.text }]}>{label}</Text>
        {!!note && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>{note}</Text>
        )}
      </View>
      <Icon name={icon} size={16} color={t.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 8,
  },
});
