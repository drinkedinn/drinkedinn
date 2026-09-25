// src/components/sommelier/TypingIndicator.js
// Three-dot typing bubble shown while the Innkeeper is thinking.
// Uses the same bubble skin as an assistant message so the transition
// from "thinking" to "answered" doesn't visually pop.

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';

function Dot({ delay }) {
  const { t } = useTheme();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(v, { toValue: 0, duration: 420, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);

  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: t.textSecondary, opacity, transform: [{ translateY }] },
      ]}
    />
  );
}

export default function TypingIndicator() {
  const { t } = useTheme();
  return (
    <View style={styles.row} accessibilityLabel="The Innkeeper is thinking">
      <View style={[styles.bubble, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Dot delay={0} />
        <Dot delay={140} />
        <Dot delay={280} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.lg,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 60,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
