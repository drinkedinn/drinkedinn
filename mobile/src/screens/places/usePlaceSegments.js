// src/screens/places/usePlaceSegments.js
// Owns the five Places segments. Each keeps its own rows, status and error, so
// switching back to a segment you have already seen is instant and switching
// away never throws data out.
//
// Endpoints (server/routes/places.js, mounted at /api/places; /api/trips is an
// alias for /places/trips-summary):
//   nearby   GET /places/nearby?lat&lng&radius_km   → place[] + distance_km
//   trending GET /places/trending                   → place[] + recent_visits
//   saved    GET /places/saved                      → place[]
//   visited  GET /places/visited                    → place[] + last_visit,
//                                                     my_visits
//   trips    GET /trips                             → { country, place_count,
//                                                       visit_count,
//                                                       story_count,
//                                                       last_visit }[]

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api';

export const NEARBY_RADIUS_KM = 50;

export const SEGMENTS = [
  { key: 'nearby', label: 'Nearby', icon: 'navigate-outline' },
  { key: 'trending', label: 'Trending', icon: 'flame-outline' },
  { key: 'saved', label: 'Saved', icon: 'bookmark-outline' },
  { key: 'visited', label: 'Visited', icon: 'checkmark-circle-outline' },
  { key: 'trips', label: 'Trips', icon: 'earth-outline' },
];

export const SEGMENT_KEYS = SEGMENTS.map((s) => s.key);

const EMPTY = { items: [], status: 'idle', error: null, refreshing: false, stale: false };

function initialState() {
  return SEGMENT_KEYS.reduce((acc, k) => {
    acc[k] = { ...EMPTY };
    return acc;
  }, {});
}

function pathFor(key, opts) {
  switch (key) {
    case 'nearby': {
      const { lat, lng } = opts?.coords || {};
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
      return `/places/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(
        lng
      )}&radius_km=${NEARBY_RADIUS_KM}`;
    }
    case 'trending':
      return '/places/trending';
    case 'saved':
      return '/places/saved';
    case 'visited':
      return '/places/visited';
    case 'trips':
      return '/trips';
    default:
      return null;
  }
}

export default function usePlaceSegments() {
  const [state, setState] = useState(initialState);
  const seq = useRef({});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const patch = useCallback((key, partial) => {
    setState((prev) => {
      const cur = prev[key];
      if (!cur) return prev;
      return { ...prev, [key]: { ...cur, ...partial } };
    });
  }, []);

  /**
   * Fetch one segment. Resolves to the rows on success and null on failure —
   * it never rejects, so callers do not need their own try/catch.
   */
  const load = useCallback(
    async (key, { coords, refresh = false, silent = false } = {}) => {
      if (!SEGMENT_KEYS.includes(key)) return null;
      const path = pathFor(key, { coords });
      if (!path) {
        // Nearby without coordinates. Not an error to show — the screen renders
        // the location prompt instead. Returning `prev` untouched when there is
        // nothing to clear matters: an unconditional patch would hand React a
        // new state object, re-run the screen's load effect, and land right
        // back here forever.
        setState((prev) => {
          const cur = prev[key];
          if (!cur || (cur.status !== 'loading' && !cur.refreshing && !cur.stale)) return prev;
          return {
            ...prev,
            [key]: {
              ...cur,
              status: cur.items.length ? 'ready' : 'idle',
              refreshing: false,
              stale: false,
            },
          };
        });
        return null;
      }

      const mine = (seq.current[key] = (seq.current[key] || 0) + 1);
      // Clearing `stale` up front matters: the screen re-runs its "load if
      // stale" effect on every state change, so leaving the flag set while the
      // request is in flight would loop.
      //
      // Three intensities. `silent` is for a freshness refetch behind rows that
      // are already on screen (coming back from a profile) — flipping those to
      // 'loading' would blank them into skeletons, and flipping `refreshing`
      // would pop a spinner nobody asked for.
      patch(
        key,
        silent
          ? { error: null, stale: false }
          : refresh
          ? { refreshing: true, stale: false }
          : { status: 'loading', error: null, stale: false }
      );

      try {
        const res = await api.get(path);
        if (!alive.current || mine !== seq.current[key]) return null;
        const items = Array.isArray(res.data) ? res.data.filter(Boolean) : [];
        patch(key, { items, status: 'ready', error: null, refreshing: false, stale: false });
        return items;
      } catch (e) {
        if (!alive.current || mine !== seq.current[key]) return null;
        const message = e?.safeMessage || 'Could not load that list.';
        // A silent freshness refetch that fails leaves the rows it was checking
        // exactly where they were — replacing good content with an error screen
        // because a background poll missed would be the wrong trade.
        setState((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          const keepRows = silent && cur.items.length > 0;
          return {
            ...prev,
            [key]: {
              ...cur,
              status: keepRows ? cur.status : 'error',
              error: message,
              refreshing: false,
              stale: false,
            },
          };
        });
        return null;
      }
    },
    [patch]
  );

  /** Mark segments for a quiet refetch the next time they are shown. */
  const invalidate = useCallback((keys = SEGMENT_KEYS) => {
    setState((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        if (next[k] && next[k].status !== 'idle') next[k] = { ...next[k], stale: true };
      });
      return next;
    });
  }, []);

  // Memoised so screens can list this object in an effect's deps without the
  // effect re-running on every unrelated render.
  return useMemo(
    () => ({ state, load, invalidate }),
    [state, load, invalidate]
  );
}
