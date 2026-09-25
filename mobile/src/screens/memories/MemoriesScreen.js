// src/screens/memories/MemoriesScreen.js
// Every memory, top to bottom. Reached from Account › Memories and from the
// "See all" link on the Home rail.
//
// Unlike the rail — which vanishes when there is nothing to show — this screen
// was asked for, so an empty state is the honest answer rather than a nag.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Screen, Header, EmptyState, FadeIn, useToast } from '../../components/ui';
import MemoryCard, { MemoryCardSkeleton } from '../../components/memories/MemoryCard';
import { MEMORY_ICON, normalizeCards, titleFor } from '../../components/memories/memoryLib';
import track from '../../lib/track';

export default function MemoriesScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // A failed fetch is not an empty history. Without this the screen rendered
  // "Nothing to look back on yet" to a member with real memories, with nothing
  // to retry — the sibling MemoryDetailScreen already got this right.
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const res = await api.get('/memories');
    if (!mounted.current) return;
    setCards(normalizeCards(res?.data));
    setFailed(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        await load();
        track('memories_list_opened');
      } catch (e) {
        if (mounted.current) setFailed(true);
        toast?.show(e?.safeMessage || 'Could not load your memories.', 'error');
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
    return () => { mounted.current = false; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not refresh.', 'error');
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [load, toast]);

  const openMemory = useCallback((card) => {
    if (!card) return;
    track('memory_opened', { key: String(card.key), from: 'memories_list' });
    navigation.navigate('MemoryDetail', { key: card.key, title: titleFor(card) });
  }, [navigation]);

  const count = cards.length;

  return (
    <Screen>
      <Header
        title="Memories"
        subtitle={
          !loading && count
            ? `${count} ${count === 1 ? 'night' : 'nights'} worth a second look`
            : undefined
        }
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={{ paddingTop: 10 }}>
          {[0, 1, 2].map((i) => <MemoryCardSkeleton key={i} variant="wide" />)}
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item, i) => (item?.key != null ? String(item.key) : `memory-${i}`)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 48 }}
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <MemoryCard card={item} variant="wide" onPress={() => openMemory(item)} />
            </FadeIn>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
          ListEmptyComponent={
            failed ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn't load your memories"
                body="That's on us, not you. Check your connection and try again."
                actionLabel="Try again"
                onAction={onRefresh}
              />
            ) : (
              <EmptyState
                icon={MEMORY_ICON}
                title="Nothing to look back on yet"
                body="Share a few moments with the people you're out with. In a month or so, the nights worth remembering will gather here."
                actionLabel="Share a moment"
                onAction={() => navigation.navigate('Compose')}
              />
            )
          }
          ListFooterComponent={
            count > 0 ? (
              <Text
                style={[
                  type.caption,
                  { color: t.textMuted, textAlign: 'center', paddingTop: 12, paddingHorizontal: 40, lineHeight: 17 },
                ]}
              >
                Memories gather on their own once a night is a month or so behind you.
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}
