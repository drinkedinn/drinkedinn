import { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';

export default function AuthPage() {
  const { login } = useAuth();
  const { t, isDark, toggleTheme } = useTheme();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', title: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post(tab === 'login' ? '/auth/login' : '/auth/register', form);
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const inp = (key, placeholder, type = 'text') => (
    <input type={type} placeholder={placeholder} value={form[key]} onChange={set(key)} required={key !== 'title'} style={{
      width: '100%', background: t.inputBg, border: `1.5px solid ${t.border}`,
      borderRadius: 12, padding: '14px 18px', color: t.text,
      fontSize: 15, outline: 'none', marginBottom: 12, transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
    }}
      onFocus={e => { e.target.style.borderColor = t.accent; e.target.style.boxShadow = `0 0 0 3px ${t.accentSoft}`; }}
      onBlur={e => { e.target.style.borderColor = t.border; e.target.style.boxShadow = 'none'; }}
    />
  );

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, transition: 'background 0.3s' }}>
      <div style={{ position: 'fixed', top: 20, right: 20 }}>
        <button onClick={toggleTheme} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 20, padding: '8px 14px', cursor: 'pointer', fontSize: 16, boxShadow: t.shadow }}>
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

      <div style={{ marginBottom: 32, textAlign: 'center', animation: 'fadeInUp 0.5s ease' }}>
        <Logo size="lg" />
        <p style={{ color: t.textMuted, marginTop: 10, fontSize: 15, fontStyle: 'italic' }}>
          Where Professionals Actually Unwind 🥃
        </p>
      </div>

      <div className="fadeInUp" style={{ width: '100%', maxWidth: 420, background: t.card, borderRadius: 20, border: `1px solid ${t.border}`, overflow: 'hidden', boxShadow: t.shadowLg }}>
        <div style={{ display: 'flex' }}>
          {['login', 'register'].map(tabId => (
            <button key={tabId} onClick={() => { setTab(tabId); setError(''); }} style={{
              flex: 1, padding: '18px', border: 'none',
              background: tab === tabId ? t.card : t.cardAlt,
              color: tab === tabId ? t.accent : t.textMuted,
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              borderBottom: tab === tabId ? `2px solid ${t.accent}` : `2px solid ${t.border}`,
              transition: 'all 0.2s',
            }}>
              {tabId === 'login' ? '🥃 Sign In' : '🍺 Join the Bar'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ padding: 28 }}>
          {tab === 'register' && inp('name', 'Full Name')}
          {inp('email', 'Email Address', 'email')}
          {inp('password', 'Password', 'password')}
          {tab === 'register' && inp('title', 'Your Title (e.g. VP of Vibes 🥂)')}

          {error && (
            <div style={{ background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, borderRadius: 10, padding: '10px 14px', color: t.danger, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px',
            background: loading ? t.cardAlt : 'linear-gradient(135deg, #f5a623, #ffcc5c)',
            border: 'none', borderRadius: 12,
            color: loading ? t.textMuted : '#fff',
            fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(245,166,35,0.35)',
            transition: 'all 0.2s',
          }}>
            {loading ? 'Pouring...' : tab === 'login' ? 'Sign In 🥃' : 'Join the Bar 🍺'}
          </button>

          {tab === 'login' && (
            <div style={{ marginTop: 16, padding: 12, background: t.cardAlt, borderRadius: 10, fontSize: 12, border: `1px solid ${t.border}` }}>
              <div style={{ marginBottom: 4, color: t.textFaint }}>Demo accounts (password: demo123):</div>
              {['rahul@drinkeden.app', 'ananya@drinkeden.app', 'karan@drinkeden.app'].map(email => (
                <div key={email} onClick={() => setForm(f => ({ ...f, email, password: 'demo123' }))}
                  style={{ color: t.accent, cursor: 'pointer', marginBottom: 2, fontWeight: 600 }}>
                  → {email}
                </div>
              ))}
            </div>
          )}
        </form>
      </div>

      <p style={{ marginTop: 24, color: t.textFaint, fontSize: 12 }}>No business talk. No synergy. Just good drinks. 🚫💼</p>
    </div>
  );
}
