import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const FEATURES = [
  { icon: '🥃', title: 'Share Your Pours', desc: 'Post what you\'re drinking with tasting notes, ratings, and photos' },
  { icon: '🫂', title: 'Find Your Tribe', desc: 'Connect with whisky lovers, craft beer geeks, wine professionals' },
  { icon: '🍶', title: 'Drink Groups', desc: 'Join communities around your favourite drinks — from Scotch to Sake' },
  { icon: '⚡', title: 'Monthly Challenges', desc: 'Try 5 new craft beers, explore world whiskies, discover natural wine' },
  { icon: '🍸', title: 'My Bar', desc: 'Track your ratings, build your collection, earn badges' },
  { icon: '💬', title: 'Real Conversations', desc: 'DM drink pros, bartenders, sommeliers — no small talk required' },
];

const TESTIMONIALS = [
  { name: 'Arjun S.', title: 'VP Marketing', text: 'Finally a social network where "networking" means sharing a good bottle.', avatar: '🥃' },
  { name: 'Priya K.', title: 'Tequila Correspondent', text: 'DrinkedInn taught me that mezcal and tequila are not the same thing. Career-changing.', avatar: '🍹' },
  { name: 'Dev P.', title: 'Craft Beer Analyst', text: 'I\'ve rated 340 beers. My ML model predicts IPA quality from label design. 73% accuracy.', avatar: '🍺' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) { navigate('/', { replace: true }); return null; }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b14', color: '#f0f2f8', fontFamily: "'Inter', 'SF Pro Display', sans-serif" }}>

      {/* ── Nav ── */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <Logo size="md" />
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: '1px solid #2a2d3e', borderRadius: 10, padding: '10px 22px', color: '#f0f2f8', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Log In
          </button>
          <button onClick={() => navigate('/login')} style={{ background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)', border: 'none', borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(10,102,194,0.4)' }}>
            Join the Bar 🍺
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0a66c2', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
          THE SOCIAL NETWORK FOR DRINK LOVERS
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 24px', letterSpacing: -2 }}>
          Where Professionals<br />
          <span style={{ background: 'linear-gradient(135deg, #f5a623, #ffcc5c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Actually Unwind</span>
        </h1>
        <p style={{ fontSize: 18, color: '#8b8fa8', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px' }}>
          Share what you're drinking. Connect with whisky nerds, craft beer geeks, and wine
          professionals. No synergy. No circle-backs. Just good drinks and real conversations.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/login')} style={{ background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)', border: 'none', borderRadius: 12, padding: '16px 36px', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(10,102,194,0.45)', transition: 'transform 0.15s' }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.03)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
          >
            Join Free — It Takes 30 Seconds 🍺
          </button>
          <button onClick={() => navigate('/login')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #2a2d3e', borderRadius: 12, padding: '16px 30px', color: '#f0f2f8', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Demo Account →
          </button>
        </div>

        {/* Social proof */}
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 32, color: '#555870', fontSize: 14 }}>
          <span>👥 <strong style={{ color: '#f0f2f8' }}>50+</strong> members</span>
          <span>📝 <strong style={{ color: '#f0f2f8' }}>100+</strong> pour stories</span>
          <span>🌍 <strong style={{ color: '#f0f2f8' }}>13</strong> countries</span>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, margin: '0 0 48px', letterSpacing: -1 }}>
          Everything a drink lover needs
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: '#13161e', border: '1px solid #1f2233', borderRadius: 16, padding: '28px 24px', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#0a66c2'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1f2233'}
            >
              <div style={{ fontSize: 36, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{f.title}</div>
              <div style={{ color: '#8b8fa8', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: '60px 24px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, margin: '0 0 40px', letterSpacing: -0.5 }}>
          What the bar is saying
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: '#13161e', border: '1px solid #1f2233', borderRadius: 14, padding: '24px' }}>
              <div style={{ fontSize: 14, color: '#8b8fa8', lineHeight: 1.6, marginBottom: 16, fontStyle: 'italic' }}>
                "{t.text}"
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>{t.avatar}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                  <div style={{ color: '#555870', fontSize: 12 }}>{t.title}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ textAlign: 'center', padding: '80px 24px', background: 'linear-gradient(135deg, rgba(10,102,194,0.12), rgba(29,143,232,0.08))' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 16px', letterSpacing: -1 }}>
          The bar is open. Pull up a seat.
        </h2>
        <p style={{ color: '#8b8fa8', fontSize: 16, marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
          Free forever. No ads. No data selling. Just drinks and good vibes.
        </p>
        <button onClick={() => navigate('/login')} style={{ background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)', border: 'none', borderRadius: 12, padding: '16px 40px', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(10,102,194,0.45)' }}>
          Join DrinkedInn 🍺
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{ textAlign: 'center', padding: '32px 24px', borderTop: '1px solid #1f2233', color: '#555870', fontSize: 13 }}>
        <Logo size="md" />
        <div style={{ marginTop: 12 }}>© {new Date().getFullYear()} DrinkedInn. Where professionals actually unwind.</div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 20 }}>
          <a href="/login" style={{ color: '#8b8fa8', textDecoration: 'none' }}>Sign Up</a>
          <a href="/admin" style={{ color: '#8b8fa8', textDecoration: 'none' }}>Admin</a>
        </div>
      </footer>
    </div>
  );
}
