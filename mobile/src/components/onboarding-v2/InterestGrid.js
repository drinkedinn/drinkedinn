// src/components/onboarding-v2/InterestGrid.js
// Multi-select chip grid for the broad-interest step.
//
// Chips wrap naturally rather than sitting in a fixed column grid, so longer
// labels ("Photography", "Experiences") never truncate and the layout survives
// large accessibility text sizes.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export default function InterestGrid({ options = [], value = [], onToggle }) {
  const { t } = useTheme();
  const selected = new Set(value);

  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const on = selected.has(opt.key);
        return (
          <Bounce
            key={opt.key}
            onPress={() => onToggle?.(opt.key)}
            haptic="light"
            scaleTo={0.94}
            // Bounce only forwards a `disabled` accessibility state, so the
            // selected state is carried in the label instead of a checkbox role
            // that would announce as permanently unchecked.
            accessibilityLabel={on ? `${opt.label}, selected` : opt.label}
            style={[
              styles.chip,
              {
                backgroundColor: on ? t.accentSoft : t.surface,
                borderColor: on ? t.accent : t.border,
              },
            ]}
          >
            <Icon name={opt.icon} size={17} color={on ? t.accent : t.textSecondary} />
            <Text
              style={[
                type.bodyStrong,
                { color: on ? t.accentText : t.text },
              ]}
            >
              {opt.label}
            </Text>
            {on && <Icon name="checkmark-circle" size={15} color={t.accent} />}
          </Bounce>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
