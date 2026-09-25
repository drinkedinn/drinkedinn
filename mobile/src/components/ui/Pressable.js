// src/components/ui/Pressable.js
// Springy press primitive used across the app.

import React, { useRef } from 'react';
import { Pressable as RNPressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function Bounce({
  children, onPress, onLongPress, style, scaleTo = 0.96,
  haptic = 'light', disabled, hitSlop, accessibilityLabel, accessibilityRole = 'button',
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (v) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 45, bounciness: 6 }).start();

  const fire = () => {
    if (!haptic) return;
    try {
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      Haptics.impactAsync(map[haptic] || map.light);
    } catch {}
  };

  return (
    <RNPressable
      onPressIn={() => { if (!disabled) { spring(scaleTo); fire(); } }}
      onPressOut={() => spring(1)}
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </RNPressable>
  );
}
