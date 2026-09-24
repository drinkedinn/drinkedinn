// src/admin/content/PlaceDetail.jsx
// One place, from GET /api/places/:id.
//
// That endpoint also returns `friends` — the people the signed-in admin is
// connected to who visited this venue. It is not rendered. An operations
// console has no business turning "who was at this bar" into a screen, and the
// list would be an artefact of the admin's own social graph anyway. Visit and
// story COUNTS answer the catalogue question without naming anyone.

import { useState, useEffect } from 'react';
import api from '../../api';
import Modal from './Modal';
import { C, Badge, ErrorBanner, actionBtn, fmtDate, fmtDateTime, fmtCount, plainPreview, apiError } from './ui';

// Creator names are resolved one id at a time and remembered for the session —
// the places list has no creator name, only created_by.
const creatorCache = new Map();

function Row({ label, children }) {
  return (
    <>
      <dt style={{ color: C.textMuted }}>{label}</dt>
      <dd style={{ margin: 0, color: C.text, wordBreak: 'break-word' }}>{children}</dd>
    </>
  );
}

export default function PlaceDetail({ placeId, onClose }) {
  const [place, setPlace]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [creator, setCreator] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api.get(`/places/${placeId}`)
      .then((r) => { if (alive) setPlace(r?.data || null); })
      .catch((e) => { if (alive) { setPlace(null); setError(apiError(e, 'Could not load that place.')); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [placeId]);

  useEffect(() => {
    const id = place?.created_by;
    if (id == null) { setCreator(null); return; }
    if (creatorCache.has(id)) { setCreator(creatorCache.get(id)); return; }
    let alive = true;
    api.get(`/users/${id}`)
      .then((r) => {
        const name = r?.data?.name || null;
        creatorCache.set(id, name);
        if (alive) setCreator(name);
      })
      .catch(() => { if (alive) setCreator(null); }); // id alone is still useful
    return () => { alive = false; };
  }, [place?.created_by]);

  const stories = (Array.isArray(place?.top_stories) && place.top_stories.length
    ? place.top_stories
    : Array.isArray(place?.recent_stories) ? place.recent_stories : []
  ).filter(Boolean);

  return (
    <Modal
      title={place?.name ? plainPreview(place.name, 80) : `Place #${placeId}`}
      subtitle={place ? [place.category, place.city, place.country].filter(Boolean).join(' · ') || 'No category, city or country set' : undefined}
      onClose={onClose}
      width={720}
      footer={<button type="button" onClick={onClose} style={actionBtn(C.textMuted)}>Close</button>}
    >
      {loading && <div style={{ color: C.textMuted, fontSize: 13 }} role="status">Loading place…</div>}

      {!loading && error && <ErrorBanner message={error} />}

      {!loading && !error && !place && (
        <div style={{ color: C.textMuted, fontSize: 13 }}>That place could not be found.</div>
      )}

      {!loading && !error && place && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <Badge label={`📍 ${fmtCount(place.visit_count)} visits`} color={C.teal} bg={C.teal + '22'} />
            <Badge label={`📝 ${fmtCount(place.story_count)} stories`} color={C.amber} bg={C.amber + '22'} />
            <Badge label={`#${place.id}`} color={C.textMuted} bg={C.border} />
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '10px 18px', margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
            <Row label="Category">{place.category || <span style={{ color: C.textFaint }}>not set</span>}</Row>
            <Row label="City">{place.city || <span style={{ color: C.textFaint }}>not set</span>}</Row>
            <Row label="Country">{place.country || <span style={{ color: C.textFaint }}>not set</span>}</Row>
            <Row label="Coordinates">
              {place.lat != null && place.lng != null
                ? `${Number(place.lat).toFixed(5)}, ${Number(place.lng).toFixed(5)}`
                : <span style={{ color: C.textFaint }}>not set</span>}
            </Row>
            <Row label="Added by">
              {place.created_by != null
                ? <>{creator ? `${creator} ` : ''}<span style={{ color: C.textFaint }}>User #{place.created_by}</span></>
                : <span style={{ color: C.textFaint }}>unknown</span>}
            </Row>
            <Row label="Added on">{fmtDate(place.created_at)}</Row>
            <Row label="Cover image">
              {place.cover_url
                ? <span style={{ color: C.textMuted, fontSize: 12 }} title="Not loaded in the console">{plainPreview(place.cover_url, 90)}</span>
                : <span style={{ color: C.textFaint }}>none</span>}
            </Row>
          </dl>

          <div style={{ marginTop: 10, fontSize: 11.5, color: C.textFaint, lineHeight: 1.6 }}>
            Cover images are shown as a URL, not loaded — the console does not fetch member-supplied images.
            Who visited this place is not shown; counts only.
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Stories anchored here
            </div>
            {stories.length === 0 ? (
              <div style={{ fontSize: 12.5, color: C.textMuted }}>No stories reference this place yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stories.slice(0, 6).map((s) => (
                  <div key={s.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{s.name || `User #${s.user_id ?? '—'}`}</span>
                      <span style={{ fontSize: 11, color: C.textFaint }}>{fmtDateTime(s.created_at)}</span>
                      {s.cheer_count != null && (
                        <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>🥂 {fmtCount(s.cheer_count)}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55, wordBreak: 'break-word' }}>
                      {plainPreview(s.content, 200) || <span style={{ color: C.textFaint }}>(no text)</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
