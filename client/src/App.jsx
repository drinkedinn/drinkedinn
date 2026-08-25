import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { useWindowSize } from './hooks/useWindowSize';
import AuthPage from './components/AuthPage';
import Navbar from './components/Navbar';
import Feed from './components/Feed';
import Stories from './components/Stories';
import CreatePost from './components/CreatePost';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import PostModal from './components/PostModal';
import ProfilePage from './components/ProfilePage';
import Splash from './components/Splash';
import SearchModal from './components/SearchModal';
import EditProfileModal from './components/EditProfileModal';
import OnboardingModal from './components/OnboardingModal';
import GroupsPage from './components/GroupsPage';
import MessagesPage from './components/MessagesPage';
import MyBarPage from './components/MyBarPage';
import ChallengesPage from './components/ChallengesPage';
import AgentDashboard from './components/AgentDashboard';
import PeoplePage from './components/PeoplePage';
import WhiskeyCollectionPage from './components/WhiskeyCollectionPage';
import SommelierChat from './components/SommelierChat';

const TAB_META = {
  home:       { icon: '⌂',  label: 'Home',           desc: null },
  explore:    { icon: '🔥', label: 'Explore',          desc: 'Trending Pours' },
  cheers:     { icon: '🥂', label: 'Cheers',           desc: 'Posts You Cheered' },
  trips:      { icon: '✈️', label: 'Trips',            desc: 'Travel & Location Posts' },
  people:     { icon: '🫂', label: 'Find People',      desc: 'Connect with drink pros' },
  whiskeys:   { icon: '🥃', label: 'World Whiskeys',   desc: '58 whiskies from 13 countries' },
  groups:     { icon: '🍶', label: 'Drink Groups',     desc: 'Find your tribe' },
  messages:   { icon: '💬', label: 'Messages',         desc: 'Direct messages' },
  mybar:      { icon: '🍸', label: 'My Bar',           desc: 'Ratings, Collection & Badges' },
  challenges: { icon: '⚡', label: 'Challenges',       desc: 'Monthly drink challenges' },
  agents:     { icon: '🤖', label: 'Agents',           desc: 'AI Agent Command Center' },
};

// Map URL paths to tab IDs
const PATH_TO_TAB = {
  '/': 'home', '/explore': 'explore', '/cheers': 'cheers', '/trips': 'trips',
  '/people': 'people', '/whiskeys': 'whiskeys', '/groups': 'groups',
  '/messages': 'messages', '/mybar': 'mybar', '/challenges': 'challenges',
  '/agents': 'agents',
};
const TAB_TO_PATH = Object.fromEntries(Object.entries(PATH_TO_TAB).map(([k, v]) => [v, k]));

export default function App() {
  const { user, loading } = useAuth();
  const { t } = useTheme();
  const { isMobile, isTablet } = useWindowSize();
  const navigate = useNavigate();
  const location = useLocation();

  const [splash, setSplash] = useState(true);
  const [showPost, setShowPost] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [feedKey, setFeedKey] = useState(0);
  const [hashtag, setHashtag] = useState(null);

  // Derive active tab from URL
  const pathBase = '/' + (location.pathname.split('/')[1] || '');
  const activeTab = PATH_TO_TAB[pathBase] || (pathBase.startsWith('/profile') ? 'home' : 'home');

  // Detect /profile/:id from URL
  useEffect(() => {
    const match = location.pathname.match(/^\/profile\/(\d+)/);
    if (match) setProfileId(parseInt(match[1]));
    else if (!location.pathname.startsWith('/profile')) setProfileId(null);
  }, [location.pathname]);

  // Detect /hashtag/:tag from URL
  useEffect(() => {
    const match = location.pathname.match(/^\/hashtag\/(.+)/);
    if (match) { setHashtag('#' + decodeURIComponent(match[1])); }
    else if (!location.pathname.startsWith('/hashtag')) setHashtag(null);
  }, [location.pathname]);

  if (loading) return null;
  if (!user) {
    // Show landing page for root, auth for /login
    if (location.pathname === '/') {
      navigate('/welcome', { replace: true });
      return null;
    }
    return <AuthPage />;
  }
  if (splash) return <Splash onDone={() => setSplash(false)} />;
  if (!user.onboarded) return <OnboardingModal onDone={() => window.location.reload()} />;

  const cols = isMobile ? '1fr' : isTablet ? '1fr 2fr' : '280px 1fr 300px';

  const goTab = tab => {
    const path = TAB_TO_PATH[tab] || '/';
    navigate(path);
    setProfileId(null);
    setHashtag(null);
  };

  const handleHashtag = tag => {
    const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
    navigate(`/hashtag/${encodeURIComponent(cleanTag)}`);
    setShowSearch(false);
  };

  const handleProfileClick = id => {
    navigate(`/profile/${id}`);
  };

  const onPosted = () => {
    setFeedKey(k => k + 1);
    navigate('/');
    setHashtag(null);
  };

  const renderTabContent = () => {
    const meta = TAB_META[activeTab] || TAB_META.home;

    if (activeTab === 'home') {
      return (
        <>
          <Stories />
          <CreatePost onPost={() => setShowPost(true)} />
          <Feed key={`home-${feedKey}`} mode="home" onUserClick={handleProfileClick} />
        </>
      );
    }

    if (activeTab === 'people') return <PeoplePage onUserClick={handleProfileClick} />;
    if (activeTab === 'whiskeys') return <WhiskeyCollectionPage />;
    if (activeTab === 'groups') return <GroupsPage />;
    if (activeTab === 'messages') return <MessagesPage />;
    if (activeTab === 'mybar') return <MyBarPage userId={user.id} />;
    if (activeTab === 'challenges') return <ChallengesPage />;
    if (activeTab === 'agents' && user?.is_admin) return <AgentDashboard />;

    return (
      <>
        <div style={{
          background: t.card, borderRadius: 16, padding: '16px 20px',
          border: `1px solid ${t.border}`, marginBottom: 16,
          boxShadow: t.shadow, display: 'flex', alignItems: 'center', gap: 12,
          transition: 'background 0.3s',
        }}>
          <span style={{ fontSize: 28 }}>{meta.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: t.text }}>{meta.label}</div>
            <div style={{ fontSize: 13, color: t.textMuted }}>{meta.desc}</div>
          </div>
          {hashtag && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: t.link, fontWeight: 600, fontSize: 14 }}>Filter: {hashtag}</span>
              <button onClick={() => { setHashtag(null); navigate('/explore'); }} style={{
                background: t.dangerBg, border: `1px solid ${t.dangerBorder}`,
                borderRadius: 20, padding: '4px 12px', color: t.danger,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>× Clear</button>
            </div>
          )}
        </div>

        <Feed
          key={`${activeTab}-${hashtag || ''}-${feedKey}`}
          mode={activeTab === 'home' ? 'home' : activeTab}
          hashtag={hashtag}
          onUserClick={handleProfileClick}
        />
      </>
    );
  };

  return (
    <div style={{ background: t.bg, minHeight: '100vh', transition: 'background 0.3s' }}>
      {showPost && <PostModal onClose={() => setShowPost(false)} onPosted={onPosted} />}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onUserClick={id => { handleProfileClick(id); setShowSearch(false); }}
          onHashtagClick={handleHashtag}
        />
      )}
      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}

      <Navbar
        activeTab={activeTab}
        setActiveTab={goTab}
        setShowPost={setShowPost}
        setShowSearch={setShowSearch}
        setShowEditProfile={setShowEditProfile}
        onLogoClick={() => goTab('home')}
        onProfileClick={() => handleProfileClick(user.id)}
      />

      {profileId ? (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 16px' }}>
          <ProfilePage
            userId={profileId}
            onBack={() => { setProfileId(null); navigate(-1); }}
            onUserClick={handleProfileClick}
          />
        </div>
      ) : (
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 16px',
          display: 'grid', gridTemplateColumns: cols, gap: isMobile ? 12 : 20,
        }}>
          {!isMobile && <LeftSidebar onProfileClick={() => handleProfileClick(user.id)} />}

          <main>
            {renderTabContent()}
          </main>

          {!isMobile && !isTablet && (
            <RightSidebar
              onUserClick={handleProfileClick}
              onHashtagClick={handleHashtag}
            />
          )}
        </div>
      )}

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: t.card, borderTop: `1px solid ${t.border}`,
          display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        }}>
          {[
            { id: 'home',       icon: '⌂',  label: 'Home' },
            { id: 'groups',     icon: '🍶', label: 'Groups' },
            { id: 'post',       icon: '➕', label: 'Pour',   action: () => setShowPost(true) },
            { id: 'messages',   icon: '💬', label: 'DMs' },
            { id: 'profile',    icon: '👤', label: 'Me',     action: () => handleProfileClick(user.id) },
          ].map(tab => (
            <button key={tab.id} onClick={tab.action || (() => goTab(tab.id))} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '10px 4px', background: 'none', border: 'none',
              color: activeTab === tab.id && !profileId ? t.accent : t.textMuted,
              cursor: 'pointer', fontSize: 20, gap: 2, transition: 'color 0.2s',
            }}>
              <span>{tab.id === 'post' ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, background: 'linear-gradient(135deg, #f5a623, #ffcc5c)', borderRadius: '50%', fontSize: 20, boxShadow: '0 4px 12px rgba(245,166,35,0.4)' }}>➕</span>
              ) : tab.icon}</span>
              {tab.id !== 'post' && <span style={{ fontSize: 10, fontWeight: 600 }}>{tab.label}</span>}
            </button>
          ))}
        </nav>
      )}
      {isMobile && <div style={{ height: 70 }} />}

      {/* AI Sommelier floating chat — available everywhere when logged in */}
      <SommelierChat />
    </div>
  );
}
