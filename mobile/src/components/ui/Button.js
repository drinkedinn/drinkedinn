// src/components/ui/Button.js
import React from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import Bounce from './Pressable';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';

export default function Button({
  label, onPress, variant = 'primary', size = 'md',
  icon, loading, disabled, full, style,
}) {
  const { t, elevation } = useTheme();

  const palette = {
    primary: { bg: t.accent, fg: t.textOnAccent, border: 'transparent' },
    secondary: { bg: 'transparent', fg: t.text, border: t.borderStrong },
    subtle: { bg: t.surfaceAlt, fg: t.text, border: 'transparent' },
    danger: { bg: t.dangerSoft, fg: t.danger, border: 'transparent' },
  }[variant];

  const dims = {
    sm: { pv: 8, ph: 14, font: 13, icon: 16 },
    md: { pv: 13, ph: 20, font: 15, icon: 18 },
    lg: { pv: 16, ph: 24, font: 16, icon: 20 },
  }[size];

  return (
    <Bounce onPress={onPress} disabled={disabled || loading} haptic="medium" style={full && { width: '100%' }}>
      <View
        style={[
          styles.base,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            paddingVertical: dims.pv,
            paddingHorizontal: dims.ph,
          },
          variant === 'primary' && elevation(t, 1),
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.fg} size="small" />
        ) : (
          <>
            {icon && <Icon name={icon} size={dims.icon} color={palette.fg} />}
            <Text style={{ color: palette.fg, fontSize: dims.font, fontWeight: '600' }}>{label}</Text>
          </>
        )}
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: radius.md, borderWidth: 1.5,
  },
});
