// src/screens/places/useNearbyLocation.js
// Location capability for the Nearby segment and the "use my coordinates"
// button in Add place.
//
// ── Why this file has a hard-coded switch ───────────────────────────────────
// `expo-location` is NOT in mobile/package.json, and the brief forbids adding
// dependencies. Metro resolves every require()/import statically at bundle
// time, so there is no runtime-safe way to "try" for a missing package — even
// a require wrapped in try/catch fails the whole bundle, not just this module.
// The capability is therefore declared absent, and every caller degrades to a
// clear Settings prompt instead of a silent dead end.
//
// ── To enable it (integrator, one step) ─────────────────────────────────────
//   1. `npx expo install expo-location`
//   2. app.json → ios.infoPlist.NSLocationWhenInUseUsageDescription and
//      android.permissions += ACCESS_COARSE_LOCATION / ACCESS_FINE_LOCATION
//   3. in this file, replace the two lines marked LOCATION SWITCH below with:
//        import * as Location from 'expo-location';
//        const LOCATION_MODULE_AVAILABLE = true;
// Nothing else in the Places module changes — the permission flow, the coords
// plumbing and every piece of copy below are already written against the real
// expo-location API.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';

/* LOCATION SWITCH ↓ */
const Location = null;
const LOCATION_MODULE_AVAILABLE = false;
/* LOCATION SWITCH ↑ */

// 'unavailable' — no location module in this build (nothing the user can fix)
// 'idle'        — not asked yet
// 'requesting'  — permission dialog / fix in flight
// 'granted'     — coords in hand
// 'denied'      — the person said no
// 'error'       — granted but the fix failed (indoors, airplane mode, …)
export const LOCATION_STATUS = {
  UNAVAILABLE: 'unavailable',
  IDLE: 'idle',
  REQUESTING: 'requesting',
  GRANTED: 'granted',
  DENIED: 'denied',
  ERROR: 'error',
};

const FIX_TIMEOUT_MS = 12000;

export default function useNearbyLocation() {
  const [status, setStatus] = useState(
    LOCATION_MODULE_AVAILABLE ? LOCATION_STATUS.IDLE : LOCATION_STATUS.UNAVAILABLE
  );
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * Ask for permission (if needed) and take a fix.
   * Never throws — read `status` / `error` instead.
   * @returns {Promise<{lat:number,lng:number}|null>}
   */
  const request = useCallback(async () => {
    if (!LOCATION_MODULE_AVAILABLE || !Location) {
      setStatus(LOCATION_STATUS.UNAVAILABLE);
      return null;
    }
    if (inFlight.current) return coords;
    inFlight.current = true;
    setError(null);
    setStatus(LOCATION_STATUS.REQUESTING);

    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        if (alive.current) {
          setStatus(LOCATION_STATUS.DENIED);
          setError('Location access is off.');
        }
        return null;
      }

      // A fix can hang indefinitely indoors. Race it so the UI always resolves.
      const fix = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Balanced }),
        new Promise((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
      ]);

      const lat = Number(fix?.coords?.latitude);
      const lng = Number(fix?.coords?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        if (alive.current) {
          setStatus(LOCATION_STATUS.ERROR);
          setError('Could not get a location fix. Try again outdoors.');
        }
        return null;
      }

      const next = { lat, lng };
      if (alive.current) {
        setCoords(next);
        setStatus(LOCATION_STATUS.GRANTED);
      }
      return next;
    } catch {
      if (alive.current) {
        setStatus(LOCATION_STATUS.ERROR);
        setError('Could not get a location fix.');
      }
      return null;
    } finally {
      inFlight.current = false;
    }
  }, [coords]);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      /* Some OEM builds have no settings deep link. Nothing useful to do. */
    }
  }, []);

  return useMemo(() => {
    const blocked =
      status === LOCATION_STATUS.UNAVAILABLE ||
      status === LOCATION_STATUS.DENIED ||
      status === LOCATION_STATUS.ERROR;
    return {
      supported: LOCATION_MODULE_AVAILABLE,
      status,
      coords,
      error,
      blocked,
      request,
      openSettings,
    };
  }, [status, coords, error, request, openSettings]);
}
