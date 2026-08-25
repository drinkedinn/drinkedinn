import Avatar from "./Avatar";
import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

const TABS = [
  { id: 'overview',   icon: '📊', label: 'Overview' },
  { id: 'users',      icon: '👥', label: 'Users' },
  { id: 'posts',      icon: '🗂️',  label: 'Posts' },
  { id: 'activity',  icon: '⚡', label: 'Activity' },
  { id: 'marketing',  icon: '📣', label: 'Marketing' },
];

// Marketing skills from coreyhaines31/marketingskills — adapted for DrinkedInn
const MARKETING_SKILLS = [
  {
    id: 'social',
    icon: '📲',
    name: 'Social Content',
    desc: 'Create viral posts for Instagram, LinkedIn & TikTok to grow DrinkedInn',
    prompts: [
      'Write 5 viral Instagram captions for DrinkedInn that will drive sign-ups from whisky enthusiasts',
      'Write a founder story post about why we built an inn for good moments',
      'Write a TikTok video hook script (first 3 seconds) for DrinkedInn targeting millennials who love craft beer',
      'Generate a week-long content calendar for DrinkedInn social accounts',
      'Write 10 tweet ideas for the @DrinkedInn account that would get high engagement',
    ],
  },
  {
    id: 'community',
    icon: '🫂',
    name: 'Community Growth',
    desc: 'Build a loyal drink community — engagement tactics, ambassador programs',
    prompts: [
      'Design a DrinkedInn ambassador program for power users (whisky connoisseurs, bartenders, sommeliers)',
      'Create 5 community challenges that would boost monthly active users on DrinkedInn',
      'Write engagement prompts for the DrinkedInn Groups feature to reduce churn',
      'Design a referral incentive program: what rewards would motivate drink enthusiasts to invite friends?',
      'Create a "Community of the Month" spotlight strategy to reward active DrinkedInn groups',
    ],
  },
  {
    id: 'copywriting',
    icon: '✍️',
    name: 'Copy & Messaging',
    desc: 'Taglines, landing page copy, value propositions for DrinkedInn',
    prompts: [
      'Write 10 headline variations for the DrinkedInn homepage. Current: "Every good story starts at the inn"',
      'Write the hero section copy for drinkedinn.com — include headline, subheadline, and CTA',
      'Create 5 value proposition statements for DrinkedInn targeting: (1) whisky collectors, (2) craft beer lovers, (3) wine professionals',
      'Write an "About Us" page for DrinkedInn that feels authentic, not corporate',
      'Rewrite the sign-up CTA to maximise conversions. Current CTA: "Join the Bar 🍺"',
    ],
  },
  {
    id: 'onboarding',
    icon: '🚀',
    name: 'User Onboarding',
    desc: 'Improve activation rate — get new users to their "aha moment" faster',
    prompts: [
      'Design the ideal 3-step onboarding flow for DrinkedInn. What actions = "aha moment"?',
      'Write the welcome email sequence (emails 1-3) for new DrinkedInn signups',
      'Identify the top 3 reasons new DrinkedInn users might churn in week 1 and fixes for each',
      'Create onboarding checklist items that guide users to post their first "pour story"',
      'Write in-app tooltip copy for DrinkedInn\'s key features: Feed, Cheers, Challenges, Groups',
    ],
  },
  {
    id: 'launch',
    icon: '🎯',
    name: 'Launch Strategy',
    desc: 'Product Hunt, Reddit, WhatsApp campaigns to get first 1000 users',
    prompts: [
      'Write a Product Hunt launch post for DrinkedInn — tagline, description, first comment',
      'Create a Reddit launch strategy: which subreddits, what posts, what tone for DrinkedInn?',
      'Write a WhatsApp/Telegram broadcast message to invite friends to beta test DrinkedInn',
      'Design a "founding member" campaign with perks to get DrinkedInn\'s first 100 users',
      'Create a launch week content calendar: 7 days of posts to build hype for DrinkedInn',
    ],
  },
  {
    id: 'referrals',
    icon: '🎁',
    name: 'Referral Program',
    desc: 'Design a viral referral loop to grow DrinkedInn organically',
    prompts: [
      'Design a referral program for DrinkedInn. What incentives work for drink enthusiasts?',
      'Write the referral invite email that users would send from DrinkedInn to their friends',
      'Create a "Cheers your squad" campaign — social sharing mechanic for DrinkedInn',
      'Design a tiered referral system: rewards at 1, 5, 10, 25 successful invites',
      'Write push notification copy for the referral program: "Invite a friend to DrinkedInn"',
    ],
  },
  {
    id: 'emails',
    icon: '📧',
    name: 'Email Marketing',
    desc: 'Engagement emails, win-back sequences, weekly digests',
    prompts: [
      'Write a weekly "What\'s Pouring" digest email template for DrinkedInn subscribers',
      'Create a 3-email win-back sequence for inactive DrinkedInn users (not logged in 30+ days)',
      'Write a "Your friends are active on DrinkedInn" notification email to re-engage users',
      'Design the lifecycle email sequence: signup → 3 days → 7 days → 30 days for DrinkedInn',
      'Write a Monthly Challenges announcement email to drive challenge participation',
    ],
  },
  {
    id: 'analytics',
    icon: '📈',
    name: 'Analytics & Growth',
    desc: 'KPIs, growth metrics, A/B test ideas for DrinkedInn',
    prompts: [
      'What are the 10 most important KPIs for DrinkedInn to track in its first 6 months?',
      'Design an A/B test plan for DrinkedInn\'s sign-up page to improve conversion by 20%',
      'Identify the North Star Metric for DrinkedInn and how to measure it',
      'Create a growth model: what levers, if improved 10%, would double DrinkedInn\'s MAU?',
      'Write a weekly growth report template for DrinkedInn admin to track platform health',
    ],
  },
  {
    id: 'content-strategy',
    icon: '🗓️',
    name: 'Content Strategy',
    desc: 'Blog, SEO, content pillars to establish DrinkedInn as drink culture authority',
    prompts: [
      'Create a 3-month content calendar for the DrinkedInn blog — topics, formats, keywords',
      'Identify 20 SEO keywords DrinkedInn should rank for in the "drink culture" niche',
      'Design 5 content pillars for DrinkedInn\'s brand: what topics to own consistently?',
      'Write a guest post pitch for whisky/beer/wine publications to promote DrinkedInn',
      'Create a "State of Drink Culture" annual report concept to generate PR for DrinkedInn',
    ],
  },
];

export default function AdminPage() {
  const { t } = useTheme();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [postPage, setPostPage] = useState(1);
  const [postTotal, setPostTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeSkill, setActiveSkill] = useState(null);
  const [activePrompt, setActivePrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (tab === 'overview') fetchStats();
    if (tab === 'activity') fetchActivity();
  }, [tab]);

  useEffect(() => {
    if (tab === 'users') fetchUsers();
  }, [tab, userPage, userSearch]);

  useEffect(() => {
    if (tab === 'posts') fetchPosts();
  }, [tab, postPage]);

  const fetchStats    = async () => { try { const r = await api.get('/admin/stats'); setStats(r.data); } catch(e) {} };
  const fetchUsers    = async () => { try { const r = await api.get(`/admin/users?page=${userPage}&search=${userSearch}`); setUsers(r.data.users); setUserTotal(r.data.total); } catch(e) {} };
  const fetchPosts    = async () => { try { const r = await api.get(`/admin/posts?page=${postPage}`); setPosts(r.data.posts); setPostTotal(r.data.total); } catch(e) {} };
  const fetchActivity = async () => { try { const r = await api.get('/admin/activity'); setActivity(r.data); } catch(e) {} };

  const deleteUser = async (id, name) => {
    if (!confirm(`Delete user "${name}" and all their content? This cannot be undone.`)) return;
    setLoading(true);
    await api.delete(`/admin/users/${id}`);
    fetchUsers(); fetchStats();
    setLoading(false);
  };

  const deletePost = async (id) => {
    if (!confirm('Delete this post?')) return;
    await api.delete(`/admin/posts/${id}`);
    fetchPosts(); fetchStats();
  };

  // Simulate AI marketing response (uses existing agent system)
  const runMarketingSkill = async (prompt) => {
    setAiLoading(true);
    setAiResponse('');
    try {
      const r = await api.post('/agents/task', { agentKey: 'CMO', task: prompt });
      setAiResponse(r.data.response || r.data.result || JSON.stringify(r.data, null, 2));
    } catch(e) {
      setAiResponse(`⚠️ Agent unavailable in simulation mode.\n\n**Prompt sent to CMO Agent:**\n\n"${prompt}"\n\nTo get real AI responses, configure an LLM provider (OpenAI/Anthropic) in the Agents dashboard.`);
    }
    setAiLoading(false);
  };

  const card = (children, extra = {}) => (
    <div style={{ background: t.card, borderRadius: 16, padding: 20, border: `1px solid ${t.border}`, boxShadow: t.shadow, ...extra }}>
      {children}
    </div>
  );

  const statBox = (icon, label, value, sub, color = t.accent) => (
    <div style={{ background: t.card, borderRadius: 16, padding: '20px 24px', border: `1px solid ${t.border}`, boxShadow: t.shadow, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: t.text }}>{value?.toLocaleString() ?? '–'}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: color, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, margin: 0 }}>🛡️ Admin Dashboard</h1>
        <p style={{ color: t.textMuted, margin: '4px 0 0', fontSize: 14 }}>DrinkedInn platform management — admin eyes only</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: t.cardAlt, borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            background: tab === tb.id ? t.card : 'none',
            border: 'none', borderRadius: 10, padding: '8px 18px', cursor: 'pointer',
            color: tab === tb.id ? t.accent : t.textMuted,
            fontWeight: tab === tb.id ? 700 : 500, fontSize: 13,
            boxShadow: tab === tb.id ? t.shadow : 'none',
            transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && stats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {statBox('👥', 'Total Users',    stats.users,       `+${stats.usersToday} today`,       '#6366f1')}
            {statBox('📝', 'Total Posts',    stats.posts,       `+${stats.postsToday} today`,        '#f5a623')}
            {statBox('🥂', 'Total Cheers',   stats.cheers,      null,                                '#22c55e')}
            {statBox('💬', 'Messages Sent',  stats.messages,    null,                                '#3b82f6')}
            {statBox('🔗', 'Connections',    stats.connections, null,                                '#ec4899')}
            {statBox('💭', 'Comments',       stats.comments,    null,                                '#8b5cf6')}
            {statBox('🍶', 'Groups',         stats.groups,      null,                                '#14b8a6')}
            {statBox('⚡', 'Challenges',     stats.challenges,  null,                                '#ef4444')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {card(
              <>
                <h3 style={{ margin: '0 0 16px', color: t.text, fontSize: 15 }}>🏆 Top Posters</h3>
                {(stats.topPosters || []).map((u, i) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < stats.topPosters.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: t.textMuted, width: 20 }}>#{i + 1}</span>
                    <Avatar src={u.avatar} name={u.name} size={36} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: t.textMuted }}>{u.title}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, color: t.accent, fontSize: 13 }}>{u.post_count} posts</span>
                  </div>
                ))}
              </>
            )}

            {card(
              <>
                <h3 style={{ margin: '0 0 16px', color: t.text, fontSize: 15 }}>🆕 Recent Sign-ups</h3>
                {(stats.recentSignups || []).map((u, i) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < stats.recentSignups.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                    <Avatar src={u.avatar} name={u.name} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                    </div>
                    <span style={{ fontSize: 10, color: u.onboarded ? '#22c55e' : t.textMuted, fontWeight: 600 }}>
                      {u.onboarded ? '✓ onboarded' : '⏳ pending'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <input
              placeholder="🔍 Search users by name, email or title…"
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
              style={{ flex: 1, maxWidth: 380, background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: '10px 16px', color: t.text, fontSize: 14, outline: 'none' }}
            />
            <span style={{ color: t.textMuted, fontSize: 13 }}>{userTotal} users total</span>
          </div>

          {card(
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>
                    {['User', 'Email', 'Posts', 'Connections', 'Joined', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${t.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = t.cardAlt}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar src={u.avatar} name={u.name} size={30} />
                          <div>
                            <div style={{ fontWeight: 600, color: t.text }}>{u.name}</div>
                            <div style={{ color: t.textMuted, fontSize: 11 }}>{u.title?.slice(0, 40)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: t.textMuted }}>{u.email}</td>
                      <td style={{ padding: '10px 12px', color: t.text, fontWeight: 600 }}>{u.post_count}</td>
                      <td style={{ padding: '10px 12px', color: t.text }}>{u.connection_count}</td>
                      <td style={{ padding: '10px 12px', color: t.textMuted }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: u.onboarded ? '#22c55e22' : t.cardAlt, color: u.onboarded ? '#22c55e' : t.textMuted, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                          {u.onboarded ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {u.id !== 1 && (
                          <button onClick={() => deleteUser(u.id, u.name)} disabled={loading} style={{
                            background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444',
                            borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                {userPage > 1 && <button onClick={() => setUserPage(p => p - 1)} style={{ background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 16px', cursor: 'pointer', color: t.text, fontSize: 13 }}>← Prev</button>}
                <span style={{ padding: '6px 12px', color: t.textMuted, fontSize: 13 }}>Page {userPage} · {userTotal} users</span>
                {userPage * 30 < userTotal && <button onClick={() => setUserPage(p => p + 1)} style={{ background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 16px', cursor: 'pointer', color: t.text, fontSize: 13 }}>Next →</button>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Posts ── */}
      {tab === 'posts' && (
        <div>
          <div style={{ marginBottom: 12, color: t.textMuted, fontSize: 13 }}>{postTotal} posts total</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.map(p => (
              <div key={p.id} style={{ background: t.card, borderRadius: 14, padding: 16, border: `1px solid ${t.border}`, boxShadow: t.shadow, display: 'flex', gap: 12 }}>
                <Avatar src={p.avatar} name={p.name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: t.text, fontSize: 14 }}>{p.name}</span>
                    <span style={{ color: t.textMuted, fontSize: 12 }}>{new Date(p.created_at).toLocaleString()}</span>
                    <span style={{ color: t.textMuted, fontSize: 12 }}>{p.drink} · 🥂{p.cheer_count} · 💬{p.comment_count}</span>
                  </div>
                  <p style={{ margin: 0, color: t.textSub, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {p.content?.slice(0, 300)}{p.content?.length > 300 ? '…' : ''}
                  </p>
                </div>
                <button onClick={() => deletePost(p.id)} style={{
                  background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444',
                  borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0, alignSelf: 'flex-start',
                }}>Delete</button>
              </div>
            ))}

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {postPage > 1 && <button onClick={() => setPostPage(p => p - 1)} style={{ background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 16px', cursor: 'pointer', color: t.text, fontSize: 13 }}>← Prev</button>}
              <span style={{ padding: '6px 12px', color: t.textMuted, fontSize: 13 }}>Page {postPage} · {postTotal} posts</span>
              {postPage * 30 < postTotal && <button onClick={() => setPostPage(p => p + 1)} style={{ background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 16px', cursor: 'pointer', color: t.text, fontSize: 13 }}>Next →</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Activity ── */}
      {tab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: '0 0 8px', color: t.text, fontSize: 15 }}>⚡ Recent Platform Activity</h3>
          {activity.map((a, i) => (
            <div key={i} style={{ background: t.card, borderRadius: 12, padding: '12px 16px', border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar src={a.avatar} name={a.name || 'User'} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>{a.name} </span>
                <span style={{ color: t.textMuted, fontSize: 13 }}>
                  {a.type === 'signup' ? 'joined DrinkedInn' : 'posted: '}
                </span>
                {a.type === 'post' && <span style={{ color: t.textSub, fontSize: 13 }}>{a.detail?.slice(0, 70)}…</span>}
              </div>
              <span style={{ color: t.textFaint, fontSize: 11, flexShrink: 0 }}>{new Date(a.ts).toLocaleTimeString()}</span>
              <span style={{ fontSize: 18 }}>{a.type === 'signup' ? '🆕' : '📝'}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Marketing Skills ── */}
      {tab === 'marketing' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 4px', color: t.text, fontSize: 16, fontWeight: 700 }}>📣 Marketing Skills</h3>
            <p style={{ margin: 0, color: t.textMuted, fontSize: 13 }}>
              Powered by <a href="https://github.com/coreyhaines31/marketingskills" target="_blank" rel="noreferrer" style={{ color: t.accent }}>coreyhaines31/marketingskills</a> — 9 skills adapted for DrinkedInn. Click a prompt to send it to the CMO agent.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {MARKETING_SKILLS.map(skill => (
              <div key={skill.id}
                onClick={() => setActiveSkill(activeSkill?.id === skill.id ? null : skill)}
                style={{
                  background: activeSkill?.id === skill.id ? t.accent + '11' : t.card,
                  border: `1.5px solid ${activeSkill?.id === skill.id ? t.accent : t.border}`,
                  borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: activeSkill?.id === skill.id ? `0 0 0 3px ${t.accentSoft}` : t.shadow,
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 8 }}>{skill.icon}</div>
                <div style={{ fontWeight: 700, color: t.text, fontSize: 14, marginBottom: 4 }}>{skill.name}</div>
                <div style={{ color: t.textMuted, fontSize: 12 }}>{skill.desc}</div>
              </div>
            ))}
          </div>

          {activeSkill && (
            <div style={{ background: t.card, borderRadius: 16, padding: 24, border: `1px solid ${t.border}`, marginBottom: 24, boxShadow: t.shadow }}>
              <h4 style={{ margin: '0 0 16px', color: t.text, fontSize: 15 }}>{activeSkill.icon} {activeSkill.name} — Quick Prompts</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {activeSkill.prompts.map((p, i) => (
                  <button key={i} onClick={() => { setActivePrompt(p); setAiResponse(''); }}
                    style={{
                      textAlign: 'left', background: activePrompt === p ? t.accent + '18' : t.cardAlt,
                      border: `1px solid ${activePrompt === p ? t.accent : t.border}`,
                      borderRadius: 10, padding: '10px 14px', cursor: 'pointer', color: t.textSub,
                      fontSize: 13, lineHeight: 1.4, transition: 'all 0.15s',
                    }}>
                    {p}
                  </button>
                ))}
              </div>

              {/* Custom prompt input */}
              <div style={{ marginBottom: 12 }}>
                <textarea
                  value={activePrompt}
                  onChange={e => setActivePrompt(e.target.value)}
                  placeholder="Or type a custom marketing prompt for DrinkedInn…"
                  rows={3}
                  style={{
                    width: '100%', background: t.inputBg, border: `1.5px solid ${t.border}`,
                    borderRadius: 10, padding: '12px 14px', color: t.text, fontSize: 13,
                    outline: 'none', resize: 'vertical', fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                onClick={() => activePrompt.trim() && runMarketingSkill(activePrompt)}
                disabled={aiLoading || !activePrompt.trim()}
                style={{
                  background: aiLoading ? t.cardAlt : 'linear-gradient(135deg, #f5a623, #ffcc5c)',
                  border: 'none', borderRadius: 10, padding: '11px 24px',
                  color: aiLoading ? t.textMuted : '#fff', fontWeight: 700, fontSize: 14,
                  cursor: aiLoading || !activePrompt.trim() ? 'not-allowed' : 'pointer',
                  boxShadow: aiLoading ? 'none' : '0 4px 16px rgba(245,166,35,0.35)',
                }}
              >
                {aiLoading ? '⏳ CMO Agent thinking…' : '🤖 Ask CMO Agent →'}
              </button>
            </div>
          )}

          {/* AI Response */}
          {(aiLoading || aiResponse) && (
            <div style={{ background: t.card, borderRadius: 16, padding: 24, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
              <h4 style={{ margin: '0 0 16px', color: t.accent, fontSize: 14 }}>📣 CMO Agent Response</h4>
              {aiLoading ? (
                <div style={{ color: t.textMuted, fontSize: 14 }}>⏳ Thinking…</div>
              ) : (
                <pre style={{ margin: 0, color: t.text, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}>
                  {aiResponse}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
