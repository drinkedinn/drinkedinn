// src/components/onboarding/WelcomeArt.js
// A warm hero illustration built entirely from tokens — no bundled image so
// it stays crisp at any density and shifts with the theme.
//
// Two overlapping glass silhouettes on a soft gradient dawn, with a scatter of
// dots to hint at a bar's ambient light. Purely decorative: hidden from a
// screen reader.

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeContext';

export default function WelcomeArt() {
  const { t } = useTheme();
  const width = Math.min(Dimensions.get('window').width - 40, 360);
  const height = Math.round(width * 0.78);

  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 3400, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 3400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const glassLift = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const spark = drift.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });

  return (
    <View
      style={[styles.wrap, { width, height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Dawn wash */}
      <LinearGradient
        colors={[t.accentSoft, t.blueSoft, 'transparent']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Backing halo behind the glasses */}
      <View
        style={[
          styles.halo,
          {
            width: width * 0.7,
            height: width * 0.7,
            borderRadius: width * 0.35,
            backgroundColor: t.accentSoft,
          },
        ]}
      />

      {/* Ambient sparkles */}
      {SPARKS.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: s.x * width,
            top: s.y * height,
            width: s.r * 2,
            height: s.r * 2,
            borderRadius: s.r,
            backgroundColor: i % 2 === 0 ? t.accent : t.blue,
            opacity: spark,
          }}
        />
      ))}

      {/* Two glasses, front and back */}
      <Animated.View style={{ transform: [{ translateY: glassLift }] }}>
        <View style={styles.pair}>
          <Glass width={width * 0.28} height={width * 0.44} tint={t.accent} rim={t.accentText} shadow={t.shadowColor} tilt={-6} />
          <View style={{ width: width * 0.06 }} />
          <Glass width={width * 0.32} height={width * 0.5} tint={t.blue} rim={t.blueText} shadow={t.shadowColor} tilt={5} />
        </View>
      </Animated.View>
    </View>
  );
}

function Glass({ width, height, tint, rim, shadow, tilt = 0 }) {
  const bowl = height * 0.62;
  const stem = height * 0.24;
  const foot = height - bowl - stem;
  const rimHeight = 4;
  return (
    <View style={{ transform: [{ rotate: `${tilt}deg` }] }}>
      <View
        style={{
          width,
          height: bowl,
          borderTopLeftRadius: width * 0.5,
          borderTopRightRadius: width * 0.5,
          borderBottomLeftRadius: width * 0.35,
          borderBottomRightRadius: width * 0.35,
          backgroundColor: tint,
          opacity: 0.85,
          overflow: 'hidden',
          shadowColor: shadow,
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
        }}
      >
        {/* Rim highlight */}
        <View style={{ position: 'absolute', top: 0, left: width * 0.14, right: width * 0.14, height: rimHeight, borderRadius: rimHeight, backgroundColor: rim, opacity: 0.9 }} />
        {/* Liquid line */}
        <View style={{ position: 'absolute', top: bowl * 0.32, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      </View>
      {/* Stem */}
      <View style={{ alignSelf: 'center', width: 4, height: stem, backgroundColor: rim, opacity: 0.5, marginTop: -1 }} />
      {/* Foot */}
      <View style={{ alignSelf: 'center', width: width * 0.6, height: foot, borderRadius: foot / 2, backgroundColor: rim, opacity: 0.35 }} />
    </View>
  );
}

const SPARKS = [
  { x: 0.12, y: 0.18, r: 3.2 },
  { x: 0.2, y: 0.36, r: 2 },
  { x: 0.86, y: 0.22, r: 2.6 },
  { x: 0.78, y: 0.48, r: 1.6 },
  { x: 0.5, y: 0.08, r: 2.2 },
  { x: 0.07, y: 0.58, r: 1.8 },
  { x: 0.92, y: 0.62, r: 2.2 },
];

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 32,
    paddingBottom: 22,
  },
  halo: {
    position: 'absolute',
    top: '18%',
    opacity: 0.55,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
