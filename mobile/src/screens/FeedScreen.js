// src/screens/FeedScreen.js — Home.
// Ranked "For you" feed (server ranking from /feed) plus a "Following" cut,
// a Pour-of-the-Day hero, stories, and a new-pours pill that appears when the
// server has fresher content than what's on screen.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Animated, Pressable } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Screen, Icon, Avatar, Bounce, EmptyState, FadeIn, useToast } from '../components/ui';
import { PostSkeleton } from '../components/ui/Skeleton';
import PostCard from '../components/PostCard';
import usePostActions from '../hooks/usePostActions';
import StoryRow from '../components/home/StoryRow';
import StoriesRail from '../components/stories/StoriesRail';
import MessagesHeaderButton from '../components/messages/MessagesHeaderButton';
import PourOfTheDay from '../components/feedmodes/PourOfTheDay';
import Segmented from '../components/home/Segmented';
import FeaturedCard from '../components/home/FeaturedCard';

const TABS = [
  { key: 'for-you', label: 'For you' },
  { key: 'following', label: 'Following' },
];

const PAGE = 12;

export default function FeedScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('for-you');
  const [posts, setPosts] = useState([]);
  const [rankedIds, setRankedIds] = useState(null);
  const [potdId, setPotdId] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [newCount, setNewCount] = useState(0);

  const listRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const topIdRef = useRef(null);

  useScrollToTop(listRef);

  const fetchAll = useCallback(async () => {
    const [postsRes, feedRes, peopleRes] = await Promise.allSettled([
      api.get('/posts'),
      api.get('/feed?page=0'),
      api.get('/users/discover'),
    ]);

    if (postsRes.status === 'fulfilled' && Array.isArray(postsRes.value.data)) {
      const list = postsRes.value.data;
      setPosts(list);
      topIdRef.current = list[0]?.id ?? null;
      setNewCount(0);
    }
    if (feedRes.status === 'fulfilled') {
      setRankedIds(feedRes.value.data?.post_ids || null);
      setPotdId(feedRes.value.data?.potd_post_id || null);
    }
    if (peopleRes.status === 'fulfilled' && Array.isArray(peopleRes.value.data)) {
      setPeople(peopleRes.value.data.filter((p) => p.id !== user?.id).slice(0, 14));
    }
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      try { await fetchAll(); } finally { setLoading(false); }
    })();
  }, [fetchAll]);

  // Poll quietly for fresher posts; surface a pill rather than yanking the list.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await api.get('/posts');
        const list = res.data || [];
        if (!topIdRef.current || !list.length) return;
        const idx = list.findIndex((p) => p.id === topIdRef.current);
        if (idx > 0) setNewCount(idx);
      } catch {}
    }, 45000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchAll(); setVisibleCount(PAGE); }
    catch (e) { toast?.show(e.safeMessage || 'Could not refresh.', 'error'); }
    finally { setRefreshing(false); }
  }, [fetchAll]);

  const showNew = useCallback(async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    await onRefresh();
  }, [onRefresh]);

  // Order: server ranking for "For you", chronological for "Following".
  const ordered = useMemo(() => {
    if (tab === 'following') return posts.filter((p) => p.user_connected > 0 || p.user_id === user?.id);
    if (!rankedIds?.length) return posts;
    const byId = new Map(posts.map((p) => [p.id, p]));
    const ranked = rankedIds.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(rankedIds);
    return [...ranked, ...posts.filter((p) => !seen.has(p.id))];
  }, [posts, rankedIds, tab, user?.id]);

  const potd = useMemo(
    () => (tab === 'for-you' && potdId ? posts.find((p) => p.id === potdId) : null),
    [posts, potdId, tab]
  );

  const data = useMemo(() => {
    const withoutPotd = potd ? ordered.filter((p) => p.id !== potd.id) : ordered;
    return withoutPotd.slice(0, visibleCount);
  }, [ordered, potd, visibleCount]);

  const headerElevation = scrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' });

  // Blocking or deleting removes the post from view immediately, and anything
  // else by that author, so the action feels like it actually took effect.
  const { openMenu } = usePostActions({
    onRemoved: (post) =>
      setPosts((list) =>
        list.filter((p) => (p.id === post.id ? false : p.user_id !== post.user_id || p.user_id === user?.id))
      ),
  });

  const openPost = (post) => navigation.navigate('PostDetail', { post });
  const openProfile = (id) =>
    id === user?.id ? navigation.navigate('Account') : navigation.navigate('User', { userId: id });

  return (
    <Screen>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { backgroundColor: t.bg, borderBottomColor: t.divider, borderBottomWidth: headerElevation },
        ]}
      >
        <View style={styles.brandRow}>
          <Text style={[type.h1, { color: t.text }]}>Drinked</Text>
          <View style={[styles.chip, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.textOnAccent, fontWeight: '800', fontSize: 17, letterSpacing: -0.3 }}>Inn</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Bounce onPress={() => navigation.navigate('Discover')} haptic="light" style={[styles.iconBtn, { backgroundColor: t.surfaceAlt }]} accessibilityLabel="Search">
            <Icon name="search-outline" size={19} color={t.text} />
          </Bounce>
          <MessagesHeaderButton />
          <Bounce onPress={() => navigation.navigate('Account')} haptic="light" accessibilityLabel="Your account">
            <Avatar uri={user?.avatar} name={user?.name} size={34} />
          </Bounce>
        </View>
      </Animated.View>

      {loading ? (
        <View style={{ paddingTop: 12 }}>
          <StoryRow loading />
          {[0, 1, 2].map((i) => <PostSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View>
              <StoriesRail />
              <StoryRow
                me={user}
                people={people}
                onCompose={() => navigation.navigate('Compose')}
                onOpenProfile={openProfile}
              />
              <View style={{ marginBottom: 16 }}>
                <Segmented options={TABS} value={tab} onChange={(k) => { setTab(k); setVisibleCount(PAGE); }} />
              </View>
              <PourOfTheDay onOpen={openPost} />
            </View>
          }
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <PostCard post={item} onOpen={openPost} onProfile={openProfile} onReport={openMenu} />
            </FadeIn>
          )}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (visibleCount < ordered.length) setVisibleCount((c) => c + PAGE);
          }}
          ListFooterComponent={
            visibleCount < ordered.length ? (
              <View style={{ paddingVertical: 12 }}><PostSkeleton /></View>
            ) : data.length > 0 ? (
              <Text style={[type.caption, { color: t.textMuted, textAlign: 'center', paddingVertical: 26 }]}>
                That's last call — you're all caught up.
              </Text>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 130 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} progressBackgroundColor={t.surface} />
          }
          ListEmptyComponent={
            tab === 'following' ? (
              <EmptyState
                icon="people-outline"
                title="Your round is quiet"
                body="Connect with a few people and their pours will land here."
                actionLabel="Find people"
                onAction={() => navigation.navigate('Discover')}
              />
            ) : (
              <EmptyState
                icon="wine-outline"
                title="The bar's just opened"
                body="Be the first to share a moment worth remembering."
                actionLabel="Share a pour"
                onAction={() => navigation.navigate('Compose')}
              />
            )
          }
        />
      )}

      {/* New pours pill */}
      {newCount > 0 && (
        <FadeIn distance={-10}>
          <Pressable onPress={showNew} style={[styles.newPill, { backgroundColor: t.accent }]} accessibilityRole="button">
            <Icon name="arrow-up" size={14} color={t.textOnAccent} />
            <Text style={{ color: t.textOnAccent, fontWeight: '700', fontSize: 13 }}>
              {newCount} new pour{newCount > 1 ? 's' : ''}
            </Text>
          </Pressable>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10, paddingTop: 2,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chip: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 7 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  newPill: {
    position: 'absolute', alignSelf: 'center', top: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 15, paddingVertical: 9, borderRadius: radius.pill,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
