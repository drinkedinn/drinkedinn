// src/screens/onboarding-v2/onboardingState.js
// Device-local draft of the onboarding flow so a crash, a force-quit or a
// backgrounded app resumes where the person left off instead of restarting.
//
// Nothing here is a credential, so AsyncStorage is the right home (the keystore
// is reserved for the session token and the cached profile). The draft holds a
// date of birth while the flow is in progress; it never leaves the device from
// here, and clearState() wipes it the moment onboarding completes.
//
// Every read and write is defensive: a corrupt or half-written blob must resume
// as "start from the top", never throw into a render.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'di_onboarding_v2';
const VERSION = 1;

/** A fresh, unshared blank draft. Never hand out one shared object — the dob
 *  and interests inside it would be aliased across every caller. */
export function emptyState() {
  return {
    step: 1,
    dob: { d: '', m: '', y: '' },
    countryCode: '',
    accepted: false,
    interests: [],
    followedIds: [],
  };
}

function sanitise(raw) {
  if (!raw || typeof raw !== 'object') return emptyState();
  const dob = raw.dob && typeof raw.dob === 'object' ? raw.dob : {};
  const step = Number(raw.step);
  return {
    step: Number.isFinite(step) ? Math.min(6, Math.max(1, Math.trunc(step))) : 1,
    dob: {
      d: typeof dob.d === 'string' ? dob.d.slice(0, 2) : '',
      m: typeof dob.m === 'string' ? dob.m.slice(0, 2) : '',
      y: typeof dob.y === 'string' ? dob.y.slice(0, 4) : '',
    },
    countryCode: typeof raw.countryCode === 'string' ? raw.countryCode.slice(0, 2) : '',
    accepted: raw.accepted === true,
    interests: Array.isArray(raw.interests)
      ? raw.interests.filter((k) => typeof k === 'string' && k).slice(0, 20)
      : [],
    followedIds: Array.isArray(raw.followedIds)
      ? raw.followedIds.map(Number).filter((n) => Number.isFinite(n)).slice(0, 60)
      : [],
  };
}

/** Restore the draft. Always resolves — never rejects — with a usable shape. */
export async function loadState() {
  try {
    const json = await AsyncStorage.getItem(KEY);
    if (!json) return emptyState();
    const parsed = JSON.parse(json);
    if (!parsed || parsed.v !== VERSION) return emptyState();
    return sanitise(parsed.data);
  } catch {
    return emptyState();
  }
}

/** Persist the whole draft. Fire-and-forget; a failed write is not worth a toast. */
export async function saveState(data) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: sanitise(data) }));
  } catch {}
}

/** Wipe the draft once onboarding is finished (or abandoned by signing out). */
export async function clearState() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
