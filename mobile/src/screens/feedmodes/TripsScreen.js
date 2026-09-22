// src/screens/feedmodes/TripsScreen.js
// Pours that were pinned to a place. Groups by location if a post carries one,
// and lays each place out as a section with a sticky chip header so the map-y
// feel of "places" stays visible while scrolling through moments.
//
// Server: GET /posts/trips returns an array of posts with p.* joined — we only
// rely on fields present on every post (id, user_id, name, avatar, location,
// created_at, image_url, content, counts). No country field exists yet, so we
// group by location string. See notes in the structured result.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, SectionList, RefreshControl, StyleSheet, Pressable,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Icon, Bounce, EmptyState, FadeIn, useToast } from '../../components/ui';
import { PostSkeleton } from '../../components/ui/Skeleton';
import PostCard from '../../components/PostCard';
import usePostActions from '../../hooks/usePostActions';
import track from '../../lib/track';

// Case-insensitive, whitespace-tolerant grouping. "The Dead Rabbit" and
// " the dead rabbit " belong together, but preserve the first-seen casing for
// display so the chip reads naturally.
function groupByPlace(posts) {
  const map = new Map();
  for (const p of posts) {
    const raw = (p?.location || '').trim();
    if (!raw) continue; // server already filters empties, but be defensive
    const key = raw.toLowerCase();
    if (!map.has(key)) map.set(key, { title: raw, key, data: [] });
    map.get(key).data.push(p);
  }
  // Sections ordered by newest post in that place — most alive places float up.
  return [...map.values()].sort((a, b) => {
    const ta = new Date(a.data[0]?.created_at || 0).getTime();
    const tb = new Date(b.data[0]?.created_at || 0).getTime();
    return tb - ta;
  });
}

function PlaceChip({ title, count, mode }) {
  const { t } = useTheme();
  return (
    <View style={[styles.chipWrap, { backgroundColor: mode === 'dark' ? t.bgElevated : t.bg }]}>
      <View style={[styles.chip, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[styles.chipIcon, { backgroundColor: t.accentSoft }]}>
          <Icon name="location-outline" size={14} color={t.accent} />
        </View>
        <Text style={[type.h3, { color: t.text, flex: 1 }]} numberOfLines={1}>{title}</Text>
        <Text style={[type.caption, { color: t.textMuted }]}>
          {count} {count === 1 ? 'moment' : 'moments'}
        </Text>
      </View>
    </View>
  );
}

export default function TripsScreen({ navigation }) {
  const { t, mode } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const listRef = useRef(null);
  useScrollToTop(listRef);

  const load = useCallback(async () => {
    const res = await api.get('/posts/trips');
    setPosts(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => {
    (async () => {
      try { await load(); track('places_opened'); }
      catch (e) { toast?.show(e.safeMessage || 'Could not load places.', 'error'); }
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

  const sections = useMemo(() => groupByPlace(posts), [posts]);

  const openPost = (post) => navigation.navigate('PostDetail', { post });
  const openProfile = (id) =>
    id === user?.id ? navigation.navigate('Account') : navigation.navigate('User', { userId: id });

  const totalPlaces = sections.length;
  const totalMoments = posts.length;

  return (
    <Screen>
      <Header
        title="Places"
        subtitle={
          !loading && totalMoments
            ? `${totalMoments} moment${totalMoments === 1 ? '' : 's'} across ${totalPlaces} place${totalPlaces === 1 ? '' : 's'}`
            : undefined
        }
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={{ paddingTop: 6 }}>
          {[0, 1, 2].map((i) => <PostSkeleton key={i} />)}
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: 40 }}
          renderSectionHeader={({ section }) => (
            <PlaceChip title={section.title} count={section.data.length} mode={mode} />
          )}
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
              icon="map-outline"
              title="No pins on the map yet"
              body="Add a place to a moment and it will land here — a quiet way to remember where a night happened."
              actionLabel="Share a moment"
              onAction={() => navigation.navigate('Compose')}
            />
          }
          ListFooterComponent={
            totalMoments > 0 ? (
              <Text style={[type.caption, { color: t.textMuted, textAlign: 'center', paddingVertical: 24 }]}>
                Every place, mapped by the people who were there.
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  chipIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
});
