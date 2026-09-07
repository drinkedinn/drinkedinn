import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const FEATURES = [
  { icon: '📸', title: 'Share the Moment', desc: 'The table, the view, the people — post what made the night worth remembering' },
  { icon: '🫂', title: 'Find Your People', desc: 'Follow the friends, hosts and regulars whose taste you actually trust' },
  { icon: '📍', title: 'Remember the Places', desc: 'Every moment keeps its location, so you can find your way back to it' },
  { icon: '🗺️', title: 'Discover Something New', desc: 'Monthly discoveries that send you somewhere — a new place, a new find' },
  { icon: '⭐', title: 'Build Your Taste', desc: 'Keep notes and ratings, and watch your own taste take shape over time' },
  { icon: '💬', title: 'Real Conversations', desc: 'Groups, events and messages with people who care about the same things' },
];

const TESTIMONIALS = [
  { name: 'Arjun S.', title: 'Lagos', text: 'I found my favourite rooftop through someone else\'s Friday night. Now it\'s where we all end up.', avatar: '🌆' },
  { name: 'Priya K.', title: 'Lisbon', text: 'Two years of nights out, all in one place. It reads like a scrapbook I didn\'t know I was keeping.', avatar: '📸' },
  { name: 'Dev P.', title: 'Tokyo', text: 'Every trip I take, I come home with a list of places from people who actually live there.', avatar: '🗺️' },
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
            Pull Up a Chair
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0a66c2', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
          YOUR PEOPLE. YOUR PLACES. YOUR STORIES.
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 24px', letterSpacing: -2 }}>
          Stories<br />
          <span style={{ background: 'linear-gradient(135deg, #f5a623, #ffcc5c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>start here</span>
        </h1>
        <p style={{ fontSize: 18, color: '#8b8fa8', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px' }}>
          Share the moments worth remembering — the table, the view, the people. Keep
          the places you loved, and find the people who make a night worth telling.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/login')} style={{ background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)', border: 'none', borderRadius: 12, padding: '16px 36px', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(10,102,194,0.45)', transition: 'transform 0.15s' }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.03)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
          >
            Pull Up a Chair — 30 Seconds
          </button>
          <button onClick={() => navigate('/login')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #2a2d3e', borderRadius: 12, padding: '16px 30px', color: '#f0f2f8', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Demo Account →
          </button>
        </div>

        {/* Social proof */}
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 32, color: '#555870', fontSize: 14 }}>
          <span>👥 <strong style={{ color: '#f0f2f8' }}>50+</strong> members</span>
          <span>📝 <strong style={{ color: '#f0f2f8' }}>100+</strong> stories shared</span>
          <span>🌍 <strong style={{ color: '#f0f2f8' }}>13</strong> countries</span>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, margin: '0 0 48px', letterSpacing: -1 }}>
          Everything a good night deserves
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
          The door is open. Pull up a chair.
        </h2>
        <p style={{ color: '#8b8fa8', fontSize: 16, marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
          Free forever. No ads. No data selling. Just your people, your places and your stories.
        </p>
        <button onClick={() => navigate('/login')} style={{ background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)', border: 'none', borderRadius: 12, padding: '16px 40px', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(10,102,194,0.45)' }}>
          Join DrinkedInn
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{ textAlign: 'center', padding: '32px 24px', borderTop: '1px solid #1f2233', color: '#555870', fontSize: 13 }}>
        <Logo size="md" />
        <div style={{ marginTop: 12 }}>© {new Date().getFullYear()} DrinkedInn. Your people. Your places. Your stories.</div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 20 }}>
          <a href="/login" style={{ color: '#8b8fa8', textDecoration: 'none' }}>Sign Up</a>
          <a href="/admin" style={{ color: '#8b8fa8', textDecoration: 'none' }}>Admin</a>
        </div>
      </footer>
    </div>
  );
}
