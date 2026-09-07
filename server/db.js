const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// Created lazily, not at module load.
//
// Cloudflare validates a Worker by importing it at deploy time, before secrets
// are readable. Building the client eagerly meant TURSO_DB_URL was undefined,
// the 'file:' fallback kicked in, and the web client — which only speaks
// http/https/libsql — rejected it, failing the whole deploy.
//
// Deferring until first query also means an unconfigured database surfaces as a
// clear runtime error on one request rather than a crash at import.
let _client = null;
function client_() {
  if (_client) return _client;

  const url = process.env.TURSO_DB_URL
    || (typeof globalThis.WebSocketPair === 'undefined' ? 'file:./drinkeden.db' : null);

  if (!url) {
    throw new Error('[db] TURSO_DB_URL is not set. Workers cannot use a local file database.');
  }

  _client = createClient({ url, authToken: process.env.TURSO_DB_AUTH_TOKEN });
  return _client;
}

// ── Async helpers ──────────────────────────────────────────────────────────────

// get - returns first row or null
async function get(sql, args = []) {
  const r = await client_().execute({ sql, args });
  return r.rows[0] || null;
}

// all - returns array of rows
async function all(sql, args = []) {
  const r = await client_().execute({ sql, args });
  return r.rows;
}

// run - returns { lastInsertRowid, changes }
async function run(sql, args = []) {
  const r = await client_().execute({ sql, args });
  return { lastInsertRowid: Number(r.lastInsertRowid), changes: r.rowsAffected };
}

// exec - run raw SQL (for CREATE TABLE etc.)
async function exec(sql) {
  await client_().executeMultiple(sql);
}

// batch - multiple statements atomically
async function batch(stmts) {
  return client_().batch(stmts, 'write');
}

// ── init() — create tables and run migrations ─────────────────────────────────

async function init() {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      title TEXT DEFAULT 'DrinkedInn Member',
      avatar TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      drinks TEXT DEFAULT '{}',
      onboarded INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      drink TEXT DEFAULT '🥃',
      location TEXT DEFAULT '',
      lat REAL DEFAULT NULL,
      lng REAL DEFAULT NULL,
      image_url TEXT DEFAULT '',
      has_poll INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS cheers (
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS connections (
      user_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, target_id)
    );
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      drink TEXT DEFAULT '🍹',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS repours (
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      actor_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      post_id INTEGER,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT DEFAULT '',
      drink TEXT DEFAULT '🥃',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS poll_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id)
    );
    CREATE TABLE IF NOT EXISTS poll_votes (
      user_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );
    CREATE TABLE IF NOT EXISTS drink_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      drink_name TEXT NOT NULL,
      distillery TEXT DEFAULT '',
      drink_type TEXT DEFAULT '',
      rating REAL NOT NULL,
      nose TEXT DEFAULT '',
      palate TEXT DEFAULT '',
      finish TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS collection (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      distillery TEXT DEFAULT '',
      drink_type TEXT DEFAULT '',
      vintage TEXT DEFAULT '',
      rating REAL DEFAULT 0,
      image_url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS bucket_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      drink_name TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS drink_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      drink_type TEXT DEFAULT '🥃',
      avatar TEXT DEFAULT '',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS group_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      drink TEXT DEFAULT '🥃',
      image_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES drink_groups(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS event_rsvps (
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      drink_emoji TEXT DEFAULT '🥃',
      end_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS challenge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(challenge_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS agent_configs (
      key TEXT PRIMARY KEY,
      config_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS agent_decisions (
      id TEXT PRIMARY KEY,
      agent_role TEXT,
      agent_category TEXT,
      task TEXT,
      tier INTEGER,
      status TEXT,
      reasoning TEXT,
      action TEXT,
      guardrails TEXT,
      owner_feedback TEXT,
      decision_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS agent_activities (
      id TEXT PRIMARY KEY,
      type TEXT,
      data_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      referred_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS featured_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL UNIQUE,
      featured_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id)
    );
    CREATE TABLE IF NOT EXISTS notification_prefs (
      user_id INTEGER PRIMARY KEY,
      cheers INTEGER DEFAULT 1,
      comments INTEGER DEFAULT 1,
      connections INTEGER DEFAULT 1,
      messages INTEGER DEFAULT 1,
      challenges INTEGER DEFAULT 1,
      digest_email INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Safe migrations for existing DBs
  const migrations = [
    `ALTER TABLE users ADD COLUMN drinks TEXT DEFAULT '{}'`,
    `ALTER TABLE users ADD COLUMN onboarded INTEGER DEFAULT 0`,
    `ALTER TABLE posts ADD COLUMN has_poll INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`,
    `ALTER TABLE posts ADD COLUMN lat REAL DEFAULT NULL`,
    `ALTER TABLE posts ADD COLUMN lng REAL DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN referral_code TEXT DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN referred_by INTEGER DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN badge TEXT DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN premium INTEGER DEFAULT 0`,
    // Security hardening columns
    `ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN verify_token TEXT`,
    `ALTER TABLE users ADD COLUMN verify_sent_at INTEGER`,
    `ALTER TABLE users ADD COLUMN date_of_birth TEXT`,
    `ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN locked_until INTEGER`,
    // Engagement engine — streaks (community participation, NOT drink volume)
    `ALTER TABLE users ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN streak_date TEXT`,
    `ALTER TABLE users ADD COLUMN last_active_date TEXT`,
    // Engagement engine — responsible push throttle state
    `ALTER TABLE users ADD COLUMN tz_offset_minutes INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN push_count INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN push_count_date TEXT`,
    // Engagement engine — batch duplicate notifications ("X and N others cheered")
    `ALTER TABLE notifications ADD COLUMN count INTEGER NOT NULL DEFAULT 1`,
    // Lifecycle email — last day we sent a re-engagement digest (yyyy-mm-dd)
    `ALTER TABLE users ADD COLUMN last_digest_date TEXT`,
    // Jurisdiction — drives the age gate, ad eligibility and assurance level.
    `ALTER TABLE users ADD COLUMN country_code TEXT`,
    // Age assurance: 0 self-declared, 1 age-estimated, 2 document-verified.
    // We store only the outcome — never an identity document.
    `ALTER TABLE users ADD COLUMN age_assurance_level INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN age_assurance_at INTEGER`,
    `ALTER TABLE users ADD COLUMN age_assurance_ref TEXT`,
    // Users can refuse brand content outright — a personal setting the ad
    // delivery gate checks before anything commercial.
    `ALTER TABLE users ADD COLUMN brand_content_opt_out INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const sql of migrations) {
    try { await exec(sql); } catch {}
  }

  // Admin audit trail and password reset tables
  const securityTables = [
    `CREATE TABLE IF NOT EXISTS admin_audit (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       actor_id INTEGER NOT NULL,
       action TEXT NOT NULL,
       target_type TEXT,
       target_id TEXT,
       detail TEXT,
       created_at INTEGER NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS password_resets (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       token TEXT NOT NULL,
       expires_at INTEGER NOT NULL,
       used INTEGER NOT NULL DEFAULT 0
     )`,
    // ── Brand advertising ────────────────────────────────────────────────
    // A brand is a legal entity we have a contract with. `verified` is set by
    // an admin after checking they are who they claim — never self-serve.
    `CREATE TABLE IF NOT EXISTS brands (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       slug TEXT UNIQUE NOT NULL,
       legal_entity TEXT,
       contact_email TEXT,
       website TEXT,
       avatar TEXT DEFAULT '',
       bio TEXT DEFAULT '',
       verified INTEGER NOT NULL DEFAULT 0,
       status TEXT NOT NULL DEFAULT 'pending',
       created_at INTEGER NOT NULL
     )`,
    // Which platform users may act on behalf of a brand.
    `CREATE TABLE IF NOT EXISTS brand_members (
       brand_id INTEGER NOT NULL,
       user_id INTEGER NOT NULL,
       role TEXT NOT NULL DEFAULT 'manager',
       created_at INTEGER NOT NULL,
       PRIMARY KEY (brand_id, user_id)
     )`,
    // A campaign carries the commercial terms and the market list.
    // target_countries is a JSON array of ISO codes; delivery re-checks each
    // one against the jurisdiction rules at serve time regardless.
    `CREATE TABLE IF NOT EXISTS ad_campaigns (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       brand_id INTEGER NOT NULL,
       name TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'draft',
       target_countries TEXT NOT NULL DEFAULT '[]',
       min_age_override INTEGER,
       daily_impression_cap INTEGER,
       starts_at INTEGER,
       ends_at INTEGER,
       created_at INTEGER NOT NULL
     )`,
    // Creative is reviewed by a human before it can ever serve.
    `CREATE TABLE IF NOT EXISTS ad_creatives (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       campaign_id INTEGER NOT NULL,
       headline TEXT NOT NULL,
       body TEXT DEFAULT '',
       image_url TEXT DEFAULT '',
       cta_label TEXT DEFAULT 'Learn more',
       cta_url TEXT,
       factual_only INTEGER NOT NULL DEFAULT 0,
       review_status TEXT NOT NULL DEFAULT 'pending',
       review_note TEXT,
       reviewed_by INTEGER,
       reviewed_at INTEGER,
       created_at INTEGER NOT NULL
     )`,
    // Delivery log — powers frequency capping and the composition reporting
    // brands require under the industry codes.
    `CREATE TABLE IF NOT EXISTS ad_events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       creative_id INTEGER NOT NULL,
       campaign_id INTEGER NOT NULL,
       user_id INTEGER NOT NULL,
       kind TEXT NOT NULL,
       country_code TEXT,
       age_assured INTEGER NOT NULL DEFAULT 0,
       created_at INTEGER NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_adev_user_day ON ad_events (user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_adev_campaign ON ad_events (campaign_id, kind)`,

    // Age assurance attempts. We record the OUTCOME of a check and the
    // provider's opaque reference — never a document, image, or ID number.
    `CREATE TABLE IF NOT EXISTS age_checks (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       provider TEXT NOT NULL,
       provider_ref TEXT NOT NULL,
       method TEXT,
       status TEXT NOT NULL DEFAULT 'pending',
       age_band TEXT,
       level INTEGER NOT NULL DEFAULT 0,
       country_code TEXT,
       created_at INTEGER NOT NULL,
       resolved_at INTEGER
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_agecheck_ref ON age_checks (provider, provider_ref)`,
    `CREATE INDEX IF NOT EXISTS idx_agecheck_user ON age_checks (user_id, status)`,

    // Blocking — required by Apple guideline 1.2 and Google Play's UGC policy.
    // blocker_id no longer sees, or is seen by, blocked_id anywhere in the app.
    `CREATE TABLE IF NOT EXISTS blocked_users (
       blocker_id INTEGER NOT NULL,
       blocked_id INTEGER NOT NULL,
       created_at INTEGER NOT NULL,
       PRIMARY KEY (blocker_id, blocked_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_blocked_by ON blocked_users (blocker_id)`,
    `CREATE INDEX IF NOT EXISTS idx_blocked_of ON blocked_users (blocked_id)`,

    // Error reports from the server and the apps. Grouped by fingerprint so a
    // hundred occurrences of one bug are one row with a count, not a hundred
    // rows nobody reads.
    `CREATE TABLE IF NOT EXISTS error_reports (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       fingerprint TEXT NOT NULL UNIQUE,
       source TEXT NOT NULL,
       message TEXT NOT NULL,
       stack TEXT,
       route TEXT,
       platform TEXT,
       app_version TEXT,
       count INTEGER NOT NULL DEFAULT 1,
       users_affected INTEGER NOT NULL DEFAULT 0,
       status TEXT NOT NULL DEFAULT 'open',
       first_seen INTEGER NOT NULL,
       last_seen INTEGER NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_err_status ON error_reports (status, last_seen)`,
    // Which users hit which error, so users_affected is a real count rather
    // than a guess. Kept separate so the group row stays small.
    `CREATE TABLE IF NOT EXISTS error_occurrences (
       fingerprint TEXT NOT NULL,
       user_id INTEGER,
       created_at INTEGER NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_errocc ON error_occurrences (fingerprint, user_id)`,

    // Product analytics. First-party by design: no third-party SDK, no data
    // leaving our infrastructure, nothing to add to the privacy policy beyond
    // "we measure how the product is used".
    //
    // Deliberately NOT stored: IP addresses, post content, message text, or any
    // free-text a user typed. Events are a name plus small structured props.
    `CREATE TABLE IF NOT EXISTS analytics_events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER,
       anon_id TEXT,
       name TEXT NOT NULL,
       props TEXT,
       platform TEXT,
       country_code TEXT,
       session_id TEXT,
       created_at INTEGER NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_ae_name_time ON analytics_events (name, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ae_user_time ON analytics_events (user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ae_day ON analytics_events (created_at)`,

    // Native push tokens (Expo). Separate from push_subscriptions because web
    // push needs an endpoint + key pair, while Expo is a single opaque token.
    `CREATE TABLE IF NOT EXISTS device_tokens (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       token TEXT NOT NULL UNIQUE,
       platform TEXT,
       created_at INTEGER NOT NULL,
       last_seen INTEGER
     )`,
    `CREATE INDEX IF NOT EXISTS idx_devtok_user ON device_tokens (user_id)`,

    // Engagement engine — Web Push subscriptions (one row per device/endpoint)
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       endpoint TEXT NOT NULL UNIQUE,
       p256dh TEXT NOT NULL,
       auth TEXT NOT NULL,
       created_at INTEGER NOT NULL
     )`,
  ];
  for (const sql of securityTables) {
    try { await exec(sql); } catch (e) {
      if (!/already exists/i.test(String(e.message))) console.error('[db] security table error:', e.message);
    }
  }

  // Admin is granted only via scripts/promoteAdmin.js — no email-based escalation here

  // Seed demo data
  const row = await get('SELECT COUNT(*) as count FROM users');
  const count = row?.count || 0;

  // Demo seeding is expensive (bcrypt for every account) and has no place in a
  // real deployment. Skipped on Workers, where it would also risk the CPU limit
  // on whichever unlucky request triggers first-run initialisation.
  const skipSeed = process.env.SKIP_DEMO_SEED === '1'
    || (typeof globalThis.WebSocketPair !== 'undefined');

  if (count === 0 && !skipSeed) {
    const drinkSets = [
      '{"🥃":85,"🍷":60,"🍺":90,"🍹":70}',
      '{"🍹":95,"🥂":80,"🍸":70,"🥃":40}',
      '{"🍷":95,"🥂":85,"🥃":50,"🍹":60}',
      '{"🍺":95,"🥃":75,"🍹":40,"🍷":30}',
      '{"🍸":90,"🍹":85,"🥂":70,"🍷":50}',
      '{"🥃":90,"🥂":80,"🍷":70,"🍺":60}',
    ];

    const seedUsers = [
      { name: 'Arjun Sharma',   email: 'arjun@demo.com',  pass: 'demo123', title: 'CFO @ Boring Corp | Chief Fun Officer @ Weekends',       avatar: 'https://i.pravatar.cc/150?img=51' },
      { name: 'Priya Kapoor',   email: 'priya@demo.com',  pass: 'demo123', title: 'Head of Legal | Tequila Correspondent',                  avatar: 'https://i.pravatar.cc/150?img=47' },
      { name: 'Meera Lakhani',  email: 'meera@demo.com',  pass: 'demo123', title: 'Director of Operations | Sommelier in Training',         avatar: 'https://i.pravatar.cc/150?img=32' },
      { name: 'Dev Patel',      email: 'dev@demo.com',    pass: 'demo123', title: 'Senior Engineer | Craft Beer Analyst',                   avatar: 'https://i.pravatar.cc/150?img=59' },
      { name: 'Sneha Rao',      email: 'sneha@demo.com',  pass: 'demo123', title: 'Product Manager | Gin & Tonic Devotee',                  avatar: 'https://i.pravatar.cc/150?img=25' },
      { name: 'Vikram Tiwari',  email: 'vikram@demo.com', pass: 'demo123', title: 'CEO | Champagne Budget, Beer Reality',                   avatar: 'https://i.pravatar.cc/150?img=68' },
    ];

    const userIds = [];
    for (let i = 0; i < seedUsers.length; i++) {
      const u = seedUsers[i];
      const hash = bcrypt.hashSync(u.pass, 10);
      const { lastInsertRowid } = await run(
        'INSERT INTO users (name, email, password, title, avatar, drinks, onboarded) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [u.name, u.email, hash, u.title, u.avatar, drinkSets[i]]
      );
      userIds.push(lastInsertRowid);
    }

    const seedPosts = [
      { uid: userIds[0], content: "Just had the most insane whisky tasting in Shinjuku. 47-year-old Yamazaki.\n\nI've made better decisions in 2 hours of drinking than in 10 years of corporate meetings.\n\nReminder: Life is short. Order the good stuff. 🥃 #whisky #tokyo #lifeisshort #yamazaki", drink: '🥃', loc: '🇯🇵 Tokyo, Japan', img: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&q=80' },
      { uid: userIds[1], content: "3 things I've learned from tequila that no MBA could teach me:\n\n1. Always check the source (100% agave, no blends)\n2. The process matters more than the result\n3. Good company makes everything better\n\nCheers from Oaxaca 🌵 #tequila #oaxaca #lifelessons #travel", drink: '🍹', loc: '🇲🇽 Mexico City', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80' },
      { uid: userIds[2], content: "Spent a weekend in the vineyards of Bordeaux. No emails. No Slack. No synergy. Just wine, cheese, and actual human conversations.\n\nI forgot that trees exist. Highly recommend. #wine #bordeaux #digitaldetox #france", drink: '🍷', loc: '🇫🇷 Bordeaux, France', img: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&q=80' },
      { uid: userIds[3], content: "Oktoberfest was peak human achievement. I have not debugged a single line of code in 5 days. My brain is running on pretzels and lager.\n\nThis is what work-life balance actually looks like. 🍺🥨 #oktoberfest #munich #craftbeer #nocode", drink: '🍺', loc: '🇩🇪 Munich, Germany', img: 'https://images.unsplash.com/photo-1567696153798-9111f9cd3d0d?w=600&q=80' },
      { uid: userIds[4], content: "Rooftop sundowner in Bali with a gin & tonic that had 7 botanicals. My manager kept texting. I kept watching the sunset. 🌅\n\nGuess who won. #bali #ginandtonic #sundowner #rooftop #nowork", drink: '🍸', loc: '🇮🇩 Bali, Indonesia', img: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=600&q=80' },
      { uid: userIds[5], content: "Finally opened the 30-year Macallan I've been saving.\n\nPoured it for the team after we closed the deal. Not the business deal — the deal where we all agreed to stop pretending we enjoy networking events. 🥃✨ #macallan #whisky #nosmalltalk", drink: '🥃', loc: '📍 Mumbai, India', img: '' },
    ];

    const postIds = [];
    for (const p of seedPosts) {
      const { lastInsertRowid } = await run(
        'INSERT INTO posts (user_id, content, drink, location, image_url) VALUES (?, ?, ?, ?, ?)',
        [p.uid, p.content, p.drink, p.loc, p.img]
      );
      postIds.push(lastInsertRowid);
    }

    for (let i = 0; i < postIds.length; i++) {
      for (let j = 0; j < userIds.length; j++) {
        if (j !== i && Math.random() > 0.35) {
          try { await run('INSERT OR IGNORE INTO cheers (user_id, post_id) VALUES (?, ?)', [userIds[j], postIds[i]]); } catch {}
        }
      }
    }

    const drinks = ['🥃', '🍺', '🍷', '🍹', '🍸', '🥂'];
    for (let i = 0; i < userIds.length; i++) {
      await run('INSERT INTO stories (user_id, drink) VALUES (?, ?)', [userIds[i], drinks[i]]);
    }

    const seedEvents = [
      [userIds[0], 'Whisky Tasting Evening',  '2026-05-10', 'Mumbai, India',    '🥃'],
      [userIds[1], 'Rooftop Sundowner',        '2026-05-17', 'Bangalore, India', '🍸'],
      [userIds[2], 'Wine & Cheese Night',      '2026-05-24', 'Delhi, India',     '🍷'],
      [userIds[3], 'Craft Beer Festival',      '2026-06-07', 'Pune, India',      '🍺'],
    ];
    const eventIds = [];
    for (const e of seedEvents) {
      const { lastInsertRowid } = await run(
        'INSERT INTO events (user_id, title, date, location, drink) VALUES (?, ?, ?, ?, ?)', e
      );
      eventIds.push(lastInsertRowid);
    }
    for (let i = 0; i < eventIds.length; i++) {
      await run('INSERT OR IGNORE INTO event_rsvps (event_id, user_id) VALUES (?, ?)', [eventIds[i], seedEvents[i][0]]);
    }

    const seedGroups = [
      ['Whisky Society 🥃', 'For single malt lovers and blended believers alike', '🥃', userIds[0]],
      ['Mumbai Wine Circle 🍷', "The city's finest oenophiles, meeting monthly", '🍷', userIds[2]],
      ['Craft Beer Geeks 🍺', 'IPAs, stouts, sours — we love them all', '🍺', userIds[3]],
      ['Cocktail Creators 🍸', 'Shake it, stir it, garnish it', '🍸', userIds[4]],
    ];
    const groupIds = [];
    for (const g of seedGroups) {
      const { lastInsertRowid } = await run(
        'INSERT INTO drink_groups (name, description, drink_type, created_by) VALUES (?, ?, ?, ?)', g
      );
      groupIds.push(lastInsertRowid);
    }
    for (let gi = 0; gi < groupIds.length; gi++) {
      for (let ui = 0; ui < userIds.length; ui++) {
        const role = userIds[ui] === seedGroups[gi][3] ? 'admin' : (Math.random() > 0.4 ? 'member' : null);
        if (role) {
          try { await run('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupIds[gi], userIds[ui], role]); } catch {}
        }
      }
    }

    await run('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)', [groupIds[0], userIds[0], 'Anyone tried the new Glenfarclas 25? Picked it up in Edinburgh last week — incredible sherry notes. 🥃', '🥃']);
    await run('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)', [groupIds[0], userIds[5], 'Ardbeg Uigeadail is criminally underrated. Fight me.', '🥃']);
    await run('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)', [groupIds[1], userIds[2], 'Bordeaux 2019 vintage report: exceptional. If you see a Pauillac from this year, buy it. #wine', '🍷']);
    await run('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)', [groupIds[2], userIds[3], 'White Rhino from Brewbot Mumbai → absolutely crushes it for an Indian craft IPA. 9/10. 🍺', '🍺']);
    await run('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)', [groupIds[3], userIds[4], 'Hugo Spritz recipe: Elderflower liqueur + Prosecco + soda + mint + lime. Summer in a glass. 🍸', '🍸']);

    const ratingData = [
      [userIds[0], 'Yamazaki 18 Year', 'Suntory', 'Single Malt Whisky', 9.5, 'Dried fruits, coconut, vanilla', 'Rich sherry, plum jam, orange peel', 'Long, spiced, with gentle smoke', 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=300&q=60'],
      [userIds[0], 'Macallan 30 Year', 'The Macallan', 'Single Malt Whisky', 9.8, 'Christmas cake, dark chocolate', 'Dried fruits, old oak, leather', 'Extraordinarily long, warm spice', ''],
      [userIds[1], 'Don Julio 1942', 'Casa Don Julio', 'Tequila', 9.0, 'Agave, vanilla, caramel', 'Smooth, butterscotch, oak', 'Clean, warm, lingering vanilla', ''],
      [userIds[2], 'Château Pétrus 2015', 'Pétrus', 'Red Wine', 9.7, 'Truffle, plum, violets', 'Velvety tannins, blackcurrant, iron', 'Infinite, silky, minerally', ''],
      [userIds[3], 'Weihenstephaner Hefeweissbier', 'Weihenstephaner', 'Wheat Beer', 8.5, 'Banana, clove, fresh bread', 'Creamy, banana, mild spice', 'Refreshing, clean', ''],
    ];
    for (const r of ratingData) {
      await run('INSERT INTO drink_ratings (user_id, drink_name, distillery, drink_type, rating, nose, palate, finish, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', r);
    }

    const collData = [
      [userIds[0], 'Yamazaki 18', 'Suntory', '🥃 Single Malt', '2019', 9.5, 'Birthday gift. Waiting for a special occasion.'],
      [userIds[0], 'Macallan 30', 'The Macallan', '🥃 Single Malt', '2015', 9.8, 'The crown jewel of my collection.'],
      [userIds[5], 'Glenfarclas 25', 'Glenfarclas', '🥃 Single Malt', '2018', 9.2, 'Edinburgh airport find. Perfect sherry bomb.'],
    ];
    for (const c of collData) {
      await run('INSERT INTO collection (user_id, name, distillery, drink_type, vintage, rating, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', c);
    }

    const bucketData = [
      [userIds[0], 'Pappy Van Winkle 23 Year', 0],
      [userIds[0], 'Yamazaki 25 Year', 0],
      [userIds[0], 'Macallan 50 Year', 0],
      [userIds[0], 'Hibiki 30 Year', 1],
      [userIds[0], 'Ardbeg Supernova', 1],
    ];
    for (const b of bucketData) {
      await run('INSERT INTO bucket_list (user_id, drink_name, checked) VALUES (?, ?, ?)', b);
    }

    await run('INSERT INTO challenges (title, description, drink_emoji, end_date) VALUES (?, ?, ?, ?)', ["Try 5 New Craft Beers", "Explore 5 craft beers you've never had before this month", '🍺', '2026-05-31']);
    await run('INSERT INTO challenges (title, description, drink_emoji, end_date) VALUES (?, ?, ?, ?)', ['Whisky World Tour', 'Try a whisky from 3 different countries', '🥃', '2026-05-31']);
    await run('INSERT INTO challenges (title, description, drink_emoji, end_date) VALUES (?, ?, ?, ?)', ['Natural Wine Explorer', 'Discover 3 natural or biodynamic wines', '🍷', '2026-05-31']);

    const challenges = await all('SELECT id FROM challenges');
    if (challenges.length > 0) {
      for (const uid of userIds.slice(0, 4)) {
        try { await run('INSERT OR IGNORE INTO challenge_entries (challenge_id, user_id) VALUES (?, ?)', [challenges[0].id, uid]); } catch {}
      }
      for (const uid of userIds.slice(0, 2)) {
        try { await run('INSERT OR IGNORE INTO challenge_entries (challenge_id, user_id) VALUES (?, ?)', [challenges[1].id, uid]); } catch {}
      }
    }

    await run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [userIds[1], userIds[0], "Hey Arjun! That Yamazaki post was incredible. Where can I find it in Mumbai?"]);
    await run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [userIds[0], userIds[1], "Thanks Priya! Try Woodside Inn in Colaba — they stock it. A bit pricey but worth every rupee 🥃"]);
    await run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [userIds[1], userIds[0], "Perfect! Also coming to the whisky tasting on the 10th — see you there!"]);

    console.log('✅ Database seeded with full demo data');
  }

  // Re-seed events/groups/challenges for existing DBs missing them
  try {
    const evRow = await get('SELECT COUNT(*) as count FROM events');
    if ((evRow?.count || 0) === 0) {
      for (const e of [[1,'Whisky Tasting Evening','2026-05-10','Mumbai, India','🥃'],[2,'Rooftop Sundowner','2026-05-17','Bangalore, India','🍸'],[3,'Wine & Cheese Night','2026-05-24','Delhi, India','🍷'],[4,'Craft Beer Festival','2026-06-07','Pune, India','🍺']]) {
        await run('INSERT INTO events (user_id, title, date, location, drink) VALUES (?, ?, ?, ?, ?)', e);
      }
    }

    const gcRow = await get('SELECT COUNT(*) as count FROM drink_groups');
    if ((gcRow?.count || 0) === 0) {
      const gids = [];
      for (const g of [['Whisky Society 🥃','For single malt lovers','🥃',1],['Mumbai Wine Circle 🍷','The city finest oenophiles','🍷',3],['Craft Beer Geeks 🍺','IPAs, stouts, sours','🍺',4],['Cocktail Creators 🍸','Shake it, stir it','🍸',5]]) {
        const { lastInsertRowid } = await run('INSERT INTO drink_groups (name, description, drink_type, created_by) VALUES (?, ?, ?, ?)', g);
        gids.push(lastInsertRowid);
      }
      const uids = (await all('SELECT id FROM users LIMIT 6')).map(u => u.id);
      for (let gi = 0; gi < gids.length; gi++) {
        for (let ui = 0; ui < uids.length; ui++) {
          try { await run('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [gids[gi], uids[ui], ui === gi ? 'admin' : 'member']); } catch {}
        }
      }
      await run('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)', [gids[0], 1, "Anyone tried the new Glenfarclas 25? Incredible sherry notes. 🥃", '🥃']);
      await run('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)', [gids[1], 3, "Bordeaux 2019 vintage: exceptional. Buy any Pauillac you see. #wine", '🍷']);
      await run('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)', [gids[2], 4, "White Rhino from Brewbot Mumbai — 9/10 for an Indian craft IPA 🍺", '🍺']);
      await run('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)', [gids[3], 5, "Hugo Spritz recipe: Elderflower + Prosecco + mint + lime 🍸", '🍸']);
    }

    const ccRow = await get('SELECT COUNT(*) as count FROM challenges');
    if ((ccRow?.count || 0) === 0) {
      await run('INSERT INTO challenges (title, description, drink_emoji, end_date) VALUES (?, ?, ?, ?)', ["Try 5 New Craft Beers", "Explore 5 craft beers you've never had before", '🍺', '2026-05-31']);
      await run('INSERT INTO challenges (title, description, drink_emoji, end_date) VALUES (?, ?, ?, ?)', ['Whisky World Tour', 'Try a whisky from 3 different countries', '🥃', '2026-05-31']);
      await run('INSERT INTO challenges (title, description, drink_emoji, end_date) VALUES (?, ?, ?, ?)', ['Natural Wine Explorer', 'Discover 3 natural or biodynamic wines', '🍷', '2026-05-31']);
    }

    const rcRow = await get('SELECT COUNT(*) as count FROM drink_ratings');
    if ((rcRow?.count || 0) === 0) {
      await run('INSERT INTO drink_ratings (user_id, drink_name, distillery, drink_type, rating, nose, palate, finish) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [1,'Yamazaki 18 Year','Suntory','Single Malt Whisky',9.5,'Dried fruits, coconut','Rich sherry, plum jam','Long, spiced']);
      await run('INSERT INTO drink_ratings (user_id, drink_name, distillery, drink_type, rating, nose, palate, finish) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [1,'Macallan 30 Year','The Macallan','Single Malt Whisky',9.8,'Christmas cake','Dried fruits, old oak','Extraordinarily long']);
      await run('INSERT INTO drink_ratings (user_id, drink_name, distillery, drink_type, rating, nose, palate, finish) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [2,'Don Julio 1942','Casa Don Julio','Tequila',9.0,'Agave, vanilla','Smooth, butterscotch','Clean, warm']);
    }

    const collcRow = await get('SELECT COUNT(*) as count FROM collection');
    if ((collcRow?.count || 0) === 0) {
      await run('INSERT INTO collection (user_id, name, distillery, drink_type, vintage, rating, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', [1,'Yamazaki 18','Suntory','🥃 Single Malt','2019',9.5,'Birthday gift.']);
      await run('INSERT INTO collection (user_id, name, distillery, drink_type, vintage, rating, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', [1,'Macallan 30','The Macallan','🥃 Single Malt','2015',9.8,'Crown jewel of my collection.']);
    }

    const blcRow = await get('SELECT COUNT(*) as count FROM bucket_list');
    if ((blcRow?.count || 0) === 0) {
      await run('INSERT INTO bucket_list (user_id, drink_name, checked) VALUES (?, ?, ?)', [1,'Pappy Van Winkle 23 Year',0]);
      await run('INSERT INTO bucket_list (user_id, drink_name, checked) VALUES (?, ?, ?)', [1,'Yamazaki 25 Year',0]);
      await run('INSERT INTO bucket_list (user_id, drink_name, checked) VALUES (?, ?, ?)', [1,'Hibiki 30 Year',1]);
      await run('INSERT INTO bucket_list (user_id, drink_name, checked) VALUES (?, ?, ?)', [1,'Ardbeg Supernova',1]);
    }

    const msgcRow = await get('SELECT COUNT(*) as count FROM messages');
    if ((msgcRow?.count || 0) === 0) {
      await run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [2,1,"Hey! That Yamazaki post was incredible. Where can I find it in Mumbai?"]);
      await run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [1,2,"Try Woodside Inn in Colaba — they stock it. Worth every rupee 🥃"]);
    }

    // Mark all users onboarded with drinks
    const users = await all('SELECT id, drinks FROM users');
    const defaultDrinkSets = ['{"🥃":85,"🍷":60,"🍺":90,"🍹":70}','{"🍹":95,"🥂":80,"🍸":70,"🥃":40}','{"🍷":95,"🥂":85,"🥃":50,"🍹":60}','{"🍺":95,"🥃":75,"🍹":40,"🍷":30}','{"🍸":90,"🍹":85,"🥂":70,"🍷":50}','{"🥃":90,"🥂":80,"🍷":70,"🍺":60}'];
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const hasDrinks = u.drinks && u.drinks !== '{}';
      if (hasDrinks) {
        await run('UPDATE users SET onboarded = 1 WHERE id = ?', [u.id]);
      } else {
        await run('UPDATE users SET onboarded = 1, drinks = ? WHERE id = ?', [defaultDrinkSets[i % 6], u.id]);
      }
    }

    // Seed lat/lng for existing posts with known locations
    const locCoords = {
      '🇯🇵 Tokyo, Japan':       [35.6762, 139.6503],
      '🇲🇽 Mexico City':        [19.4326, -99.1332],
      '🇫🇷 Bordeaux, France':   [44.8378, -0.5792],
      '🇩🇪 Munich, Germany':    [48.1351, 11.5820],
      '🇮🇩 Bali, Indonesia':    [-8.3405, 115.0920],
      '📍 Mumbai, India':        [19.0760,  72.8777],
      '🇬🇧 London, UK':         [51.5074,  -0.1278],
      '📍 Bangalore, India':     [12.9716,  77.5946],
      '🇫🇷 Paris, France':      [48.8566,   2.3522],
      '🇬🇷 Santorini, Greece':  [36.3932,  25.4615],
      '🇮🇹 Tuscany, Italy':     [43.7711,  11.2486],
      '🇲🇽 Oaxaca, Mexico':     [17.0732,  -96.7266],
      '📍 Hyderabad, India':     [17.3850,  78.4867],
      '📍 Delhi, India':         [28.6139,  77.2090],
      '📍 Pune, India':          [18.5204,  73.8567],
      '📍 Goa, India':           [15.2993,  74.1240],
      '🇵🇹 Lisbon, Portugal':   [38.7223,  -9.1393],
    };
    for (const [loc, [lat, lng]] of Object.entries(locCoords)) {
      await run('UPDATE posts SET lat=?, lng=? WHERE location=? AND lat IS NULL', [lat, lng, loc]);
    }

  } catch (e) { console.error('Migration error:', e.message); }

  // Backchodi posts — add if fewer than 15 posts exist
  try {
    const pcRow = await get('SELECT COUNT(*) as count FROM posts');
    if ((pcRow?.count || 0) < 15) {
      const uids = (await all('SELECT id FROM users LIMIT 6')).map(u => u.id);
      const [u1, u2, u3, u4, u5, u6] = uids;

      const backchodiPosts = [
        [u1, `Just submitted my Q3 performance review.\n\nKey achievements:\n✅ Tried 23 new whiskeys\n✅ Found 4 bars that open at 11am\n✅ Convinced my team that a 'walking meeting' means walking to the nearest bar\n\nSeeking salary appraisal. DMs open. 🥃\n\n#performance #leadership #results #whisky`, '🥃', '📍 Mumbai, India', ''],
        [u2, `Hot take: The best way to 'disrupt the industry' is to show up slightly tipped to the client meeting.\n\nSuddenly everyone is 'aligned.' The deck 'makes sense.' The budget gets approved.\n\nI have 11 years of qualitative data. Will share for the price of one good tequila. 🌵\n\n#thoughtleadership #disruption #data`, '🍹', '🇲🇽 Mexico City', 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80'],
        [u4, `My startup pitch:\n\nAn app that replaces your morning standup with a pub quiz question.\n\nSame amount of actual work gets done. Team morale goes from 2/10 to 9/10. Burnout drops 100%.\n\nSeeking $2M seed. I already have 6 co-founders. We are all at the pub right now. 🍺\n\n#startup #funding #innovation #novc`, '🍺', '🇬🇧 London, UK', ''],
        [u5, `Day 1 of quitting alcohol:\nLost 2 clients. Missed a deadline. Got a parking ticket. Argued with the printer.\n\nDay 2: Back on it. 🍸\n\nCorrelation is not causation but I am not taking that chance.\n\n#wellness #balance #gin #selfcare`, '🍸', '📍 Bangalore, India', ''],
        [u6, `CEO update:\n\nQ1 goals were:\n1. Scale the product ✅\n2. Grow the team ✅\n3. Drink less ❌\n\n2 out of 3 ain't bad. Investors are very excited about our vision. Board dinner is at a wine bar. Progress. 🥂\n\n#leadership #transparency #vision`, '🥂', '🇫🇷 Paris, France', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80'],
        [u1, `My therapist asked what makes me feel at peace.\n\nI showed her my bar cart.\n\nShe said that's concerning. I poured her a small Lagavulin.\n\nShe asked for the name of the distillery.\n\nWe're both doing much better now. 🥃\n\n#mentalhealth #therapy #whisky #growth`, '🥃', '📍 Mumbai, India', ''],
        [u2, `Unpopular opinion:\n\n'Networking events' would have 400% better ROI if they served good tequila instead of warm chardonnay in plastic cups.\n\nI have slides. I have data. I have receipts from 47 networking events.\n\nPing me. Let's disrupt the industry. 🌵\n\n#networking #thoughtleadership #tequila`, '🍹', '📍 Delhi, India', ''],
        [u4, `Bought a ₹40,000 Japanese chef's knife.\n\nImmediately used it to cut limes for gin & tonics.\n\nNo regrets. Zero. The knife understands its true calling. It has never been happier.\n\nThis is what finding purpose looks like. 🍸\n\n#japaneseknife #priorities #gin #invest`, '🍸', '📍 Pune, India', ''],
        [u5, `My 5-year plan:\n\nYear 1: More rosé\nYear 2: More rosé but in nicer places\nYear 3: More rosé in places that have a view\nYear 4: Be known for having good rosé taste\nYear 5: Still be doing this, with the same people\n\nCurrently on Year 3. Absolutely crushing it. 🥂\n\n#goals #planning #rosé #vision`, '🥂', '🇬🇷 Santorini, Greece', 'https://images.unsplash.com/photo-1560148271-8b4d7df01c06?w=600&q=80'],
        [u3, `Types of wine person:\n\nA) Actually knows wine\nB) Pretends to know wine\nC) Just really likes wine and doesn't care about A or B\n\nI am C. I have been C for 12 years. I will die C.\n\nC is the best type. Find yourself a C. Be the C.\n\n🍷\n\n#wine #bordeaux #authentic #nosommelier`, '🍷', '🇫🇷 Bordeaux, France', ''],
        [u1, `Life hack nobody asked for:\n\nReplace 'synergy' with 'drinks' in any corporate email and re-read it.\n\n"Let's create some synergy" → "Let's create some drinks"\n"We need synergy across teams" → "We need drinks across teams"\n"Our synergy is off the charts" → absolute poetry\n\nYou're welcome. 🥃\n\n#productivity #corporate #synergy #lifehack`, '🥃', '📍 Mumbai, India', ''],
        [u2, `Just learned the actual difference between mezcal and tequila.\n\nI have been ordering the wrong one for 6 years.\n\nThis is the single most valuable piece of knowledge I have acquired in my entire 14-year career. My MBA has nothing on this moment.\n\n🌵 #mezcal #tequila #learning #nevertooolate`, '🍹', '🇲🇽 Oaxaca, Mexico', 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80'],
        [u4, `Wrote 400 lines of code. Deployed to prod. Everything worked on first try.\n\nClosed laptop.\n\nOpened a cold craft IPA.\n\nIn exactly that order.\n\nThis is what peak developer performance looks like. Nobody talks about this in engineering bootcamps. 🍺\n\n#coding #craftbeer #developer #peakperformance`, '🍺', '📍 Hyderabad, India', ''],
        [u6, `Asked ChatGPT what pairs well with a 25-year Scotch.\n\nIt said: "Perhaps a good book and a fireplace."\n\nI closed the tab. Called Arjun. We figured it out ourselves.\n\nAI has limits. Friends with good taste do not. 🥃\n\n#whisky #ai #friendship #scotch`, '🥃', '📍 Mumbai, India', ''],
        [u3, `The 5 stages of wine tasting:\n\n1. "I'm definitely getting dark fruits"\n2. "Actually... is that leather?"\n3. "I'm getting pencil shavings. Is anyone else getting pencil shavings?"\n4. "I think this is the greatest thing I've ever tasted"\n5. "Can I have more please"\n\nRepeat until enlightened. 🍷\n\n#winetasting #sommelier #france #wine`, '🍷', '🇮🇹 Tuscany, Italy', 'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=600&q=80'],
        [u5, `Convinced my entire team that stand-up meetings are more productive at a bar.\n\nWe are now 45 minutes into a heated debate about whether pineapple belongs in a Margarita.\n\nZero work discussed. Morale is the highest it has ever been.\n\nBest. Stand-up. Ever. 🍹\n\n#agile #standup #teamwork #margarita #pineapple`, '🍹', '📍 Goa, India', 'https://images.unsplash.com/photo-1609345265499-2133bbeb6ce5?w=600&q=80'],
        [u6, `Honest out-of-office reply I want to send:\n\n"I am on leave. I am at a rooftop bar in Lisbon. There is excellent wine. There is a view of the Tagus river. I am not checking email. I am not 'looping back'. I am not 'circling'. I am DRINKING.\n\nReturn date: When the wine runs out.\n\nUrgent matters: Still not my problem."\n\n🥂✈️ #pto #outofoffice #lisbon #wine #nosynergy`, '🥂', '🇵🇹 Lisbon, Portugal', 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&q=80'],
      ];

      for (const [uid, content, drink, loc, img] of backchodiPosts) {
        const { lastInsertRowid: pid } = await run(
          'INSERT INTO posts (user_id, content, drink, location, image_url) VALUES (?, ?, ?, ?, ?)',
          [uid, content, drink, loc, img]
        );
        for (const cuid of uids) {
          if (cuid !== uid && Math.random() > 0.3) {
            try { await run('INSERT OR IGNORE INTO cheers (user_id, post_id) VALUES (?, ?)', [cuid, pid]); } catch {}
          }
        }
      }
      console.log('✅ Backchodi posts seeded');
    }
  } catch (e) { console.error('Backchodi seed error:', e.message); }

  console.log('✅ DB init complete');
}

// `client` is exposed as a getter so callers still work, but nothing is
// constructed until it is actually touched.
module.exports = {
  get client() { return client_(); },
  get, all, run, exec, batch, init,
};
