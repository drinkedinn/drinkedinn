const { useState, useEffect, useRef } = React;

// ─── DATA ────────────────────────────────────────────────────────────────────

const ME = {
  name: "Rahul M.",
  title: "VP of After-Hours Strategy 🥃",
  avatar: "https://i.pravatar.cc/150?img=12",
  connections: 847,
  verified: true,
};

const STORIES = [
  { id: 1, user: "Priya K.", avatar: "https://i.pravatar.cc/150?img=47", drink: "🍹", active: true },
  { id: 2, user: "Arjun S.", avatar: "https://i.pravatar.cc/150?img=51", drink: "🥃", active: false },
  { id: 3, user: "Meera L.", avatar: "https://i.pravatar.cc/150?img=32", drink: "🍷", active: true },
  { id: 4, user: "Dev P.", avatar: "https://i.pravatar.cc/150?img=59", drink: "🍺", active: false },
  { id: 5, user: "Sneha R.", avatar: "https://i.pravatar.cc/150?img=25", drink: "🍸", active: true },
  { id: 6, user: "Vikram T.", avatar: "https://i.pravatar.cc/150?img=68", drink: "🥂", active: false },
];

const POSTS = [
  {
    id: 1,
    user: { name: "Arjun Sharma", title: "CFO @ Boring Corp | Chief Fun Officer @ Weekends", avatar: "https://i.pravatar.cc/150?img=51" },
    time: "2h ago",
    location: "🇯🇵 Tokyo, Japan",
    content: "Just had the most insane whisky tasting in Shinjuku. 47-year-old Yamazaki. I've made better decisions in 2 hours of drinking than in 10 years of corporate meetings.\n\nReminder: Life is short. Order the good stuff. 🥃",
    image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&q=80",
    hashtags: ["#whisky", "#tokyo", "#lifeisshort", "#yamazaki"],
    likes: 1247,
    comments: 89,
    repours: 203,
    liked: false,
    drink: "🥃",
  },
  {
    id: 2,
    user: { name: "Priya Kapoor", title: "Head of Legal | Tequila Correspondent", avatar: "https://i.pravatar.cc/150?img=47" },
    time: "5h ago",
    location: "🇲🇽 Mexico City",
    content: "3 things I've learned from tequila that no MBA could teach me:\n\n1. Always check the source (100% agave, no blends)\n2. The process matters more than the result\n3. Good company makes everything better\n\nCheers from Oaxaca 🌵",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
    hashtags: ["#tequila", "#oaxaca", "#lifelessons", "#travel"],
    likes: 2891,
    comments: 156,
    repours: 445,
    liked: true,
    drink: "🍹",
  },
  {
    id: 3,
    user: { name: "Meera Lakhani", title: "Director of Operations | Sommelier in Training", avatar: "https://i.pravatar.cc/150?img=32" },
    time: "1d ago",
    location: "🇫🇷 Bordeaux, France",
    content: "Spent a weekend in the vineyards of Bordeaux. No emails. No Slack. No synergy. Just wine, cheese, and actual human conversations.\n\nI forgot that trees exist. Highly recommend.",
    image: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&q=80",
    hashtags: ["#wine", "#bordeaux", "#digitoxdetox", "#france"],
    likes: 3420,
    comments: 211,
    repours: 678,
    liked: false,
    drink: "🍷",
  },
  {
    id: 4,
    user: { name: "Dev Patel", title: "Senior Engineer | Craft Beer Analyst", avatar: "https://i.pravatar.cc/150?img=59" },
    time: "2d ago",
    location: "🇩🇪 Munich, Germany",
    content: "Oktoberfest 2024 was peak human achievement. I have not debugged a single line of code in 5 days. My brain is running on pretzels and lager.\n\nThis is what work-life balance actually looks like. 🍺🥨",
    image: "https://images.unsplash.com/photo-1567696153798-9111f9cd3d0d?w=600&q=80",
    hashtags: ["#oktoberfest", "#munich", "#craftbeer", "#nocode"],
    likes: 5102,
    comments: 394,
    repours: 912,
    liked: false,
    drink: "🍺",
  },
];

const TRENDING = [
  { tag: "#whiskytrails", posts: "12.4k posts" },
  { tag: "#sundowner", posts: "8.9k posts" },
  { tag: "#winewednesday", posts: "34.2k posts" },
  { tag: "#craftbeerlife", posts: "21.1k posts" },
  { tag: "#noboardrooms", posts: "6.7k posts" },
  { tag: "#rooftopdrinks", posts: "15.3k posts" },
];

const SUGGESTIONS = [
  { name: "Kabir Mehta", title: "CTO | Rum Enthusiast", avatar: "https://i.pravatar.cc/150?img=62", mutual: 14 },
  { name: "Anjali Roy", title: "Marketing Head | Gin Collector", avatar: "https://i.pravatar.cc/150?img=44", mutual: 9 },
  { name: "Rohan Das", title: "Founder | Single Malt Seeker", avatar: "https://i.pravatar.cc/150?img=70", mutual: 22 },
];

// ─── LOGO ────────────────────────────────────────────────────────────────────

function Logo({ size = "md" }) {
  const big = size === "lg";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: big ? 10 : 6, userSelect: "none" }}>
      <span style={{
        fontWeight: 900,
        fontSize: big ? 32 : 22,
        color: "#fff",
        letterSpacing: -1,
        fontFamily: "'Inter', sans-serif",
      }}>
        Drinked
      </span>
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a66c2, #1d8fe8)",
        color: "#fff",
        fontWeight: 900,
        fontSize: big ? 28 : 18,
        borderRadius: big ? 8 : 5,
        padding: big ? "4px 10px" : "2px 7px",
        letterSpacing: -0.5,
        boxShadow: "0 2px 12px rgba(10,102,194,0.4)",
      }}>
        In 🍺
      </span>
    </div>
  );
}

// ─── NAVBAR ──────────────────────────────────────────────────────────────────

function Navbar({ activeTab, setActiveTab, setShowPost }) {
  const [search, setSearch] = useState("");
  const tabs = [
    { id: "home", icon: "⌂", label: "Home" },
    { id: "explore", icon: "🔍", label: "Explore" },
    { id: "cheers", icon: "🥂", label: "Cheers" },
    { id: "trips", icon: "✈️", label: "Trips" },
    { id: "profile", icon: "👤", label: "Me" },
  ];

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(13,13,13,0.95)",
      backdropFilter: "blur(16px)",
      borderBottom: "1px solid #2a2a2a",
      padding: "0 24px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", height: 64, gap: 20 }}>
        <Logo />

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 320, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#666" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search drinks, people, places…"
            style={{
              width: "100%", background: "#1e1e1e", border: "1px solid #2a2a2a",
              borderRadius: 24, padding: "9px 16px 9px 36px",
              color: "#f0f0f0", fontSize: 14, outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = "#f5a623"}
            onBlur={e => e.target.style.borderColor = "#2a2a2a"}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "8px 14px", borderRadius: 8, gap: 2,
              color: activeTab === t.id ? "#f5a623" : "#999",
              borderBottom: activeTab === t.id ? "2px solid #f5a623" : "2px solid transparent",
              transition: "all 0.2s",
            }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Post button */}
        <button onClick={() => setShowPost(true)} style={{
          background: "linear-gradient(135deg, #f5a623, #ffcc5c)",
          border: "none", borderRadius: 24, padding: "9px 20px",
          color: "#0d0d0d", fontWeight: 700, fontSize: 14,
          cursor: "pointer", whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(245,166,35,0.3)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
          onMouseEnter={e => { e.target.style.transform = "scale(1.04)"; e.target.style.boxShadow = "0 6px 20px rgba(245,166,35,0.45)"; }}
          onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 4px 16px rgba(245,166,35,0.3)"; }}
        >
          + Pour a Story
        </button>

        {/* Avatar */}
        <div style={{ position: "relative" }}>
          <img src={ME.avatar} alt="" style={{ width: 38, height: 38, borderRadius: "50%", border: "2px solid #f5a623", cursor: "pointer" }} />
          <span style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, background: "#22c55e", borderRadius: "50%", border: "2px solid #0d0d0d" }} />
        </div>
      </div>
    </nav>
  );
}

// ─── STORIES ─────────────────────────────────────────────────────────────────

function Stories() {
  return (
    <div style={{
      background: "#161616", borderRadius: 16, padding: "16px 20px",
      border: "1px solid #2a2a2a", marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, color: "#666", fontWeight: 600, marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase" }}>
        Sip Stories • Live
      </div>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4 }}>
        {/* Add your own */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "#1e1e1e", border: "2px dashed #f5a623",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, transition: "transform 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            ➕
          </div>
          <span style={{ fontSize: 11, color: "#666", fontWeight: 500 }}>Your Story</span>
        </div>

        {STORIES.map(s => (
          <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.06)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              padding: 2,
              background: s.active
                ? "linear-gradient(135deg, #f5a623, #ffcc5c, #ff6b35)"
                : "#2a2a2a",
            }}>
              <img src={s.avatar} alt={s.user} style={{ width: "100%", height: "100%", borderRadius: "50%", border: "2px solid #161616", objectFit: "cover" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 11, color: s.active ? "#f0f0f0" : "#666", fontWeight: 500, maxWidth: 56, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.user.split(" ")[0]}</span>
              <span style={{ fontSize: 12 }}>{s.drink}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CREATE POST ─────────────────────────────────────────────────────────────

function CreatePost({ onPost }) {
  return (
    <div style={{ background: "#161616", borderRadius: 16, padding: 20, border: "1px solid #2a2a2a", marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <img src={ME.avatar} alt="" style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid #f5a623" }} />
        <div onClick={onPost} style={{
          flex: 1, background: "#1e1e1e", borderRadius: 24,
          padding: "12px 20px", color: "#666", fontSize: 15,
          cursor: "pointer", border: "1px solid #2a2a2a",
          transition: "border-color 0.2s",
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#f5a623"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}
        >
          What's in your glass tonight? 🥃
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, paddingLeft: 56 }}>
        {[["📸", "Photo"], ["📍", "Location"], ["🏷️", "Tag"], ["🍹", "Drink"]].map(([icon, label]) => (
          <button key={label} onClick={onPost} style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "#1e1e1e", border: "1px solid #2a2a2a",
            borderRadius: 20, padding: "6px 14px",
            color: "#999", fontSize: 13, cursor: "pointer",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#f5a623"; e.currentTarget.style.color = "#f5a623"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#999"; }}
          >
            <span>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── POST CARD ────────────────────────────────────────────────────────────────

function PostCard({ post, onLike }) {
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");

  const formatNum = n => n >= 1000 ? (n / 1000).toFixed(1) + "k" : n;

  return (
    <div style={{
      background: "#161616", borderRadius: 16, border: "1px solid #2a2a2a",
      marginBottom: 16, overflow: "hidden",
      transition: "border-color 0.2s, transform 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px 12px" }}>
        <div style={{ position: "relative" }}>
          <img src={post.user.avatar} alt="" style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid #f5a623", objectFit: "cover" }} />
          <span style={{ position: "absolute", bottom: -2, right: -2, fontSize: 14 }}>{post.drink}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{post.user.name}</span>
            <span style={{ fontSize: 13, color: "#f5a623" }}>✓</span>
          </div>
          <div style={{ color: "#666", fontSize: 12, marginTop: 1 }}>{post.user.title}</div>
          <div style={{ color: "#555", fontSize: 11, marginTop: 2, display: "flex", gap: 8 }}>
            <span>{post.time}</span>
            <span>•</span>
            <span>{post.location}</span>
          </div>
        </div>
        <button style={{
          background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)",
          borderRadius: 20, padding: "6px 16px", color: "#f5a623",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          transition: "all 0.2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,166,35,0.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,166,35,0.1)"; }}
        >
          + Connect
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "0 20px 14px", lineHeight: 1.65, fontSize: 15, color: "#ddd", whiteSpace: "pre-line" }}>
        {post.content}
      </div>

      {/* Hashtags */}
      <div style={{ padding: "0 20px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
        {post.hashtags.map(h => (
          <span key={h} style={{ color: "#f5a623", fontSize: 13, cursor: "pointer", fontWeight: 500 }}
            onMouseEnter={e => e.target.style.textDecoration = "underline"}
            onMouseLeave={e => e.target.style.textDecoration = "none"}
          >{h}</span>
        ))}
      </div>

      {/* Image */}
      {post.image && (
        <div style={{ overflow: "hidden", maxHeight: 380 }}>
          <img src={post.image} alt="" style={{ width: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}

      {/* Stats */}
      <div style={{ padding: "10px 20px", display: "flex", justifyContent: "space-between", color: "#555", fontSize: 13, borderBottom: "1px solid #222" }}>
        <span>🍺 {formatNum(post.likes)} cheers</span>
        <span style={{ cursor: "pointer" }} onClick={() => setShowComments(!showComments)}>{post.comments} comments · {formatNum(post.repours)} repours</span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", padding: "4px 8px" }}>
        {[
          { icon: post.liked ? "🍺" : "🥂", label: post.liked ? "Cheers!" : "Cheers", action: () => onLike(post.id), active: post.liked },
          { icon: "💬", label: "Comment", action: () => setShowComments(!showComments) },
          { icon: "🔄", label: "Repour", action: () => {} },
          { icon: "📤", label: "Share", action: () => {} },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            padding: "10px 4px", borderRadius: 8,
            color: btn.active ? "#f5a623" : "#666", fontSize: 13, fontWeight: 600,
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#1e1e1e"; e.currentTarget.style.color = "#f5a623"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = btn.active ? "#f5a623" : "#666"; }}
          >
            <span style={{ fontSize: 16 }}>{btn.icon}</span>
            <span>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #222" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <img src={ME.avatar} alt="" style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", gap: 8 }}>
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…"
                style={{
                  flex: 1, background: "#1e1e1e", border: "1px solid #2a2a2a",
                  borderRadius: 20, padding: "8px 16px", color: "#f0f0f0",
                  fontSize: 13, outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = "#f5a623"}
                onBlur={e => e.target.style.borderColor = "#2a2a2a"}
              />
              {comment && (
                <button onClick={() => setComment("")} style={{
                  background: "linear-gradient(135deg, #f5a623, #ffcc5c)",
                  border: "none", borderRadius: 20, padding: "8px 16px",
                  color: "#0d0d0d", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                  Post
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LEFT SIDEBAR ─────────────────────────────────────────────────────────────

function LeftSidebar() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Profile card */}
      <div style={{
        background: "#161616", borderRadius: 16, overflow: "hidden",
        border: "1px solid #2a2a2a",
      }}>
        <div style={{
          height: 72,
          background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "url('https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?w=400&q=60') center/cover",
            opacity: 0.3,
          }} />
        </div>
        <div style={{ padding: "0 16px 16px", marginTop: -24 }}>
          <img src={ME.avatar} alt="" style={{ width: 52, height: 52, borderRadius: "50%", border: "3px solid #161616", marginBottom: 8 }} />
          <div style={{ fontWeight: 700, fontSize: 16 }}>{ME.name} <span style={{ color: "#f5a623", fontSize: 14 }}>✓</span></div>
          <div style={{ color: "#777", fontSize: 12, marginTop: 2 }}>{ME.title}</div>

          <div style={{ marginTop: 14, borderTop: "1px solid #222", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["🔗 Connections", ME.connections],
              ["👁️ Profile views", "1,284"],
              ["📈 Post impressions", "9.4k"],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#666" }}>{label}</span>
                <span style={{ color: "#f5a623", fontWeight: 700 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My bar */}
      <div style={{ background: "#161616", borderRadius: 16, padding: 16, border: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 12, color: "#666", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>My Bar 🍶</div>
        {[
          { emoji: "🥃", name: "Whisky", level: 85 },
          { emoji: "🍷", name: "Wine", level: 60 },
          { emoji: "🍺", name: "Craft Beer", level: 90 },
          { emoji: "🍹", name: "Cocktails", level: 70 },
        ].map(({ emoji, name, level }) => (
          <div key={name} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>{emoji} {name}</span>
              <span style={{ color: "#f5a623" }}>{level}%</span>
            </div>
            <div style={{ height: 4, background: "#2a2a2a", borderRadius: 2 }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: "linear-gradient(90deg, #f5a623, #ffcc5c)",
                width: `${level}%`,
                transition: "width 1s ease",
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming */}
      <div style={{ background: "#161616", borderRadius: 16, padding: 16, border: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 12, color: "#666", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Upcoming Pours 📅</div>
        {[
          { event: "Whisky Tasting", date: "Sat, Apr 27", location: "Mumbai" },
          { event: "Rooftop Sundowner", date: "Fri, May 3", location: "Bangalore" },
          { event: "Wine & Cheese Evening", date: "Sun, May 12", location: "Delhi" },
        ].map(e => (
          <div key={e.event} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #1e1e1e" }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{e.event}</div>
            <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>{e.date} · {e.location}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RIGHT SIDEBAR ────────────────────────────────────────────────────────────

function RightSidebar() {
  const [connected, setConnected] = useState({});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Trending */}
      <div style={{ background: "#161616", borderRadius: 16, padding: 16, border: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 12, color: "#666", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Trending Pours 🔥</div>
        {TRENDING.map((t, i) => (
          <div key={t.tag} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 0", borderBottom: i < TRENDING.length - 1 ? "1px solid #1e1e1e" : "none",
            cursor: "pointer",
          }}
            onMouseEnter={e => e.currentTarget.style.paddingLeft = "6px"}
            onMouseLeave={e => e.currentTarget.style.paddingLeft = "0"}
          >
            <div>
              <div style={{ color: "#f5a623", fontWeight: 600, fontSize: 14 }}>{t.tag}</div>
              <div style={{ color: "#555", fontSize: 12 }}>{t.posts}</div>
            </div>
            <span style={{ color: "#333", fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div style={{ background: "#161616", borderRadius: 16, padding: 16, border: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 12, color: "#666", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Pour Buddies to Add 👥</div>
        {SUGGESTIONS.map(s => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <img src={s.avatar} alt="" style={{ width: 42, height: 42, borderRadius: "50%", border: "2px solid #2a2a2a", objectFit: "cover" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
              <div style={{ color: "#666", fontSize: 11 }}>{s.mutual} mutual pour buddies</div>
            </div>
            <button onClick={() => setConnected(p => ({ ...p, [s.name]: !p[s.name] }))} style={{
              background: connected[s.name] ? "#1e1e1e" : "rgba(245,166,35,0.1)",
              border: `1px solid ${connected[s.name] ? "#2a2a2a" : "rgba(245,166,35,0.4)"}`,
              borderRadius: 16, padding: "5px 12px",
              color: connected[s.name] ? "#666" : "#f5a623",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s",
            }}>
              {connected[s.name] ? "✓ Added" : "+ Add"}
            </button>
          </div>
        ))}
      </div>

      {/* Tonight's vibe */}
      <div style={{
        background: "linear-gradient(135deg, #1a1200, #2a1f00)",
        borderRadius: 16, padding: 16, border: "1px solid rgba(245,166,35,0.2)",
      }}>
        <div style={{ fontSize: 12, color: "#f5a623", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Tonight's Vibe 🌙</div>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🥃🎵✨</div>
        <div style={{ fontSize: 14, color: "#ddd", fontWeight: 600 }}>Old Fashioned & Jazz</div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>234 pour buddies are sipping tonight</div>
        <button style={{
          marginTop: 12, width: "100%",
          background: "linear-gradient(135deg, #f5a623, #ffcc5c)",
          border: "none", borderRadius: 20, padding: "8px",
          color: "#0d0d0d", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>
          Join the Vibe
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#333", lineHeight: 1.6, padding: "0 4px" }}>
        DrinkedInn · About · Help · Privacy · Terms · No Business Talk Policy 🚫💼<br />
        DrinkedInn Corp © 2024
      </div>
    </div>
  );
}

// ─── POST MODAL ───────────────────────────────────────────────────────────────

function PostModal({ onClose, onSubmit }) {
  const [text, setText] = useState("");
  const [drink, setDrink] = useState("🥃");
  const drinks = ["🥃", "🍺", "🍷", "🍹", "🥂", "🍸", "🍶", "🧉"];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "#161616", borderRadius: 20, padding: 28,
        width: "100%", maxWidth: 560, border: "1px solid #2a2a2a",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Pour a Story ✍️</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <img src={ME.avatar} alt="" style={{ width: 46, height: 46, borderRadius: "50%", border: "2px solid #f5a623" }} />
          <div>
            <div style={{ fontWeight: 700 }}>{ME.name}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{ME.title}</div>
          </div>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What's in your glass? Where are you pouring tonight? Share the vibes… 🥃"
          style={{
            width: "100%", minHeight: 140, background: "#1e1e1e",
            border: "1px solid #2a2a2a", borderRadius: 12, padding: 16,
            color: "#f0f0f0", fontSize: 15, lineHeight: 1.6,
            resize: "vertical", outline: "none", fontFamily: "'Inter', sans-serif",
          }}
          onFocus={e => e.target.style.borderColor = "#f5a623"}
          onBlur={e => e.target.style.borderColor = "#2a2a2a"}
        />

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>What's in your glass?</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {drinks.map(d => (
              <button key={d} onClick={() => setDrink(d)} style={{
                fontSize: 22, background: drink === d ? "rgba(245,166,35,0.15)" : "#1e1e1e",
                border: `2px solid ${drink === d ? "#f5a623" : "#2a2a2a"}`,
                borderRadius: 10, padding: "6px 10px", cursor: "pointer",
                transition: "all 0.15s", transform: drink === d ? "scale(1.2)" : "scale(1)",
              }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {[["📸", "Photo"], ["📍", "Location"], ["👥", "Tag Buddies"]].map(([icon, label]) => (
            <button key={label} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "#1e1e1e", border: "1px solid #2a2a2a",
              borderRadius: 20, padding: "7px 14px",
              color: "#888", fontSize: 13, cursor: "pointer",
              transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#f5a623"; e.currentTarget.style.color = "#f5a623"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#888"; }}
            >
              <span>{icon}</span><span>{label}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #2a2a2a", borderRadius: 20,
            padding: "10px 22px", color: "#888", fontSize: 14, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => { if (text.trim()) { onSubmit({ text, drink }); onClose(); } }} style={{
            background: text.trim() ? "linear-gradient(135deg, #f5a623, #ffcc5c)" : "#2a2a2a",
            border: "none", borderRadius: 20, padding: "10px 28px",
            color: text.trim() ? "#0d0d0d" : "#555", fontWeight: 700, fontSize: 14,
            cursor: text.trim() ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}>
            Pour It 🍺
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SPLASH SCREEN ────────────────────────────────────────────────────────────

function Splash({ onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 500);
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#0d0d0d",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      transition: "opacity 0.5s",
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? "all" : "none",
    }}>
      <div style={{ animation: "popIn 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <Logo size="lg" />
      </div>
      <div style={{ marginTop: 16, color: "#666", fontSize: 15, fontStyle: "italic" }}>
        Where Professionals Actually Unwind 🥃
      </div>
      <div style={{ marginTop: 40, display: "flex", gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#f5a623",
            animation: `pulse 1s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

function App() {
  const [splash, setSplash] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [showPost, setShowPost] = useState(false);
  const [posts, setPosts] = useState(POSTS);

  const handleLike = (id) => {
    setPosts(prev => prev.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
  };

  const handleNewPost = ({ text, drink }) => {
    const newPost = {
      id: Date.now(),
      user: { name: ME.name, title: ME.title, avatar: ME.avatar },
      time: "Just now",
      location: "📍 Your Location",
      content: text,
      image: null,
      hashtags: [],
      likes: 0,
      comments: 0,
      repours: 0,
      liked: false,
      drink,
    };
    setPosts(prev => [newPost, ...prev]);
  };

  return (
    <>
      {splash && <Splash onDone={() => setSplash(false)} />}
      {showPost && <PostModal onClose={() => setShowPost(false)} onSubmit={handleNewPost} />}

      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} setShowPost={setShowPost} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", display: "grid", gridTemplateColumns: "280px 1fr 300px", gap: 20 }}>
        <LeftSidebar />

        {/* Feed */}
        <div>
          <Stories />
          <CreatePost onPost={() => setShowPost(true)} />
          {posts.map(post => (
            <PostCard key={post.id} post={post} onLike={handleLike} />
          ))}
        </div>

        <RightSidebar />
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
