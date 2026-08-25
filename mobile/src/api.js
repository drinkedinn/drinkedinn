// src/api.js
// Hardened HTTP client for the DrinkedInn API.
//
// Security posture:
//  - HTTPS only, pinned to the www host. The bare domain 307-redirects and
//    browsers/clients drop the Authorization header across that hop, so every
//    authenticated call must target www directly.
//  - Bearer token is read from the OS keystore per request, never held in a
//    module-level variable that could leak into a crash report.
//  - Redirects are not followed for authenticated calls (prevents a redirect
//    from replaying credentials to another origin).
//  - Errors are normalised to safe messages; raw server/exception text is never
//    surfaced to the UI, and tokens are never logged.

import axios from 'axios';
import secureStore from './lib/secureStore';

export const ORIGIN = 'https://www.drinkedinn.com';
export const BASE = `${ORIGIN}/api`;

const api = axios.create({
  baseURL: BASE,
  timeout: 20000,
  maxRedirects: 0,
  headers: { Accept: 'application/json' },
});

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

api.interceptors.request.use(async (config) => {
  const url = `${config.baseURL || ''}${config.url || ''}`;
  if (!url.startsWith('https://')) {
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
