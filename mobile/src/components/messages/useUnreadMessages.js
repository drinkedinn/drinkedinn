// src/components/messages/useUnreadMessages.js
// Small hook that keeps a live count of unread messages so any surface
// (the Feed header, an Account row, a tab badge) can render a badge without
// each one polling the server on its own.
//
// The hook coalesces requests: multiple consumers on screen at once share a
// single interval, and each mount immediately reflects the last known count
// instead of blinking to zero while the first request is in flight.

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

let cachedCount = 0;
const listeners = new Set();
let pollTimer = null;
let inFlight = null;

function notify(next) {
  cachedCount = next;
  listeners.forEach((fn) => {
    try { fn(next); } catch {}
  });
}

async function fetchOnce() {
  if (inFlight) return inFlight;
  inFlight = api
    .get('/messages/unread/count')
    .then((res) => {
      const n = Number(res?.data?.count);
      notify(Number.isFinite(n) && n >= 0 ? n : 0);
    })
    .catch(() => {
      // Analytics-grade concern — never surface an error for a background poll.
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

function startPolling(intervalMs) {
  if (pollTimer) return;
  pollTimer = setInterval(fetchOnce, intervalMs);
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/**
 * useUnreadMessages({ intervalMs = 45000 })
 * Returns { count, refresh, markAllRead }.
 *   - count: latest known unread count (0 when signed out).
 *   - refresh(): force a re-fetch (e.g. when a screen focuses).
 *   - markAllRead(fromUserId?): optimistically zero the badge (server clears
 *     read=1 automatically when a thread is opened).
 */
export default function useUnreadMessages({ intervalMs = 45000 } = {}) {
  const { user } = useAuth();
  const [count, setCount] = useState(cachedCount);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    if (!user) {
      notify(0);
      if (mounted.current) setCount(0);
      return;
    }
    const cb = (n) => { if (mounted.current) setCount(n); };
    listeners.add(cb);
    fetchOnce();
    startPolling(intervalMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') fetchOnce();
    });
    return () => {
      listeners.delete(cb);
      sub.remove();
      if (listeners.size === 0) stopPolling();
    };
  }, [user, intervalMs]);

  const refresh = useCallback(() => fetchOnce(), []);

  const markAllRead = useCallback(() => {
    // Optimistic: assume the just-opened thread cleared everything unread from
    // that user. The next poll returns the truth.
    notify(0);
  }, []);

  return { count, refresh, markAllRead };
}
