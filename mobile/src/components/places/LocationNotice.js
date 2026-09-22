// src/components/places/LocationNotice.js
// Shown when Nearby cannot run: either this build has no location module, or
// the person declined the permission. One clear sentence and one clear way out.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

function LocationNotice({
  title = 'Turn on location to see what’s nearby',
  body,
  actionLabel = 'Settings',
  onAction,
  onDismiss,
}) {
  const { t } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
      <View style={[styles.iconWrap, { backgroundColor: t.surface }]}>
        <Icon name="location-outline" size={17} color={t.accent} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.label, { color: t.text }]}>{title}</Text>
        {!!body && (
          <Text style={[type.caption, { color: t.textSecondary, marginTop: 3, lineHeight: 17 }]}>{body}</Text>
        )}
      </View>

      {!!onAction && (
        <Bounce
          onPress={onAction}
          haptic="light"
          style={[styles.action, { backgroundColor: t.surface, borderColor: t.accentBorder }]}
          accessibilityLabel={actionLabel}
        >
          <Text style={[type.caption, { color: t.accentText, fontWeight: '700' }]}>{actionLabel}</Text>
        </Bounce>
      )}

      {!!onDismiss && (
        <Bounce onPress={onDismiss} haptic="light" hitSlop={12} accessibilityLabel="Dismiss this notice">
          <Icon name="close" size={16} color={t.textMuted} />
        </Bounce>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export default memo(LocationNotice);
