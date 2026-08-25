// src/components/Bounce.js
// A Pressable that springs down on touch — the base tactile interaction used
// across the app. Optional haptic on press-in.
import React, { useRef } from 'react';
import { Pressable, Animated } from 'react-native';
import { tap } from '../ui/haptics';

export default function Bounce({ children, onPress, style, scaleTo = 0.94, haptic = true, disabled, hitSlop }) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (v) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <Pressable
      onPressIn={() => { if (!disabled) { to(scaleTo); if (haptic) tap(); } }}
      onPressOut={() => to(1)}
      onPress={disabled ? undefined : onPress}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
