// src/components/explore/InnkeeperCard.js
// Full-width entry point to the Innkeeper. Kept visually identical to the card
// the previous Explore screen rendered inline, so nothing shifts under people
// who already know where it lives.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export default function InnkeeperCard({ onPress }) {
  const { t } = useTheme();
  return (
    <Bounce
      onPress={onPress}
      haptic="medium"
      scaleTo={0.98}
      style={styles.wrap}
      accessibilityLabel="Ask the Innkeeper"
    >
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[styles.badge, { backgroundColor: t.accentSoft }]}>
          <Icon name="sparkles-outline" size={22} color={t.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: t.text, fontWeight: '700' }]}>Ask the Innkeeper</Text>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>
            Recommendations from your own taste.
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={t.textMuted} />
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 22 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 16,
  },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
