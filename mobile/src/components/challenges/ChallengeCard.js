// src/components/challenges/ChallengeCard.js
// A single discovery challenge — presented as an invitation to try something
// new, not as a consumption target. The header area opens the leaderboard;
// the Join button toggles participation without leaving the list.

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

// "2026-05-31" -> "May 31" ; falls back to the raw string if it can't parse.
function formatEndDate(raw) {
  if (!raw) return '';
  const iso = String(raw).includes('T') ? raw : `${raw}T00:00:00Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(raw) {
  if (!raw) return null;
  const iso = String(raw).includes('T') ? raw : `${raw}T23:59:59Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export default function ChallengeCard({ challenge, onOpen, onToggleJoin }) {
  const { t, elevation } = useTheme();

  // Server returns is_joined as a COUNT (0 or 1). Coerce so the UI never lies
  // if a later endpoint switches shape.
  const initialJoined = !!(challenge?.is_joined && Number(challenge.is_joined) > 0);
  const initialCount = Number(challenge?.participant_count) || 0;

  const [joined, setJoined] = useState(initialJoined);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  // Sync from props when a refresh brings fresh server values (e.g. another
  // device joined). Guarded by `busy` so an in-flight optimistic update isn't
  // trampled by a stale parent render.
  useEffect(() => {
    if (busy) return;
    setJoined(initialJoined);
    setCount(initialCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJoined, initialCount]);

  const emoji = challenge?.drink_emoji || '🥃';
  const title = challenge?.title || 'Untitled challenge';
  const description = challenge?.description || '';
  const dLeft = daysUntil(challenge?.end_date);
  const ended = typeof dLeft === 'number' && dLeft < 0;

  const endLabel = ended
    ? 'Wrapped up'
    : dLeft === 0
      ? 'Ends today'
      : dLeft === 1
        ? 'Ends tomorrow'
        : typeof dLeft === 'number' && dLeft <= 7
          ? `Ends in ${dLeft} days`
          : `Ends ${formatEndDate(challenge?.end_date)}`;

  const handleToggle = useCallback(async () => {
    if (busy || ended) return;
    setBusy(true);
    // Optimistic update — snap back if the server disagrees.
    const prevJoined = joined;
    const prevCount = count;
    const nextJoined = !prevJoined;
    setJoined(nextJoined);
    setCount(Math.max(0, prevCount + (nextJoined ? 1 : -1)));
    try {
      const serverJoined = await onToggleJoin?.(challenge);
      if (typeof serverJoined === 'boolean' && serverJoined !== nextJoined) {
        setJoined(serverJoined);
        setCount(Math.max(0, prevCount + (serverJoined ? 1 : -1)));
      }
    } catch {
      setJoined(prevJoined);
      setCount(prevCount);
    } finally {
      setBusy(false);
    }
  }, [busy, ended, joined, count, onToggleJoin, challenge]);

  const openLeaderboard = () => onOpen?.(challenge);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.surface, borderColor: t.border },
        elevation(t, 1),
        ended && { opacity: 0.72 },
      ]}
    >
      {/* Tappable content region — opens the leaderboard */}
      <Bounce
        onPress={openLeaderboard}
        haptic="light"
        scaleTo={0.99}
        accessibilityLabel={`Open leaderboard for ${title}`}
      >
        <View style={styles.headRow}>
          <View style={[styles.emojiWrap, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
            <Text style={styles.emoji} accessible={false}>{emoji}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={[type.h3, { color: t.text, flex: 1 }]} numberOfLines={2}>
                {title}
              </Text>
              {joined && (
                <View style={[styles.joinedPill, { backgroundColor: t.successSoft, borderColor: t.success }]}>
                  <Icon name="checkmark" size={12} color={t.success} />
                  <Text style={[type.caption, { color: t.success, fontWeight: '700' }]}>Joined</Text>
                </View>
              )}
            </View>
            {!!description && (
              <Text style={[type.body, { color: t.textSecondary, marginTop: 4, lineHeight: 20 }]} numberOfLines={3}>
                {description}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Icon name="calendar-outline" size={13} color={t.textMuted} />
            <Text style={[type.caption, { color: t.textMuted }]}>{endLabel}</Text>
          </View>
          <Text style={[type.caption, { color: t.textMuted, paddingHorizontal: 2 }]}>·</Text>
          <View style={styles.metaChip}>
            <Icon name="people-outline" size={13} color={t.textMuted} />
            <Text style={[type.caption, { color: t.textMuted }]}>
              {count} explorer{count === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </Bounce>

      {/* Action row is a sibling — never wrapped by the header's Bounce. */}
      <View style={[styles.actionRow, { borderTopColor: t.divider }]}>
        <Bounce
          onPress={openLeaderboard}
          haptic="light"
          scaleTo={0.95}
          style={[styles.ghostBtn, { borderColor: t.border }]}
          accessibilityLabel={`See who's exploring ${title}`}
        >
          <Icon name="trophy-outline" size={15} color={t.textSecondary} />
          <Text style={[type.label, { color: t.textSecondary }]}>Leaderboard</Text>
        </Bounce>

        <Bounce
          onPress={handleToggle}
          haptic="medium"
          disabled={busy || ended}
          scaleTo={0.95}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: joined ? t.surfaceAlt : t.accent,
              borderColor: joined ? t.borderStrong : 'transparent',
            },
          ]}
          accessibilityLabel={joined ? `Leave ${title}` : `Join ${title}`}
        >
          <Text
            style={[
              type.label,
              { color: joined ? t.text : t.textOnAccent, fontWeight: '700' },
            ]}
          >
            {ended ? 'Closed' : joined ? 'Leave' : 'Join'}
          </Text>
        </Bounce>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  headRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  emojiWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  joinedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ghostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
