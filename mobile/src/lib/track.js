// src/lib/track.js
// Client-side event batching.
//
// Events queue in memory and flush on a timer, when the batch fills, or when the
// app backgrounds — never one request per event. Analytics must not compete with
// the user's actual traffic, and must never surface an error to them.

import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

const FLUSH_MS = 15000;
const MAX_BATCH = 25;

let queue = [];
let timer = null;
let anonId = null;
let sessionId = null;

async function getAnonId() {
  if (anonId) return anonId;
  try {
    let id = await AsyncStorage.getItem('di_anon_id');
    if (!id) {
      id = `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem('di_anon_id', id);
    }
    anonId = id;
  } catch {
    anonId = 'a_ephemeral';
  }
  return anonId;
}

function newSession() {
  sessionId = `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return sessionId;
}

async function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    await api.post('/analytics/events', {
      events: batch,
      anonId: await getAnonId(),
      sessionId: sessionId || newSession(),
      platform: Platform.OS,
    });
  } catch {
    // Drop on failure rather than retrying forever. Analytics is not worth
    // holding memory or draining battery over.
  }
}

/** Record an event. Fire-and-forget — never awaited by UI code. */
export function track(name, props) {
  if (!name) return;
  queue.push({ name, props: props || undefined, platform: Platform.OS });
  if (queue.length >= MAX_BATCH) { flush(); return; }
  if (!timer) {
    timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS);
  }
}

/** Call once at app start. Returns a teardown function. */
export function initAnalytics() {
  newSession();
  track('app_opened', { platform: Platform.OS });

  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      newSession();
      track('app_opened', { platform: Platform.OS });
    } else if (state === 'background') {
      // Last chance to send before the OS suspends us.
      flush();
    }
  });

  return () => {
    sub.remove();
    if (timer) { clearTimeout(timer); timer = null; }
    flush();
  };
}

export default track;
