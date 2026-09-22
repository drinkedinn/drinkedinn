// src/screens/profile/PillarTabs.js
// The six-pillar selector that replaces the old three-segment row.
//
// Six labels do not fit a flex-divided segmented control at phone width
// ("Collection" alone needs ~100pt), so this is a scrolling pill rail instead —
// the same pattern the platform uses for long filter rows. The selected pill
// is scrolled into view whenever it changes, including when it is selected
// programmatically, so a tab is never left off-screen.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../../components/ui';
import { tap as tapHaptic } from '../../ui/haptics';

export default function PillarTabs({ tabs, value, onChange }) {
  const { t } = useTheme();
  const scrollRef = useRef(null);
  const layouts = useRef({});
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);

  const list = Array.isArray(tabs) ? tabs : [];

  // Keep the active pill visible. Runs after layout so the measurements the
  // maths depends on are real numbers, never zero.
  useEffect(() => {
    const l = layouts.current[value];
    if (!l || !viewport || !content) return;
    const target = l.x + l.width / 2 - viewport / 2;
    const max = Math.max(0, content - viewport);
    scrollRef.current?.scrollTo({
      x: Math.min(Math.max(0, target), max),
      animated: true,
    });
  }, [value, viewport, content]);

  const select = useCallback(
    (key) => {
      if (key === value) return;
      tapHaptic();
      onChange?.(key);
    },
    [value, onChange],
  );

  return (
    <View style={[styles.wrap, { borderBottomColor: t.divider }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onLayout={(e) => setViewport(e?.nativeEvent?.layout?.width || 0)}
        onContentSizeChange={(w) => setContent(w || 0)}
        accessibilityRole="tablist"
      >
        {list.map((tab) => {
          const active = tab.key === value;
          return (
            // Bounce does not forward onLayout, and a measurement taken inside
            // the pill would be relative to the pill. This wrapper is a direct
            // child of the content container, so its x is the scroll offset the
            // "keep active pill visible" maths needs.
            <View
              key={tab.key}
              onLayout={(e) => {
                const l = e?.nativeEvent?.layout;
                if (l) layouts.current[tab.key] = { x: l.x, width: l.width };
              }}
            >
              <Bounce
                onPress={() => select(tab.key)}
                haptic={null}
                scaleTo={0.94}
                hitSlop={6}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                style={[
                  styles.pill,
                  {
                    backgroundColor: active ? t.accent : t.surfaceAlt,
                    borderColor: active ? 'transparent' : t.border,
                  },
                ]}
              >
                <View style={styles.pillInner}>
                  <Icon
                    name={tab.icon}
                    size={15}
                    color={active ? t.textOnAccent : t.textSecondary}
                  />
                  <Text
                    style={[
                      type.label,
                      { color: active ? t.textOnAccent : t.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </View>
              </Bounce>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  row: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  pillInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
