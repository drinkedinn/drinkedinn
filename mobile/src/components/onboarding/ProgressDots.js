// src/components/onboarding/ProgressDots.js
// Slim segmented progress bar sitting under the step header. Each segment
// animates its width as the flow advances, so momentum feels earned rather
// than snapped.

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export default function ProgressDots({ step, total }) {
  const { t } = useTheme();

  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: step }}>
      {Array.from({ length: total }).map((_, i) => (
        <Segment key={i} active={i < step} accent={t.accent} muted={t.surfaceAlt} />
      ))}
    </View>
  );
}

function Segment({ active, accent, muted }) {
  const v = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: active ? 1 : 0,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [active, v]);

  const bg = v.interpolate({ inputRange: [0, 1], outputRange: [muted, accent] });

  return (
    <View style={[styles.track, { backgroundColor: muted }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg, borderRadius: 3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 4,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
