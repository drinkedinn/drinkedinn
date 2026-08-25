// src/context/AuthContext.js
// Session state. Tokens and the cached profile live in the OS keystore
// (see lib/secureStore), never in plaintext AsyncStorage.

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import api, { setUnauthorizedHandler } from '../api';
import secureStore from '../lib/secureStore';
import { isLockEnabled, authenticate } from '../lib/appLock';

const AuthContext = createContext(null);

// Re-prompt for biometrics if the app was backgrounded longer than this.
const LOCK_AFTER_MS = 2 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef(null);

  const logout = useCallback(async () => {
    await secureStore.clear();
    setUser(null);
    setLocked(false);
  }, []);

  useEffect(() => { setUnauthorizedHandler(() => { logout(); }); }, [logout]);

  // Boot: restore session, then re-validate against the server.
  useEffect(() => {
    (async () => {
      try {
        const [token, cached] = await Promise.all([secureStore.getToken(), secureStore.getUser()]);
        if (!token) return;
        if (await isLockEnabled()) setLocked(true);
        if (cached) setUser(cached);
        try {
          const res = await api.get('/users/me');
          setUser(res.data);
          await secureStore.setUser(res.data);
        } catch {
          /* offline — keep cached profile; a 401 is handled by the interceptor */
        }
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Re-lock after the app has been in the background for a while.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > LOCK_AFTER_MS && user && (await isLockEnabled())) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [user]);

  const unlock = useCallback(async () => {
    const ok = await authenticate('Unlock DrinkedInn');
    if (ok) setLocked(false);
    return ok;
  }, []);

  const login = useCallback(async (token, userData) => {
    await secureStore.setToken(token);
    await secureStore.setUser(userData);
    setUser(userData);
    try {
      const tz = -new Date().getTimezoneOffset();
      api.put('/notifications/tz', { tz_offset_minutes: tz }).catch(() => {});
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    const res = await api.get('/users/me');
    setUser(res.data);
    await secureStore.setUser(res.data);
    return res.data;
  }, []);

  const patchUser = useCallback(async (partial) => {
    setUser((u) => {
      const next = { ...(u || {}), ...partial };
      secureStore.setUser(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, booting, locked, unlock, login, logout, refresh, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
