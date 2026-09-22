// src/components/taste/ScoreControl.js
// A tactile 0-10 score picker in 0.5-point steps. Each step is a vertical bar
// whose height rises with the value — so the row reads as a physical ramp you
// can point to. Selecting fires a light haptic; the readout above updates in
// tabular-nums so it never jitters.
//
// The server stores rating as a float (parseFloat), so a 0.5-step decimal is
// safe. Values are clamped in [0, 10].

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Bounce } from '../ui';

const STEPS = 21; // 0, 0.5, 1, ..., 10

function scoreLabel(v) {
  if (v == null || Number.isNaN(v)) return '—';
  if (v <= 0) return 'Untried';
  if (v < 4) return 'A miss';
  if (v < 6) return 'Fine';
  if (v < 7.5) return 'Solid';
  if (v < 9) return 'Memorable';
  return 'Unforgettable';
}

export default function ScoreControl({ value, onChange, label = 'Score' }) {
  const { t } = useTheme();
  const v = typeof value === 'number' ? value : 0;

  const steps = useMemo(() => {
    return Array.from({ length: STEPS }, (_, i) => ({
      value: i * 0.5,
      // 0.32..1 — ramps up so the row reads as a slope from left to right
      heightPct: 0.32 + (i / (STEPS - 1)) * 0.68,
    }));
  }, []);

  const setScore = (next) => {
    if (next === v) return;
    try { Haptics.selectionAsync(); } catch {}
    onChange(next);
  };

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={styles.head}>
        <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>
          {label}
        </Text>
        <View style={styles.readout}>
          <Text style={[type.h1, { color: t.text, fontVariant: ['tabular-nums'] }]}>
            {v.toFixed(1)}
          </Text>
          <Text style={[type.caption, { color: t.textMuted, marginLeft: 4 }]}> / 10</Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
        {steps.map((s) => {
          const active = s.value <= v && v > 0;
          const isCurrent = Math.abs(s.value - v) < 0.001;
          return (
            <Bounce
              key={s.value}
              onPress={() => setScore(s.value)}
              haptic={null}
              scaleTo={0.9}
              hitSlop={4}
              accessibilityLabel={`Score ${s.value}`}
              style={styles.stepTouch}
            >
              <View style={styles.stepInner}>
                <View
                  style={{
                    width: 4,
                    height: `${s.heightPct * 100}%`,
                    borderRadius: 2,
                    backgroundColor: isCurrent
                      ? t.accent
                      : active
                        ? t.accentBorder
                        : t.borderStrong,
                    opacity: isCurrent ? 1 : active ? 1 : 0.55,
                  }}
                />
              </View>
            </Bounce>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Text style={[type.caption, { color: t.textMuted }]}>0</Text>
        <Text style={[type.caption, { color: t.accentText, fontWeight: '600' }]}>
          {scoreLabel(v)}
        </Text>
        <Text style={[type.caption, { color: t.textMuted }]}>10</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  readout: { flexDirection: 'row', alignItems: 'flex-end' },
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 68,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  stepTouch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stepInner: {
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
});
