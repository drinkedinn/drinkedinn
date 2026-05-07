import { useState, useRef, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DRINKS = ['🥃', '🍺', '🍷', '🍹', '🥂', '🍸', '🍶', '🧉'];

export default function PostModal({ onClose, onPosted }) {
  const { user } = useAuth();
  const { t } = useTheme();
  const [text, setText] = useState('');
  const [drink, setDrink] = useState('🥃');
  const [location, setLocation] = useState('');
  const [locationCoords, setLocationCoords] = useState(null); // {lat, lng}
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const fileRef = useRef();
  const locDebounce = useRef();

  // Nominatim location search
  useEffect(() => {
    clearTimeout(locDebounce.current);
    if (!locationQuery.trim() || locationQuery.length < 3) { setLocationSuggestions([]); return; }
    locDebounce.current = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=6&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        setLocationSuggestions(data);
        setShowSuggestions(true);
      } catch {}
      finally { setLocationLoading(false); }
    }, 400);
    return () => clearTimeout(locDebounce.current);
  }, [locationQuery]);

  const selectLocation = (place) => {
    const label = place.display_name.split(',').slice(0, 3).join(',').trim();
    setLocation(label);
    setLocationQuery(label);
    setLocationCoords({ lat: parseFloat(place.lat), lng: parseFloat(place.lon) });
    setLocationSuggestions([]);
    setShowSuggestions(false);
  };

  const uploadFile = async file => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImageUrl(data.url);
    } catch { setError('Image upload failed'); }
    finally { setUploading(false); }
  };

  const handleDrop = e => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) uploadFile(file);
  };

  const submit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true); setError('');
    try {
      const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
      const payload = { content: text, drink, location, image_url: imageUrl };
      if (locationCoords) { payload.lat = locationCoords.lat; payload.lng = locationCoords.lng; }
      if (showPoll && validOptions.length >= 2) payload.poll_options = validOptions;
      const { data } = await api.post('/posts', payload);
      onPosted?.(data); onClose();
    } catch (err) { setError(err.response?.data?.error || 'Failed to post'); }
    finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%', background: t.inputBg, border: `1.5px solid ${t.border}`,
    borderRadius: 20, padding: '9px 16px', color: t.text,
    fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: t.overlay, backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div className="popIn" style={{
        background: t.card, borderRadius: 20, padding: 28,
        width: '100%', maxWidth: 560, border: `1px solid ${t.border}`,
        boxShadow: t.shadowLg,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: t.text }}>Pour a Story ✍️</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 22, cursor: 'pointer', lineHeight: 1, transition: 'color 0.2s' }}
            onMouseEnter={e => e.target.style.color = t.danger}
            onMouseLeave={e => e.target.style.color = t.textMuted}
          >×</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <img src={user?.avatar} alt="" style={{ width: 46, height: 46, borderRadius: '50%', border: `2px solid ${t.accent}` }} />
          <div>
            <div style={{ fontWeight: 700, color: t.text }}>{user?.name}</div>
            <div style={{ color: t.textMuted, fontSize: 12 }}>{user?.title}</div>
          </div>
        </div>

        <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
          placeholder="What's in your glass? Where are you pouring tonight? Share the vibes… 🥃"
          style={{
            width: '100%', minHeight: 130, background: t.inputBg,
            border: `1.5px solid ${t.border}`, borderRadius: 12, padding: 16,
            color: t.text, fontSize: 15, lineHeight: 1.6,
            resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s',
          }}
          onFocus={e => { e.target.style.borderColor = t.accent; }}
          onBlur={e => { e.target.style.borderColor = t.border; }}
        />

        {/* Drink picker */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>What's in your glass?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DRINKS.map(d => (
              <button key={d} onClick={() => setDrink(d)} style={{
                fontSize: 22, background: drink === d ? t.accentSoft : t.inputBg,
                border: `2px solid ${drink === d ? t.accent : t.border}`,
                borderRadius: 10, padding: '6px 10px', cursor: 'pointer',
                transition: 'all 0.15s', transform: drink === d ? 'scale(1.2)' : 'scale(1)',
              }}>{d}</button>
            ))}
          </div>
        </div>

        {/* Location autocomplete */}
        <div style={{ marginTop: 14, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <input
              value={locationQuery}
              onChange={e => { setLocationQuery(e.target.value); setLocation(e.target.value); setLocationCoords(null); }}
              placeholder="📍 Search location (e.g. Tokyo, Bali, Mumbai…)"
              style={{ ...inputStyle, paddingRight: locationLoading ? 36 : 16 }}
              onFocus={e => { e.target.style.borderColor = t.accent; if (locationSuggestions.length) setShowSuggestions(true); }}
              onBlur={e => { e.target.style.borderColor = t.border; setTimeout(() => setShowSuggestions(false), 180); }}
            />
            {locationLoading && (
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: t.textMuted }}>⏳</span>
            )}
            {locationCoords && (
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#22c55e' }}>✓</span>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && locationSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
              background: t.card, border: `1.5px solid ${t.accent}`, borderRadius: 12,
              boxShadow: t.shadowLg, marginTop: 4, overflow: 'hidden',
            }}>
              {locationSuggestions.map((place, i) => {
                const parts = place.display_name.split(',');
                const main = parts.slice(0, 2).join(',').trim();
                const sub = parts.slice(2, 4).join(',').trim();
                return (
                  <div key={place.place_id} onMouseDown={() => selectLocation(place)} style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: i < locationSuggestions.length - 1 ? `1px solid ${t.borderSub}` : 'none',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = t.cardAlt}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>📍 {main}</div>
                    {sub && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{sub}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Mini map preview once location is selected */}
          {locationCoords && (
            <div style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${t.accent}`, height: 130, position: 'relative' }}>
              <iframe
                title="location-preview"
                width="100%" height="130" frameBorder="0" scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationCoords.lng-0.03},${locationCoords.lat-0.02},${locationCoords.lng+0.03},${locationCoords.lat+0.02}&layer=mapnik&marker=${locationCoords.lat},${locationCoords.lng}`}
                style={{ border: 'none', display: 'block' }}
              />
              <button onClick={() => { setLocationCoords(null); setLocationQuery(''); setLocation(''); }} style={{
                position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)',
                border: 'none', borderRadius: '50%', width: 24, height: 24,
                color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>
          )}
        </div>

        {/* Image upload */}
        <div style={{ marginTop: 8 }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !imageUrl && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? t.accent : imageUrl ? t.accent : t.border}`,
              borderRadius: 12, padding: imageUrl ? 0 : '16px',
              background: dragOver ? t.accentSoft : t.inputBg,
              textAlign: 'center', cursor: imageUrl ? 'default' : 'pointer',
              transition: 'all 0.2s', overflow: 'hidden',
            }}
          >
            {uploading ? (
              <div style={{ color: t.textMuted, fontSize: 13, padding: 12 }}>📤 Uploading…</div>
            ) : imageUrl ? (
              <div style={{ position: 'relative' }}>
                <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                <button onClick={e => { e.stopPropagation(); setImageUrl(''); }} style={{
                  position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)',
                  border: 'none', borderRadius: '50%', width: 28, height: 28,
                  color: '#fff', cursor: 'pointer', fontSize: 14,
                }}>×</button>
              </div>
            ) : (
              <div style={{ color: t.textMuted, fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
                <div>Drop an image here or <span style={{ color: t.accent, fontWeight: 600 }}>browse</span></div>
                <div style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG, GIF up to 8MB</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadFile(e.target.files[0])} />

          {/* Or paste URL */}
          <input value={typeof imageUrl === 'string' && imageUrl.startsWith('/uploads') ? '' : imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="…or paste an image URL"
            style={{ ...inputStyle, marginTop: 8 }}
            onFocus={e => e.target.style.borderColor = t.accent}
            onBlur={e => e.target.style.borderColor = t.border}
          />
        </div>

        {/* Poll toggle */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setShowPoll(p => !p)} style={{
            background: showPoll ? t.accentSoft : t.inputBg,
            border: `1.5px solid ${showPoll ? t.accent : t.border}`,
            borderRadius: 20, padding: '7px 16px',
            color: showPoll ? t.accent : t.textMuted,
            fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
          }}>📊 {showPoll ? 'Remove Poll' : 'Add a Poll'}</button>
        </div>

        {/* Poll options */}
        {showPoll && (
          <div style={{ marginTop: 12, background: t.cardAlt, borderRadius: 12, padding: 14, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 10 }}>Poll Options (2–4)</div>
            {pollOptions.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={opt} onChange={e => setPollOptions(p => p.map((o, idx) => idx === i ? e.target.value : o))}
                  placeholder={`Option ${i + 1}`}
                  style={{ flex: 1, background: t.card, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: '8px 12px', color: t.text, fontSize: 13, outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = t.accent}
                  onBlur={e => e.target.style.borderColor = t.border}
                />
                {pollOptions.length > 2 && (
                  <button onClick={() => setPollOptions(p => p.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 18 }}>×</button>
                )}
              </div>
            ))}
            {pollOptions.length < 4 && (
              <button onClick={() => setPollOptions(p => [...p, ''])} style={{ background: 'none', border: `1px dashed ${t.border}`, borderRadius: 10, padding: '7px 16px', color: t.textMuted, fontSize: 13, cursor: 'pointer', width: '100%' }}>
                + Add Option
              </button>
            )}
          </div>
        )}

        {error && <div style={{ marginTop: 10, color: t.danger, fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ background: 'none', border: `1.5px solid ${t.border}`, borderRadius: 20, padding: '10px 22px', color: t.textMuted, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={!text.trim() || loading} style={{
            background: text.trim() && !loading ? 'linear-gradient(135deg, #f5a623, #ffcc5c)' : t.cardAlt,
            border: 'none', borderRadius: 20, padding: '10px 28px',
            color: text.trim() && !loading ? '#fff' : t.textMuted,
            fontWeight: 700, fontSize: 14, cursor: text.trim() && !loading ? 'pointer' : 'not-allowed',
            boxShadow: text.trim() && !loading ? '0 4px 16px rgba(245,166,35,0.35)' : 'none',
            transition: 'all 0.2s',
          }}>
            {loading ? 'Pouring…' : 'Pour It 🍺'}
          </button>
        </div>
      </div>
    </div>
  );
}
