// src/screens/feedmodes/HashtagScreen.js
// All the pours carrying one hashtag. Accepts { tag } as a route param — with
// or without a leading '#', matching what the server accepts on
// GET /posts/hashtag/:tag.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Icon, EmptyState, FadeIn, useToast } from '../../components/ui';
import { PostSkeleton } from '../../components/ui/Skeleton';
import PostCard from '../../components/PostCard';
import usePostActions from '../../hooks/usePostActions';
import track from '../../lib/track';
import { navigateByName } from '../../lib/nav';

// Normalise "#whisky", " whisky ", "%23whisky" all to the same canonical form
// so we can display it consistently and pass a clean value to the server.
function canonical(raw) {
  const t = String(raw || '').trim().replace(/^%23/, '#');
  const bare = t.replace(/^#+/, '');
  return { display: '#' + bare, bare };
}

export default function HashtagScreen({ navigation, route }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const { display, bare } = useMemo(() => canonical(route?.params?.tag), [route?.params?.tag]);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const listRef = useRef(null);
  useScrollToTop(listRef);

  const load = useCallback(async () => {
    if (!bare) { setPosts([]); return; }
    // Server accepts both '#tag' and 'tag' and normalises internally.
    const res = await api.get(`/posts/hashtag/${encodeURIComponent(bare)}`);
    setPosts(Array.isArray(res.data) ? res.data : []);
  }, [bare]);

  useEffect(() => {
    (async () => {
      try { await load(); track('hashtag_opened', { tag: bare }); }
      catch (e) { toast?.show(e.safeMessage || 'Could not load that tag.', 'error'); }
      finally { setLoading(false); }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); }
    catch (e) { toast?.show(e.safeMessage || 'Could not refresh.', 'error'); }
    finally { setRefreshing(false); }
  }, [load]);

  const { openMenu } = usePostActions({
    onRemoved: (post) =>
      setPosts((list) =>
        list.filter((p) => (p.id === post.id ? false : p.user_id !== post.user_id || p.user_id === user?.id))
      ),
  });

  const openPost = (post) => navigation.navigate('PostDetail', { post });
  const openProfile = (id) =>
    id === user?.id ? navigateByName(navigation, 'Profile') : navigation.navigate('User', { userId: id });

  return (
    <Screen>
      <Header title={display} onBack={() => navigation.goBack()} />

      {/* Editorial header — sets context without competing with the cards. */}
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
          <Icon name="pricetag-outline" size={15} color={t.accent} />
          <Text style={[type.label, { color: t.accentText }]}>{display}</Text>
        </View>
        <Text style={[type.caption, { color: t.textMuted }]}>
          {loading
            ? 'Pulling in the latest…'
            : posts.length
              ? `${posts.length} moment${posts.length === 1 ? '' : 's'} tagged`
              : 'No one has tagged this yet.'}
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 4 }}>
          {[0, 1, 2].map((i) => <PostSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <PostCard post={item} onOpen={openPost} onProfile={openProfile} onReport={openMenu} />
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
            <EmptyState
              icon="pricetag-outline"
              title={`Nothing under ${display} yet`}
              body="Be the first to add this tag to a moment worth remembering."
              actionLabel="Share a moment"
              onAction={() => navigation.navigate('Compose')}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
