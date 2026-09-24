// src/screens/feedmodes/CheeredScreen.js
// Every pour the current user has cheered — reverse-chronological.
// Reuses the app-wide PostCard so cheer, comment, repour and the report/block
// menu all behave identically to the home feed.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Screen, Header, EmptyState, FadeIn, useToast } from '../../components/ui';
import { PostSkeleton } from '../../components/ui/Skeleton';
import PostCard from '../../components/PostCard';
import usePostActions from '../../hooks/usePostActions';
import track from '../../lib/track';
import { navigateByName } from '../../lib/nav';

export default function CheeredScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const listRef = useRef(null);
  useScrollToTop(listRef);

  const load = useCallback(async () => {
    const res = await api.get('/posts/cheered');
    // Endpoint returns a plain array of posts (see server/routes/posts.js).
    setPosts(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => {
    (async () => {
      try { await load(); track('cheered_opened'); }
      catch (e) { toast?.show(e.safeMessage || 'Could not load your cheers.', 'error'); }
      finally { setLoading(false); }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); }
    catch (e) { toast?.show(e.safeMessage || 'Could not refresh.', 'error'); }
    finally { setRefreshing(false); }
  }, [load]);

  // When someone blocks or deletes from the card menu, sweep out anything else
  // by that author too — a stale ghost row after a block feels broken.
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
      <Header
        title="Moments you cheered"
        subtitle={!loading && posts.length ? `${posts.length} saved to raise a glass to` : undefined}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={{ paddingTop: 6 }}>
          {[0, 1, 2].map((i) => <PostSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 40 }}
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
          ListFooterComponent={
            posts.length > 0 ? (
              <Text style={[type.caption, { color: t.textMuted, textAlign: 'center', paddingVertical: 22 }]}>
                Every cheers you've raised, right here.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="No cheers yet"
              body="Tap the pint on a moment to save it here. It's your way of saying, this one mattered."
              actionLabel="Find something worth a cheers"
              onAction={() => navigateByName(navigation, 'Home')}
            />
          }
        />
      )}
    </Screen>
  );
}
