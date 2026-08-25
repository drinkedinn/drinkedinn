// src/screens/ExploreScreen.js — Discover.
// Debounced search across people and pours, with trending tags and suggested
// people as the resting state.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl, Keyboard,
} from 'react-native';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Screen, Icon, Bounce, EmptyState, FadeIn, useToast } from '../components/ui';
import { Shimmer } from '../components/ui/Skeleton';
import PersonRow from '../components/discover/PersonRow';
import PostCard from '../components/PostCard';
import Segmented from '../components/home/Segmented';

const TABS = [
  { key: 'people', label: 'People' },
  { key: 'pours', label: 'Pours' },
];

export default function ExploreScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [q, setQ] = useState('');
  const [tab, setTab] = useState('people');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);

  const [people, setPeople] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const inputRef = useRef(null);
  const debounce = useRef(null);
  const reqId = useRef(0);

  const loadResting = useCallback(async () => {
    const [pe, tg] = await Promise.allSettled([
      api.get('/users/discover'),
      api.get('/posts/trending'),
    ]);
    if (pe.status === 'fulfilled' && Array.isArray(pe.value.data)) {
      setPeople(pe.value.data.filter((p) => p.id !== user?.id));
    }
    if (tg.status === 'fulfilled' && Array.isArray(tg.value.data)) {
      setTags(tg.value.data.slice(0, 10));
    }
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      try { await loadResting(); } finally { setLoading(false); }
    })();
  }, [loadResting]);

  // Debounced search — stale responses are discarded via reqId.
  useEffect(() => {
    clearTimeout(debounce.current);
    const term = q.trim();
    if (!term) { setResults(null); setSearching(false); return; }

    setSearching(true);
    debounce.current = setTimeout(async () => {
      const id = ++reqId.current;
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(term)}`);
        if (id !== reqId.current) return;
        setResults(res.data || { users: [], posts: [] });
      } catch (e) {
        if (id === reqId.current) {
          setResults({ users: [], posts: [] });
          toast?.show(e.safeMessage || 'Search failed.', 'error');
        }
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 350);

    return () => clearTimeout(debounce.current);
  }, [q]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadResting(); } finally { setRefreshing(false); }
  }, [loadResting]);

  const openProfile = (id) =>
    id === user?.id ? navigation.navigate('Account') : navigation.navigate('User', { userId: id });
  const openPost = (post) => navigation.navigate('PostDetail', { post });

  const isSearch = !!q.trim();
  const data = isSearch
    ? tab === 'people' ? results?.users || [] : results?.posts || []
    : people;

  return (
    <Screen>
      {/* Search bar */}
      <View style={styles.head}>
        <Text style={[type.h1, { color: t.text, marginBottom: 14 }]}>Discover</Text>
        <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Icon name="search-outline" size={18} color={t.textMuted} />
          <TextInput
            ref={inputRef}
            value={q}
            onChangeText={setQ}
            placeholder="Search people and pours"
            placeholderTextColor={t.textMuted}
            style={{ flex: 1, color: t.text, fontSize: 15.5, paddingVertical: 12 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {searching ? (
            <ActivityIndicator size="small" color={t.textMuted} />
          ) : isSearch ? (
            <Pressable onPress={() => { setQ(''); inputRef.current?.focus(); }} hitSlop={10} accessibilityLabel="Clear search">
              <Icon name="close-circle" size={17} color={t.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isSearch && (
        <View style={{ marginBottom: 14 }}>
          <Segmented options={TABS} value={tab} onChange={setTab} />
        </View>
      )}

      <FlatList
        data={loading && !isSearch ? [] : data}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          !isSearch ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
          ) : undefined
        }
        ListHeaderComponent={
          !isSearch ? (
            <View>
              {/* Trending tags */}
              {tags.length > 0 && (
                <View style={{ marginBottom: 22 }}>
                  <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginLeft: 16, marginBottom: 10 }]}>
                    Trending tonight
                  </Text>
                  <FlatList
                    horizontal
                    data={tags}
                    keyExtractor={(item) => item.tag}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                    renderItem={({ item }) => (
                      <Bounce onPress={() => setQ(item.tag.replace(/^#/, ''))} haptic="light" scaleTo={0.94}>
                        <View style={[styles.tag, { backgroundColor: t.surface, borderColor: t.border }]}>
                          <Text style={[type.label, { color: t.accent }]}>{item.tag}</Text>
                          <Text style={[type.caption, { color: t.textMuted }]}>{item.count}</Text>
                        </View>
                      </Bounce>
                    )}
                  />
                </View>
              )}
              <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginLeft: 16, marginBottom: 8 }]}>
                People to pour with
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) =>
          isSearch && tab === 'pours' ? (
            <FadeIn index={index}>
              <PostCard post={item} onOpen={openPost} onProfile={openProfile} />
            </FadeIn>
          ) : (
            <FadeIn index={index}>
              <PersonRow person={item} onOpen={openProfile} onChanged={loadResting} />
            </FadeIn>
          )
        }
        contentContainerStyle={{ paddingBottom: 130 }}
        ListEmptyComponent={
          loading && !isSearch ? (
            <View style={{ paddingHorizontal: 16, gap: 18, paddingTop: 8 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Shimmer style={{ width: 48, height: 48, borderRadius: 24 }} />
                  <View style={{ flex: 1 }}>
                    <Shimmer style={{ width: '45%', height: 11, borderRadius: 6 }} />
                    <Shimmer style={{ width: '65%', height: 9, borderRadius: 5, marginTop: 8 }} />
                  </View>
                  <Shimmer style={{ width: 88, height: 32, borderRadius: 16 }} />
                </View>
              ))}
            </View>
          ) : searching ? null : isSearch ? (
            <EmptyState
              icon="search-outline"
              title={`No ${tab} for “${q.trim()}”`}
              body="Try a different name, tag, or drink."
            />
          ) : (
            <EmptyState icon="people-outline" title="Nobody here yet" body="Check back once a few more people pull up a seat." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: radius.pill, borderWidth: 1.2, paddingHorizontal: 15 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1 },
});
