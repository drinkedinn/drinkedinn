// src/components/memories/MemoriesRail.js
// "Looking back" — the retention loop at the top of Home.
//
// Behaviour:
//   • Owns its own fetch (GET /memories) and refetches when the enclosing
//     screen regains focus, so a memory opened and closed doesn't leave a
//     stale rail behind.
//   • Renders NOTHING when there are no memories yet. This rail is a reward for
//     having history, not a prompt to make some — an empty-state here would
//     nag every new member on their very first launch.
//   • Failure is silent for the same reason the stories rail is: it sits above
//     the feed's own error handling and must never step on it.
//   • Exposes .refresh() via ref so Home's pull-to-refresh can drive it.

import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import { View, Text, ScrollView, StyleSheet, InteractionManager } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Bounce } from '../ui';
import track from '../../lib/track';
import MemoryCard, { MemoryCardSkeleton, RAIL_CARD_W } from './MemoryCard';
import { normalizeCards, safeNavigate, titleFor } from './memoryLib';

const GAP = 12;

const MemoriesRail = forwardRef(function MemoriesRail(
  { onOpenMemory, onSeeAll, style },
  ref,
) {
  const { t } = useTheme();
  const navigation = useNavigation();

  const [cards, setCards] = useState([]);
  const everHadCards = useRef(false);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const trackedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/memories');
      if (!mounted.current) return;
      const list = normalizeCards(res?.data);
      setCards(list);
      if (((list) || []).length) everHadCards.current = true;
      if (list.length && !trackedRef.current) {
        trackedRef.current = true;
        track('memories_rail_shown', { count: list.length });
      }
    } catch {
      // Silent by design — see the file header.
      if (mounted.current) setCards([]);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Defer a beat so the rail never competes with the feed's own first load.
    const task = InteractionManager.runAfterInteractions(() => { load(); });
    return () => { mounted.current = false; task?.cancel?.(); };
  }, [load]);

  // Refetch on re-focus (skip the first — mount already loaded).
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) { focusedOnce.current = true; return; }
      load();
    }, [load]),
  );

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  const openMemory = useCallback((card) => {
    if (!card) return;
    const title = titleFor(card);
    track('memory_opened', { key: String(card.key), from: 'home_rail' });
    if (onOpenMemory) { onOpenMemory(card); return; }
    safeNavigate(navigation, 'MemoryDetail', { key: card.key, title });
  }, [navigation, onOpenMemory]);

  const seeAll = useCallback(() => {
    if (onSeeAll) { onSeeAll(); return; }
    safeNavigate(navigation, 'Memories');
  }, [navigation, onSeeAll]);

  // Nothing to look back on — disappear entirely.
  //
  // The `loading` clause meant a member with ZERO memories still got the
  // "Looking back" heading and two skeleton cards on every Home mount, then
  // watched ~250px vanish when the fetch came back empty. Stay hidden until we
  // have actually seen cards at least once; after that, keep the skeletons on a
  // refetch so the rail does not flash out for members who do have memories.
  if (cards.length === 0 && !everHadCards.current) return null;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <Text style={[type.h2, { color: t.text, flex: 1 }]} numberOfLines={1}>
          Looking back
        </Text>
        {!loading && cards.length > 2 && (
          <Bounce
            onPress={seeAll}
            haptic="light"
            hitSlop={10}
            scaleTo={0.94}
            accessibilityLabel="See all memories"
          >
            <Text style={[type.label, { color: t.accent }]}>See all</Text>
          </Bounce>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        snapToInterval={RAIL_CARD_W + GAP}
        decelerationRate="fast"
      >
        {loading
          ? [0, 1].map((i) => <MemoryCardSkeleton key={i} variant="rail" />)
          : cards.map((card) => (
            <MemoryCard
              key={String(card.key)}
              card={card}
              variant="rail"
              onPress={() => openMemory(card)}
            />
          ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  rail: { paddingHorizontal: 16, gap: GAP, paddingVertical: 4 },
});

export default MemoriesRail;
