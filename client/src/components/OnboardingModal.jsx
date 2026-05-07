import { useState, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DRINKS = [
  { emoji: '🥃', name: 'Whisky' },
  { emoji: '🍷', name: 'Wine' },
  { emoji: '🍺', name: 'Beer' },
  { emoji: '🍹', name: 'Cocktails' },
  { emoji: '🍸', name: 'Gin' },
  { emoji: '🥂', name: 'Champagne' },
  { emoji: '🍶', name: 'Sake' },
  { emoji: '🧉', name: 'Mate' },
];

export default function OnboardingModal({ onDone }) {
  const { user, refreshUser } = useAuth();
  const { t } = useTheme();
  const [step, setStep] = useState(1); // 1=welcome, 2=profile, 3=drinks
  const [name, setName] = useState(user?.name || '');
  const [title, setTitle] = useState(user?.title === 'DrinkedInn Member 🥃' ? '' : (user?.title || ''));
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [drinkLevels, setDrinkLevels] = useState({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const uploadAvatar = async file => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAvatar(data.url);
    } catch {}
    finally { setUploading(false); }
  };

  const toggleDrink = emoji => {
    setDrinkLevels(prev => {
      const next = { ...prev };
      if (next[emoji]) delete next[emoji];
      else next[emoji] = 75;
      return next;
    });
  };

  const setLevel = (emoji, val) => {
    setDrinkLevels(prev => ({ ...prev, [emoji]: parseInt(val) }));
  };

  const finish = async () => {
    setSaving(true);
    try {
      await api.put('/users/me', {
        name: name.trim() || user?.name,
        title: title.trim() || 'DrinkedInn Member 🥃',
        bio, avatar, drinks: drinkLevels, onboarded: true,
      });
      await refreshUser();
      onDone();
    } finally { setSaving(false); }
  };

  const inputStyle = {
    width: '100%', background: t.inputBg, border: `1.5px solid ${t.border}`,
    borderRadius: 12, padding: '10px 16px', color: t.text,
    fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: t.overlay, backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="popIn" style={{
        background: t.card, borderRadius: 24, padding: 32,
        width: '100%', maxWidth: 500, border: `1px solid ${t.border}`,
        boxShadow: t.shadowLg,
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i <= step ? t.accent : t.border,
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🥃</div>
            <h2 style={{ color: t.text, fontSize: 24, fontWeight: 800, margin: '0 0 12px' }}>
              Welcome to DrinkedInn!
            </h2>
            <p style={{ color: t.textMuted, fontSize: 15, lineHeight: 1.6, margin: '0 0 8px' }}>
              Where professionals actually unwind.
            </p>
            <p style={{ color: t.textSub, fontSize: 14, lineHeight: 1.6, margin: '0 0 32px' }}>
              No business talk. No synergy. No KPIs.<br />
              Just drinks, stories, and good vibes. 🎉
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setStep(2)} style={{
                background: 'linear-gradient(135deg, #f5a623, #ffcc5c)',
                border: 'none', borderRadius: 20, padding: '14px',
                color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(245,166,35,0.4)',
              }}>
                Set Up My Profile →
              </button>
              <button onClick={finish} style={{
                background: 'none', border: 'none', color: t.textMuted,
                fontSize: 13, cursor: 'pointer', padding: '8px',
              }}>
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Profile info */}
        {step === 2 && (
          <div>
            <h2 style={{ color: t.text, fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Your Profile</h2>
            <p style={{ color: t.textMuted, fontSize: 13, margin: '0 0 24px' }}>Tell the community who you are</p>

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`} alt=""
                  style={{ width: 64, height: 64, borderRadius: '50%', border: `3px solid ${t.accent}`, objectFit: 'cover' }}
                  onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`; }}
                />
                <button onClick={() => fileRef.current?.click()} style={{
                  position: 'absolute', bottom: 0, right: 0,
                  background: t.accent, border: 'none', borderRadius: '50%',
                  width: 22, height: 22, color: '#fff', cursor: 'pointer', fontSize: 11,
                }}>✎</button>
              </div>
              <div style={{ flex: 1 }}>
                <button onClick={() => fileRef.current?.click()} style={{
                  background: t.accentSoft, border: `1px solid ${t.accent}`,
                  borderRadius: 20, padding: '6px 16px', color: t.accent,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{uploading ? 'Uploading…' : '📸 Upload Photo'}</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => uploadAvatar(e.target.files[0])} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Your Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Title / Role</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. CFO @ Boring Corp | Chief Fun Officer"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Bio <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <textarea value={bio} onChange={e => setBio(e.target.value)}
                placeholder="What's your drink story? Where have you sipped? What's your guilty pleasure?"
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical', lineHeight: 1.5 }}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 20, padding: '12px', color: t.textMuted, cursor: 'pointer', fontWeight: 600 }}>← Back</button>
              <button onClick={() => setStep(3)} style={{
                flex: 2, background: 'linear-gradient(135deg, #f5a623, #ffcc5c)',
                border: 'none', borderRadius: 20, padding: '12px',
                color: '#fff', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(245,166,35,0.35)',
              }}>Next: My Bar →</button>
            </div>
          </div>
        )}

        {/* Step 3: Drink preferences */}
        {step === 3 && (
          <div>
            <h2 style={{ color: t.text, fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Set Up My Bar 🍶</h2>
            <p style={{ color: t.textMuted, fontSize: 13, margin: '0 0 20px' }}>Pick your drinks and set your enthusiasm level</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {DRINKS.map(({ emoji, name: drinkName }) => {
                const selected = emoji in drinkLevels;
                return (
                  <div key={emoji} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => toggleDrink(emoji)} style={{
                      width: 42, height: 42, borderRadius: 10, fontSize: 20,
                      background: selected ? t.accentSoft : t.cardAlt,
                      border: `2px solid ${selected ? t.accent : t.border}`,
                      cursor: 'pointer', flexShrink: 0,
                      transform: selected ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.15s',
                    }}>{emoji}</button>
                    <span style={{ width: 70, fontSize: 13, color: t.textSub, fontWeight: selected ? 600 : 400 }}>{drinkName}</span>
                    {selected && (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="range" min={10} max={100} step={5}
                          value={drinkLevels[emoji]}
                          onChange={e => setLevel(emoji, e.target.value)}
                          style={{ flex: 1, accentColor: t.accent }}
                        />
                        <span style={{ fontSize: 12, color: t.accent, fontWeight: 700, minWidth: 32 }}>{drinkLevels[emoji]}%</span>
                      </div>
                    )}
                    {!selected && <div style={{ flex: 1, height: 6, background: t.cardAlt, borderRadius: 3 }} />}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 20, padding: '12px', color: t.textMuted, cursor: 'pointer', fontWeight: 600 }}>← Back</button>
              <button onClick={finish} disabled={saving} style={{
                flex: 2, background: 'linear-gradient(135deg, #f5a623, #ffcc5c)',
                border: 'none', borderRadius: 20, padding: '12px',
                color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
                boxShadow: '0 4px 12px rgba(245,166,35,0.35)',
              }}>
                {saving ? 'Setting up…' : "🍺 Let's Pour!"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
