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
import { Icon, Bounce } from '../ui';

// actionLabel/onAction added because an empty state that explains what is
// missing and offers no way to fix it is a dead end. Passing them to a
// component that did not accept them silently dropped the control.
function QuietCard({ icon = 'sparkles-outline', title, body, pill, actionLabel, onAction }) {
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
      {!!actionLabel && !!onAction && (
        <Bounce
          onPress={onAction}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={[styles.action, { borderColor: t.accentBorder, backgroundColor: t.accentSoft }]}
        >
          <Text style={[type.caption, { color: t.accentText, fontWeight: '700' }]}>{actionLabel}</Text>
        </Bounce>
      )}
      {!!pill && (
        <View style={[styles.pill, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[type.caption, { color: t.textMuted, fontWeight: '700' }]}>{pill}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
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
