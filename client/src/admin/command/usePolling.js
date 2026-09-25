// client/src/admin/command/usePolling.js
//
// One fetch + refresh loop, shared by the dashboard and the audit log.
//
// Contract:
//   - `enabled: false` means never touch the network (used for a permission
//     the admin does not hold).
//   - The first load sets `loading`; background refreshes do not, so the
//     screen never blanks itself on a wall monitor.
//   - The last good data is kept when a refresh fails, and the error is shown
//     alongside it rather than replacing it.
//   - Errors carry the SERVER's message (err.response.data.error), never
//     err.message.

import { useCallback, useEffect, useRef, useState } from 'react';

const GENERIC_ERROR = 'The request failed and the server did not say why. Check your connection and try again.';

export default function usePolling(fetcher, {
  intervalMs = 30000,
  enabled = true,
  startPaused = false,
  refreshKey = '',
} = {}) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const aliveRef = useRef(true);
  const inFlightRef = useRef(false);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [busy, setBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [paused, setPaused] = useState(Boolean(startPaused));

  // Re-arm on remount (React 18 StrictMode mounts, unmounts, mounts again).
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const run = useCallback(async () => {
    if (!enabled || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const result = await fetcherRef.current();
      if (!aliveRef.current) return;
      setData(result);
      setError(null);
      setStatus(200);
      setLastUpdated(Date.now());
    } catch (err) {
      if (!aliveRef.current) return;
      setStatus(err?.response?.status ?? null);
      setError(err?.response?.data?.error || GENERIC_ERROR);
    } finally {
      inFlightRef.current = false;
      if (aliveRef.current) { setBusy(false); setLoading(false); }
    }
  }, [enabled]);

  // Initial load, and a reload whenever the caller changes refreshKey.
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    setLoading((prev) => (data == null ? true : prev));
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, refreshKey]);

  // The loop itself.
  useEffect(() => {
    if (!enabled || paused || !Number.isFinite(intervalMs) || intervalMs <= 0) return undefined;
    const id = setInterval(run, intervalMs);
    return () => clearInterval(id);
  }, [enabled, paused, intervalMs, run]);

  return {
    data,
    error,
    status,
    forbidden: status === 403,
    loading,
    busy,
    lastUpdated,
    paused,
    setPaused,
    refresh: run,
    intervalMs,
  };
}
