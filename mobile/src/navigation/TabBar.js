// src/navigation/TabBar.js
// Frosted tab bar with a centred compose action and an animated active pill.

import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/tokens';
import { Icon } from '../components/ui';
import { openCreateSheet } from '../components/composer/CreateSheet';

// Four named tabs plus the centre Create button — the five slots of the
// People / Places / Stories IA. Activity moved to a bell in the Home header;
// it was competing for a tab it did not earn, and Places needed the room.
const TABS = {
  Home: { on: 'home', off: 'home-outline', label: 'Home' },
  Explore: { on: 'compass', off: 'compass-outline', label: 'Explore' },
  Places: { on: 'location', off: 'location-outline', label: 'Places' },
  Profile: { on: 'person-circle', off: 'person-circle-outline', label: 'Profile' },
};

function Tab({ routeName, focused, onPress, badge }) {
  const { t } = useTheme();
  const cfg = TABS[routeName] || { on: 'ellipse', off: 'ellipse-outline', label: routeName };
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(v, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  }, [focused]);

  return (
    <Pressable
      onPress={() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
        onPress();
      }}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={cfg.label}
    >
      <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }] }}>
        <View>
          <Icon name={focused ? cfg.on : cfg.off} size={23} color={focused ? t.accent : t.textMuted} />
          {badge > 0 && (
            <View style={[styles.badge, { backgroundColor: t.accent, borderColor: t.bg }]}>
              <Text style={{ color: t.textOnAccent, fontSize: 9, fontWeight: '800' }}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>
      </Animated.View>
      <Text style={[type.caption, { color: focused ? t.accent : t.textMuted, fontSize: 10.5, marginTop: 3 }]}>
        {cfg.label}
      </Text>
    </Pressable>
  );
}

export default function TabBar({ state, navigation, unreadCount = 0 }) {
  const { t, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  const go = (route, isFocused) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  const left = state.routes.slice(0, 2);
  const right = state.routes.slice(2);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 100}
        tint={t.blurTint}
        style={[styles.bar, { backgroundColor: t.tabBar, borderColor: t.border }, elevation(t, 2)]}
      >
        <View style={styles.side}>
          {left.map((r) => {
            const i = state.routes.indexOf(r);
            return (
              <Tab
                key={r.key}
                routeName={r.name}
                focused={state.index === i}
                onPress={() => go(r, state.index === i)}
                // Activity lost its tab to Places, so its unread badge moved to
                // Home — which is where the Activity bell now lives, in the
                // header. Home sits in the left slice, so the badge has to be
                // passed here as well as on the right.
                badge={r.name === 'Home' ? unreadCount : 0}
              />
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
            // Opens the "What are you sharing?" sheet rather than jumping
            // straight into a post composer — Story / Post / Place / Rating
            // are all first-class creates now.
            openCreateSheet({ navigation, source: 'tabbar' });
          }}
          style={[styles.compose, { backgroundColor: t.accent, borderColor: t.bg }, elevation(t, 2)]}
          accessibilityRole="button"
          accessibilityLabel="Share a moment"
        >
          <Icon name="add" size={28} color={t.textOnAccent} />
        </Pressable>

        <View style={styles.side}>
          {right.map((r) => {
            const i = state.routes.indexOf(r);
            return (
              <Tab
                key={r.key}
                routeName={r.name}
                focused={state.index === i}
                onPress={() => go(r, state.index === i)}
                badge={r.name === 'Home' ? unreadCount : 0}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row', alignItems: 'center', width: '94%', borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', paddingVertical: 9, paddingHorizontal: 6,
  },
  side: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  tab: { alignItems: 'center', justifyContent: 'center', width: 62, paddingVertical: 2 },
  badge: {
    position: 'absolute', top: -4, right: -7, minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5,
  },
  compose: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 4, marginTop: -20, borderWidth: 3,
  },
});
