// src/screens/profile/useProfileResource.js
// One fetch, four states: loading / data / empty / error.
//
// Every pillar loads independently and lazily — opening the profile must not
// wake six endpoints. Rules this hook enforces so no tab can get them wrong:
//   • Nothing is fetched until `enabled` flips true (first time the tab opens).
//   • A stale response can never overwrite a newer one (request-id guard).
//   • Nothing is set after unmount.
//   • The error is surfaced twice — a toast carrying err.safeMessage, and an
//     inline retry — never a raw exception and never a permanent spinner.
//   • Bumping `token` re-runs the fetch, which is how the profile's
//     pull-to-refresh reaches every already-loaded tab. A refresh keeps the
//     old rows on screen (no skeleton flash) while the new ones land.

import { useCallback, useEffect, useRef, useState } from 'react';

export default function useProfileResource(
  fetcher,
  { enabled = true, token = 0, key = '', onError } = {},
) {
  // `loading` starts true when the hook is enabled. Starting false meant every
  // pillar rendered its full-screen empty state (with a CTA) for one frame
  // before the fetch was even dispatched — a flash of "you have nothing" on a
  // profile that does.
  const [state, setState] = useState({ data: null, loading: !!enabled, error: null, settled: false });

  // Kept in refs so a new inline closure on every render never re-triggers the
  // effect (which would loop the request).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const mounted = useRef(true);
  const reqId = useRef(0);
  const hasData = useRef(false);
  const lastRun = useRef(null);
  const lastKey = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++reqId.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (!mounted.current || id !== reqId.current) return;
      hasData.current = data != null;
      setState({ data: data ?? null, loading: false, error: null, settled: true });
    } catch (e) {
      if (!mounted.current || id !== reqId.current) return;
      const message = e?.safeMessage || 'Something went wrong.';
      // Keep whatever was already on screen; the inline retry is the way back.
      setState((s) => ({ data: s.data, loading: false, error: message, settled: true }));
      try { onErrorRef.current?.(message); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Fetch on a real change only: first enable, a new key (a different
    // member), or a refresh-token bump.
    const stamp = `${key}#${token}`;
    if (lastRun.current === stamp) return;

    // A new key means a different member — drop the previous member's rows
    // rather than showing them under someone else's name while the new ones
    // are in flight. A token bump on the same key is a refresh: keep the rows.
    const switchedMember = lastKey.current !== null && lastKey.current !== key;
    if (switchedMember) {
      hasData.current = false;
      setState({ data: null, loading: true, error: null, settled: false });
    }
    const isRefresh = lastRun.current !== null && !switchedMember;
    lastRun.current = stamp;
    lastKey.current = key;
    run({ silent: isRefresh && hasData.current });
  }, [enabled, key, token, run]);

  const reload = useCallback(() => run(), [run]);

  return { ...state, reload };
}
