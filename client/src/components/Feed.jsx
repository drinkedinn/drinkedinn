import { useState, useEffect } from 'react';
import api from '../api';
import { useTheme } from '../context/ThemeContext';
import PostCard from './PostCard';

/* ── Whisky Pour Loader ──────────────────────────────────────────────── */
function WhiskyPourLoader({ t }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '28px 0 8px', gap: 14,
    }}>
      <svg
        viewBox="0 0 160 180"
        width="160" height="180"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Bottle gradient */}
          <linearGradient id="bottleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#2d4a1e" />
            <stop offset="35%"  stopColor="#3d6829" />
            <stop offset="65%"  stopColor="#4a7a30" />
            <stop offset="100%" stopColor="#2d4a1e" />
          </linearGradient>
          <linearGradient id="bottleShine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"  stopColor="rgba(255,255,255,0)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Stream gradient */}
          <linearGradient id="streamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#d4900a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#c4780a" stopOpacity="0.7" />
          </linearGradient>
          {/* Liquid in glass gradient */}
          <linearGradient id="liquidGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#a0600a" />
            <stop offset="40%"  stopColor="#d4900a" />
            <stop offset="100%" stopColor="#8b5209" />
          </linearGradient>
          {/* Glass gradient */}
          <linearGradient id="glassBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="rgba(180,210,255,0.35)" />
            <stop offset="30%"  stopColor="rgba(220,235,255,0.10)" />
            <stop offset="70%"  stopColor="rgba(200,220,255,0.15)" />
            <stop offset="100%" stopColor="rgba(180,210,255,0.35)" />
          </linearGradient>
          <clipPath id="glassBodyClip">
            <polygon points="68,110 92,110 98,165 62,165" />
          </clipPath>

          {/* Animated stream clip — narrows to nothing then opens */}
          <style>{`
            @keyframes bottleTilt {
              0%,15%  { transform: rotate(0deg) translate(0,0); }
              30%     { transform: rotate(-52deg) translate(-18px, 8px); }
              75%     { transform: rotate(-52deg) translate(-18px, 8px); }
              90%,100%{ transform: rotate(0deg) translate(0,0); }
            }
            @keyframes streamAppear {
              0%,28%  { opacity: 0; d: path("M 80 95 Q 80 110 80 130 Q 80 140 80 148"); }
              32%     { opacity: 1; d: path("M 80 95 Q 79 112 79 130 Q 79 140 80 148"); }
              35%,72% { opacity: 1; d: path("M 79 95 Q 77 112 77 130 Q 78 142 80 148"); }
              80%     { opacity: 0.5; d: path("M 80 95 Q 80 112 80 130 Q 80 142 80 148"); }
              85%,100%{ opacity: 0; d: path("M 80 95 Q 80 112 80 130 Q 80 142 80 148"); }
            }
            @keyframes liquidFill {
              0%,30%  { height: 0px;  y: 165px; opacity: 0; }
              35%     { opacity: 0.9; }
              75%     { height: 38px; y: 127px; opacity: 0.9; }
              88%     { height: 38px; y: 127px; opacity: 0.9; }
              100%    { height: 0px;  y: 165px; opacity: 0; }
            }
            @keyframes surfaceWave {
              0%,30%  { opacity: 0; }
              35%,85% { opacity: 1; }
              100%    { opacity: 0; }
              0%      { d: path("M 65 127 Q 75 124 80 127 Q 85 130 95 127"); }
              50%     { d: path("M 65 127 Q 72 130 80 127 Q 88 124 95 127"); }
              100%    { d: path("M 65 127 Q 75 124 80 127 Q 85 130 95 127"); }
            }
            @keyframes bubblePop {
              0%     { transform: translateY(0)  scale(1);   opacity: 0.8; }
              100%   { transform: translateY(-22px) scale(0.3); opacity: 0; }
            }
            .bottle-g {
              transform-origin: 80px 96px;
              animation: bottleTilt 2.8s cubic-bezier(0.4,0,0.2,1) infinite;
            }
            .pour-stream {
              animation: streamAppear 2.8s cubic-bezier(0.4,0,0.2,1) infinite;
              fill: none;
              stroke: url(#streamGrad);
              stroke-width: 5;
              stroke-linecap: round;
            }
            .liquid-rect {
              animation: liquidFill 2.8s cubic-bezier(0.4,0,0.2,1) infinite;
            }
          `}</style>
        </defs>

        {/* ── Bottle (pivots from its base/neck) ── */}
        <g className="bottle-g">
          {/* Bottle body */}
          <rect x="68" y="30" width="24" height="56" rx="5" fill="url(#bottleGrad)" />
          {/* Bottle neck */}
          <rect x="73" y="14" width="14" height="20" rx="3" fill="url(#bottleGrad)" />
          {/* Cork / cap */}
          <rect x="74" y="10" width="12" height="7" rx="2" fill="#8b6914" />
          {/* Shine */}
          <rect x="68" y="30" width="24" height="56" rx="5" fill="url(#bottleShine)" />
          {/* Label */}
          <rect x="70" y="46" width="20" height="22" rx="3" fill="rgba(255,220,120,0.18)" stroke="rgba(255,220,120,0.35)" strokeWidth="0.8" />
          <line x1="74" y1="53" x2="86" y2="53" stroke="rgba(255,220,150,0.5)" strokeWidth="1" />
          <line x1="74" y1="57" x2="86" y2="57" stroke="rgba(255,220,150,0.5)" strokeWidth="1" />
          <line x1="74" y1="61" x2="82" y2="61" stroke="rgba(255,220,150,0.5)" strokeWidth="1" />
          {/* Liquid level inside bottle */}
          <rect x="69" y="50" width="22" height="35" rx="0"
            fill="#c4780a" opacity="0.45"
            style={{ clipPath: 'inset(0 0 0 0 round 0 0 4px 4px)' }}
          />
        </g>

        {/* ── Pour stream ── */}
        <path className="pour-stream"
          d="M 80 95 Q 79 112 79 130 Q 79 140 80 148"
        />

        {/* ── Glass ── */}
        {/* Glass body outline */}
        <polygon points="62,110 98,110 104,165 56,165"
          fill="url(#glassBodyGrad)"
          stroke="rgba(180,210,255,0.55)" strokeWidth="1.5"
        />
        {/* Liquid inside glass */}
        <rect className="liquid-rect"
          x="58" width="44" y="165" height="0"
          fill="url(#liquidGrad2)"
          clipPath="url(#glassBodyClip)"
          rx="0"
        />
        {/* Bubbles */}
        {[{x:70,delay:'0.9s'},{x:80,delay:'1.3s'},{x:76,delay:'1.6s'}].map((b,i)=>(
          <circle key={i} cx={b.cx||b.x} cy="150" r="2"
            fill="rgba(255,255,255,0.65)"
            style={{
              animation:`bubblePop 1s ${b.delay} ease-out infinite`,
              opacity: 0,
            }}
          />
        ))}
        {/* Glass top rim */}
        <ellipse cx="80" cy="110" rx="18" ry="4"
          fill="rgba(200,225,255,0.12)"
          stroke="rgba(180,210,255,0.5)" strokeWidth="1"
        />
        {/* Glass base */}
        <ellipse cx="80" cy="165" rx="24" ry="5"
          fill="rgba(180,210,255,0.12)"
          stroke="rgba(180,210,255,0.4)" strokeWidth="1"
        />
        <rect x="68" y="165" width="24" height="7" rx="3"
          fill="rgba(180,210,255,0.15)"
          stroke="rgba(180,210,255,0.35)" strokeWidth="1"
        />
        {/* Glass shine */}
        <polygon points="64,113 69,113 63,160 58,160"
          fill="rgba(255,255,255,0.12)"
        />
      </svg>

      <div style={{ color: t.textMuted, fontSize: 14, fontStyle: 'italic', letterSpacing: '0.2px' }}>
        Pouring your feed…
      </div>
    </div>
  );
}

// Keyed by the TAB ID the app passes as `mode` (App.jsx TABS / Navbar), not by
// the API path. These disagreed: the tab is 'cheers' everywhere, the key was
// 'cheered', so the lookup missed, fell through to the '/posts' default, and
// the Cheers tab quietly rendered the ordinary home feed while its header still
// said "Posts You Cheered".
const ENDPOINTS = {
  home: '/posts',
  explore: '/posts/explore',
  trips: '/posts/trips',
  cheers: '/posts/cheered',
};

const EMPTY_MESSAGES = {
  home: { icon: '🥃', text: 'No pours yet. Be the first to share!' },
  explore: { icon: '🔥', text: 'Nothing trending yet. Start pouring!' },
  trips: { icon: '✈️', text: 'No travel pours yet. Tag a location in your next post!' },
  cheers: { icon: '🥂', text: "You haven't cheered any posts yet. Go explore and raise a glass!" },
  hashtag: { icon: '#️⃣', text: 'No posts with this hashtag yet.' },
};

export default function Feed({ mode = 'home', hashtag = null, onUserClick, refresh }) {
  const { t } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [potd, setPotd] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const url = hashtag
        ? `/posts/hashtag/${encodeURIComponent(hashtag.replace('#', ''))}`
        : (ENDPOINTS[mode] || '/posts');
      const { data } = await api.get(url);
      setPosts(data);
      // Load Pour of the Day for home feed
      if (mode === 'home' && !hashtag) {
        try { const r = await api.get('/featured/potd'); setPotd(r.data); } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [mode, hashtag, refresh]);

  const handleDelete = id => setPosts(p => p.filter(post => post.id !== id));

  const emptyMsg = EMPTY_MESSAGES[hashtag ? 'hashtag' : mode] || EMPTY_MESSAGES.home;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Whisky Pour Loader */}
      <WhiskyPourLoader t={t} />
      {/* Skeleton cards */}
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton-3d" style={{
          background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, overflow: 'hidden', padding: 20,
          animationDelay: `${i * 0.18}s`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: t.border }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, borderRadius: 6, background: t.border, marginBottom: 6, width: '40%' }} />
              <div style={{ height: 10, borderRadius: 6, background: t.border, width: '25%' }} />
            </div>
          </div>
          {[100, 85, 65].map((w, j) => (
            <div key={j} style={{ height: 11, borderRadius: 6, background: t.border, marginBottom: 8, width: `${w}%` }} />
          ))}
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            {[60, 60, 50].map((w, j) => (
              <div key={j} style={{ height: 10, borderRadius: 6, background: t.border, width: w }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (!posts.length) return (
    <div style={{
      background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
      padding: 40, textAlign: 'center', color: t.textMuted, boxShadow: t.shadow,
      transition: 'background 0.3s',
    }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{emptyMsg.icon}</div>
      <div style={{ fontSize: 16 }}>{emptyMsg.text}</div>
    </div>
  );

  return (
    <div>
      {/* Pour of the Day */}
      {potd && mode === 'home' && (
        <div style={{
          background: `linear-gradient(135deg, ${t.accent}15, ${t.accent}08)`,
          border: `1.5px solid ${t.accent}44`,
          borderRadius: 16, marginBottom: 16, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🏆</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: t.accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>Pour of the Day</span>
          </div>
          <PostCard post={potd} onUserClick={onUserClick} onDelete={handleDelete} style={{ border: 'none', marginBottom: 0, boxShadow: 'none', background: 'transparent' }} />
        </div>
      )}
      {posts.map(post => (
        <PostCard key={post.id} post={post} onUserClick={onUserClick} onDelete={handleDelete} />
      ))}
    </div>
  );
}
