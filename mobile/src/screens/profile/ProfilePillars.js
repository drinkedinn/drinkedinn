// src/screens/profile/ProfilePillars.js
// The six profile pillars — Stories, Places, Collection, Trips, Ratings,
// Tagged — as one drop-in block that replaces the old
// Pours / Cheered / Collection row inside ProfileScreen's body.
//
// Integration (one line in ProfileScreen, where <Segmented … /> sits today):
//     <ProfilePillars userId={targetId} isMe={isMe} />
// Optional, and worth doing:
//     posts={profile?.posts}   — reuses the posts ProfileScreen already
//                                fetched instead of re-fetching /users/:id
//     memberName={profile?.name}
//     ref={pillarsRef}         — then call pillarsRef.current?.refresh() from
//                                the screen's pull-to-refresh
//     onOpenPlace={(place) => navigation.navigate('PlaceProfile', { id: place.id, place })}
//                              — only if the Places module is registered.
//                                Without it, a place tap filters this member's
//                                moments to that place inline, so the pillar
//                                never depends on a route that may not exist.
//
// The pillars render their own tab bodies, so ProfileScreen's FlatList has
// nothing left to list: swap it for a ScrollView whose content is the existing
// header plus <ProfilePillars/>, and drop the screen's `tab` / `bar` / `badges`
// state, renderItem and ListEmptyComponent with it. Keep the RefreshControl and
// have onRefresh also call pillarsRef.current?.refresh().
//
// Two design rules hold this file together:
//
// 1. No vertical VirtualizedList. The pillars live inside ProfileScreen's own
//    FlatList/ScrollView, and nesting one inside the other breaks scrolling and
//    logs a warning. Lists are capped and expanded on demand instead. Every
//    server list here is bounded (places 60, tagged 40) or a personal shelf, so
//    nothing unbounded can reach the renderer.
//
// 2. Nothing is fetched until a tab is opened. Opening a profile costs one
//    request, not six. Once a tab has been opened it stays mounted (hidden) so
//    going back to it is instant and keeps whatever the member had expanded.

import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import track from '../../lib/track';
import useProfileResource from './useProfileResource';
import useProfileUgcActions from './useProfileUgcActions';
import PillarTabs from './PillarTabs';
import StoriesPillar from './tabs/StoriesPillar';
import PlacesPillar from './tabs/PlacesPillar';
import CollectionPillar from './tabs/CollectionPillar';
import TripsPillar from './tabs/TripsPillar';
import RatingsPillar from './tabs/RatingsPillar';
import TaggedPillar from './tabs/TaggedPillar';

export const PILLARS = [
  { key: 'stories', label: 'Stories', icon: 'sparkles-outline' },
  { key: 'places', label: 'Places', icon: 'location-outline' },
  { key: 'collection', label: 'Collection', icon: 'library-outline' },
  { key: 'trips', label: 'Trips', icon: 'earth-outline' },
  { key: 'ratings', label: 'Ratings', icon: 'star-outline' },
  { key: 'tagged', label: 'Tagged', icon: 'pricetag-outline' },
];

const DEFAULT_TAB = 'stories';

// Same message from six endpoints at once (offline) should be one toast.
const TOAST_DEDUPE_MS = 4000;

const ProfilePillars = forwardRef(function ProfilePillars(
  {
    userId,
    isMe,
    posts: postsProp,
    memberName,
    initialTab = DEFAULT_TAB,
    onOpenPlace,
    navigation: navigationProp,
    style,
  },
  ref,
) {
  const fallbackNavigation = useNavigation();
  const navigation = navigationProp || fallbackNavigation;
  const { user } = useAuth();
  const toast = useToast();

  const uid = userId ?? user?.id;
  const mine = isMe === undefined ? uid != null && String(uid) === String(user?.id) : !!isMe;

  const [tab, setTab] = useState(
    PILLARS.some((p) => p.key === initialTab) ? initialTab : DEFAULT_TAB,
  );
  const [token, setToken] = useState(0);
  const [visited, setVisited] = useState(() => new Set([tab]));
  const [blockedIds, setBlockedIds] = useState(() => new Set());

  // Reset when the component is pointed at a different member.
  const lastUid = useRef(uid);
  useEffect(() => {
    if (String(lastUid.current) === String(uid)) return;
    lastUid.current = uid;
    setTab(DEFAULT_TAB);
    setVisited(new Set([DEFAULT_TAB]));
    setBlockedIds(new Set());
  }, [uid]);

  const lastToast = useRef({ message: null, at: 0 });
  const onError = useCallback(
    (message) => {
      if (!message) return;
      const now = Date.now();
      if (lastToast.current.message === message && now - lastToast.current.at < TOAST_DEDUPE_MS) return;
      lastToast.current = { message, at: now };
      toast?.show(message, 'error');
    },
    [toast],
  );

  const ugc = useProfileUgcActions({
    onBlocked: (memberId) =>
      setBlockedIds((prev) => {
        const next = new Set(prev);
        next.add(String(memberId));
        return next;
      }),
  });

  /* ── shared datasets ───────────────────────────────────────────────────
     posts   — Stories (highlights), Places (a place's moments) and Trips
               (a country's moments) all read the same list.
     places  — Places renders it; Trips uses it to map place_id → country.
     trips   — Trips only, but kept here so refresh() reaches everything.     */

  const needPosts =
    !postsProp && (visited.has('stories') || visited.has('places') || visited.has('trips'));
  const needPlaces = visited.has('places') || visited.has('trips');
  const needTrips = visited.has('trips');

  const postsRes = useProfileResource(
    async () => {
      const res = await api.get(`/users/${encodeURIComponent(uid)}`);
      return Array.isArray(res?.data?.posts) ? res.data.posts : [];
    },
    { enabled: !!uid && needPosts, token, key: `posts:${uid}`, onError },
  );

  const placesRes = useProfileResource(
    async () => {
      const res = await api.get(`/users/${encodeURIComponent(uid)}/places`);
      return Array.isArray(res?.data) ? res.data : [];
    },
    { enabled: !!uid && needPlaces, token, key: `places:${uid}`, onError },
  );

  const tripsRes = useProfileResource(
    async () => {
      const res = await api.get(`/users/${encodeURIComponent(uid)}/trips`);
      return Array.isArray(res?.data) ? res.data : [];
    },
    { enabled: !!uid && needTrips, token, key: `trips:${uid}`, onError },
  );

  // A blocked author's moments leave every pillar at once.
  const visiblePosts = useMemo(() => {
    const list = postsProp != null
      ? (Array.isArray(postsProp) ? postsProp : [])
      : (Array.isArray(postsRes.data) ? postsRes.data : null);
    if (list == null) return null;
    if (!blockedIds.size) return list;
    return list.filter((p) => !blockedIds.has(String(p?.user_id)));
  }, [postsProp, postsRes.data, blockedIds]);

  const posts = useMemo(
    () =>
      postsProp != null
        ? { data: visiblePosts, loading: false, error: null, reload: () => {} }
        : { data: visiblePosts, loading: postsRes.loading, error: postsRes.error, reload: postsRes.reload },
    [postsProp, visiblePosts, postsRes.loading, postsRes.error, postsRes.reload],
  );

  const changeTab = useCallback((key) => {
    setTab(key);
    setVisited((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    track('profile_pillar_view', { tab, is_me: mine });
  }, [tab, mine]);

  // Coming back from a post, a story or the composer should not leave stale
  // rows behind, so opened pillars re-fetch on focus.
  //
  // A stack emits 'focus' for a screen it has just pushed, and child effects
  // run before the navigator's, so that first event can land within a beat of
  // mount — when everything is already in flight. Ignoring focus for the first
  // moment covers that without also swallowing a genuine return (which a
  // "skip the first event" flag would, on the navigators that don't emit one).
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    if (!navigation?.addListener) return undefined;
    const unsub = navigation.addListener('focus', () => {
      if (Date.now() - mountedAt.current < 1200) return;
      setToken((n) => n + 1);
    });
    return unsub;
  }, [navigation]);

  useImperativeHandle(
    ref,
    () => ({
      /** Re-fetch every pillar that has been opened. Safe to call any time. */
      refresh: () => setToken((n) => n + 1),
      /** Jump to a pillar programmatically, e.g. from a deep link. */
      setTab: (key) => {
        if (PILLARS.some((p) => p.key === key)) changeTab(key);
      },
      activeTab: tab,
    }),
    [tab, changeTab],
  );

  if (uid == null) return null;

  const shared = {
    userId: uid,
    isMe: mine,
    token,
    navigation,
    ugc,
    memberName,
    meId: user?.id,
    blockedIds,
    onError,
  };

  const bodyFor = (key) => {
    switch (key) {
      case 'stories':
        return <StoriesPillar {...shared} posts={posts} />;
      case 'places':
        return <PlacesPillar {...shared} places={placesRes} posts={posts} onOpenPlace={onOpenPlace} />;
      case 'collection':
        return <CollectionPillar {...shared} />;
      case 'trips':
        return <TripsPillar {...shared} trips={tripsRes} places={placesRes} posts={posts} />;
      case 'ratings':
        return <RatingsPillar {...shared} />;
      case 'tagged':
        return <TaggedPillar {...shared} />;
      default:
        return null;
    }
  };

  return (
    <View style={style}>
      <PillarTabs tabs={PILLARS} value={tab} onChange={changeTab} />

      {/* Opened tabs stay mounted so returning to one is instant and keeps
          whatever was expanded. display:'none' keeps them out of layout. */}
      {PILLARS.map((p) =>
        visited.has(p.key) ? (
          <View key={p.key} style={p.key === tab ? styles.body : styles.hidden}>
            {bodyFor(p.key)}
          </View>
        ) : null,
      )}
    </View>
  );
});

export default ProfilePillars;

const styles = StyleSheet.create({
  body: { paddingTop: 18 },
  hidden: { display: 'none' },
});
