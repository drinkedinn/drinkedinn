// src/screens/safety/BlockedAccountsScreen.js
// Everyone you have blocked, and the way back.
//
// Server contract (server/routes/blocks.js):
//   GET    /blocks      → { blocked: [{ id, name, avatar, title, created_at }] }
//   DELETE /blocks/:id  → { ok: true, blocked: false }
// created_at is written as Date.now() milliseconds, so it is a number here and
// not the ISO string the rest of the API returns — formatBlockedAt handles both.
//
// Blocking is required by App Store 1.2 and Play's UGC policy; being able to
// undo it is what stops the feature from being a trap.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, StyleSheet } from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import {
  Screen, Header, Avatar, Button, EmptyState, FadeIn, useToast,
} from '../../components/ui';
import { Shimmer } from '../../components/ui/Skeleton';
import track from '../../lib/track';

/** "Blocked 3d ago" — tolerant of epoch milliseconds, epoch seconds and ISO. */
function formatBlockedAt(value) {
  if (value == null || value === '') return 'Blocked';
  let ms;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    ms = n > 1e11 ? n : n * 1000; // seconds vs milliseconds
  } else {
    const raw = String(value);
    ms = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`).getTime();
  }
  if (!Number.isFinite(ms)) return 'Blocked';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (!Number.isFinite(s) || s < 0) return 'Blocked';
  if (s < 3600) return 'Blocked just now';
  if (s < 86400) return `Blocked ${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `Blocked ${Math.floor(s / 86400)}d ago`;
  return `Blocked ${Math.floor(s / 2592000)}mo ago`;
}

function RowSkeleton() {
  const { t } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.divider }]}>
      <Shimmer style={{ width: 44, height: 44, borderRadius: 22 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Shimmer style={{ width: '46%', height: 12, borderRadius: 6 }} />
        <Shimmer style={{ width: '30%', height: 10, borderRadius: 5, marginTop: 9 }} />
      </View>
      <Shimmer style={{ width: 78, height: 30, borderRadius: 10 }} />
    </View>
  );
}

function BlockedRow({ person, busy, onUnblock }) {
  const { t } = useTheme();
  const name = person.name || 'Member';
  return (
    <View style={[styles.row, { borderBottomColor: t.divider }]}>
      <Avatar uri={person.avatar} name={name} size={44} />
      <View style={styles.center}>
        <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {person.title ? `${person.title} · ` : ''}{formatBlockedAt(person.created_at)}
        </Text>
      </View>
      <Button
        label="Unblock"
        variant="secondary"
        size="sm"
        loading={busy}
        disabled={busy}
        onPress={() => onUnblock(person)}
      />
    </View>
  );
}

export default function BlockedAccountsScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const alive = useRef(true);

  // The toast context hands out a fresh object on every provider render, so
  // holding it in a ref keeps load() stable — depending on it directly would
  // re-run the mount effect every time any toast appeared anywhere.
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  // Set on mount as well as cleared on unmount: React 18 runs the mount /
  // unmount / remount cycle in development, and a one-way flag would leave the
  // screen stuck on its skeleton.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/blocks');
      const data = res?.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.blocked) ? data.blocked : [];
      if (!alive.current) return;
      setPeople(list.filter((p) => p && p.id != null));
      setErrored(false);
    } catch (e) {
      if (!alive.current) return;
      setErrored(true);
      toastRef.current?.show(e?.safeMessage || 'Could not load your blocked list.', 'error');
    }
  }, []);

  useEffect(() => {
    (async () => {
      track('blocked_accounts_open');
      await load();
      if (alive.current) setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (alive.current) setRefreshing(false);
  }, [load]);

  const unblock = useCallback(
    (person) => {
      const name = person.name || 'this member';
      Alert.alert(
        `Unblock ${name}?`,
        `You'll both be able to see each other's moments again. Any connection between you stays removed — you can reconnect if you want to.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: async () => {
              setBusyId(person.id);
              // Optimistic: the row goes immediately so the action feels real.
              setPeople((list) => list.filter((p) => p.id !== person.id));
              try {
                await api.delete(`/blocks/${person.id}`);
                track('member_unblocked');
                toastRef.current?.show(`${name} is unblocked.`, 'success');
              } catch (e) {
                toastRef.current?.show(
                  e?.safeMessage || 'Could not unblock that member.', 'error'
                );
                // They are still blocked — re-read rather than trust a snapshot
                // that may be older than the list on screen.
                load();
              } finally {
                if (alive.current) setBusyId(null);
              }
            },
          },
        ]
      );
    },
    [load]
  );

  const count = people.length;

  return (
    <Screen>
      <Header
        title="Blocked accounts"
        subtitle={loading || count === 0 ? undefined : count === 1 ? '1 person' : `${count} people`}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      {loading ? (
        <View style={{ paddingTop: 4 }}>
          {[0, 1, 2].map((i) => <RowSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => String(item.id)}
          extraData={busyId}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <BlockedRow person={item} busy={busyId === item.id} onUnblock={unblock} />
            </FadeIn>
          )}
          contentContainerStyle={{ paddingBottom: 48, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
          ListFooterComponent={
            count > 0 ? (
              <Text style={[type.caption, styles.foot, { color: t.textMuted }]}>
                Blocking hides the two of you from each other. You can block anyone from the
                options button on their profile or on any moment they share.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            errored ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn’t load that"
                body="Your blocked list didn’t come through. Try again in a moment."
                actionLabel="Try again"
                onAction={onRefresh}
              />
            ) : (
              <EmptyState
                icon="shield-checkmark-outline"
                title="You haven’t blocked anyone"
                body="If you ever need to, tap the options button on someone’s profile or on any moment they share. They land here so you can undo it."
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  center: { flex: 1, minWidth: 0 },
  foot: { marginHorizontal: 20, marginTop: 18, lineHeight: 17, textAlign: 'center' },
});
