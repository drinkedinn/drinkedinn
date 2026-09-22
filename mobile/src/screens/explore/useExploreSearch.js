// src/screens/explore/useExploreSearch.js
// The search half of Explore — unchanged in behaviour from the screen this
// replaces: debounced GET /search?q=, stale responses discarded by request id,
// results split into people and pours.

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api';
import { useToast } from '../../components/ui';
import track from '../../lib/track';

const DEBOUNCE_MS = 350;
const EMPTY = { users: [], posts: [] };

export default function useExploreSearch(query) {
  const toast = useToast();

  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const timer = useRef(null);
  const reqId = useRef(0);

  // ToastProvider hands down a fresh context object on every one of its own
  // renders, so `toast` is not a stable dependency. Keeping it in a ref means
  // showing any toast anywhere can't re-run the effect below and fire a second
  // search for the term already on screen.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    clearTimeout(timer.current);
    const term = String(query || '').trim();

    if (!term) {
      // Invalidate anything in flight so a late response can't repopulate the
      // list after the field has been cleared.
      reqId.current += 1;
      setResults(null);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(term)}`);
        if (id !== reqId.current) return;
        const data = res?.data || EMPTY;
        setResults({
          users: Array.isArray(data.users) ? data.users : [],
          posts: Array.isArray(data.posts) ? data.posts : [],
        });
        // Never log what was typed — only that a search happened, and how long
        // the term was.
        track('explore_search', { length: term.length });
      } catch (e) {
        if (id !== reqId.current) return;
        setResults(EMPTY);
        toastRef.current?.show(e?.safeMessage || 'Search failed.', 'error');
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [query]);

  useEffect(() => () => clearTimeout(timer.current), []);

  /** After a block: drop that member and everything of theirs from results. */
  const dropAuthor = useCallback((post) => {
    const authorId = post?.user_id;
    if (authorId == null) return;
    setResults((r) => (
      r
        ? {
            users: r.users.filter((u) => u?.id !== authorId),
            posts: r.posts.filter((p) => (
              post.id != null && p.id === post.id ? false : p.user_id !== authorId
            )),
          }
        : r
    ));
  }, []);

  return { results, searching, dropAuthor };
}
