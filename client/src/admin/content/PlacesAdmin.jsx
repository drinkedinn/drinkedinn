// src/admin/content/PlacesAdmin.jsx
// The places catalogue.
//
// Contract: GET /api/places?q=&city=&country= returns a bare ARRAY of place
// rows — { id, name, category, city, country, lat, lng, cover_url, created_by,
// created_at } decorated with { saved, visit_count, story_count } — newest
// first, capped at 50. There is no creator name in that payload (only
// created_by), no total count, and no pagination, and every one of those gaps
// is stated on screen rather than papered over.

import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api';
import {
  C, Card, Notice, ErrorBanner, EmptyState, Loading,
  labelStyle, inputStyle, actionBtn, thStyle, tdStyle,
  fmtDate, fmtCount, plainPreview, apiError,
} from './ui';
import { can, hasPermissionSource, PERMS } from './permissions';
import { findDuplicateGroups } from './duplicates';
import DuplicateGroups from './DuplicateGroups';
import PlaceDetail from './PlaceDetail';

const RESULT_CAP = 50; // server-side LIMIT in routes/places.js

export default function PlacesAdmin({ permissions, role }) {
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery]             = useState('');
  const [country, setCountry]         = useState('');
  const [places, setPlaces]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [detailId, setDetailId]       = useState(null);

  const mayRead    = can(permissions, PERMS.placesRead);
  const mayEdit    = can(permissions, PERMS.placesEdit);
  const permsKnown = hasPermissionSource(permissions);

  const countryValid = country === '' || /^[A-Z]{2}$/.test(country);

  // Debounce typing so a search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (query) params.q = query;
      // The server matches country exactly on an upper-cased ISO-2 code; a
      // half-typed code would silently return nothing, so it is not sent.
      if (/^[A-Z]{2}$/.test(country)) params.country = country;
      const r = await api.get('/places', { params });
      setPlaces(Array.isArray(r?.data) ? r.data.filter(Boolean) : []);
    } catch (e) {
      setPlaces([]);
      setError(apiError(e, 'Could not load places.'));
    } finally {
      setLoading(false);
    }
  }, [query, country]);

  useEffect(() => { if (mayRead) load(); }, [mayRead, load]);

  const duplicateGroups = useMemo(() => findDuplicateGroups(places), [places]);

  const duplicateIds = useMemo(() => {
    const ids = new Set();
    for (const g of duplicateGroups) for (const p of g.places) ids.add(p.id);
    return ids;
  }, [duplicateGroups]);

  const knownCountries = useMemo(
    () => Array.from(new Set(places.map((p) => String(p.country || '').trim().toUpperCase()).filter(Boolean))).sort(),
    [places]
  );

  const rows = useMemo(
    () => (onlyDuplicates ? places.filter((p) => duplicateIds.has(p.id)) : places),
    [places, onlyDuplicates, duplicateIds]
  );

  if (!mayRead) {
    return (
      <EmptyState
        icon="🔒"
        title="Places are not part of your role"
        hint={permsKnown
          ? `The places catalogue needs the ${PERMS.placesRead} permission${role ? `, and the ${role} role does not have it` : ''}.`
          : 'The admin shell did not pass a permission set to this panel, so it cannot confirm you hold places.read.'}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <Notice icon="🗺️">
        The catalogue is the venue list every post, visit and save points at. Duplicate rows split one venue's
        history in two, so they are grouped below.{' '}
        <strong>There is no merge endpoint — merging is a manual, out-of-console job.</strong>
      </Notice>

      {/* ── Search / filter ── */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label htmlFor="places-search" style={labelStyle}>Search name, category or city</label>
            <input
              id="places-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. Rooftop, Wine Bar, Lisbon"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="places-country" style={labelStyle}>Country (ISO-2)</label>
            <input
              id="places-country"
              list="places-country-options"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
              placeholder="All"
              maxLength={2}
              aria-invalid={!countryValid}
              aria-describedby="places-country-help"
              style={{ ...inputStyle, width: 110, textTransform: 'uppercase', borderColor: countryValid ? C.border : C.amber }}
            />
            <datalist id="places-country-options">
              {knownCountries.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.textMuted, cursor: 'pointer', paddingBottom: 10 }}>
            {/* Never disabled: a filter you cannot switch off is a trap when a
                new search turns up no duplicates. */}
            <input
              type="checkbox"
              checked={onlyDuplicates}
              onChange={(e) => setOnlyDuplicates(e.target.checked)}
              style={{ accentColor: C.accent, cursor: 'pointer' }}
            />
            Only possible duplicates
          </label>

          {(searchInput || country || onlyDuplicates) && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setCountry(''); setOnlyDuplicates(false); }}
              style={{ ...actionBtn(C.textMuted), marginBottom: 6 }}
            >
              Clear
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: C.textMuted, textAlign: 'right', lineHeight: 1.6, paddingBottom: 6 }}>
            <div><strong style={{ color: C.text }}>{rows.length}</strong> shown</div>
            <div style={{ color: C.textFaint, fontSize: 11.5 }}>{places.length} loaded (max {RESULT_CAP})</div>
          </div>
        </div>

        <div id="places-country-help" style={{ marginTop: 12, fontSize: 11.5, color: countryValid ? C.textFaint : C.amber, lineHeight: 1.6 }}>
          {!countryValid
            ? 'Enter both letters of an ISO-2 country code (GB, PT, US) — a single letter matches nothing, so the filter is not applied.'
            : `The API returns at most ${RESULT_CAP} places per query and gives no total, so duplicate detection only sees what is loaded here. Narrow by country or search to sweep another slice of the catalogue.`}
        </div>
      </Card>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* ── Duplicates ── */}
      {!loading && !error && duplicateGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            Possible duplicates
            <span style={{ fontWeight: 500, color: C.textMuted, marginLeft: 8, fontSize: 12.5 }}>
              {duplicateGroups.length} group{duplicateGroups.length === 1 ? '' : 's'} · matched on normalised name within a city
            </span>
          </div>
          <DuplicateGroups groups={duplicateGroups} canEdit={mayEdit} onOpen={setDetailId} />
        </div>
      )}

      {/* ── Catalogue ── */}
      {loading ? (
        <Loading label="Loading places…" />
      ) : !error && places.length === 0 ? (
        <EmptyState
          icon="🗺️"
          title="No places match"
          hint={query || country ? 'Nothing matched that search. Try a shorter term or clear the country filter.' : 'The catalogue is empty — no venue has been added yet.'}
        />
      ) : !error && rows.length === 0 ? (
        <EmptyState icon="✅" title="No duplicates in this slice" hint="Every place loaded here has a distinct normalised name for its city." />
      ) : !error ? (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <caption style={{ captionSide: 'top', textAlign: 'left', padding: '12px 16px 0', color: C.textFaint, fontSize: 11.5 }}>
                Places, newest first.
              </caption>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Place', 'Category', 'City', 'Country', 'Added by', 'Visits', 'Stories', 'Added', ''].map((h, i) => (
                    <th key={h + i} scope="col" style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: C.text }}>
                        {plainPreview(p.name, 60) || <span style={{ color: C.textFaint }}>(unnamed)</span>}
                      </div>
                      <div style={{ color: C.textFaint, fontSize: 11 }}>#{p.id}</div>
                    </td>
                    <td style={{ ...tdStyle, color: C.textMuted, fontSize: 12.5 }}>{plainPreview(p.category, 28) || '—'}</td>
                    <td style={{ ...tdStyle, color: C.textMuted, fontSize: 12.5 }}>{plainPreview(p.city, 28) || '—'}</td>
                    <td style={{ ...tdStyle, color: C.textMuted, fontSize: 12.5 }}>{p.country || '—'}</td>
                    <td style={{ ...tdStyle, color: C.textFaint, fontSize: 12 }}>
                      {p.created_by != null ? `User #${p.created_by}` : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtCount(p.visit_count)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtCount(p.story_count)}</td>
                    <td style={{ ...tdStyle, color: C.textFaint, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                    <td style={tdStyle}>
                      <button type="button" onClick={() => setDetailId(p.id)} style={actionBtn(C.accentHi)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {!loading && !error && rows.length > 0 && (
        <div style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.6 }}>
          The places API returns a creator id, not a name, so “Added by” shows the account id. Open a place to resolve it.
        </div>
      )}

      {detailId != null && (
        <PlaceDetail placeId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
