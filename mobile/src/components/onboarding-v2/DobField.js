// src/components/onboarding-v2/DobField.js
// Compact three-box date-of-birth entry — day / month / year.
//
// Built from plain TextInputs rather than a picker package: the app has no
// date-picker dependency and onboarding is not the place to add one. Three
// labelled boxes are also faster than a wheel for a date twenty-plus years
// back, and they read correctly to a screen reader.
//
// Fields auto-advance forward on a full box and backspace-advance backward from
// an empty one, so the whole date is one uninterrupted run of digits.

import React, { useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';

// 18 is the FLOOR, not the rule. The real minimum is per-country and lives on
// the server (server/lib/jurisdictions.js — US 21, CA 19, JP/NO/SE 20, IN 25),
// exposed by GET /auth/rules?country=XX. Callers pass the resolved minimum in;
// this is only the fallback for when the rules call has not answered yet.
const MIN_AGE = 18;
const MAX_AGE = 120;

/**
 * Age in whole years for a { d, m, y } entry, or null when the date is not yet
 * a real one. Callers treat null as "keep typing", not as a rejection.
 */
export function ageFromDob(dob) {
  if (!dob) return null;
  const d = String(dob.d || '');
  const m = String(dob.m || '');
  const y = String(dob.y || '');
  if (!d.length || !m.length || y.length !== 4) return null;

  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (month < 1 || month > 12) return null;

  const now = new Date();
  const thisYear = now.getFullYear();
  if (year < thisYear - MAX_AGE || year > thisYear) return null;

  // Day 0 of the next month is the last day of this one — catches 31 Feb.
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;

  let age = thisYear - year;
  const monthNow = now.getMonth() + 1;
  if (monthNow < month || (monthNow === month && now.getDate() < day)) age -= 1;
  return age;
}

/** True once the entry is a real date belonging to someone old enough. */
export function isOfAge(dob, minAge) {
  const age = ageFromDob(dob);
  return age !== null && age >= (minAge || MIN_AGE) && age <= MAX_AGE;
}

/** True only when the person has actively told us they are under 18. */
export function isUnderAge(dob, minAge) {
  const age = ageFromDob(dob);
  return age !== null && age < (minAge || MIN_AGE);
}

export { MIN_AGE };

export default function DobField({ value, onChange, error }) {
  const { t } = useTheme();
  const dob = value || { d: '', m: '', y: '' };

  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  const setPart = useCallback(
    (part, raw, max, nextRef) => {
      const digits = String(raw || '').replace(/[^0-9]/g, '').slice(0, max);
      onChange({ ...dob, [part]: digits });
      if (digits.length === max && nextRef?.current) nextRef.current.focus();
    },
    [dob, onChange]
  );

  // Backspace out of an empty box lands the caret in the previous one.
  const backTo = useCallback((key, current, ref) => {
    if (key === 'Backspace' && !current && ref?.current) ref.current.focus();
  }, []);

  const boxStyle = (invalid) => [
    styles.box,
    {
      backgroundColor: t.surface,
      borderColor: invalid ? t.danger : t.border,
      color: t.text,
    },
  ];

  return (
    <View>
      <View style={styles.row}>
        <Part label="Day" flex={1}>
          <TextInput
            ref={dayRef}
            value={dob.d}
            onChangeText={(v) => setPart('d', v, 2, monthRef)}
            placeholder="DD"
            placeholderTextColor={t.textMuted}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={2}
            returnKeyType="next"
            style={boxStyle(!!error)}
            accessibilityLabel="Day of birth"
            selectionColor={t.accent}
          />
        </Part>

        <Part label="Month" flex={1}>
          <TextInput
            ref={monthRef}
            value={dob.m}
            onChangeText={(v) => setPart('m', v, 2, yearRef)}
            onKeyPress={({ nativeEvent }) => backTo(nativeEvent.key, dob.m, dayRef)}
            placeholder="MM"
            placeholderTextColor={t.textMuted}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={2}
            returnKeyType="next"
            style={boxStyle(!!error)}
            accessibilityLabel="Month of birth"
            selectionColor={t.accent}
          />
        </Part>

        <Part label="Year" flex={1.5}>
          <TextInput
            ref={yearRef}
            value={dob.y}
            onChangeText={(v) => setPart('y', v, 4, null)}
            onKeyPress={({ nativeEvent }) => backTo(nativeEvent.key, dob.y, monthRef)}
            placeholder="YYYY"
            placeholderTextColor={t.textMuted}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={4}
            returnKeyType="done"
            style={boxStyle(!!error)}
            accessibilityLabel="Year of birth"
            selectionColor={t.accent}
          />
        </Part>
      </View>

      {!!error && (
        <Text style={[type.caption, { color: t.danger, marginTop: 8, lineHeight: 17 }]}>{error}</Text>
      )}
    </View>
  );
}

function Part({ label, flex, children }) {
  const { t } = useTheme();
  return (
    <View style={{ flex }}>
      <Text style={[type.caption, { color: t.textMuted, marginBottom: 6, marginLeft: 4 }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  box: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
});
