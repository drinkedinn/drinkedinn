// src/components/Skeleton.js — shimmering placeholders while content loads.
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

function Shimmer({ style }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1150, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-160, 260] });
  return (
    <View style={[styles.base, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <View style={styles.gleam} />
      </Animated.View>
    </View>
  );
}

export function PostSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Shimmer style={{ width: 44, height: 44, borderRadius: 22 }} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Shimmer style={{ width: '55%', height: 12, borderRadius: 6 }} />
          <Shimmer style={{ width: '35%', height: 10, borderRadius: 6, marginTop: 8 }} />
        </View>
      </View>
      <Shimmer style={{ width: '100%', height: 12, borderRadius: 6, marginTop: 16 }} />
      <Shimmer style={{ width: '80%', height: 12, borderRadius: 6, marginTop: 8 }} />
      <Shimmer style={{ width: '100%', height: 180, borderRadius: radius.md, marginTop: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.cardAlt, overflow: 'hidden' },
  gleam: { width: 120, height: '100%', backgroundColor: 'rgba(255,255,255,0.05)', transform: [{ skewX: '-20deg' }] },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.borderSoft },
  row: { flexDirection: 'row', alignItems: 'center' },
});

export default Shimmer;
