// src/screens/groups/GroupsScreen.js
// Communities hub — a two-column grid of groups, split into "Your groups"
// (ones you've joined) and "Discover" (everything else). Search is
// as-you-type over the loaded set; there's no server-side search endpoint,
// so filtering happens client-side. A "Create" action lives in the header.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TextInput, Keyboard,
} from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import {
  Screen, Header, Icon, Bounce, EmptyState, FadeIn, useToast,
} from '../../components/ui';
import { Shimmer } from '../../components/ui/Skeleton';
import GroupCard from '../../components/groups/GroupCard';
import track from '../../lib/track';

function GroupCardSkeleton() {
  const { t } = useTheme();
  return (
    <View
      style={[
        styles.skelCard,
        { backgroundColor: t.surface, borderColor: t.border },
      ]}
    >
      <Shimmer style={{ height: 96, borderBottomWidth: 1, borderColor: t.border }} />
      <View style={{ padding: 12 }}>
        <Shimmer style={{ width: '65%', height: 14, borderRadius: 7 }} />
        <Shimmer style={{ width: '92%', height: 11, borderRadius: 6, marginTop: 10 }} />
        <Shimmer style={{ width: '40%', height: 10, borderRadius: 5, marginTop: 12 }} />
      </View>
    </View>
  );
}

function SectionHeader({ label, count }) {
  const { t } = useTheme();
  return (
    <View style={styles.sectionHead}>
      <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>
        {label}
      </Text>
      {count != null && (
        <Text style={[type.caption, { color: t.textMuted }]}>{count}</Text>
      )}
    </View>
  );
}

export default function GroupsScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  const didInitial = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/groups');
      const list = Array.isArray(res.data) ? res.data : [];
      setGroups(list);
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not load groups.', 'error');
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
      didInitial.current = true;
      track('groups_viewed');
    })();
  }, [load]);

  // Silently refresh on return so a new group or membership change shows up.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (didInitial.current) load();
    });
    return unsub;
  }, [navigation, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((g) => {
      const name = (g?.name || '').toLowerCase();
      const desc = (g?.description || '').toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }, [groups, q]);

  const { yours, discover } = useMemo(() => {
    const y = [];
    const d = [];
    for (const g of filtered) {
      if (Number(g?.is_member) > 0) y.push(g);
      else d.push(g);
    }
    return { yours: y, discover: d };
  }, [filtered]);

  // Merge sections into a single FlatList data array with typed rows so we
  // can render a two-column grid without nested scrolls.
  const rows = useMemo(() => {
    const out = [];
    if (yours.length) {
      out.push({ type: 'header', key: 'h-yours', label: 'Your groups', count: yours.length });
      for (let i = 0; i < yours.length; i += 2) {
        out.push({
          type: 'row',
          key: `y-${yours[i].id}-${yours[i + 1]?.id ?? 'x'}`,
          left: yours[i],
          right: yours[i + 1] || null,
        });
      }
    }
    if (discover.length) {
      out.push({
        type: 'header',
        key: 'h-discover',
        label: yours.length ? 'Discover' : 'All groups',
        count: discover.length,
      });
      for (let i = 0; i < discover.length; i += 2) {
        out.push({
          type: 'row',
          key: `d-${discover[i].id}-${discover[i + 1]?.id ?? 'x'}`,
          left: discover[i],
          right: discover[i + 1] || null,
        });
      }
    }
    return out;
  }, [yours, discover]);

  const openGroup = useCallback(
    (g) => {
      if (!g?.id) return;
      Keyboard.dismiss();
      track('group_opened', { id: g.id });
      navigation.navigate('GroupDetail', { id: g.id, name: g.name });
    },
    [navigation]
  );

  const openCreate = useCallback(() => {
    Keyboard.dismiss();
    track('group_create_opened');
    navigation.navigate('CreateGroup');
  }, [navigation]);

  const rightAction = (
    <Bounce
      onPress={openCreate}
      haptic="light"
      hitSlop={10}
      style={[styles.headerBtn, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}
      accessibilityLabel="Create a group"
    >
      <Icon name="add" size={20} color={t.accent} />
    </Bounce>
  );

  return (
    <Screen>
      <Header
        title="Groups"
        subtitle="Communities around what you drink"
        onBack={() => navigation.goBack()}
        right={rightAction}
        border={false}
      />

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Icon name="search-outline" size={17} color={t.textMuted} />
          <TextInput
            ref={inputRef}
            value={q}
            onChangeText={setQ}
            placeholder="Search groups"
            placeholderTextColor={t.textMuted}
            returnKeyType="search"
            style={[type.body, { flex: 1, color: t.text, paddingVertical: 0 }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!q && (
            <Bounce
              onPress={() => setQ('')}
              haptic="light"
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Icon name="close-circle" size={16} color={t.textMuted} />
            </Bounce>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
          <View style={{ height: 12 }} />
          <View style={styles.rowWrap}>
            <GroupCardSkeleton />
            <GroupCardSkeleton />
          </View>
          <View style={{ height: 14 }} />
          <View style={styles.rowWrap}>
            <GroupCardSkeleton />
            <GroupCardSkeleton />
          </View>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
          renderItem={({ item, index }) => {
            if (item.type === 'header') {
              return <SectionHeader label={item.label} count={item.count} />;
            }
            return (
              <FadeIn index={index} distance={10}>
                <View style={styles.rowWrap}>
                  <GroupCard group={item.left} onPress={openGroup} />
                  {item.right ? (
                    <GroupCard group={item.right} onPress={openGroup} />
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                </View>
              </FadeIn>
            );
          }}
          ListEmptyComponent={
            q.trim() ? (
              <EmptyState
                icon="search-outline"
                title="Nothing matches yet"
                body={`No groups match "${q.trim()}". Try a different word, or start your own.`}
                actionLabel="Start a group"
                onAction={openCreate}
              />
            ) : (
              <EmptyState
                icon="people-outline"
                title="No groups yet"
                body="Start one for the drink you know best — the room fills up fast."
                actionLabel="Start a group"
                onAction={openCreate}
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 40,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  rowWrap: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  skelCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
