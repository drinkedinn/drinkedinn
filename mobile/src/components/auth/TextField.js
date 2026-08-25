// src/components/auth/TextField.js
// Form field with a focus ring, inline error, and an optional trailing action.

import React, { useState, forwardRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';

const TextField = forwardRef(function TextField(
  { label, error, hint, icon, trailing, onTrailingPress, style, ...props },
  ref
) {
  const { t } = useTheme();
  const [focus, setFocus] = useState(false);

  const borderColor = error ? t.danger : focus ? t.accent : t.border;

  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && (
        <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginBottom: 7 }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.wrap,
          { backgroundColor: t.surface, borderColor, borderWidth: focus || error ? 1.8 : 1.2 },
          style,
        ]}
      >
        {!!icon && <Icon name={icon} size={18} color={focus ? t.accent : t.textMuted} />}
        <TextInput
          ref={ref}
          {...props}
          onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
          placeholderTextColor={t.textMuted}
          style={[styles.input, { color: t.text }]}
        />
        {!!trailing && (
          <Pressable onPress={onTrailingPress} hitSlop={10} accessibilityLabel="Toggle visibility">
            <Icon name={trailing} size={18} color={t.textMuted} />
          </Pressable>
        )}
      </View>
      {!!error && (
        <View style={styles.msgRow}>
          <Icon name="alert-circle" size={13} color={t.danger} />
          <Text style={[type.caption, { color: t.danger, flex: 1 }]}>{error}</Text>
        </View>
      )}
      {!error && !!hint && (
        <Text style={[type.caption, { color: t.textMuted, marginTop: 6, marginLeft: 2 }]}>{hint}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 52 },
  input: { flex: 1, fontSize: 15.5, paddingVertical: 14 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginLeft: 2 },
});

export default TextField;
