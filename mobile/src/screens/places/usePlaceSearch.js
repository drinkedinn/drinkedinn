// src/screens/places/usePlaceSearch.js
// Debounced GET /places?q=&country= — shared by the Places hub (filtering any
// segment) and by Add place (the search-first picker).
//
// Two things this has to get right:
//   1. Out-of-order responses. A fast "ba" can land after a slow "bar", so the
//      sequence number decides who is allowed to write state, not arrival time.
//   2. Going idle. Clearing the field must drop results immediately rather than
//      leaving the last query's rows on screen under an empty input.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api';
import { normaliseCountry } from '../../components/places/placeUtils';

const DEBOUNCE_MS = 300;

export default function usePlaceSearch({ minChars = 1, debounceMs = DEBOUNCE_MS } = {}) {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [term, setTerm] = useState('');

  const seq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const trimmed = query.trim();
  const code = normaliseCountry(country);
  const active = trimmed.length >= minChars || !!code;

  const run = useCallback(
    async (q, c) => {
      const mine = ++seq.current;
      setLoading(true);
      setError(null);
      try {
        const params = [];
        if (q) params.push(`q=${encodeURIComponent(q)}`);
        if (c) params.push(`country=${encodeURIComponent(c)}`);
        const res = await api.get(`/places${params.length ? `?${params.join('&')}` : ''}`);
        if (!alive.current || mine !== seq.current) return;
        setResults(Array.isArray(res.data) ? res.data.filter(Boolean) : []);
      } catch (e) {
        if (!alive.current || mine !== seq.current) return;
        setResults([]);
        setError(e?.safeMessage || 'Could not search places.');
      } finally {
        if (alive.current && mine === seq.current) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!active) {
      // Invalidate anything in flight so a late response cannot repopulate an
      // empty search.
      seq.current += 1;
      setResults([]);
      setLoading(false);
      setError(null);
      setTerm('');
      return undefined;
    }
    setLoading(true);
    const id = setTimeout(() => {
      setTerm(trimmed);
      run(trimmed, code);
    }, debounceMs);
    return () => clearTimeout(id);
  }, [active, trimmed, code, debounceMs, run]);

  const reload = useCallback(() => {
    if (!active) return;
    run(trimmed, code);
  }, [active, trimmed, code, run]);

  const clear = useCallback(() => {
    setQuery('');
    setCountry('');
  }, []);

  return useMemo(
    () => ({
      query,
      setQuery,
      country: code,
      setCountry,
      results,
      loading,
      error,
      active,
      term,
      reload,
      clear,
    }),
    [query, code, results, loading, error, active, term, reload, clear]
  );
}
