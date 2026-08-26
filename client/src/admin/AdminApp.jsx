import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Avatar from '../components/Avatar';

// ─── Icons (inline SVG to avoid deps) ────────────────────────────────────────
const Icon = ({ d, size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV = [
  { id: 'overview',   label: 'Dashboard',   emoji: '📊' },
  { id: 'users',      label: 'Users',        emoji: '👥' },
  { id: 'posts',      label: 'Posts',        emoji: '🗂️' },
  { id: 'reports',    label: 'Reports',      emoji: '🚩' },
  { id: 'brands',     label: 'Brand Review', emoji: '🏷️' },
  { id: 'activity',   label: 'Activity',     emoji: '⚡' },
  { id: 'marketing',  label: 'Marketing',    emoji: '📣' },
];

const MARKETING_SKILLS = [
  { id: 'social',    icon: '📲', name: 'Social Content',   desc: 'Viral posts for Instagram, LinkedIn & TikTok', prompts: ['Write 5 viral Instagram captions for DrinkedInn that will drive sign-ups from whisky enthusiasts','Write a founder story post about why we built an inn for good moments','Write a TikTok video hook script (first 3 seconds) for DrinkedInn targeting millennials who love craft beer','Generate a week-long content calendar for DrinkedInn social accounts','Write 10 tweet ideas for the @DrinkedInn account that would get high engagement'] },
  { id: 'community', icon: '🫂', name: 'Community Growth', desc: 'Engagement tactics, ambassador programs',        prompts: ['Design a DrinkedInn ambassador program for power users (whisky connoisseurs, bartenders, sommeliers)','Create 5 community challenges that would boost monthly active users on DrinkedInn','Write engagement prompts for the DrinkedInn Groups feature to reduce churn','Design a referral incentive program: what rewards would motivate drink enthusiasts to invite friends?','Create a "Community of the Month" spotlight strategy to reward active DrinkedInn groups'] },
  { id: 'copy',      icon: '✍️', name: 'Copy & Messaging', desc: 'Taglines, landing page copy, value props',       prompts: ['Write 10 headline variations for the DrinkedInn homepage. Current: "Where Professionals Actually Unwind"','Write the hero section copy for drinkedinn.com — include headline, subheadline, and CTA','Create 5 value proposition statements for DrinkedInn targeting: (1) whisky collectors, (2) craft beer lovers, (3) wine professionals','Write an "About Us" page for DrinkedInn that feels authentic, not corporate','Rewrite the sign-up CTA to maximise conversions. Current CTA: "Join the Bar 🍺"'] },
  { id: 'onboarding',icon: '🚀', name: 'User Onboarding',  desc: 'Improve activation — get users to aha moment',  prompts: ['Design the ideal 3-step onboarding flow for DrinkedInn. What actions = "aha moment"?','Write the welcome email sequence (emails 1-3) for new DrinkedInn signups','Identify the top 3 reasons new DrinkedInn users might churn in week 1 and fixes for each','Create onboarding checklist items that guide users to post their first "pour story"','Write in-app tooltip copy for DrinkedInn\'s key features: Feed, Cheers, Challenges, Groups'] },
  { id: 'launch',    icon: '🎯', name: 'Launch Strategy',  desc: 'Product Hunt, Reddit, WhatsApp campaigns',       prompts: ['Write a Product Hunt launch post for DrinkedInn — tagline, description, first comment','Create a Reddit launch strategy: which subreddits, what posts, what tone for DrinkedInn?','Write a WhatsApp/Telegram broadcast message to invite friends to beta test DrinkedInn','Design a "founding member" campaign with perks to get DrinkedInn\'s first 100 users','Create a launch week content calendar: 7 days of posts to build hype for DrinkedInn'] },
  { id: 'referrals', icon: '🎁', name: 'Referral Program', desc: 'Design a viral referral loop to grow organically',prompts: ['Design a referral program for DrinkedInn. What incentives work for drink enthusiasts?','Write the referral invite email that users would send from DrinkedInn to their friends','Create a "Cheers your squad" campaign — social sharing mechanic for DrinkedInn','Design a tiered referral system: rewards at 1, 5, 10, 25 successful invites','Write push notification copy for the referral program: "Invite a friend to DrinkedInn"'] },
  { id: 'emails',    icon: '📧', name: 'Email Marketing',  desc: 'Engagement emails, win-back sequences, digests', prompts: ['Write a weekly "What\'s Pouring" digest email template for DrinkedInn subscribers','Create a 3-email win-back sequence for inactive DrinkedInn users (not logged in 30+ days)','Write a "Your friends are active on DrinkedInn" notification email to re-engage users','Design the lifecycle email sequence: signup → 3 days → 7 days → 30 days for DrinkedInn','Write a Monthly Challenges announcement email to drive challenge participation'] },
  { id: 'analytics', icon: '📈', name: 'Analytics & Growth',desc: 'KPIs, growth metrics, A/B test ideas',           prompts: ['What are the 10 most important KPIs for DrinkedInn to track in its first 6 months?','Design an A/B test plan for DrinkedInn\'s sign-up page to improve conversion by 20%','Identify the North Star Metric for DrinkedInn and how to measure it','Create a growth model: what levers, if improved 10%, would double DrinkedInn\'s MAU?','Write a weekly growth report template for DrinkedInn admin to track platform health'] },
  { id: 'seo',       icon: '🗓️', name: 'Content & SEO',    desc: 'Blog, SEO, content pillars for authority',       prompts: ['Create a 3-month content calendar for the DrinkedInn blog — topics, formats, keywords','Identify 20 SEO keywords DrinkedInn should rank for in the "drink culture" niche','Design 5 content pillars for DrinkedInn\'s brand: what topics to own consistently?','Write a guest post pitch for whisky/beer/wine publications to promote DrinkedInn','Create a "State of Drink Culture" annual report concept to generate PR for DrinkedInn'] },
];

// ─── Colour palette (dark admin theme) ───────────────────────────────────────
const C = {
  bg:        '#0f1117',
  sidebar:   '#13161e',
  card:      '#1a1d27',
  cardHover: '#1f2233',
  border:    '#2a2d3e',
  accent:    '#0a66c2',
  accentHi:  '#1d8fe8',
  accentSoft:'rgba(10,102,194,0.12)',
  text:      '#f0f2f8',
  textMuted: '#8b8fa8',
  textFaint: '#555870',
  green:     '#22c55e',
  red:       '#ef4444',
  amber:     '#f59e0b',
  purple:    '#8b5cf6',
  pink:      '#ec4899',
  teal:      '#14b8a6',
};

// ─── Reusable card shell ──────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, ...style }}>
    {children}
  </div>
);

// ─── Stat tile ────────────────────────────────────────────────────────────────
const StatTile = ({ icon, label, value, sub, color = C.accent }) => (
  <Card style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 52, height: 52, borderRadius: 14, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value?.toLocaleString() ?? '–'}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 3 }}>{sub}</div>}
    </div>
  </Card>
);

// ─── Badge ────────────────────────────────────────────────────────────────────
const Badge = ({ label, color, bg }) => (
  <span style={{ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{label}</span>
);

// ─── Main AdminApp ────────────────────────────────────────────────────────────
export default function AdminApp() {
  const { user, logout, loading } = useAuth();
  const [page, setPage]           = useState('overview');
  const [sideOpen, setSideOpen]   = useState(true);

  // Data states
  const [stats, setStats]         = useState(null);
  const [users, setUsers]         = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage]   = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [posts, setPosts]         = useState([]);
  const [postTotal, setPostTotal] = useState(0);
  const [postPage, setPostPage]   = useState(1);
  const [activity, setActivity]   = useState([]);
  const [busy, setBusy]           = useState(false);
  const [reports, setReports]     = useState([]);
  const [brandQueue, setBrandQueue] = useState({ brands: [], creatives: [] });

  // Marketing
  const [activeSkill, setActiveSkill]   = useState(null);
  const [activePrompt, setActivePrompt] = useState('');
  const [aiResponse, setAiResponse]     = useState('');
  const [aiLoading, setAiLoading]       = useState(false);

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  useEffect(() => { if (page === 'overview') fetchStats(); }, [page]);
  useEffect(() => { if (page === 'activity') fetchActivity(); }, [page]);
  useEffect(() => { if (page === 'reports') fetchReports(); }, [page]);
  useEffect(() => { if (page === 'brands') fetchBrandQueue(); }, [page]);
  useEffect(() => { if (page === 'users') fetchUsers(); }, [page, userPage, userSearch]);
  useEffect(() => { if (page === 'posts') fetchPosts(); }, [page, postPage]);

  const fetchStats    = async () => { try { const r = await api.get('/admin/stats'); setStats(r.data); } catch {} };
  const fetchActivity = async () => { try { const r = await api.get('/admin/activity'); setActivity(r.data); } catch {} };
  const fetchReports  = async () => { try { const r = await api.get('/reports'); setReports(r.data); } catch {} };
  const fetchBrandQueue = async () => {
    try {
      const r = await api.get('/brands/admin/queue');
      setBrandQueue({ brands: r.data.brands || [], creatives: r.data.creatives || [] });
    } catch { setBrandQueue({ brands: [], creatives: [] }); }
  };
  const reviewBrand = async (id, status, verified) => {
    setBusy(true);
    try { await api.put(`/brands/admin/brands/${id}`, { status, verified }); await fetchBrandQueue(); }
    catch (e) { alert(e.response?.data?.error || 'Could not update brand.'); }
    setBusy(false);
  };
  const reviewCreative = async (id, decision) => {
    const note = decision === 'rejected'
      ? window.prompt('Why is this creative rejected? The brand will see this.')
      : null;
    if (decision === 'rejected' && note === null) return;
    setBusy(true);
    try { await api.put(`/brands/admin/creatives/${id}`, { decision, note }); await fetchBrandQueue(); }
    catch (e) { alert(e.response?.data?.error || 'Could not record decision.'); }
    setBusy(false);
  };
  const resolveReport = async (id, status) => { await api.put(`/reports/${id}`, { status }); fetchReports(); };
  const fetchUsers    = async () => { try { const r = await api.get(`/admin/users?page=${userPage}&search=${userSearch}`); setUsers(r.data.users); setUserTotal(r.data.total); } catch {} };
  const fetchPosts    = async () => { try { const r = await api.get(`/admin/posts?page=${postPage}`); setPosts(r.data.posts); setPostTotal(r.data.total); } catch {} };

  const deleteUser = async (id, name) => {
    if (!confirm(`Delete "${name}" and all their content? This cannot be undone.`)) return;
    setBusy(true);
    await api.delete(`/admin/users/${id}`);
    fetchUsers(); fetchStats();
    setBusy(false);
  };
  const toggleVerify = async (id, current) => {
    await api.put(`/admin/users/${id}/verify`, { verified: current ? 0 : 1 });
    fetchUsers();
  };
  const togglePremium = async (id, current) => {
    await api.put(`/admin/users/${id}/premium`, { premium: current ? 0 : 1 });
    fetchUsers();
  };
  const setBadge = async (id, badge) => {
    await api.put(`/admin/users/${id}/badge`, { badge });
    fetchUsers();
  };
  const deletePost = async (id) => {
    if (!confirm('Delete this post?')) return;
    await api.delete(`/admin/posts/${id}`);
    fetchPosts(); fetchStats();
  };
  const runMarketingSkill = async (prompt) => {
    setAiLoading(true); setAiResponse('');
    try {
      const r = await api.post('/agents/task', { agentKey: 'CMO', task: prompt });
      setAiResponse(r.data.response || r.data.result || JSON.stringify(r.data, null, 2));
    } catch {
      setAiResponse(`⚠️ Agent unavailable.\n\nPrompt: "${prompt}"\n\nConfigure an LLM provider (OpenAI/Anthropic) to get real AI responses.`);
    }
    setAiLoading(false);
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: C.textMuted, fontSize: 16 }}>Loading…</div>
    </div>
  );

  if (!user) return <AdminLogin />;

  if (!user.is_admin) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🚫</div>
      <div style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>Access Denied</div>
      <div style={{ color: C.textMuted, fontSize: 14 }}>This area is restricted to admins only.</div>
      <button onClick={() => window.location.href = '/'} style={btnStyle}>← Back to DrinkedInn</button>
    </div>
  );

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', fontFamily: "'Inter', 'SF Pro Display', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sideOpen ? 240 : 64, flexShrink: 0, background: C.sidebar,
        borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s ease', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, minHeight: 64 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#fff',
          }}>DI</div>
          {sideOpen && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.text, letterSpacing: -0.3 }}>DrinkedInn</div>
              <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Admin Panel</div>
            </div>
          )}
          <button onClick={() => setSideOpen(o => !o)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 16, flexShrink: 0, padding: 4 }}>
            {sideOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {NAV.map(item => {
            const active = page === item.id;
            return (
              <button key={item.id} onClick={() => setPage(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: sideOpen ? '10px 12px' : '10px', marginBottom: 4,
                background: active ? C.accentSoft : 'none',
                border: `1px solid ${active ? C.accent + '44' : 'transparent'}`,
                borderRadius: 10, cursor: 'pointer', color: active ? C.accentHi : C.textMuted,
                fontWeight: active ? 700 : 500, fontSize: 13, textAlign: 'left',
                transition: 'all 0.15s', whiteSpace: 'nowrap', justifyContent: sideOpen ? 'flex-start' : 'center',
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.cardHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
                {sideOpen && item.label}
                {item.id === 'reports' && reports.filter(r => r.status === 'pending').length > 0 && (
                  <span style={{ marginLeft: 'auto', background: C.red, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800, minWidth: 18, textAlign: 'center' }}>
                    {reports.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '12px 8px', borderTop: `1px solid ${C.border}` }}>
          {sideOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
              <Avatar src={user.avatar} name={user.name} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>🛡️ Admin</div>
              </div>
              <button onClick={logout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 16, padding: 4 }}>⏏</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Avatar src={user.avatar} name={user.name} size={32} />
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          height: 64, borderBottom: `1px solid ${C.border}`, background: C.sidebar,
          display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, flexShrink: 0,
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text }}>
              {NAV.find(n => n.id === page)?.emoji} {NAV.find(n => n.id === page)?.label}
            </h1>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" style={{ color: C.textMuted, fontSize: 12, textDecoration: 'none', padding: '6px 14px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = C.text}
              onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
            >← Back to App</a>
            <div style={{ fontSize: 11, color: C.textMuted, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>

          {/* ── OVERVIEW ── */}
          {page === 'overview' && stats && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatTile icon="👥" label="Total Users"    value={stats.users}       sub={`+${stats.usersToday} today`}  color={C.purple} />
                <StatTile icon="📝" label="Total Posts"    value={stats.posts}       sub={`+${stats.postsToday} today`}  color={C.amber} />
                <StatTile icon="🥂" label="Total Cheers"   value={stats.cheers}                                          color={C.green} />
                <StatTile icon="💬" label="Messages Sent"  value={stats.messages}                                        color={C.accent} />
                <StatTile icon="🔗" label="Connections"    value={stats.connections}                                     color={C.pink} />
                <StatTile icon="💭" label="Comments"       value={stats.comments}                                        color={C.purple} />
                <StatTile icon="🍶" label="Groups"         value={stats.groups}                                          color={C.teal} />
                <StatTile icon="⚡" label="Challenges"     value={stats.challenges}                                      color={C.red} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Top Posters */}
                <Card style={{ padding: '20px 24px' }}>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 16 }}>🏆 Top Posters</div>
                  {(stats.topPosters || []).map((u, i) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < stats.topPosters.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.textFaint, width: 22 }}>#{i + 1}</span>
                      <Avatar src={u.avatar} name={u.name} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.title}</div>
                      </div>
                      <span style={{ fontWeight: 700, color: C.amber, fontSize: 13 }}>{u.post_count}</span>
                    </div>
                  ))}
                </Card>

                {/* Recent signups */}
                <Card style={{ padding: '20px 24px' }}>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 16 }}>🆕 Recent Sign-ups</div>
                  {(stats.recentSignups || []).map((u, i) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < stats.recentSignups.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <Avatar src={u.avatar} name={u.name} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                      </div>
                      <Badge
                        label={u.onboarded ? '✓ Active' : '⏳ Pending'}
                        color={u.onboarded ? C.green : C.textMuted}
                        bg={u.onboarded ? C.green + '22' : C.border}
                      />
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {page === 'users' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                <input
                  placeholder="🔍  Search by name, email or title…"
                  value={userSearch}
                  onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                  style={{ flex: 1, maxWidth: 380, background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', color: C.text, fontSize: 14, outline: 'none' }}
                />
                <div style={{ fontSize: 13, color: C.textMuted, marginLeft: 'auto' }}>{userTotal.toLocaleString()} users</div>
              </div>

              <Card>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['User', 'Email', 'Posts', 'Joined', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}` }}
                          onMouseEnter={e => e.currentTarget.style.background = C.cardHover}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar src={u.avatar} name={u.name} size={34} />
                              <div>
                                <div style={{ fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {u.name}
                                  {u.verified ? <span title="Verified" style={{ color: C.accentHi, fontSize: 14 }}>✓</span> : null}
                                  {u.premium ? <span title="Premium" style={{ fontSize: 12 }}>⭐</span> : null}
                                  {u.badge ? <span title="Badge" style={{ fontSize: 12 }}>{u.badge}</span> : null}
                                </div>
                                <div style={{ color: C.textFaint, fontSize: 11 }}>{u.title?.slice(0, 35)}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: C.textMuted, fontSize: 12 }}>{u.email}</td>
                          <td style={{ padding: '12px 16px', color: C.text, fontWeight: 700 }}>{u.post_count}</td>
                          <td style={{ padding: '12px 16px', color: C.textFaint, fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <Badge
                                label={u.onboarded ? 'Active' : 'Pending'}
                                color={u.onboarded ? C.green : C.textMuted}
                                bg={u.onboarded ? C.green + '22' : C.border}
                              />
                              {u.verified ? <Badge label="Verified" color={C.accentHi} bg={C.accent + '22'} /> : null}
                              {u.premium ? <Badge label="Premium" color={C.amber} bg={C.amber + '22'} /> : null}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <button onClick={() => toggleVerify(u.id, u.verified)} title={u.verified ? 'Unverify' : 'Verify'}
                                style={{ background: u.verified ? C.accentHi + '22' : C.card, border: `1px solid ${u.verified ? C.accentHi + '44' : C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: u.verified ? C.accentHi : C.textMuted }}>
                                {u.verified ? '✓ Verified' : '☐ Verify'}
                              </button>
                              <button onClick={() => togglePremium(u.id, u.premium)} title={u.premium ? 'Remove Premium' : 'Give Premium'}
                                style={{ background: u.premium ? C.amber + '22' : C.card, border: `1px solid ${u.premium ? C.amber + '44' : C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: u.premium ? C.amber : C.textMuted }}>
                                {u.premium ? '⭐ Premium' : '☆ Premium'}
                              </button>
                              {u.id !== 1 && (
                                <button onClick={() => deleteUser(u.id, u.name)} disabled={busy}
                                  style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                  🗑
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '16px' }}>
                    <button onClick={() => setUserPage(p => p - 1)} disabled={userPage <= 1} style={pagerBtn(userPage <= 1)}>← Prev</button>
                    <span style={{ color: C.textMuted, fontSize: 13 }}>Page {userPage} of {Math.ceil(userTotal / 30) || 1}</span>
                    <button onClick={() => setUserPage(p => p + 1)} disabled={userPage * 30 >= userTotal} style={pagerBtn(userPage * 30 >= userTotal)}>Next →</button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── POSTS ── */}
          {page === 'posts' && (
            <div>
              <div style={{ marginBottom: 16, color: C.textMuted, fontSize: 13 }}>{postTotal.toLocaleString()} posts total</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {posts.map(p => (
                  <Card key={p.id} style={{ padding: 18, display: 'flex', gap: 14 }}>
                    <Avatar src={p.avatar} name={p.name} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{p.name}</span>
                        {p.drink && <Badge label={p.drink} color={C.amber} bg={C.amber + '22'} />}
                        <span style={{ color: C.textFaint, fontSize: 12 }}>{new Date(p.created_at).toLocaleString()}</span>
                        <span style={{ color: C.textMuted, fontSize: 12 }}>🥂 {p.cheer_count} &nbsp;💬 {p.comment_count}</span>
                      </div>
                      <p style={{ margin: 0, color: C.textMuted, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {p.content?.slice(0, 280)}{p.content?.length > 280 ? '…' : ''}
                      </p>
                    </div>
                    <button onClick={() => deletePost(p.id)}
                      style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0, alignSelf: 'flex-start' }}>
                      Delete
                    </button>
                  </Card>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 }}>
                <button onClick={() => setPostPage(p => p - 1)} disabled={postPage <= 1} style={pagerBtn(postPage <= 1)}>← Prev</button>
                <span style={{ color: C.textMuted, fontSize: 13 }}>Page {postPage} of {Math.ceil(postTotal / 30) || 1}</span>
                <button onClick={() => setPostPage(p => p + 1)} disabled={postPage * 30 >= postTotal} style={pagerBtn(postPage * 30 >= postTotal)}>Next →</button>
              </div>
            </div>
          )}

          {/* ── REPORTS ── */}
          {page === 'reports' && (
            <div>
              {reports.length === 0 ? (
                <Card style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Reports</div>
                  <div style={{ color: C.textMuted, fontSize: 13 }}>All clear — no flagged content right now.</div>
                </Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reports.map(r => (
                    <Card key={r.id} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: r.status === 'pending' ? C.amber + '22' : r.status === 'resolved' ? C.green + '22' : C.red + '22',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                      }}>
                        {r.status === 'pending' ? '⚠️' : r.status === 'resolved' ? '✅' : '🗑️'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
                            {r.reporter_name || 'User #' + r.reporter_id}
                          </span>
                          <span style={{ color: C.textFaint, fontSize: 12 }}>reported</span>
                          <Badge
                            label={r.reason || 'Flagged'}
                            color={C.amber}
                            bg={C.amber + '22'}
                          />
                          <Badge
                            label={r.status}
                            color={r.status === 'pending' ? C.amber : r.status === 'resolved' ? C.green : C.red}
                            bg={(r.status === 'pending' ? C.amber : r.status === 'resolved' ? C.green : C.red) + '22'}
                          />
                        </div>
                        {r.post_content && (
                          <p style={{ margin: '0 0 6px', color: C.textMuted, fontSize: 13, lineHeight: 1.5, background: C.bg, borderRadius: 8, padding: '10px 12px', border: `1px solid ${C.border}` }}>
                            "{r.post_content?.slice(0, 200)}{r.post_content?.length > 200 ? '…' : ''}"
                          </p>
                        )}
                        <div style={{ fontSize: 11, color: C.textFaint }}>
                          Post #{r.post_id} · {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                        </div>
                      </div>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => resolveReport(r.id, 'resolved')}
                            style={{ background: C.green + '22', color: C.green, border: `1px solid ${C.green}44`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            ✓ Dismiss
                          </button>
                          <button onClick={() => { resolveReport(r.id, 'removed'); deletePost(r.post_id); }}
                            style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            🗑 Remove Post
                          </button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── BRAND REVIEW ── */}
          {page === 'brands' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

              <Card style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start', background: C.amber + '11', borderColor: C.amber + '44' }}>
                <span style={{ fontSize: 18 }}>⚖️</span>
                <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
                  Nothing here serves until you approve it. Check the brand is a real licensed entity,
                  and that creative doesn't encourage excessive drinking, appeal to under-age audiences,
                  or link alcohol to social or professional success. Rejections are shown to the advertiser.
                </div>
              </Card>

              {/* Brand verification */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>
                  Brand applications
                  {brandQueue.brands.length > 0 && (
                    <span style={{ marginLeft: 8 }}><Badge label={brandQueue.brands.length} color={C.amber} bg={C.amber + '22'} /></span>
                  )}
                </div>
                {brandQueue.brands.length === 0 ? (
                  <Card style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                    No brands waiting for verification.
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {brandQueue.brands.map(b => (
                      <Card key={b.id} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: C.text, fontSize: 15, marginBottom: 4 }}>{b.name}</div>
                          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.7 }}>
                            <div><strong style={{ color: C.text }}>Legal entity:</strong> {b.legal_entity || '—'}</div>
                            <div><strong style={{ color: C.text }}>Contact:</strong> {b.contact_email || '—'}</div>
                            {b.website && (
                              <div><strong style={{ color: C.text }}>Site:</strong>{' '}
                                <a href={b.website} target="_blank" rel="noopener noreferrer" style={{ color: C.accentHi }}>{b.website}</a>
                              </div>
                            )}
                            <div style={{ color: C.textFaint, marginTop: 4 }}>
                              Applied {b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                          <button disabled={busy} onClick={() => reviewBrand(b.id, 'active', true)}
                            style={{ background: C.green + '22', color: C.green, border: `1px solid ${C.green}44`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            ✓ Verify
                          </button>
                          <button disabled={busy} onClick={() => reviewBrand(b.id, 'rejected', false)}
                            style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            ✕ Reject
                          </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Creative review */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>
                  Creative awaiting review
                  {brandQueue.creatives.length > 0 && (
                    <span style={{ marginLeft: 8 }}><Badge label={brandQueue.creatives.length} color={C.amber} bg={C.amber + '22'} /></span>
                  )}
                </div>
                {brandQueue.creatives.length === 0 ? (
                  <Card style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                    No creative in the queue.
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {brandQueue.creatives.map(c => (
                      <Card key={c.id} style={{ padding: 18 }}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                          {c.image_url && (
                            <img src={c.image_url} alt="" style={{ width: 110, height: 82, objectFit: 'cover', borderRadius: 10, flexShrink: 0, border: `1px solid ${C.border}` }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{c.brand_name}</span>
                              <span style={{ color: C.textFaint, fontSize: 12 }}>· {c.campaign_name}</span>
                              {c.factual_only === 1 && <Badge label="Factual only" color={C.accentHi} bg={C.accentHi + '22'} />}
                            </div>
                            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                              <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>{c.headline}</div>
                              {c.body && <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.55 }}>{c.body}</div>}
                              {c.cta_url && (
                                <div style={{ marginTop: 8, fontSize: 12, color: C.accentHi }}>
                                  {c.cta_label} → {c.cta_url}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                            <button disabled={busy} onClick={() => reviewCreative(c.id, 'approved')}
                              style={{ background: C.green + '22', color: C.green, border: `1px solid ${C.green}44`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                              ✓ Approve
                            </button>
                            <button disabled={busy} onClick={() => reviewCreative(c.id, 'rejected')}
                              style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                              ✕ Reject
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ACTIVITY ── */}
          {page === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activity.map((a, i) => (
                <Card key={i} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Avatar src={a.avatar} name={a.name || 'User'} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{a.name} </span>
                    <span style={{ color: C.textMuted, fontSize: 13 }}>
                      {a.type === 'signup' ? 'joined DrinkedInn' : 'posted: '}
                    </span>
                    {a.type === 'post' && <span style={{ color: C.textFaint, fontSize: 13 }}>{a.detail?.slice(0, 70)}{a.detail?.length > 70 ? '…' : ''}</span>}
                  </div>
                  <Badge
                    label={a.type === 'signup' ? '🆕 Signup' : '📝 Post'}
                    color={a.type === 'signup' ? C.green : C.accentHi}
                    bg={a.type === 'signup' ? C.green + '22' : C.accent + '22'}
                  />
                  <span style={{ color: C.textFaint, fontSize: 11, flexShrink: 0 }}>
                    {new Date(a.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Card>
              ))}
            </div>
          )}

          {/* ── MARKETING ── */}
          {page === 'marketing' && (
            <div>
              <p style={{ margin: '0 0 20px', color: C.textMuted, fontSize: 13 }}>
                9 marketing skills adapted for DrinkedInn. Select a skill, pick a prompt, and send it to the CMO Agent.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
                {MARKETING_SKILLS.map(skill => (
                  <Card key={skill.id}
                    onClick={() => { setActiveSkill(activeSkill?.id === skill.id ? null : skill); setActivePrompt(''); setAiResponse(''); }}
                    style={{
                      padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s',
                      border: `1.5px solid ${activeSkill?.id === skill.id ? C.accent : C.border}`,
                      background: activeSkill?.id === skill.id ? C.accentSoft : C.card,
                      boxShadow: activeSkill?.id === skill.id ? `0 0 0 3px ${C.accent}33` : 'none',
                    }}
                    onMouseEnter={e => { if (activeSkill?.id !== skill.id) e.currentTarget.style.background = C.cardHover; }}
                    onMouseLeave={e => { if (activeSkill?.id !== skill.id) e.currentTarget.style.background = C.card; }}
                  >
                    <div style={{ fontSize: 26, marginBottom: 8 }}>{skill.icon}</div>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>{skill.name}</div>
                    <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>{skill.desc}</div>
                  </Card>
                ))}
              </div>

              {activeSkill && (
                <Card style={{ padding: 24, marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 15, marginBottom: 16 }}>
                    {activeSkill.icon} {activeSkill.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {activeSkill.prompts.map((p, i) => (
                      <button key={i} onClick={() => { setActivePrompt(p); setAiResponse(''); }}
                        style={{
                          textAlign: 'left', background: activePrompt === p ? C.accentSoft : C.cardHover,
                          border: `1px solid ${activePrompt === p ? C.accent : C.border}`,
                          borderRadius: 10, padding: '10px 14px', cursor: 'pointer', color: activePrompt === p ? C.text : C.textMuted,
                          fontSize: 13, lineHeight: 1.4, transition: 'all 0.15s',
                        }}>
                        {p}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={activePrompt}
                    onChange={e => setActivePrompt(e.target.value)}
                    placeholder="Or type a custom marketing prompt…"
                    rows={3}
                    style={{ width: '100%', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', color: C.text, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }}
                  />

                  <button onClick={() => activePrompt.trim() && runMarketingSkill(activePrompt)}
                    disabled={aiLoading || !activePrompt.trim()}
                    style={{ background: aiLoading || !activePrompt.trim() ? C.border : 'linear-gradient(135deg, #0a66c2, #1d8fe8)', border: 'none', borderRadius: 10, padding: '11px 26px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: aiLoading || !activePrompt.trim() ? 'not-allowed' : 'pointer', boxShadow: aiLoading ? 'none' : '0 4px 16px rgba(10,102,194,0.35)' }}>
                    {aiLoading ? '⏳ CMO Agent thinking…' : '🤖 Ask CMO Agent →'}
                  </button>
                </Card>
              )}

              {(aiLoading || aiResponse) && (
                <Card style={{ padding: 24 }}>
                  <div style={{ fontWeight: 700, color: C.accentHi, fontSize: 14, marginBottom: 14 }}>📣 CMO Agent Response</div>
                  {aiLoading ? (
                    <div style={{ color: C.textMuted }}>⏳ Thinking…</div>
                  ) : (
                    <pre style={{ margin: 0, color: C.text, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{aiResponse}</pre>
                  )}
                </Card>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── Admin login screen ───────────────────────────────────────────────────────
function AdminLogin() {
  const { login } = useAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const r = await api.post('/auth/login', { email, password });
      if (!r.data.user?.is_admin) { setErr('This account does not have admin access.'); setLoading(false); return; }
      login(r.data.token, r.data.user);
    } catch (e) {
      setErr(e.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 14, boxShadow: '0 8px 32px rgba(10,102,194,0.4)' }}>DI</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>DrinkedInn Admin</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Sign in to the admin panel</div>
        </div>

        <Card style={{ padding: 28 }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="admin@drinkedinn.com"
                style={{ width: '100%', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{ width: '100%', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>
            {err && <div style={{ background: C.red + '22', border: `1px solid ${C.red}44`, borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13 }}>{err}</div>}
            <button type="submit" disabled={loading}
              style={{ background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)', border: 'none', borderRadius: 10, padding: '13px', color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, boxShadow: '0 4px 16px rgba(10,102,194,0.35)' }}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/" style={{ color: C.textMuted, fontSize: 13, textDecoration: 'none' }}>← Back to DrinkedInn</a>
        </div>
      </div>
    </div>
  );
}

// ─── Small style helpers ──────────────────────────────────────────────────────
const btnStyle = {
  background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)',
  border: 'none', borderRadius: 10, padding: '11px 24px',
  color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
};

const pagerBtn = (disabled) => ({
  background: disabled ? C.border : C.card,
  border: `1px solid ${disabled ? C.border : C.border}`,
  borderRadius: 8, padding: '7px 18px', cursor: disabled ? 'not-allowed' : 'pointer',
  color: disabled ? C.textFaint : C.text, fontSize: 13, fontWeight: 600,
  opacity: disabled ? 0.5 : 1,
});
