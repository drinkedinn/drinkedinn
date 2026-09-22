// src/components/onboarding/StepTransition.js
// Cross-fade + slight lift between onboarding steps. Wraps the step content
// and re-plays whenever the `step` key changes, so pressing Next feels like
// the next page turning rather than a snap swap.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

export default function StepTransition({ step, children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    opacity.setValue(0);
    translate.setValue(14);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }),
    ]).start();
  }, [step, opacity, translate]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity, transform: [{ translateY: translate }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
});
