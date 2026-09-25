// src/components/referrals/LeaderRow.js
// One row on the invite leaderboard. Names and titles are user-generated,
// so a long-press opens the report / block menu — same behaviour usePostActions
// gives feed posts, adapted for a user target.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Avatar, Bounce } from '../ui';

function RankBadge({ rank }) {
  const { t } = useTheme();
  // Rank 1–3 get a warm accented pill; the rest get a muted number.
  const top = rank <= 3;
  const palette = top
    ? { bg: t.accent, fg: t.textOnAccent }
    : { bg: t.surfaceAlt, fg: t.textSecondary };
  return (
    <View style={[styles.rank, { backgroundColor: palette.bg }]}>
      <Text
        style={{
          color: palette.fg,
          fontSize: 13,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
        }}
        allowFontScaling={false}
      >
        {rank}
      </Text>
    </View>
  );
}

export default function LeaderRow({
  leader,
  rank,
  isMe,
  onOpen,
  onLongPress,
  last,
}) {
  const { t } = useTheme();
  const count = Number(leader?.referral_count) || 0;

  return (
    <Bounce
      haptic={null}
      scaleTo={0.99}
      onPress={() => onOpen?.(leader)}
      onLongPress={() => onLongPress?.(leader)}
      accessibilityLabel={`Rank ${rank}, ${leader?.name || 'member'}, ${count} invite${count === 1 ? '' : 's'}`}
    >
      <View
        style={[
          styles.row,
          !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.divider },
        ]}
      >
        <RankBadge rank={rank} />
        <Avatar uri={leader?.avatar} name={leader?.name || '?'} size={38} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
              {leader?.name || 'Member'}
            </Text>
            {isMe && (
              <View style={[styles.youChip, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
                <Text style={{ color: t.accentText, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 }}>
                  YOU
                </Text>
              </View>
            )}
          </View>
          {!!leader?.title && (
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {leader.title}
            </Text>
          )}
        </View>
        <View style={styles.countCol}>
          <Text style={[type.h3, { color: t.text, fontVariant: ['tabular-nums'] }]} allowFontScaling={false}>
            {count}
          </Text>
          <Text style={[type.caption, { color: t.textMuted }]}>
            {count === 1 ? 'invite' : 'invites'}
          </Text>
        </View>
        <Icon name="chevron-forward" size={16} color={t.textMuted} />
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 62,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  youChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  countCol: { alignItems: 'flex-end', minWidth: 52 },
});
