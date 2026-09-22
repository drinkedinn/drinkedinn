// src/screens/challenges/LeaderboardScreen.js
// Ranked list for a single discovery challenge. Rank comes from the server —
// currently order of joining, ascending — and is framed here as "who's been
// exploring", never as a consumption contest.
// Server: GET /challenges/:id/leaderboard → up to 20 rows.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Icon, EmptyState, FadeIn, useToast } from '../../components/ui';
import { Shimmer } from '../../components/ui/Skeleton';
import track from '../../lib/track';
import LeaderboardRow from '../../components/challenges/LeaderboardRow';

function RowSkeleton() {
  const { t } = useTheme();
  return (
    <View style={[styles.rowShim, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Shimmer style={{ width: 34, height: 34, borderRadius: radius.sm }} />
      <Shimmer style={{ width: 40, height: 40, borderRadius: 20 }} />
      <View style={{ flex: 1, marginLeft: 4 }}>
        <Shimmer style={{ width: '55%', height: 11, borderRadius: 6 }} />
        <Shimmer style={{ width: '35%', height: 9, borderRadius: 5, marginTop: 8 }} />
      </View>
    </View>
  );
}

export default function LeaderboardScreen({ navigation, route }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const id = route.params?.id;
  const title = route.params?.title || 'Leaderboard';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setErrored(true);
      return;
    }
    try {
      const res = await api.get(`/challenges/${id}/leaderboard`);
      const list = Array.isArray(res.data) ? res.data : [];
      setEntries(list);
      setErrored(false);
    } catch (e) {
      setErrored(true);
      toast?.show(e.safeMessage || 'Could not load the leaderboard.', 'error');
    }
  }, [id, toast]);

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
    if (id) track('challenge_leaderboard_view', { id });
  }, [load, id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const openProfile = useCallback(
    (entry) => {
      if (!entry?.id) return;
      if (entry.id === user?.id) navigation.navigate('Profile');
      else navigation.navigate('User', { userId: entry.id });
    },
    [navigation, user?.id]
  );

  // Find the current user's position (if present) so we can pin a summary at the top.
  const mySpot = useMemo(() => {
    if (!user?.id) return null;
    const mine = entries.find((e) => e && e.id === user.id);
    return mine || null;
  }, [entries, user?.id]);

  return (
    <Screen edges={['top']}>
      <Header
        title={title}
        subtitle="Explorers, in join order"
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={{ paddingTop: 4 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => <RowSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, i) => String(item?.id ?? i)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 60 }}
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
            entries.length > 0 ? (
              <View style={styles.headerWrap}>
                {mySpot ? (
                  <View style={[styles.myBanner, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
                    <Icon name="sparkles-outline" size={16} color={t.accentText} />
                    <Text style={[type.label, { color: t.accentText }]}>
                      You're #{mySpot.rank || '—'} — nice pour.
                    </Text>
                  </View>
                ) : (
                  <Text style={[type.caption, { color: t.textMuted, marginHorizontal: 20, marginBottom: 12 }]}>
                    Join from the challenge card to show up here.
                  </Text>
                )}
                <Text
                  style={[
                    type.overline,
                    { color: t.textMuted, textTransform: 'uppercase', marginLeft: 20, marginBottom: 8 },
                  ]}
                >
                  Top {entries.length}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <LeaderboardRow
                entry={item}
                isMe={!!user?.id && item?.id === user.id}
                onOpen={openProfile}
              />
            </FadeIn>
          )}
          ListEmptyComponent={
            errored ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn't load that"
                body="Pull to try again — the leaderboard is usually right here."
              />
            ) : (
              <EmptyState
                icon="trophy-outline"
                title="Be the first on the board"
                body="No explorers yet. Join the challenge and your name lands here."
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { marginTop: 4 },
  myBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rowShim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
