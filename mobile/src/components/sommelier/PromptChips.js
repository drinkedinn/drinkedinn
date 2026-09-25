// src/components/sommelier/PromptChips.js
// The empty-state suggestions. Shown only when the thread is fresh; the moment
// the member types anything, they disappear so the chat stays uncluttered.
//
// Voice rules — people first, moments second, drinks last and only as detail.
// One prompt is intentionally zero-proof so no-and-low sits at the table too.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

const SUGGESTIONS = [
  {
    icon: 'restaurant-outline',
    label: "I'm having dinner with friends tonight — what should I open?",
  },
  {
    icon: 'moon-outline',
    label: 'Plan a night out in Lisbon',
  },
  {
    icon: 'bookmark-outline',
    label: 'What should I add to my want-to-try list?',
  },
  {
    icon: 'leaf-outline',
    label: 'Something zero-proof that still feels special',
  },
];

export default function PromptChips({ onPick }) {
  const { t } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.crest, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
        <Icon name="sparkles-outline" size={26} color={t.accent} />
      </View>
      <Text style={[type.h2, { color: t.text, textAlign: 'center', marginTop: 16 }]}>
        Ask the Innkeeper
      </Text>
      <Text
        style={[
          type.body,
          { color: t.textSecondary, textAlign: 'center', marginTop: 8, marginHorizontal: 24, lineHeight: 22 },
        ]}
      >
        A friend who knows your cellar. Pairings for tonight's table, plans for a night out,
        or something quietly special without the proof.
      </Text>

      <View style={styles.chips}>
        {SUGGESTIONS.map((s, i) => (
          <Bounce
            key={i}
            onPress={() => onPick?.(s.label)}
            haptic="light"
            scaleTo={0.97}
            accessibilityLabel={`Ask: ${s.label}`}
          >
            <View style={[styles.chip, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[styles.chipIcon, { backgroundColor: t.accentSoft }]}>
                <Icon name={s.icon} size={16} color={t.accent} />
              </View>
              <Text style={[type.body, { color: t.text, flex: 1, lineHeight: 20 }]}>
                {s.label}
              </Text>
              <Icon name="arrow-up-circle-outline" size={18} color={t.textMuted} />
            </View>
          </Bounce>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 40, paddingHorizontal: 20, paddingBottom: 24 },
  crest: {
    width: 60,
    height: 60,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
  },
  chips: { marginTop: 28, gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  chipIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
