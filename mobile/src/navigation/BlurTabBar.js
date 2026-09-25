// src/navigation/BlurTabBar.js — frosted glass tab bar with a floating compose button.
import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, shadow } from '../theme';
import { tap, press } from '../ui/haptics';

const ICONS = { Feed: '🏠', Explore: '🧭', Notifications: '🔔', Profile: '👤' };

function TabButton({ label, icon, focused, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const go = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.8, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 10 }),
    ]).start();
    tap();
    onPress();
  };
  return (
    <Pressable style={styles.tab} onPress={go} hitSlop={6}>
      <Animated.Text style={[styles.icon, { transform: [{ scale }], opacity: focused ? 1 : 0.5 }]}>{icon}</Animated.Text>
      <View style={[styles.dot, focused && styles.dotActive]} />
    </Pressable>
  );
}

export default function BlurTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes;

  const onTab = (route, isFocused) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <BlurView intensity={Platform.OS === 'ios' ? 40 : 90} tint="dark" style={styles.bar}>
        <View style={styles.side}>
          {left.map((r) => (
            <TabButton key={r.key} label={r.name} icon={ICONS[r.name]} focused={state.index === state.routes.indexOf(r)} onPress={() => onTab(r, state.index === state.routes.indexOf(r))} />
          ))}
        </View>

        <Pressable onPress={() => { press(); navigation.navigate('Compose'); }} style={styles.createWrap} hitSlop={8}>
          <LinearGradient colors={gradients.whisky} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.create}>
            <Text style={styles.createPlus}>+</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.side}>
          {right.map((r) => (
            <TabButton key={r.key} label={r.name} icon={ICONS[r.name]} focused={state.index === state.routes.indexOf(r)} onPress={() => onTab(r, state.index === state.routes.indexOf(r))} />
          ))}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row', alignItems: 'center', width: '92%', marginBottom: 4,
    borderRadius: 30, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    paddingVertical: 10, paddingHorizontal: 8, backgroundColor: 'rgba(16,18,28,0.6)',
    ...shadow.card,
  },
  side: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  tab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, width: 56 },
  icon: { fontSize: 22 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent', marginTop: 5 },
  dotActive: { backgroundColor: colors.whisky },
  createWrap: { marginHorizontal: 6, marginTop: -22 },
  create: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg, ...shadow.glow },
  createPlus: { color: '#1a1206', fontSize: 30, fontWeight: '800', lineHeight: 34, marginTop: -2 },
});
