// src/api.js
// Hardened HTTP client for the DrinkedInn API.
//
// Security posture:
//  - HTTPS only. A bare-domain 307 would drop the Authorization header, so
//    browsers/clients drop the Authorization header across that hop, so every
//    every authenticated call targets the API origin directly.
//  - Bearer token is read from the OS keystore per request, never held in a
//    module-level variable that could leak into a crash report.
//  - Redirects are not followed for authenticated calls (prevents a redirect
//    from replaying credentials to another origin).
//  - Errors are normalised to safe messages; raw server/exception text is never
//    surfaced to the UI, and tokens are never logged.

import axios from 'axios';
import secureStore from './lib/secureStore';

// The API host.
//
// www.drinkedinn.com is STILL the old Vercel deployment: it answers /api/places
// with text/html (the SPA fallback) and its /api/health has no `runtime` field,
// so it predates the Cloudflare migration and every endpoint added since.
// Pointing the app there meant Places, Memories, Trips, the interests step and
// the whole Admin OS returned "not found" — nothing was wrong with the client.
//
// Until the custom domain is cut over to the Worker, target the Worker
// directly. EXPO_PUBLIC_API_ORIGIN overrides this for local work.
export const ORIGIN =
  process.env.EXPO_PUBLIC_API_ORIGIN || 'https://drinkedinn.madasales15.workers.dev';
export const BASE = `${ORIGIN}/api`;

const api = axios.create({
  baseURL: BASE,
  // 12s, not 20. A request that is going to fail should say so while the
  // person is still looking at the screen. At 20s a failed call reads as a
  // frozen app rather than a failed one — and on a screen that fires several
  // calls, the slowest one decides how long the spinner sits there.
  timeout: 12000,
  maxRedirects: 0,
  headers: { Accept: 'application/json' },
});

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

// Plain HTTP is permitted ONLY for a development server on the local network,
// and only in a development build. Three conditions all have to hold, so this
// cannot be reached from a release build or pointed at the open internet:
//   1. __DEV__ is true (stripped from any production bundle),
//   2. the host is localhost or an RFC-1918 private address,
//   3. the scheme is http on that host specifically.
// Anything else keeps the original behaviour: HTTPS or the request is cancelled.
const PRIVATE_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?(\/|$)/;

function isAllowedInsecure(url) {
  return typeof __DEV__ !== 'undefined' && __DEV__ && PRIVATE_HOST.test(url);
}

api.interceptors.request.use(async (config) => {
  const url = `${config.baseURL || ''}${config.url || ''}`;
  if (!url.startsWith('https://') && !isAllowedInsecure(url)) {
    throw new axios.Cancel('Blocked insecure request');
  }
  const token = await secureStore.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// User-facing messages only — never echo raw server internals.
function safeMessage(err) {
  const status = err.response?.status;
  const serverMsg = err.response?.data?.error;
  if (status === 401) return 'Your session expired. Sign in again.';
  if (status === 403) return serverMsg || "You don't have access to that.";
  if (status === 404) return 'Not found.';
  if (status === 409) return serverMsg || 'That already exists.';
  if (status === 429) return 'Too many attempts. Try again in a few minutes.';
  if (status >= 500) return 'The bar is having a moment. Try again shortly.';
  if (err.code === 'ECONNABORTED') return 'That took too long. Check your connection.';
  if (!err.response) return 'No connection. Check your network.';
  return typeof serverMsg === 'string' ? serverMsg : 'Something went wrong.';
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && onUnauthorized) onUnauthorized();
    err.safeMessage = safeMessage(err);
    return Promise.reject(err);
  }
);

export function mediaUrl(path) {
  if (!path) return null;
  if (/^https:\/\//i.test(path)) return path;
  if (/^http:\/\//i.test(path)) return path.replace(/^http:/, 'https:');
  return `${ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default api;
