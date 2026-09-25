// src/lib/errorReporting.js
// Reports JS errors to our own API. No third-party SDK.
//
// Two capture points, because they catch different things:
//   - the global handler catches errors thrown outside React (async, timers)
//   - the ErrorBoundary catches render errors, which React swallows into a
//     blank white screen otherwise
//
// Reports are best-effort and deduplicated in-session: a render loop must not
// turn one bug into a thousand requests.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from '../api';

const seen = new Set();
const MAX_PER_SESSION = 20;
let sent = 0;

function appVersion() {
  return Constants?.expoConfig?.version || 'dev';
}

/** Send one error. Never throws, never awaited by UI code. */
export async function reportError(error, context = {}) {
  try {
    const message = String(error?.message || error || 'Unknown error').slice(0, 500);
    const key = `${message}|${context.route || ''}`;
    if (seen.has(key) || sent >= MAX_PER_SESSION) return;
    seen.add(key);
    sent += 1;

    await api.post('/errors', {
      source: 'mobile',
      message,
      stack: String(error?.stack || '').slice(0, 4000),
      route: context.route || null,
      platform: Platform.OS,
      appVersion: appVersion(),
    });
  } catch {
    // A failure to report an error must never produce another error.
  }
}

/**
 * Catch errors thrown outside React's render cycle.
 * Chains the existing handler so the red box still appears in development.
 */
export function installGlobalHandler() {
  const g = global;
  if (typeof g.ErrorUtils?.setGlobalHandler !== 'function') return () => {};

  const previous = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { route: isFatal ? 'fatal' : 'global' });
    if (typeof previous === 'function') previous(error, isFatal);
  });

  return () => { if (previous) g.ErrorUtils.setGlobalHandler(previous); };
}
