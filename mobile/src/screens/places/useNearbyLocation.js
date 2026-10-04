// src/screens/places/useNearbyLocation.js
// Location capability for the Nearby segment and the "use my coordinates"
// button in Add place.
//
// ── Enabled ─────────────────────────────────────────────────────────────────
// expo-location is installed and the switch below is on, so Nearby works.
// Previously the module was absent and this file declared the capability
// unavailable, which meant the Nearby tab rendered and loaded nothing — a
// visible feature that could not function.
//
// COARSE only, deliberately. getCurrentPositionAsync asks for
// Accuracy.Balanced (roughly 100m), which ACCESS_COARSE_LOCATION satisfies.
// ACCESS_FINE_LOCATION is NOT requested: it would be more permission than the
// code uses, and it moves the Play Data Safety declaration from "Approximate
// location" to "Precise location" for no gain.
//
// Turning it back off is the inverse of turning it on: flip the switch, drop
// the dependency, remove the permission entries from app.json, and restore the
// "we never ask for location" wording in the privacy policy — which is only
// accurate while all four are true together.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';

/* LOCATION SWITCH ↓ */
import * as Location from 'expo-location';
const LOCATION_MODULE_AVAILABLE = true;
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

// ~1.1km. See the note where it is applied.
const round2 = (n) => Math.round(n * 100) / 100;

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

      // Rounded to 2dp (~1.1km) before it leaves the device.
      //
      // These coordinates travel in a URL query string
      // (/places/nearby?lat=&lng=), and the Worker runs with observability
      // enabled, so request URLs — query strings included — land in Cloudflare's
      // logs. A full-precision fix sitting in a log line is a home address with
      // a timestamp on it.
      //
      // The search radius is 50km and rounding moves the query by at most ~385m,
      // so nothing about Nearby changes; what gets logged simply stops being able
      // to identify where someone lives.
      const next = { lat: round2(lat), lng: round2(lng) };
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
