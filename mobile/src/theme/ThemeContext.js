// src/theme/ThemeContext.js
// Theme provider with three user-selectable modes: system, light, dark.
// Preference persists locally (non-sensitive, so AsyncStorage is fine).

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { light, dark, radius, spacing, type, elevation } from './tokens';

const KEY = 'di_theme_pref';
const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [pref, setPref] = useState('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') setPref(saved);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setThemePref = useCallback(async (next) => {
    setPref(next);
    try { await AsyncStorage.setItem(KEY, next); } catch {}
  }, []);

  const resolved = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const theme = resolved === 'dark' ? dark : light;

  const value = useMemo(
    () => ({ t: theme, mode: resolved, pref, setThemePref, ready, radius, spacing, type, elevation }),
    [theme, resolved, pref, setThemePref, ready]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
