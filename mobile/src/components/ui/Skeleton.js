// src/components/ui/Skeleton.js
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';

export function Shimmer({ style }) {
  const { t } = useTheme();
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-180, 320] });

  return (
    <View style={[{ backgroundColor: t.skeleton, overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <View style={{ width: 110, height: '100%', backgroundColor: t.skeletonSheen, transform: [{ skewX: '-18deg' }] }} />
      </Animated.View>
    </View>
  );
}

export function PostSkeleton() {
  const { t, elevation } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <View style={styles.row}>
        <Shimmer style={{ width: 42, height: 42, borderRadius: 21 }} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Shimmer style={{ width: '50%', height: 12, borderRadius: 6 }} />
          <Shimmer style={{ width: '32%', height: 10, borderRadius: 5, marginTop: 8 }} />
        </View>
      </View>
      <Shimmer style={{ width: '100%', height: 11, borderRadius: 6, marginTop: 16 }} />
      <Shimmer style={{ width: '78%', height: 11, borderRadius: 6, marginTop: 8 }} />
      <Shimmer style={{ width: '100%', height: 170, borderRadius: radius.md, marginTop: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 16, marginHorizontal: 16, marginBottom: 14, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
