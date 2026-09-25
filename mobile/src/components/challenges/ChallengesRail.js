// src/components/challenges/ChallengesRail.js
// A compact horizontal rail of open discovery challenges, meant to sit on the
// Discover screen. Renders nothing until it has content — a silent absence is
// better than a stub section — so the integrator can drop it in unconditionally.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';
import { Shimmer } from '../ui/Skeleton';

function isEnded(challenge) {
  const raw = challenge?.end_date;
  if (!raw) return false;
  const iso = String(raw).includes('T') ? raw : `${raw}T23:59:59Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function endShort(raw) {
  if (!raw) return '';
  const iso = String(raw).includes('T') ? raw : `${raw}T23:59:59Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return 'Wrapped';
  if (diff === 0) return 'Ends today';
  if (diff === 1) return 'Ends tomorrow';
  if (diff <= 7) return `${diff} days left`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MiniCard({ challenge, onOpen }) {
  const { t, elevation } = useTheme();
  const joined = !!(challenge?.is_joined && Number(challenge.is_joined) > 0);
  const participants = Number(challenge?.participant_count) || 0;

  return (
    <Bounce
      onPress={() => onOpen?.(challenge)}
      haptic="light"
      scaleTo={0.97}
      accessibilityLabel={`Open ${challenge?.title || 'challenge'}`}
    >
      <View
        style={[
          styles.mini,
          { backgroundColor: t.surface, borderColor: t.border },
          elevation(t, 1),
        ]}
      >
        <View style={[styles.miniEmoji, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
          <Text style={{ fontSize: 22 }} accessible={false}>{challenge?.drink_emoji || '🥃'}</Text>
        </View>
        <Text style={[type.h3, { color: t.text, marginTop: 12 }]} numberOfLines={2}>
          {challenge?.title || 'Discovery challenge'}
        </Text>
        <View style={styles.miniMeta}>
          <Icon name="people-outline" size={12} color={t.textMuted} />
          <Text style={[type.caption, { color: t.textMuted }]}>
            {participants} exploring
          </Text>
        </View>
        <View style={styles.miniFoot}>
          <Text style={[type.caption, { color: t.textMuted }]}>{endShort(challenge?.end_date)}</Text>
          {joined && (
            <View style={[styles.joinedDot, { backgroundColor: t.successSoft, borderColor: t.success }]}>
              <Text style={{ color: t.success, fontWeight: '700', fontSize: 10 }}>JOINED</Text>
            </View>
          )}
        </View>
      </View>
    </Bounce>
  );
}

function MiniSkeleton() {
  const { t, elevation } = useTheme();
  return (
    <View style={[styles.mini, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <Shimmer style={{ width: 44, height: 44, borderRadius: radius.md }} />
      <Shimmer style={{ width: '80%', height: 12, borderRadius: 6, marginTop: 14 }} />
      <Shimmer style={{ width: '50%', height: 10, borderRadius: 5, marginTop: 10 }} />
    </View>
  );
}

/**
 * A compact rail of open challenges.
 * @param {(challenge) => void} onOpen  invoked when a card is tapped.
 * @param {() => void} onSeeAll        invoked when the "See all" pill is tapped.
 */
export default function ChallengesRail({ onOpen, onSeeAll }) {
  const { t } = useTheme();
  const [items, setItems] = useState(null); // null=loading, []=empty, [...]=list

  const load = useCallback(async () => {
    try {
      const res = await api.get('/challenges');
      const all = Array.isArray(res.data) ? res.data : [];
      const open = all.filter((c) => !isEnded(c)).slice(0, 8);
      setItems(open);
    } catch {
      // Rail is a silent enhancement — the full screen surfaces the error.
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (items && items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>
            Challenges
          </Text>
          <Text style={[type.h3, { color: t.text, marginTop: 2 }]}>
            Try something new
          </Text>
        </View>
        {!!onSeeAll && (
          <Bounce onPress={onSeeAll} haptic="light" scaleTo={0.94} accessibilityLabel="See all challenges">
            <View style={[styles.seeAll, { borderColor: t.border, backgroundColor: t.surface }]}>
              <Text style={[type.label, { color: t.accent }]}>See all</Text>
              <Icon name="chevron-forward" size={14} color={t.accent} />
            </View>
          </Bounce>
        )}
      </View>

      {items === null ? (
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
          <MiniSkeleton /><MiniSkeleton />
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => String(item.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          renderItem={({ item }) => <MiniCard challenge={item} onOpen={onOpen} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 22 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  mini: {
    width: 210,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  miniEmoji: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  miniFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  joinedDot: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
