// src/components/onboarding-v2/StepShell.js
// Chrome shared by every onboarding step: back / "Step N of 6" / skip, an
// animated progress rail, the step body, and a pinned footer.
//
// Back and Skip are only rendered when the parent passes a handler, so a step
// that must be resolved (acceptance, finish) simply omits them rather than
// showing a dead control.

import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Icon } from '../ui';

export default function StepShell({ step, total, onBack, onSkip, children, footer }) {
  const { t } = useTheme();
  const progress = useRef(new Animated.Value(step / total)).current;
  const enter = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: Math.max(0, Math.min(1, step / total)),
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width percentage cannot run on the native driver
    }).start();
  }, [step, total, progress]);

  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, enter]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <View style={styles.side}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Go back a step"
            >
              <Icon name="chevron-back" size={26} color={t.text} />
            </Pressable>
          ) : null}
        </View>

        <Text style={[type.caption, { color: t.textMuted }]} allowFontScaling>
          Step {step} of {total}
        </Text>

        <View style={[styles.side, { alignItems: 'flex-end' }]}>
          {onSkip ? (
            <Pressable
              onPress={onSkip}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Skip this step"
            >
              <Text style={[type.label, { color: t.textSecondary }]}>Skip</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View
        style={[styles.track, { backgroundColor: t.surfaceAlt }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Onboarding progress, step ${step} of ${total}`}
      >
        <Animated.View style={[styles.fill, { backgroundColor: t.accent, width }]} />
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        {children}
      </Animated.View>

      {footer ? (
        <View style={[styles.footer, { backgroundColor: t.bg, borderTopColor: t.divider }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 40,
  },
  side: { width: 56, justifyContent: 'center' },
  track: { height: 3, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
