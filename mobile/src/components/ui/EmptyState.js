// src/components/ui/EmptyState.js
import React from 'react';
import { View, Text } from 'react-native';
import Icon from './Icon';
import Button from './Button';
import { useTheme } from '../../theme/ThemeContext';
import { type, radius } from '../../theme/tokens';

// Default icon is deliberately not a glass: this is THE fallback across the
// whole app, so a drink glyph here is the most-seen image in the product.
export default function EmptyState({ icon = 'sparkles-outline', title, body, actionLabel, onAction }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 72, paddingHorizontal: 40 }}>
      <View
        style={{
          width: 68, height: 68, borderRadius: radius.xl,
          backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}
      >
        <Icon name={icon} size={30} color={t.accent} />
      </View>
      <Text style={[type.h2, { color: t.text, textAlign: 'center' }]}>{title}</Text>
      {!!body && (
        <Text style={[type.body, { color: t.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }]}>
          {body}
        </Text>
      )}
      {!!actionLabel && (
        <View style={{ marginTop: 20 }}>
          <Button label={actionLabel} onPress={onAction} size="md" />
        </View>
      )}
    </View>
  );
}
