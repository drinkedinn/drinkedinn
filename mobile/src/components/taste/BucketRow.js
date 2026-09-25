// src/components/taste/BucketRow.js
// A "want to try" row. Left checkbox toggles the checked state through
// PATCH /bucketlist/:id/check, with a satisfying success haptic when it lands.
// Trailing overflow menu opens Delete confirmation.

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export default function BucketRow({ item, onToggle, onDelete }) {
  const { t, elevation } = useTheme();
  const checked = !!item?.checked;
  const name = item?.drink_name || 'Untitled';
  const scale = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: checked ? 1 : 0, useNativeDriver: true, speed: 22, bounciness: 8 }).start();
  }, [checked, scale]);

  const openMenu = () => {
    Alert.alert(name, 'Manage this bottle', [
      {
        text: 'Remove from list',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Remove from your list?', "You can always add it again.", [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => onDelete?.(item) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <Bounce
        onPress={() => onToggle?.(item)}
        haptic={checked ? 'light' : 'medium'}
        scaleTo={0.85}
        hitSlop={10}
        accessibilityLabel={checked ? `Mark ${name} as not yet tried` : `Mark ${name} as tried`}
        style={[
          styles.check,
          {
            backgroundColor: checked ? t.accent : 'transparent',
            borderColor: checked ? t.accent : t.borderStrong,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Icon name="checkmark" size={16} color={checked ? t.textOnAccent : 'transparent'} />
        </Animated.View>
      </Bounce>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={[
            type.body,
            {
              color: checked ? t.textMuted : t.text,
              textDecorationLine: checked ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={2}
        >
          {name}
        </Text>
        {checked && (
          <Text style={[type.caption, { color: t.accent, marginTop: 3, fontWeight: '600' }]}>
            Tried
          </Text>
        )}
      </View>

      <Bounce onPress={openMenu} haptic="light" hitSlop={10} scaleTo={0.85} accessibilityLabel="More options" style={styles.menuBtn}>
        <Icon name="ellipsis-horizontal" size={18} color={t.textMuted} />
      </Bounce>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
});
