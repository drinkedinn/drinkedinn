import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DRINK_NAMES = { '🥃': 'Whisky', '🍷': 'Wine', '🍺': 'Beer', '🍹': 'Cocktails', '🍸': 'Gin', '🥂': 'Champagne', '🍶': 'Sake', '🧉': 'Mate' };

const fmtDate = dateStr => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export default function LeftSidebar({ onProfileClick }) {
  const { user } = useAuth();
  const { t } = useTheme();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data)).catch(() => {});
  }, []);

  const toggleRsvp = async (event) => {
    try {
      const { data } = await api.post(`/events/${event.id}/rsvp`);
      setEvents(ev => ev.map(e => e.id === event.id
        ? { ...e, user_rsvped: data.rsvped ? 1 : 0, rsvp_count: (e.rsvp_count || 0) + (data.rsvped ? 1 : -1) }
        : e));
    } catch {}
  };

  const cardStyle = {
    background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
    boxShadow: t.shadow, transition: 'background 0.3s, border-color 0.3s',
  };

  // Parse user drinks
  let userDrinks = {};
  try { userDrinks = JSON.parse(user?.drinks || '{}'); } catch {}
  const drinkEntries = Object.entries(userDrinks).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Profile card */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ height: 72, background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'url(https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?w=400&q=60) center/cover', opacity: 0.2 }} />
        </div>
        <div style={{ padding: '0 16px 16px', marginTop: -24 }}>
          <img src={user?.avatar} alt="" style={{
            width: 52, height: 52, borderRadius: '50%', border: `3px solid ${t.card}`,
            marginBottom: 8, cursor: 'pointer', boxShadow: t.shadowMd, objectFit: 'cover',
          }} onClick={onProfileClick}
            onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`; }}
          />
          <div style={{ fontWeight: 700, fontSize: 15, color: t.text, cursor: 'pointer' }} onClick={onProfileClick}>
            {user?.name} <span style={{ color: t.link, fontSize: 13 }}>✓</span>
          </div>
          <div style={{ color: t.textMuted, fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{user?.title}</div>

          <div style={{ marginTop: 14, borderTop: `1px solid ${t.borderSub}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['🔗 Connections', user?.connections ?? 0],
              ['📝 Posts', user?.postCount ?? 0],
              ['📈 Impressions', '∞'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: t.textMuted }}>{label}</span>
                <span style={{ color: t.accent, fontWeight: 700 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My Bar */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>My Bar 🍶</div>
        {drinkEntries.length === 0 ? (
          <div style={{ color: t.textFaint, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🍸</div>
            <div>Set up your bar in Edit Profile</div>
          </div>
        ) : (
          drinkEntries.map(([emoji, level]) => (
            <div key={emoji} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: t.textSub }}>{emoji} {DRINK_NAMES[emoji] || emoji}</span>
                <span style={{ color: t.accent, fontWeight: 700 }}>{level}%</span>
              </div>
              <div style={{ height: 6, background: t.cardAlt, borderRadius: 3 }}>
                <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #f5a623, #ffcc5c)', width: `${level}%`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upcoming Community Events */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Community Events 📅</div>
        {events.length === 0 ? (
          <div style={{ color: t.textFaint, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🗓️</div>
            <div>No upcoming events yet</div>
          </div>
        ) : (
          events.slice(0, 4).map((e, i) => (
            <div key={e.id} style={{
              marginBottom: 12, paddingBottom: 12,
              borderBottom: i < Math.min(events.length, 4) - 1 ? `1px solid ${t.borderSub}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 16 }}>{e.drink}</span>
                <div style={{ fontWeight: 600, fontSize: 13, color: t.text, flex: 1 }}>{e.title}</div>
              </div>
              <div style={{ color: t.textMuted, fontSize: 12 }}>{fmtDate(e.date)}</div>
              {e.location && <div style={{ color: t.textFaint, fontSize: 11, marginTop: 1 }}>📍 {e.location}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <button onClick={() => toggleRsvp(e)} style={{
                  background: e.user_rsvped ? t.accentSoft : t.cardAlt,
                  border: `1.5px solid ${e.user_rsvped ? t.accent : t.border}`,
                  borderRadius: 20, padding: '4px 12px',
                  color: e.user_rsvped ? t.accent : t.textMuted,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                }}>{e.user_rsvped ? '✓ Going' : 'RSVP'}</button>
                {e.rsvp_count > 0 && <span style={{ fontSize: 11, color: t.textFaint }}>{e.rsvp_count} going</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
