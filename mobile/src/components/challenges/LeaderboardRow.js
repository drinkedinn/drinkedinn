// src/components/challenges/LeaderboardRow.js
// One row on the discovery leaderboard. Rank is presented as "who arrived
// first to try this" — never as a consumption competition. The current user's
// row gets a subtle accent so they can spot themselves at a glance.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Avatar, Bounce, Icon } from '../ui';

function medal(rank) {
  if (rank === 1) return { icon: 'trophy', tint: 'gold' };
  if (rank === 2) return { icon: 'medal', tint: 'silver' };
  if (rank === 3) return { icon: 'medal', tint: 'bronze' };
  return null;
}

const MEDAL_TINTS = {
  gold: '#D4A02A',
  silver: '#9CA3AF',
  bronze: '#B87333',
};

export default function LeaderboardRow({ entry, isMe, onOpen }) {
  const { t } = useTheme();
  if (!entry) return null;

  const rank = Number(entry.rank) || 0;
  const m = medal(rank);
  const displayName = entry.name || 'Explorer';
  const subtitle = entry.title || 'Member';

  return (
    <Bounce
      onPress={() => onOpen?.(entry)}
      haptic="light"
      scaleTo={0.985}
      accessibilityLabel={`Rank ${rank || '—'}: ${displayName}${isMe ? ', that’s you' : ''}`}
    >
      <View
        style={[
          styles.row,
          {
            backgroundColor: isMe ? t.accentSoft : t.surface,
            borderColor: isMe ? t.accentBorder : t.border,
          },
        ]}
      >
        <View style={[styles.rankWrap, { backgroundColor: t.surfaceAlt }]}>
          {m ? (
            <Icon name={m.icon} size={18} color={MEDAL_TINTS[m.tint]} />
          ) : (
            <Text style={[type.label, { color: t.textSecondary, fontVariant: ['tabular-nums'] }]}>
              {rank || '—'}
            </Text>
          )}
        </View>

        <Avatar uri={entry.avatar} name={displayName} size={40} />

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.nameRow}>
            <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {isMe && (
              <View style={[styles.youPill, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.textOnAccent, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <Icon name="chevron-forward" size={17} color={t.textMuted} />
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rankWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  youPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
