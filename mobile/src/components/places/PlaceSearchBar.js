// src/components/places/PlaceSearchBar.js
// The search field above every Places segment and at the top of Add place.
// Controlled — debouncing belongs to the caller's hook, not to the input, so
// typing never feels laggy.

import React, { forwardRef } from 'react';
import { View, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

const PlaceSearchBar = forwardRef(function PlaceSearchBar(
  { value, onChangeText, placeholder = 'Search places', loading, autoFocus, onSubmitEditing, style },
  ref
) {
  const { t } = useTheme();
  const hasText = !!String(value || '').length;

  return (
    <View style={[styles.wrap, { backgroundColor: t.surfaceAlt, borderColor: t.border }, style]}>
      <Icon name="search-outline" size={17} color={t.textMuted} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        style={[styles.input, { color: t.text }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        maxLength={80}
        clearButtonMode="never"
        accessibilityLabel={placeholder}
      />
      {loading ? (
        <ActivityIndicator size="small" color={t.textMuted} />
      ) : hasText ? (
        <Bounce
          onPress={() => onChangeText?.('')}
          haptic="light"
          hitSlop={12}
          accessibilityLabel="Clear search"
        >
          <Icon name="close-circle" size={17} color={t.textMuted} />
        </Bounce>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 13,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
});

export default PlaceSearchBar;
