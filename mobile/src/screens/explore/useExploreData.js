// src/screens/explore/useExploreData.js
// Everything the editorial half of Explore needs, in one place.
//
// Shape of the network work:
//   phase 1 (parallel) — /posts, /feed?mode=following&page=0, /places/trending,
//                        /users/me, /age/status, /users/discover
//   phase 2 (parallel) — the city/country place list, and /places/nearby once
//                        phase 1 has told us where "here" is.
//
// Only /posts is load-bearing: if it fails the screen says so. Every other
// section is an enhancement and hides itself rather than showing an error —
// one flaky endpoint should not turn Explore into a wall of apologies.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  byCheersThenRecent,
  byStoryCount,
  countryLabel,
  findAnchor,
  isWeekendMoment,
  makeScope,
  postInScope,
} from './exploreLib';

const RAIL_LIMIT = 12;
const PLACE_LIMIT = 10;
const FOLLOWING_LIMIT = 3;
const PEOPLE_LIMIT = 8;
const NEARBY_RADIUS_KM = 50;

const listOf = (settled) => {
  if (settled?.status !== 'fulfilled') return [];
  const data = settled.value?.data;
  return Array.isArray(data) ? data : [];
};

const dataOf = (settled) => (settled?.status === 'fulfilled' ? settled.value?.data : null);

// Promise.allSettled for a single call, so a rejection never escapes.
const settle = (promise) => promise.then(
  (value) => ({ status: 'fulfilled', value }),
  (reason) => ({ status: 'rejected', reason })
);

export default function useExploreData() {
  const { user } = useAuth();
  const viewerId = user?.id;

  const [posts, setPosts] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [trendingPlaces, setTrendingPlaces] = useState([]);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [people, setPeople] = useState([]);
  const [scope, setScope] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Members blocked during this session. /users/discover and /search do not
  // filter blocked accounts server-side, so without this a refetch (including
  // the one PersonRow fires after a connect toggle) puts a member the viewer
  // just blocked straight back on screen.
  const hidden = useRef(new Set());
  const visible = useCallback(
    (row) => !!row && !hidden.current.has(row.id),
    []
  );
  const authorVisible = useCallback(
    (post) => !!post && !hidden.current.has(post.user_id),
    []
  );

  const load = useCallback(async () => {
    const [postsRes, feedRes, trendRes, meRes, ageRes, peopleRes] = await Promise.allSettled([
      api.get('/posts'),
      api.get('/feed?mode=following&page=0'),
      api.get('/places/trending'),
      api.get('/users/me'),
      api.get('/age/status'),
      api.get('/users/discover'),
    ]);

    const postList = listOf(postsRes).filter(authorVisible);
    const failure =
      postsRes.status === 'rejected'
        ? postsRes.reason?.safeMessage || 'Could not load Explore just now.'
        : null;

    // Where is "home"? The profile's own city wins; otherwise the country the
    // edge resolved for this viewer (the only country the server hands back).
    const me = dataOf(meRes);
    const homeCity = String(me?.home_city ?? user?.home_city ?? '').trim();
    const country = String(dataOf(ageRes)?.country ?? '').trim().toUpperCase();

    const resolveScope = async () => {
      if (homeCity) {
        const res = await settle(api.get(`/places?city=${encodeURIComponent(homeCity)}`));
        return makeScope(homeCity, listOf(res));
      }
      const label = countryLabel(country);
      if (!label) return null;
      const res = await settle(api.get(`/places?country=${encodeURIComponent(country)}`));
      return makeScope(label, listOf(res));
    };

    const resolveNearby = async () => {
      let anchor = findAnchor({ posts: postList, viewerId });
      if (!anchor) {
        const visited = await settle(api.get('/places/visited'));
        anchor = findAnchor({ visitedPlaces: listOf(visited), viewerId });
      }
      if (!anchor) return [];
      const res = await settle(
        api.get(`/places/nearby?lat=${anchor.lat}&lng=${anchor.lng}&radius_km=${NEARBY_RADIUS_KM}`)
      );
      return listOf(res).slice().sort(byStoryCount).slice(0, PLACE_LIMIT);
    };

    const [nextScope, nextNearby] = // Do NOT block first paint on these. The load-bearing /posts has already
      // returned by here; a slow /places/visited used to keep the whole screen
      // in skeleton. Each section hides itself while empty, so they can fill in
      // late.
      Promise.all([resolveScope(), resolveNearby()]).catch(() => {});

    if (!alive.current) return;

    setPosts(postList);
    setFollowingIds(
      (dataOf(feedRes)?.post_ids || []).filter((id) => id != null).map(String)
    );
    setTrendingPlaces(listOf(trendRes).slice(0, PLACE_LIMIT));
    setPeople(
      listOf(peopleRes).filter((p) => p?.id !== viewerId && visible(p)).slice(0, PEOPLE_LIMIT)
    );
    setScope(nextScope);
    setNearbyPlaces(nextNearby);
    setError(failure);
  }, [viewerId, user?.home_city, visible, authorVisible]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await load(); } finally {
        if (!cancelled && alive.current) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally {
      if (alive.current) setRefreshing(false);
    }
  }, [load]);

  /** Full reload with the skeleton back — used by the error state's retry. */
  const retry = useCallback(async () => {
    setLoading(true);
    try { await load(); } finally {
      if (alive.current) setLoading(false);
    }
  }, [load]);

  // Blocking or deleting takes effect immediately: the post goes, and so does
  // everything else by that author (your own posts are never removed).
  const removeAuthor = useCallback((post) => {
    if (!post) return;
    setPosts((list) =>
      list.filter((p) =>
        p.id != null && post.id != null && p.id === post.id
          ? false
          : p.user_id !== post.user_id || p.user_id === viewerId
      )
    );
  }, [viewerId]);

  /** Drop a member from the people rail and keep them out of later refetches. */
  const removePerson = useCallback((id) => {
    if (id == null) return;
    hidden.current.add(id);
    setPeople((list) => list.filter((p) => p?.id !== id));
    setPosts((list) => list.filter((p) => p.user_id !== id || p.user_id === viewerId));
  }, [viewerId]);

  /** Re-pull the discover rail after a connect toggle, as the old screen did. */
  const refreshPeople = useCallback(async () => {
    const res = await settle(api.get('/users/discover'));
    if (!alive.current || res.status !== 'fulfilled') return;
    setPeople(
      listOf(res).filter((p) => p?.id !== viewerId && visible(p)).slice(0, PEOPLE_LIMIT)
    );
  }, [viewerId, visible]);

  // ── Derived sections ──────────────────────────────────────────────────────

  const cityPosts = useMemo(() => {
    if (!scope) return [];
    return posts.filter((p) => postInScope(p, scope)).sort(byCheersThenRecent).slice(0, RAIL_LIMIT);
  }, [posts, scope]);

  const weekendPosts = useMemo(() => {
    const now = Date.now();
    return posts.filter((p) => isWeekendMoment(p, now)).sort(byCheersThenRecent).slice(0, RAIL_LIMIT);
  }, [posts]);

  const followingPosts = useMemo(() => {
    const notMine = (p) => !!p && p.user_id !== viewerId;
    const byId = new Map(posts.map((p) => [String(p.id), p]));
    const ranked = followingIds.map((id) => byId.get(id)).filter(notMine);
    if (ranked.length) return ranked.slice(0, FOLLOWING_LIMIT);
    // /feed only names ids, and /posts only carries the 50 most recent — if
    // none of the ranked ids are in that window, fall back to the connection
    // flag the post rows already carry.
    return posts.filter((p) => notMine(p) && Number(p.user_connected) > 0).slice(0, FOLLOWING_LIMIT);
  }, [posts, followingIds, viewerId]);

  const isEmpty =
    !cityPosts.length &&
    !weekendPosts.length &&
    !trendingPlaces.length &&
    !nearbyPlaces.length &&
    !followingPosts.length &&
    !people.length;

  return {
    loading,
    refreshing,
    error,
    isEmpty,
    cityLabel: scope?.label || null,
    cityPosts,
    weekendPosts,
    trendingPlaces,
    nearbyPlaces,
    followingPosts,
    people,
    refresh,
    retry,
    removeAuthor,
    removePerson,
    refreshPeople,
  };
}
