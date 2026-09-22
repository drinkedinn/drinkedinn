// src/components/stories/seenStore.js
// Story "seen" tracking. The server has no read-receipt for stories, so the
// unseen ring is driven entirely on-device. We cap the store so it can't grow
// forever — 24-hour content churns anyway, and old entries stop mattering.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'di_stories_seen_v1';
const MAX = 500;

let cache = null;
let loading = null;

async function load() {
  if (cache) return cache;
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      cache = new Set(Array.isArray(arr) ? arr : []);
    } catch {
      cache = new Set();
    }
    loading = null;
    return cache;
  })();
  return loading;
}

async function persist() {
  if (!cache) return;
  // Cap to the most-recent MAX ids to keep AsyncStorage tiny.
  const arr = Array.from(cache);
  const capped = arr.length > MAX ? arr.slice(arr.length - MAX) : arr;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(capped));
  } catch {}
}

export async function getSeen() {
  const s = await load();
  return s;
}

export async function markSeen(storyId) {
  if (storyId == null) return;
  const s = await load();
  const id = String(storyId);
  if (s.has(id)) return;
  s.add(id);
  persist();
}

export async function markManySeen(ids) {
  if (!ids?.length) return;
  const s = await load();
  let changed = false;
  for (const raw of ids) {
    if (raw == null) continue;
    const id = String(raw);
    if (!s.has(id)) { s.add(id); changed = true; }
  }
  if (changed) persist();
}

export function isSeenSync(storyId) {
  if (!cache || storyId == null) return false;
  return cache.has(String(storyId));
}
