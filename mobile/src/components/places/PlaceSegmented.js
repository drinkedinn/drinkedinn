// src/components/places/PlaceSegmented.js
// Five segments do not fit in the fixed-width sliding control the feed uses
// ("Trending" alone eats a fifth of a 375pt screen), so Places gets a
// horizontally scrollable pill row instead. Same tokens, same type scale, and
// the selected pill is scrolled into view whenever it changes.
//
// Supports genuinely disabled segments: a disabled pill cannot be selected, and
// tapping it calls onDisabledPress so the screen can explain why.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export default function PlaceSegmented({ options = [], value, onChange, onDisabledPress }) {
  const { t } = useTheme();
  const scrollRef = useRef(null);
  const layouts = useRef({});
  const [viewportWidth, setViewportWidth] = useState(0);

  const scrollTo = useCallback(
    (key, animated = true) => {
      const l = layouts.current[key];
      if (!l || !viewportWidth) return;
      const target = Math.max(0, l.x + l.width / 2 - viewportWidth / 2);
      scrollRef.current?.scrollTo({ x: target, animated });
    },
    [viewportWidth]
  );

  // Keep the active pill visible — on selection changes and once measurements
  // land (layout and the ScrollView's own onLayout race on first render).
  useEffect(() => {
    scrollTo(value);
  }, [value, scrollTo]);

  const remember = useCallback(
    (key) => (e) => {
      const { x, width } = e.nativeEvent.layout;
      const prev = layouts.current[key];
      layouts.current[key] = { x, width };
      if (!prev && key === value) scrollTo(key, false);
    },
    [value, scrollTo]
  );

  const press = (opt) => {
    if (opt.disabled) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      onDisabledPress?.(opt);
      return;
    }
    if (opt.key === value) return;
    try { Haptics.selectionAsync(); } catch {}
    onChange?.(opt.key);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
      contentContainerStyle={styles.track}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((o) => {
        const active = o.key === value && !o.disabled;
        const fg = o.disabled ? t.textMuted : active ? t.textOnAccent : t.textSecondary;
        return (
          // onLayout lives on this wrapper, not inside Bounce: Bounce renders a
          // Pressable around an Animated.View, so a child's layout x is measured
          // against that view (always 0) rather than against the scroll content.
          <View key={o.key} onLayout={remember(o.key)}>
            <Bounce
              onPress={() => press(o)}
              haptic={null}
              scaleTo={0.96}
              accessibilityRole="tab"
              accessibilityLabel={o.label}
              accessibilityHint={o.disabled ? o.disabledHint : undefined}
              accessibilityState={{ selected: active, disabled: !!o.disabled }}
            >
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: active ? t.accent : t.surfaceAlt,
                    borderColor: active ? 'transparent' : t.border,
                    opacity: o.disabled ? 0.55 : 1,
                  },
                ]}
              >
                {o.disabled ? (
                  <Icon name="lock-closed" size={12} color={fg} />
                ) : o.icon ? (
                  <Icon name={o.icon} size={14} color={fg} />
                ) : null}
                <Text style={[type.label, { color: fg }]} numberOfLines={1}>
                  {o.label}
                </Text>
                {o.badge > 0 && (
                  <View style={[styles.badge, { backgroundColor: active ? t.textOnAccent : t.border }]}>
                    <Text
                      style={{
                        color: active ? t.accent : t.textSecondary,
                        fontSize: 10,
                        fontWeight: '800',
                      }}
                      allowFontScaling={false}
                    >
                      {o.badge > 99 ? '99+' : o.badge}
                    </Text>
                  </View>
                )}
              </View>
            </Bounce>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
