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

export default function EditProfileModal({ onClose }) {
  const { user, refreshUser } = useAuth();
  const { t } = useTheme();
  const [tab, setTab] = useState('profile'); // profile | bar | password

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [title, setTitle] = useState(user?.title || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [uploading, setUploading] = useState(false);

  // My Bar
  let initDrinks = {};
  try { initDrinks = JSON.parse(user?.drinks || '{}'); } catch {}
  const [drinkLevels, setDrinkLevels] = useState(initDrinks);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef();

  const uploadAvatar = async file => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAvatar(data.url);
    } catch { setError('Image upload failed'); }
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

  const setLevel = (emoji, val) => setDrinkLevels(prev => ({ ...prev, [emoji]: parseInt(val) }));

  const saveProfile = async () => {
    if (!name.trim() || saving) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put('/users/me', { name: name.trim(), title, bio, avatar, drinks: drinkLevels, onboarded: true });
      await refreshUser();
      setSuccess('Profile saved!');
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!currentPw || !newPw) { setError('Fill in both passwords'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match'); return; }
    if (newPw.length < 6) { setError('New password must be at least 6 characters'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      setSuccess('Password changed!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally { setSaving(false); }
  };

  const inputStyle = {
    width: '100%', background: t.inputBg, border: `1.5px solid ${t.border}`,
    borderRadius: 12, padding: '10px 16px', color: t.text,
    fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s', boxSizing: 'border-box',
  };

  const tabStyle = active => ({
    flex: 1, padding: '10px 8px', background: active ? t.accentSoft : 'none',
    border: 'none', borderRadius: 10, color: active ? t.accent : t.textMuted,
    fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001,
      background: t.overlay, backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div className="popIn" style={{
        background: t.card, borderRadius: 20, padding: 28,
        width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto',
        border: `1px solid ${t.border}`, boxShadow: t.shadowLg,
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: t.text }}>Edit Profile</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
            onMouseEnter={e => e.target.style.color = t.danger}
            onMouseLeave={e => e.target.style.color = t.textMuted}
          >×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: t.cardAlt, borderRadius: 12, padding: 4, marginBottom: 24 }}>
          <button style={tabStyle(tab === 'profile')} onClick={() => { setTab('profile'); setError(''); setSuccess(''); }}>👤 Profile</button>
          <button style={tabStyle(tab === 'bar')} onClick={() => { setTab('bar'); setError(''); setSuccess(''); }}>🍶 My Bar</button>
          <button style={tabStyle(tab === 'password')} onClick={() => { setTab('password'); setError(''); setSuccess(''); }}>🔒 Password</button>
        </div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div>
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
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 6,
                }}>{uploading ? 'Uploading…' : '📸 Upload Photo'}</button>
                <div style={{ fontSize: 11, color: t.textFaint }}>Or paste a URL below</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => uploadAvatar(e.target.files[0])} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Avatar URL</label>
              <input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://…" style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Full Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Title / Role</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. CFO @ Boring Corp | Chief Fun Officer" style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell the world what's in your glass…"
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }}
                onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
            </div>

            {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ color: t.green, fontSize: 13, marginBottom: 12 }}>✓ {success}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ background: 'none', border: `1.5px solid ${t.border}`, borderRadius: 20, padding: '10px 22px', color: t.textMuted, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveProfile} disabled={!name.trim() || saving} style={{
                flex: 1, background: name.trim() && !saving ? 'linear-gradient(135deg, #f5a623, #ffcc5c)' : t.cardAlt,
                border: 'none', borderRadius: 20, padding: '10px 20px',
                color: name.trim() && !saving ? '#fff' : t.textMuted,
                fontWeight: 700, fontSize: 14, cursor: name.trim() && !saving ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}>
                {saving ? 'Saving…' : 'Save Changes ✓'}
              </button>
            </div>
          </div>
        )}

        {/* My Bar Tab */}
        {tab === 'bar' && (
          <div>
            <p style={{ color: t.textMuted, fontSize: 13, margin: '0 0 20px' }}>
              Select your drinks and set your enthusiasm level. This shows on your profile.
            </p>
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
                    <span style={{ width: 72, fontSize: 13, color: selected ? t.text : t.textMuted, fontWeight: selected ? 600 : 400 }}>{drinkName}</span>
                    {selected ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="range" min={10} max={100} step={5}
                          value={drinkLevels[emoji]}
                          onChange={e => setLevel(emoji, e.target.value)}
                          style={{ flex: 1, accentColor: t.accent }}
                        />
                        <span style={{ fontSize: 12, color: t.accent, fontWeight: 700, minWidth: 32 }}>{drinkLevels[emoji]}%</span>
                      </div>
                    ) : (
                      <div style={{ flex: 1, height: 6, background: t.cardAlt, borderRadius: 3 }} />
                    )}
                  </div>
                );
              })}
            </div>

            {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ color: t.green, fontSize: 13, marginBottom: 12 }}>✓ {success}</div>}

            <button onClick={saveProfile} disabled={saving} style={{
              width: '100%', background: saving ? t.cardAlt : 'linear-gradient(135deg, #f5a623, #ffcc5c)',
              border: 'none', borderRadius: 20, padding: '12px',
              color: saving ? t.textMuted : '#fff', fontWeight: 700, fontSize: 14,
              cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s',
            }}>
              {saving ? 'Saving…' : '🍶 Save My Bar'}
            </button>
          </div>
        )}

        {/* Password Tab */}
        {tab === 'password' && (
          <div>
            <p style={{ color: t.textMuted, fontSize: 13, margin: '0 0 20px' }}>
              Choose a strong password with at least 6 characters.
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Current Password</label>
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>New Password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="At least 6 characters" style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Confirm New Password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border}
                onKeyDown={e => e.key === 'Enter' && changePassword()}
              />
            </div>

            {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ color: t.green, fontSize: 13, marginBottom: 12 }}>✓ {success}</div>}

            <button onClick={changePassword} disabled={saving} style={{
              width: '100%', background: saving ? t.cardAlt : 'linear-gradient(135deg, #f5a623, #ffcc5c)',
              border: 'none', borderRadius: 20, padding: '12px',
              color: saving ? t.textMuted : '#fff', fontWeight: 700, fontSize: 14,
              cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s',
            }}>
              {saving ? 'Changing…' : '🔒 Change Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
