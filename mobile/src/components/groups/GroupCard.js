// src/components/groups/GroupCard.js
// A single group tile — cover emoji, name, member count, and a "Joined" chip
// when applicable. Used in the grid on GroupsScreen and by search results.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Bounce, Icon } from '../ui';

function memberLabel(n) {
  const c = Number(n) || 0;
  if (c === 0) return 'No members yet';
  if (c === 1) return '1 member';
  if (c < 1000) return `${c} members`;
  return `${(c / 1000).toFixed(c < 10000 ? 1 : 0)}k members`;
}

function GroupCard({ group, onPress }) {
  const { t, elevation } = useTheme();
  const joined = Number(group?.is_member) > 0;
  const emoji = group?.drink_type || '🥃';

  // A wrapper View owns the row width; the Pressable itself has no reliable
  // flex-child behaviour, so we let the wrapper claim the column and stretch
  // the Bounce inside it.
  return (
    <View style={{ flex: 1 }}>
      <Bounce
        onPress={() => onPress?.(group)}
        haptic="light"
        scaleTo={0.98}
        style={{ width: '100%' }}
        accessibilityLabel={`Open ${group?.name || 'group'}`}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: t.surface, borderColor: t.border },
            elevation(t, 1),
          ]}
        >
          <View style={[styles.cover, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
            <Text style={styles.coverEmoji}>{emoji}</Text>
            {joined && (
              <View style={[styles.joinedPill, { backgroundColor: t.accent }]}>
                <Icon name="checkmark" size={11} color={t.textOnAccent} />
                <Text style={{ color: t.textOnAccent, fontSize: 10.5, fontWeight: '700' }}>Joined</Text>
              </View>
            )}
          </View>

          <View style={styles.body}>
            <Text style={[type.h3, { color: t.text }]} numberOfLines={1}>
              {group?.name || 'Untitled group'}
            </Text>
            {!!group?.description && (
              <Text
                style={[type.caption, { color: t.textSecondary, marginTop: 4, lineHeight: 17 }]}
                numberOfLines={2}
              >
                {group.description}
              </Text>
            )}
            <View style={styles.metaRow}>
              <Icon name="people-outline" size={12} color={t.textMuted} />
              <Text style={[type.caption, { color: t.textMuted }]}>
                {memberLabel(group?.member_count)}
              </Text>
            </View>
          </View>
        </View>
      </Bounce>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  coverEmoji: { fontSize: 42 },
  joinedPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  body: { padding: 12, paddingTop: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
});

export default memo(GroupCard);
