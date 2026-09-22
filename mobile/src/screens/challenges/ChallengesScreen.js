// src/screens/challenges/ChallengesScreen.js
// Discovery challenges — invitations to try something new, not consumption
// targets. Server routes: GET /challenges, POST /challenges/:id/join.
// The list splits into "Open now" and "Wrapped up" so ended prompts stop
// crowding the active ones. Join is optimistic and rolls back on failure.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, EmptyState, FadeIn, useToast } from '../../components/ui';
import { Shimmer } from '../../components/ui/Skeleton';
import track from '../../lib/track';
import ChallengeCard from '../../components/challenges/ChallengeCard';

function isEnded(challenge) {
  const raw = challenge?.end_date;
  if (!raw) return false;
  const iso = String(raw).includes('T') ? raw : `${raw}T23:59:59Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function CardShimmer() {
  const { t, elevation } = useTheme();
  return (
    <View
      style={[
        styles.skeleton,
        { backgroundColor: t.surface, borderColor: t.border },
        elevation(t, 1),
      ]}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Shimmer style={{ width: 52, height: 52, borderRadius: radius.md }} />
        <View style={{ flex: 1 }}>
          <Shimmer style={{ width: '65%', height: 12, borderRadius: 6 }} />
          <Shimmer style={{ width: '90%', height: 10, borderRadius: 5, marginTop: 10 }} />
          <Shimmer style={{ width: '55%', height: 10, borderRadius: 5, marginTop: 8 }} />
        </View>
      </View>
      <Shimmer style={{ width: '100%', height: 36, borderRadius: radius.md, marginTop: 16 }} />
    </View>
  );
}

export default function ChallengesScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/challenges');
      const list = Array.isArray(res.data) ? res.data : [];
      setItems(list);
      setErrored(false);
    } catch (e) {
      setErrored(true);
      toast?.show(e.safeMessage || 'Could not load challenges.', 'error');
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
    track('challenges_view');
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const openLeaderboard = useCallback(
    (challenge) => {
      if (!challenge?.id) return;
      track('challenge_leaderboard_open', { id: challenge.id });
      navigation.navigate('ChallengeLeaderboard', {
        id: challenge.id,
        title: challenge.title || 'Leaderboard',
      });
    },
    [navigation]
  );

  const toggleJoin = useCallback(
    async (challenge) => {
      if (!challenge?.id) throw new Error('missing_id');
      try {
        const res = await api.post(`/challenges/${challenge.id}/join`);
        // Server contract: returns { joined: boolean }
        const serverJoined = res.data?.joined === true;

        setItems((list) =>
          list.map((c) => {
            if (c.id !== challenge.id) return c;
            const prevJoined = !!(c.is_joined && Number(c.is_joined) > 0);
            const prevCount = Number(c.participant_count) || 0;
            const delta = serverJoined === prevJoined ? 0 : serverJoined ? 1 : -1;
            return {
              ...c,
              is_joined: serverJoined ? 1 : 0,
              participant_count: Math.max(0, prevCount + delta),
            };
          })
        );

        toast?.show(
          serverJoined
            ? "You're in — happy exploring."
            : 'Left the challenge.',
          serverJoined ? 'success' : 'info'
        );
        track(serverJoined ? 'challenge_join' : 'challenge_leave', { id: challenge.id });
        return serverJoined;
      } catch (e) {
        toast?.show(e.safeMessage || 'Could not update that.', 'error');
        throw e;
      }
    },
    [toast]
  );

  const { open, wrapped } = useMemo(() => {
    const openList = [];
    const wrappedList = [];
    for (const c of items) (isEnded(c) ? wrappedList : openList).push(c);
    return { open: openList, wrapped: wrappedList };
  }, [items]);

  const rows = useMemo(() => {
    const out = [];
    if (open.length) out.push({ type: 'section', key: 'sec-open', label: 'Open now' });
    for (const c of open) out.push({ type: 'card', key: `c-${c.id}`, challenge: c });
    if (wrapped.length) out.push({ type: 'section', key: 'sec-wrapped', label: 'Wrapped up' });
    for (const c of wrapped) out.push({ type: 'card', key: `c-${c.id}`, challenge: c });
    return out;
  }, [open, wrapped]);

  return (
    <Screen edges={['top']}>
      <Header title="Challenges" onBack={() => navigation.goBack()} large={false} />

      {loading ? (
        <View style={{ paddingTop: 6 }}>
          <View style={styles.introWrap}>
            <Shimmer style={{ width: '70%', height: 12, borderRadius: 6 }} />
            <Shimmer style={{ width: '50%', height: 10, borderRadius: 5, marginTop: 8 }} />
          </View>
          {[0, 1, 2].map((i) => <CardShimmer key={i} />)}
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
          ListHeaderComponent={
            <View style={styles.introWrap}>
              <Text style={[type.body, { color: t.textSecondary, lineHeight: 22 }]}>
                Little missions to try something new — a style you haven't sipped,
                a region you haven't wandered. Join at your pace, no pressure.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            if (item.type === 'section') {
              return (
                <Text
                  style={[
                    type.overline,
                    {
                      color: t.textMuted,
                      textTransform: 'uppercase',
                      marginLeft: 20,
                      marginBottom: 10,
                      marginTop: index === 0 ? 4 : 10,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              );
            }
            return (
              <FadeIn index={index}>
                <ChallengeCard
                  challenge={item.challenge}
                  onOpen={openLeaderboard}
                  onToggleJoin={toggleJoin}
                />
              </FadeIn>
            );
          }}
          ListEmptyComponent={
            errored ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn't reach the bar"
                body="Pull to try again in a moment."
              />
            ) : (
              <EmptyState
                icon="compass-outline"
                title="No challenges just yet"
                body="New discovery prompts land here every few weeks. Check back soon."
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  introWrap: {
    marginHorizontal: 16,
    marginBottom: 18,
    marginTop: 2,
  },
  skeleton: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
