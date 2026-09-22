// src/components/events/DateTimeField.js
// A pair of inline pickers — one for the day, one for the time — built entirely
// from ScrollView + Pressable so it doesn't need a native date-picker library.
//
// The design bar: it must feel deliberate to use, never trap the user in a
// crashed picker, and produce a valid Date object every keystroke.

import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';
import { DAYS_SHORT, MONTHS_SHORT, formatTime } from './dateUtils';

const DAY_COUNT = 21; // three weeks of options is plenty.
const START_HOUR = 12;
const END_HOUR = 25; // last slot is 12:30 AM the next day.

function buildDates(base) {
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return Array.from({ length: DAY_COUNT }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function buildTimes() {
  const out = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    for (const m of [0, 30]) {
      if (h === END_HOUR && m > 30) break;
      const d = new Date();
      d.setHours(h % 24, m, 0, 0);
      out.push({ h: h % 24, m, label: formatTime(d) });
    }
  }
  return out;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(d, today) {
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return DAYS_SHORT[d.getDay()];
}

export default function DateTimeField({ value, onChange }) {
  const { t } = useTheme();
  const dateScroll = useRef(null);
  const timeScroll = useRef(null);

  const now = useMemo(() => new Date(), []);
  const dates = useMemo(() => buildDates(now), [now]);
  const times = useMemo(() => buildTimes(), []);

  const selected = value instanceof Date && !isNaN(value.getTime()) ? value : dates[0];

  // Scroll each rail so the current selection is visible when the picker opens.
  useEffect(() => {
    const idx = dates.findIndex((d) => sameDay(d, selected));
    if (idx > 0) {
      const t = setTimeout(() => dateScroll.current?.scrollTo({ x: idx * 76, animated: false }), 30);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const idx = times.findIndex((tt) => tt.h === selected.getHours() && tt.m === selected.getMinutes());
    if (idx > 0) {
      const t = setTimeout(() => timeScroll.current?.scrollTo({ x: idx * 82, animated: false }), 60);
      return () => clearTimeout(t);
    }
  }, []);

  const pickDate = (d) => {
    const next = new Date(d);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange?.(next);
  };

  const pickTime = ({ h, m }) => {
    const next = new Date(selected);
    next.setHours(h, m, 0, 0);
    onChange?.(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Icon name="calendar-outline" size={15} color={t.textMuted} />
        <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>Date</Text>
      </View>
      <ScrollView
        ref={dateScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        keyboardShouldPersistTaps="handled"
      >
        {dates.map((d) => {
          const active = sameDay(d, selected);
          return (
            <Bounce
              key={d.toISOString()}
              onPress={() => pickDate(d)}
              haptic="light"
              scaleTo={0.94}
              accessibilityLabel={`${dayLabel(d, now)}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`}
            >
              <View
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: active ? t.accent : t.surface,
                    borderColor: active ? t.accent : t.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? t.textOnAccent : t.textMuted,
                    fontSize: 10,
                    fontWeight: '700',
                    letterSpacing: 0.6,
                  }}
                >
                  {dayLabel(d, now).toUpperCase()}
                </Text>
                <Text
                  style={{
                    color: active ? t.textOnAccent : t.text,
                    fontSize: 18,
                    fontWeight: '700',
                    marginTop: 2,
                    letterSpacing: -0.5,
                  }}
                >
                  {d.getDate()}
                </Text>
                <Text
                  style={{
                    color: active ? t.textOnAccent : t.textMuted,
                    fontSize: 10,
                    fontWeight: '600',
                    marginTop: 1,
                  }}
                >
                  {MONTHS_SHORT[d.getMonth()]}
                </Text>
              </View>
            </Bounce>
          );
        })}
      </ScrollView>

      <View style={[styles.header, { marginTop: 18 }]}>
        <Icon name="time-outline" size={15} color={t.textMuted} />
        <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>Time</Text>
      </View>
      <ScrollView
        ref={timeScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        keyboardShouldPersistTaps="handled"
      >
        {times.map((tt) => {
          const active = tt.h === selected.getHours() && tt.m === selected.getMinutes();
          return (
            <Bounce
              key={`${tt.h}-${tt.m}`}
              onPress={() => pickTime(tt)}
              haptic="light"
              scaleTo={0.94}
              accessibilityLabel={tt.label}
            >
              <View
                style={[
                  styles.timeCell,
                  {
                    backgroundColor: active ? t.accent : t.surface,
                    borderColor: active ? t.accent : t.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? t.textOnAccent : t.text,
                    fontSize: 13,
                    fontWeight: '700',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {tt.label}
                </Text>
              </View>
            </Bounce>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
  rail: { paddingHorizontal: 12, gap: 8, paddingBottom: 4 },
  dayCell: {
    width: 68,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCell: {
    minWidth: 74,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
