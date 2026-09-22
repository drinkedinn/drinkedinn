// src/components/places/QuietCard.js
// A low-key section note. Used for two different "there is nothing here" cases
// on a place profile:
//   - a section that is genuinely empty (no friends have been, no stories yet)
//   - a section the server has no endpoint for yet (ratings, events) — those
//     pass pill="Coming soon"
//
// Deliberately quieter than EmptyState: four stacked full-height empty states
// at the bottom of a profile read as breakage, where a soft card reads as
// "not yet".

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';

function QuietCard({ icon = 'sparkles-outline', title, body, pill }) {
  const { t } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: t.surface }]}>
        <Icon name={icon} size={17} color={t.textMuted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.label, { color: t.textSecondary }]}>{title}</Text>
        {!!body && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 3, lineHeight: 17 }]}>{body}</Text>
        )}
      </View>
      {!!pill && (
        <View style={[styles.pill, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[type.caption, { color: t.textMuted, fontWeight: '700' }]}>{pill}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export default memo(QuietCard);
