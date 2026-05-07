import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useWindowSize } from '../hooks/useWindowSize';
import { useState, useEffect } from 'react';
import api from '../api';
import Logo from './Logo';
import { NotificationBell } from './Notifications';

export default function Navbar({ activeTab, setActiveTab, setShowPost, setShowSearch, setShowEditProfile, onLogoClick, onProfileClick }) {
  const { user, logout } = useAuth();
  const { t, isDark, toggleTheme } = useTheme();
  const { isMobile } = useWindowSize();
  const [showMenu, setShowMenu] = useState(false);
  const [unreadMsg, setUnreadMsg] = useState(0);

  useEffect(() => {
    const fetchUnread = () => api.get('/messages/unread/count').then(r => setUnreadMsg(r.data.count || 0)).catch(() => {});
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'home',       icon: '⌂',  label: 'Home' },
    { id: 'explore',    icon: '🔥', label: 'Explore' },
    { id: 'cheers',     icon: '🥂', label: 'Cheers' },
    { id: 'trips',      icon: '✈️', label: 'Trips' },
    { id: 'groups',     icon: '🍶', label: 'Groups' },
    { id: 'messages',   icon: '💬', label: 'Messages', badge: unreadMsg },
    { id: 'challenges', icon: '⚡', label: 'Challenges' },
  ];

  if (user?.id === 1) {
    tabs.push({ id: 'agents', icon: '🤖', label: 'Agents' });
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: t.navBg, backdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${t.border}`,
      boxShadow: t.shadow,
      padding: isMobile ? '0 12px' : '0 24px',
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64, gap: isMobile ? 10 : 20 }}>
        <Logo onClick={onLogoClick} />

        {/* Search bar - desktop only */}
        {!isMobile && (
          <div onClick={() => setShowSearch(true)} style={{
            flex: 1, maxWidth: 320, display: 'flex', alignItems: 'center', gap: 8,
            background: t.inputBg, border: `1.5px solid ${t.border}`,
            borderRadius: 24, padding: '9px 16px', cursor: 'pointer',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${t.accentSoft}`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span style={{ fontSize: 14, color: t.textMuted }}>🔍</span>
            <span style={{ color: t.textMuted, fontSize: 14 }}>Search drinks, people, places…</span>
          </div>
        )}

        {/* Tabs - desktop only */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 10px', borderRadius: 8, gap: 2, position: 'relative',
                color: activeTab === tab.id ? t.accent : t.textMuted,
                borderBottom: activeTab === tab.id ? `2px solid ${t.accent}` : '2px solid transparent',
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: 17, position: 'relative' }}>
                  {tab.icon}
                  {tab.badge > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -6, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600 }}>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mobile search */}
          {isMobile && (
            <button onClick={() => setShowSearch(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: t.textMuted, padding: '6px 8px' }}>🔍</button>
          )}

          {/* Pour button */}
          {!isMobile && (
            <button onClick={() => setShowPost(true)} style={{
              background: 'linear-gradient(135deg, #f5a623, #ffcc5c)',
              border: 'none', borderRadius: 24, padding: '9px 20px',
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(245,166,35,0.35)', transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,166,35,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,166,35,0.35)'; }}
            >+ Pour a Story</button>
          )}

          {/* Theme toggle */}
          <button onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'} style={{
            background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 20,
            padding: '7px 10px', cursor: 'pointer', fontSize: 16, transition: 'all 0.2s',
            boxShadow: t.shadow,
          }}>
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* Notifications */}
          {!isMobile && <NotificationBell />}

          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <div onClick={() => setShowMenu(m => !m)} style={{ cursor: 'pointer', position: 'relative' }}>
              <img src={user?.avatar} alt="" style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${t.accent}`, display: 'block' }} />
              <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: '#22c55e', borderRadius: '50%', border: `2px solid ${t.card}` }} />
            </div>

            {showMenu && (
              <div className="slideDown" style={{
                position: 'absolute', right: 0, top: 48, width: 220,
                background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
                boxShadow: t.shadowLg, overflow: 'hidden', zIndex: 200,
              }} onMouseLeave={() => setShowMenu(false)}>
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{user?.name}</div>
                  <div style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>{user?.title}</div>
                </div>
                {[
                  { icon: '👤', label: 'My Profile', action: () => { onProfileClick?.(); setShowMenu(false); } },
                  { icon: '✏️', label: 'Edit Profile', action: () => { setShowEditProfile?.(true); setShowMenu(false); } },
                  { icon: '🍶', label: 'My Bar', action: () => { setActiveTab?.('mybar'); setShowMenu(false); } },
                  { icon: '⚡', label: 'Challenges', action: () => { setActiveTab?.('challenges'); setShowMenu(false); } },
                  { icon: isDark ? '☀️' : '🌙', label: isDark ? 'Light Mode' : 'Dark Mode', action: () => { toggleTheme(); setShowMenu(false); } },
                  { icon: '🚪', label: 'Sign Out', action: logout, danger: true },
                ].map(item => (
                  <button key={item.label} onClick={item.action} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', background: 'none', border: 'none',
                    color: item.danger ? t.danger : t.textSub, cursor: 'pointer',
                    fontSize: 14, textAlign: 'left', transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = t.cardAlt}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span>{item.icon}</span><span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
