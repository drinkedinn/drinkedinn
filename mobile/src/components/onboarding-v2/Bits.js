// src/components/onboarding-v2/Bits.js
// The small repeated pieces of onboarding chrome. Kept together so the step
// bodies stay about their own content and nothing re-declares a heading style.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';

/** Title + supporting line at the top of a step. */
export function Heading({ title, body }) {
  const { t } = useTheme();
  return (
    <View style={styles.heading}>
      <Text style={[type.h1, { color: t.text }]}>{title}</Text>
      {!!body && (
        <Text style={[type.body, { color: t.textSecondary, marginTop: 8, lineHeight: 22 }]}>{body}</Text>
      )}
    </View>
  );
}

/** An inline aside. `tone` picks the token pair; anything else reads neutral. */
export function Note({ icon, tone, children }) {
  const { t } = useTheme();
  const palette =
    { success: { bg: t.successSoft, fg: t.success }, danger: { bg: t.dangerSoft, fg: t.danger } }[tone] ||
    { bg: t.surfaceAlt, fg: t.textSecondary };

  return (
    <View style={[styles.note, { backgroundColor: palette.bg, borderColor: t.border }]}>
      <Icon name={icon} size={17} color={palette.fg} />
      <Text style={[type.caption, { color: t.textSecondary, flex: 1, lineHeight: 18 }]}>{children}</Text>
    </View>
  );
}

/** The one-line status that sits above a footer button. */
export function FootNote({ children }) {
  const { t } = useTheme();
  return <Text style={[type.caption, { color: t.textMuted, textAlign: 'center' }]}>{children}</Text>;
}

/** A row inside the "what notifications are for" card. */
export function Benefit({ icon, title, body }) {
  const { t } = useTheme();
  return (
    <View style={styles.benefit}>
      <View style={[styles.benefitIcon, { backgroundColor: t.accentSoft }]}>
        <Icon name={icon} size={18} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: t.text }]}>{title}</Text>
        <Text style={[type.caption, { color: t.textSecondary, marginTop: 3, lineHeight: 17 }]}>{body}</Text>
      </View>
    </View>
  );
}

export function Hairline() {
  const { t } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.divider, marginLeft: 62 }} />;
}

export const bits = StyleSheet.create({
  body: { paddingBottom: 28 },
  card: {
    marginHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
});

const styles = StyleSheet.create({
  heading: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 20 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  benefitIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 18,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
