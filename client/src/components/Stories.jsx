import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Stories() {
  const { user } = useAuth();
  const { t } = useTheme();
  const [stories, setStories] = useState([]);
  const [showDrinkPicker, setShowDrinkPicker] = useState(false);
  const drinks = ['🥃', '🍺', '🍷', '🍹', '🍸', '🥂', '🍶', '🧉'];

  useEffect(() => {
    api.get('/stories').then(r => setStories(r.data)).catch(() => {});
  }, []);

  const addStory = async drink => {
    await api.post('/stories', { drink });
    const r = await api.get('/stories');
    setStories(r.data);
    setShowDrinkPicker(false);
  };

  return (
    <div className="fadeInUp" style={{ background: t.card, borderRadius: 16, padding: '16px 20px', border: `1px solid ${t.border}`, marginBottom: 16, boxShadow: t.shadow, transition: 'background 0.3s, border-color 0.3s' }}>
      <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        Sip Stories • Live
      </div>

      {showDrinkPicker && (
        <div className="slideDown" style={{ marginBottom: 12, padding: 12, background: t.accentSoft, borderRadius: 12, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>What's in your glass?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {drinks.map(d => (
              <button key={d} onClick={() => addStory(d)} style={{
                fontSize: 24, background: t.card, border: `1.5px solid ${t.border}`,
                borderRadius: 10, padding: '6px 10px', cursor: 'pointer',
                transition: 'transform 0.15s, border-color 0.15s', boxShadow: t.shadow,
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.borderColor = t.accent; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = t.border; }}
              >{d}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
        <div onClick={() => setShowDrinkPicker(p => !p)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: t.cardAlt,
            border: `2px dashed ${t.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            transition: 'transform 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >➕</div>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>Your Story</span>
        </div>

        {user && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg, #f5a623, #ffcc5c)' }}>
              <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', border: `2px solid ${t.card}`, objectFit: 'cover' }} />
            </div>
            <span style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>You</span>
          </div>
        )}

        {stories.map(s => (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer', transition: 'transform 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ width: 60, height: 60, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg, #f5a623, #ffcc5c, #ff6b35)' }}>
              <img src={s.avatar} alt={s.name} style={{ width: '100%', height: '100%', borderRadius: '50%', border: `2px solid ${t.card}`, objectFit: 'cover' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 11, color: t.textSub, fontWeight: 500, maxWidth: 56, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name.split(' ')[0]}
              </span>
              <span style={{ fontSize: 12 }}>{s.drink}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
