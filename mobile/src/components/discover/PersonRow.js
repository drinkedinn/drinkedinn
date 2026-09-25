// src/components/discover/PersonRow.js
// Person result with an optimistic connect toggle.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Avatar, Icon, Bounce } from '../ui';

export default function PersonRow({ person, onOpen, onChanged }) {
  const { t } = useTheme();
  const [connected, setConnected] = useState(!!(person.is_connected || person.isConnected));
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    const next = !connected;
    setConnected(next);
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    try {
      await api.post(`/users/${person.id}/connect`);
      onChanged?.();
    } catch {
      setConnected(!next);
    } finally {
      setBusy(false);
    }
  };

  const mutual = person.mutual || 0;

  return (
    <View style={styles.row}>
      <Bounce onPress={() => onOpen?.(person.id)} haptic="light" scaleTo={0.98} style={styles.main}>
        <Avatar uri={person.avatar} name={person.name} size={48} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{person.name}</Text>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 1 }]} numberOfLines={1}>
            {person.title || 'DrinkedInn Member'}
          </Text>
          {mutual > 0 && (
            <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]}>
              {mutual} mutual connection{mutual > 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </Bounce>

      <Bounce onPress={toggle} haptic={null} scaleTo={0.94} accessibilityLabel={connected ? 'Disconnect' : 'Connect'}>
        <View
          style={[
            styles.btn,
            connected
              ? { backgroundColor: 'transparent', borderColor: t.borderStrong }
              : { backgroundColor: t.accent, borderColor: 'transparent' },
          ]}
        >
          {connected && <Icon name="checkmark" size={14} color={t.textSecondary} />}
          <Text style={[type.caption, { color: connected ? t.textSecondary : t.textOnAccent, fontWeight: '700' }]}>
            {connected ? 'Connected' : 'Connect'}
          </Text>
        </View>
      </Bounce>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, gap: 10 },
  main: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.4, minWidth: 92, justifyContent: 'center',
  },
});
