// src/components/onboarding-v2/WelcomeHero.js
// The welcome-step artwork. Drawn entirely from theme tokens and a gradient —
// no bundled image, no remote asset, so it is correct in both palettes and
// costs nothing to load on a cold first run.
//
// The three glyphs are the brand triad, in brand order: People, Places,
// Stories. Drinks are a detail of a story, never the subject, so nothing here
// depicts one.

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';

const TRIAD = [
  { icon: 'people-outline', label: 'People' },
  { icon: 'location-outline', label: 'Places' },
  { icon: 'book-outline', label: 'Stories' },
];

export default function WelcomeHero() {
  const { t, elevation } = useTheme();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });

  return (
    <View style={styles.wrap} accessible accessibilityRole="image" accessibilityLabel="People, places and stories">
      <View style={[styles.halo, { backgroundColor: t.accentSoft }]} />

      <Animated.View style={{ transform: [{ translateY }] }}>
        <LinearGradient
          colors={[t.accent, t.accentHover]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.orb, elevation(t, 3)]}
        >
          <Icon name="people-outline" size={44} color={t.textOnAccent} />
        </LinearGradient>
      </Animated.View>

      <View style={styles.triad}>
        {TRIAD.map((item) => (
          <View
            key={item.label}
            style={[styles.chip, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <Icon name={item.icon} size={15} color={t.accent} />
            <Text style={[type.caption, { color: t.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    top: -46,
  },
  orb: {
    width: 104,
    height: 104,
    borderRadius: radius.xl + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triad: { flexDirection: 'row', gap: 8, marginTop: 26 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
