const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'drinkeden.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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
`);

// Safe migrations for existing DBs
const migrations = [
  `ALTER TABLE users ADD COLUMN drinks TEXT DEFAULT '{}'`,
  `ALTER TABLE users ADD COLUMN onboarded INTEGER DEFAULT 0`,
  `ALTER TABLE posts ADD COLUMN has_poll INTEGER DEFAULT 0`,
];
migrations.forEach(sql => { try { db.exec(sql); } catch {} });

// Seed demo data
const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (count === 0) {
  const insertUser = db.prepare('INSERT INTO users (name, email, password, title, avatar, drinks, onboarded) VALUES (?, ?, ?, ?, ?, ?, 1)');
  const insertPost = db.prepare('INSERT INTO posts (user_id, content, drink, location, image_url) VALUES (?, ?, ?, ?, ?)');
  const insertStory = db.prepare('INSERT INTO stories (user_id, drink) VALUES (?, ?)');
  const insertCheer = db.prepare('INSERT INTO cheers (user_id, post_id) VALUES (?, ?)');
  const insertEvent = db.prepare('INSERT INTO events (user_id, title, date, location, drink) VALUES (?, ?, ?, ?, ?)');
  const insertGroup = db.prepare('INSERT INTO drink_groups (name, description, drink_type, created_by) VALUES (?, ?, ?, ?)');
  const insertMember = db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)');
  const insertChallenge = db.prepare('INSERT INTO challenges (title, description, drink_emoji, end_date) VALUES (?, ?, ?, ?)');

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

  const userIds = seedUsers.map((u, i) => {
    const hash = bcrypt.hashSync(u.pass, 10);
    return insertUser.run(u.name, u.email, hash, u.title, u.avatar, drinkSets[i]).lastInsertRowid;
  });

  const seedPosts = [
    { uid: userIds[0], content: "Just had the most insane whisky tasting in Shinjuku. 47-year-old Yamazaki.\n\nI've made better decisions in 2 hours of drinking than in 10 years of corporate meetings.\n\nReminder: Life is short. Order the good stuff. 🥃 #whisky #tokyo #lifeisshort #yamazaki", drink: '🥃', loc: '🇯🇵 Tokyo, Japan', img: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&q=80' },
    { uid: userIds[1], content: "3 things I've learned from tequila that no MBA could teach me:\n\n1. Always check the source (100% agave, no blends)\n2. The process matters more than the result\n3. Good company makes everything better\n\nCheers from Oaxaca 🌵 #tequila #oaxaca #lifelessons #travel", drink: '🍹', loc: '🇲🇽 Mexico City', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80' },
    { uid: userIds[2], content: "Spent a weekend in the vineyards of Bordeaux. No emails. No Slack. No synergy. Just wine, cheese, and actual human conversations.\n\nI forgot that trees exist. Highly recommend. #wine #bordeaux #digitaldetox #france", drink: '🍷', loc: '🇫🇷 Bordeaux, France', img: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&q=80' },
    { uid: userIds[3], content: "Oktoberfest was peak human achievement. I have not debugged a single line of code in 5 days. My brain is running on pretzels and lager.\n\nThis is what work-life balance actually looks like. 🍺🥨 #oktoberfest #munich #craftbeer #nocode", drink: '🍺', loc: '🇩🇪 Munich, Germany', img: 'https://images.unsplash.com/photo-1567696153798-9111f9cd3d0d?w=600&q=80' },
    { uid: userIds[4], content: "Rooftop sundowner in Bali with a gin & tonic that had 7 botanicals. My manager kept texting. I kept watching the sunset. 🌅\n\nGuess who won. #bali #ginandtonic #sundowner #rooftop #nowork", drink: '🍸', loc: '🇮🇩 Bali, Indonesia', img: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=600&q=80' },
    { uid: userIds[5], content: "Finally opened the 30-year Macallan I've been saving.\n\nPoured it for the team after we closed the deal. Not the business deal — the deal where we all agreed to stop pretending we enjoy networking events. 🥃✨ #macallan #whisky #nosmalltalk", drink: '🥃', loc: '📍 Mumbai, India', img: '' },
  ];

  const postIds = seedPosts.map(p => insertPost.run(p.uid, p.content, p.drink, p.loc, p.img).lastInsertRowid);

  for (let i = 0; i < postIds.length; i++) {
    for (let j = 0; j < userIds.length; j++) {
      if (j !== i && Math.random() > 0.35) { try { insertCheer.run(userIds[j], postIds[i]); } catch {} }
    }
  }

  const drinks = ['🥃', '🍺', '🍷', '🍹', '🍸', '🥂'];
  userIds.forEach((uid, i) => insertStory.run(uid, drinks[i]));

  const seedEvents = [
    [userIds[0], 'Whisky Tasting Evening',  '2026-05-10', 'Mumbai, India',    '🥃'],
    [userIds[1], 'Rooftop Sundowner',        '2026-05-17', 'Bangalore, India', '🍸'],
    [userIds[2], 'Wine & Cheese Night',      '2026-05-24', 'Delhi, India',     '🍷'],
    [userIds[3], 'Craft Beer Festival',      '2026-06-07', 'Pune, India',      '🍺'],
  ];
  const eventIds = seedEvents.map(e => insertEvent.run(...e).lastInsertRowid);
  // Auto-RSVP creators
  const insertRsvp = db.prepare('INSERT OR IGNORE INTO event_rsvps (event_id, user_id) VALUES (?, ?)');
  eventIds.forEach((eid, i) => insertRsvp.run(eid, seedEvents[i][0]));

  // Seed groups
  const seedGroups = [
    ['Whisky Society 🥃', 'For single malt lovers and blended believers alike', '🥃', userIds[0]],
    ['Mumbai Wine Circle 🍷', 'The city\'s finest oenophiles, meeting monthly', '🍷', userIds[2]],
    ['Craft Beer Geeks 🍺', 'IPAs, stouts, sours — we love them all', '🍺', userIds[3]],
    ['Cocktail Creators 🍸', 'Shake it, stir it, garnish it', '🍸', userIds[4]],
  ];
  const groupIds = seedGroups.map(g => insertGroup.run(...g).lastInsertRowid);
  groupIds.forEach((gid, gi) => {
    userIds.forEach((uid, ui) => {
      const role = uid === seedGroups[gi][3] ? 'admin' : (Math.random() > 0.4 ? 'member' : null);
      if (role) try { insertMember.run(gid, uid, role); } catch {}
    });
  });

  // Seed group posts
  const insertGPost = db.prepare('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)');
  insertGPost.run(groupIds[0], userIds[0], 'Anyone tried the new Glenfarclas 25? Picked it up in Edinburgh last week — incredible sherry notes. 🥃', '🥃');
  insertGPost.run(groupIds[0], userIds[5], 'Ardbeg Uigeadail is criminally underrated. Fight me.', '🥃');
  insertGPost.run(groupIds[1], userIds[2], 'Bordeaux 2019 vintage report: exceptional. If you see a Pauillac from this year, buy it. #wine', '🍷');
  insertGPost.run(groupIds[2], userIds[3], 'White Rhino from Brewbot Mumbai → absolutely crushes it for an Indian craft IPA. 9/10. 🍺', '🍺');
  insertGPost.run(groupIds[3], userIds[4], 'Hugo Spritz recipe: Elderflower liqueur + Prosecco + soda + mint + lime. Summer in a glass. 🍸', '🍸');

  // Seed drink ratings
  const insertRating = db.prepare('INSERT INTO drink_ratings (user_id, drink_name, distillery, drink_type, rating, nose, palate, finish, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertRating.run(userIds[0], 'Yamazaki 18 Year', 'Suntory', 'Single Malt Whisky', 9.5, 'Dried fruits, coconut, vanilla', 'Rich sherry, plum jam, orange peel', 'Long, spiced, with gentle smoke', 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=300&q=60');
  insertRating.run(userIds[0], 'Macallan 30 Year', 'The Macallan', 'Single Malt Whisky', 9.8, 'Christmas cake, dark chocolate', 'Dried fruits, old oak, leather', 'Extraordinarily long, warm spice', '');
  insertRating.run(userIds[1], 'Don Julio 1942', 'Casa Don Julio', 'Tequila', 9.0, 'Agave, vanilla, caramel', 'Smooth, butterscotch, oak', 'Clean, warm, lingering vanilla', '');
  insertRating.run(userIds[2], 'Château Pétrus 2015', 'Pétrus', 'Red Wine', 9.7, 'Truffle, plum, violets', 'Velvety tannins, blackcurrant, iron', 'Infinite, silky, minerally', '');
  insertRating.run(userIds[3], 'Weihenstephaner Hefeweissbier', 'Weihenstephaner', 'Wheat Beer', 8.5, 'Banana, clove, fresh bread', 'Creamy, banana, mild spice', 'Refreshing, clean', '');

  // Seed collection
  const insertColl = db.prepare('INSERT INTO collection (user_id, name, distillery, drink_type, vintage, rating, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertColl.run(userIds[0], 'Yamazaki 18', 'Suntory', '🥃 Single Malt', '2019', 9.5, 'Birthday gift. Waiting for a special occasion.');
  insertColl.run(userIds[0], 'Macallan 30', 'The Macallan', '🥃 Single Malt', '2015', 9.8, 'The crown jewel of my collection.');
  insertColl.run(userIds[5], 'Glenfarclas 25', 'Glenfarclas', '🥃 Single Malt', '2018', 9.2, 'Edinburgh airport find. Perfect sherry bomb.');

  // Seed bucket list
  const insertBucket = db.prepare('INSERT INTO bucket_list (user_id, drink_name, checked) VALUES (?, ?, ?)');
  insertBucket.run(userIds[0], 'Pappy Van Winkle 23 Year', 0);
  insertBucket.run(userIds[0], 'Yamazaki 25 Year', 0);
  insertBucket.run(userIds[0], 'Macallan 50 Year', 0);
  insertBucket.run(userIds[0], 'Hibiki 30 Year', 1);
  insertBucket.run(userIds[0], 'Ardbeg Supernova', 1);

  // Seed monthly challenges
  insertChallenge.run('Try 5 New Craft Beers', 'Explore 5 craft beers you\'ve never had before this month', '🍺', '2026-05-31');
  insertChallenge.run('Whisky World Tour', 'Try a whisky from 3 different countries', '🥃', '2026-05-31');
  insertChallenge.run('Natural Wine Explorer', 'Discover 3 natural or biodynamic wines', '🍷', '2026-05-31');

  // Seed some challenge entries
  const insertEntry = db.prepare('INSERT OR IGNORE INTO challenge_entries (challenge_id, user_id) VALUES (?, ?)');
  const challenges = db.prepare('SELECT id FROM challenges').all();
  if (challenges.length > 0) {
    userIds.slice(0, 4).forEach(uid => { try { insertEntry.run(challenges[0].id, uid); } catch {} });
    userIds.slice(0, 2).forEach(uid => { try { insertEntry.run(challenges[1].id, uid); } catch {} });
  }

  // Seed messages
  const insertMsg = db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)');
  insertMsg.run(userIds[1], userIds[0], "Hey Arjun! That Yamazaki post was incredible. Where can I find it in Mumbai?");
  insertMsg.run(userIds[0], userIds[1], "Thanks Priya! Try Woodside Inn in Colaba — they stock it. A bit pricey but worth every rupee 🥃");
  insertMsg.run(userIds[1], userIds[0], "Perfect! Also coming to the whisky tasting on the 10th — see you there!");

  console.log('✅ Database seeded with full demo data');
}

// Re-seed events/groups/challenges for existing DBs missing them
try {
  const { count: ec } = db.prepare('SELECT COUNT(*) as count FROM events').get();
  if (ec === 0) {
    const ins = db.prepare('INSERT INTO events (user_id, title, date, location, drink) VALUES (?, ?, ?, ?, ?)');
    [[1,'Whisky Tasting Evening','2026-05-10','Mumbai, India','🥃'],[2,'Rooftop Sundowner','2026-05-17','Bangalore, India','🍸'],[3,'Wine & Cheese Night','2026-05-24','Delhi, India','🍷'],[4,'Craft Beer Festival','2026-06-07','Pune, India','🍺']].forEach(e => ins.run(...e));
  }
  const { count: gc } = db.prepare('SELECT COUNT(*) as count FROM drink_groups').get();
  if (gc === 0) {
    const ig = db.prepare('INSERT INTO drink_groups (name, description, drink_type, created_by) VALUES (?, ?, ?, ?)');
    const im = db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)');
    const igp = db.prepare('INSERT INTO group_posts (group_id, user_id, content, drink) VALUES (?, ?, ?, ?)');
    const gids = [
      ig.run('Whisky Society 🥃','For single malt lovers','🥃',1).lastInsertRowid,
      ig.run('Mumbai Wine Circle 🍷','The city finest oenophiles','🍷',3).lastInsertRowid,
      ig.run('Craft Beer Geeks 🍺','IPAs, stouts, sours','🍺',4).lastInsertRowid,
      ig.run('Cocktail Creators 🍸','Shake it, stir it','🍸',5).lastInsertRowid,
    ];
    const uids = db.prepare('SELECT id FROM users LIMIT 6').all().map(u=>u.id);
    gids.forEach((gid,gi) => {
      uids.forEach((uid,ui) => { try { im.run(gid,uid,ui===gi?'admin':'member'); } catch {} });
    });
    igp.run(gids[0],1,"Anyone tried the new Glenfarclas 25? Incredible sherry notes. 🥃",'🥃');
    igp.run(gids[1],3,"Bordeaux 2019 vintage: exceptional. Buy any Pauillac you see. #wine",'🍷');
    igp.run(gids[2],4,"White Rhino from Brewbot Mumbai — 9/10 for an Indian craft IPA 🍺",'🍺');
    igp.run(gids[3],5,"Hugo Spritz recipe: Elderflower + Prosecco + mint + lime 🍸",'🍸');
  }
  const { count: cc } = db.prepare('SELECT COUNT(*) as count FROM challenges').get();
  if (cc === 0) {
    const ic = db.prepare('INSERT INTO challenges (title, description, drink_emoji, end_date) VALUES (?, ?, ?, ?)');
    ic.run('Try 5 New Craft Beers',"Explore 5 craft beers you've never had before",'🍺','2026-05-31');
    ic.run('Whisky World Tour','Try a whisky from 3 different countries','🥃','2026-05-31');
    ic.run('Natural Wine Explorer','Discover 3 natural or biodynamic wines','🍷','2026-05-31');
  }
  const { count: rc } = db.prepare('SELECT COUNT(*) as count FROM drink_ratings').get();
  if (rc === 0) {
    const ir = db.prepare('INSERT INTO drink_ratings (user_id, drink_name, distillery, drink_type, rating, nose, palate, finish) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    ir.run(1,'Yamazaki 18 Year','Suntory','Single Malt Whisky',9.5,'Dried fruits, coconut','Rich sherry, plum jam','Long, spiced');
    ir.run(1,'Macallan 30 Year','The Macallan','Single Malt Whisky',9.8,'Christmas cake','Dried fruits, old oak','Extraordinarily long');
    ir.run(2,'Don Julio 1942','Casa Don Julio','Tequila',9.0,'Agave, vanilla','Smooth, butterscotch','Clean, warm');
  }
  const { count: collc } = db.prepare('SELECT COUNT(*) as count FROM collection').get();
  if (collc === 0) {
    const ico = db.prepare('INSERT INTO collection (user_id, name, distillery, drink_type, vintage, rating, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    ico.run(1,'Yamazaki 18','Suntory','🥃 Single Malt','2019',9.5,'Birthday gift.');
    ico.run(1,'Macallan 30','The Macallan','🥃 Single Malt','2015',9.8,'Crown jewel of my collection.');
  }
  const { count: blc } = db.prepare('SELECT COUNT(*) as count FROM bucket_list').get();
  if (blc === 0) {
    const ibl = db.prepare('INSERT INTO bucket_list (user_id, drink_name, checked) VALUES (?, ?, ?)');
    ibl.run(1,'Pappy Van Winkle 23 Year',0); ibl.run(1,'Yamazaki 25 Year',0);
    ibl.run(1,'Hibiki 30 Year',1); ibl.run(1,'Ardbeg Supernova',1);
  }
  const { count: msgc } = db.prepare('SELECT COUNT(*) as count FROM messages').get();
  if (msgc === 0) {
    const imsg = db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)');
    imsg.run(2,1,"Hey! That Yamazaki post was incredible. Where can I find it in Mumbai?");
    imsg.run(1,2,"Try Woodside Inn in Colaba — they stock it. Worth every rupee 🥃");
  }
  // Mark all users onboarded with drinks
  const users = db.prepare('SELECT id, drinks FROM users').all();
  const defaultDrinkSets = ['{"🥃":85,"🍷":60,"🍺":90,"🍹":70}','{"🍹":95,"🥂":80,"🍸":70,"🥃":40}','{"🍷":95,"🥂":85,"🥃":50,"🍹":60}','{"🍺":95,"🥃":75,"🍹":40,"🍷":30}','{"🍸":90,"🍹":85,"🥂":70,"🍷":50}','{"🥃":90,"🥂":80,"🍷":70,"🍺":60}'];
  users.forEach((u, i) => {
    const hasDrinks = u.drinks && u.drinks !== '{}';
    db.prepare('UPDATE users SET onboarded = 1' + (hasDrinks ? '' : ', drinks = ?') + ' WHERE id = ?').run(...(hasDrinks ? [u.id] : [defaultDrinkSets[i % 6], u.id]));
  });
  // lat/lng migration
  try { db.exec('ALTER TABLE posts ADD COLUMN lat REAL DEFAULT NULL'); } catch {}
  try { db.exec('ALTER TABLE posts ADD COLUMN lng REAL DEFAULT NULL'); } catch {}

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
  Object.entries(locCoords).forEach(([loc, [lat, lng]]) => {
    db.prepare('UPDATE posts SET lat=?, lng=? WHERE location=? AND lat IS NULL').run(lat, lng, loc);
  });

} catch (e) { console.error('Migration error:', e.message); }

// ── Backchodi posts — add if fewer than 15 posts exist ──────────────────────
try {
  const { count: pc } = db.prepare('SELECT COUNT(*) as count FROM posts').get();
  if (pc < 15) {
    const ip = db.prepare('INSERT INTO posts (user_id, content, drink, location, image_url) VALUES (?, ?, ?, ?, ?)');
    const uids = db.prepare('SELECT id FROM users LIMIT 6').all().map(u => u.id);
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
      [u5, `My 5-year plan:\n\nYear 1: More rosé\nYear 2: More rosé but in nicer places\nYear 3: More rosé in places that have a view\nYear 4: Be known for having good rosé taste\nYear 5: Write a LinkedIn post about my rosé journey\n\nCurrently on Year 3. Absolutely crushing it. 🥂\n\n#goals #planning #rosé #vision`, '🥂', '🇬🇷 Santorini, Greece', 'https://images.unsplash.com/photo-1560148271-8b4d7df01c06?w=600&q=80'],
      [u3, `Types of wine person:\n\nA) Actually knows wine\nB) Pretends to know wine\nC) Just really likes wine and doesn't care about A or B\n\nI am C. I have been C for 12 years. I will die C.\n\nC is the best type. Find yourself a C. Be the C.\n\n🍷\n\n#wine #bordeaux #authentic #nosommelier`, '🍷', '🇫🇷 Bordeaux, France', ''],
      [u1, `Life hack nobody asked for:\n\nReplace 'synergy' with 'drinks' in any corporate email and re-read it.\n\n"Let's create some synergy" → "Let's create some drinks"\n"We need synergy across teams" → "We need drinks across teams"\n"Our synergy is off the charts" → absolute poetry\n\nYou're welcome. 🥃\n\n#productivity #corporate #synergy #lifehack`, '🥃', '📍 Mumbai, India', ''],
      [u2, `Just learned the actual difference between mezcal and tequila.\n\nI have been ordering the wrong one for 6 years.\n\nThis is the single most valuable piece of knowledge I have acquired in my entire 14-year career. My MBA has nothing on this moment.\n\n🌵 #mezcal #tequila #learning #nevertooolate`, '🍹', '🇲🇽 Oaxaca, Mexico', 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80'],
      [u4, `Wrote 400 lines of code. Deployed to prod. Everything worked on first try.\n\nClosed laptop.\n\nOpened a cold craft IPA.\n\nIn exactly that order.\n\nThis is what peak developer performance looks like. Nobody talks about this in engineering bootcamps. 🍺\n\n#coding #craftbeer #developer #peakperformance`, '🍺', '📍 Hyderabad, India', ''],
      [u6, `Asked ChatGPT what pairs well with a 25-year Scotch.\n\nIt said: "Perhaps a good book and a fireplace."\n\nI closed the tab. Called Arjun. We figured it out ourselves.\n\nAI has limits. Friends with good taste do not. 🥃\n\n#whisky #ai #friendship #scotch`, '🥃', '📍 Mumbai, India', ''],
      [u3, `The 5 stages of wine tasting:\n\n1. "I'm definitely getting dark fruits"\n2. "Actually... is that leather?"\n3. "I'm getting pencil shavings. Is anyone else getting pencil shavings?"\n4. "I think this is the greatest thing I've ever tasted"\n5. "Can I have more please"\n\nRepeat until enlightened. 🍷\n\n#winetasting #sommelier #france #wine`, '🍷', '🇮🇹 Tuscany, Italy', 'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=600&q=80'],
      [u5, `Convinced my entire team that stand-up meetings are more productive at a bar.\n\nWe are now 45 minutes into a heated debate about whether pineapple belongs in a Margarita.\n\nZero work discussed. Morale is the highest it has ever been.\n\nBest. Stand-up. Ever. 🍹\n\n#agile #standup #teamwork #margarita #pineapple`, '🍹', '📍 Goa, India', 'https://images.unsplash.com/photo-1609345265499-2133bbeb6ce5?w=600&q=80'],
      [u6, `Honest out-of-office reply I want to send:\n\n"I am on leave. I am at a rooftop bar in Lisbon. There is excellent wine. There is a view of the Tagus river. I am not checking email. I am not 'looping back'. I am not 'circling'. I am DRINKING.\n\nReturn date: When the wine runs out.\n\nUrgent matters: Still not my problem."\n\n🥂✈️ #pto #outofoffice #lisbon #wine #nosynergy`, '🥂', '🇵🇹 Lisbon, Portugal', 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&q=80'],
    ];

    const ic = db.prepare('INSERT OR IGNORE INTO cheers (user_id, post_id) VALUES (?, ?)');
    backchodiPosts.forEach(([uid, content, drink, loc, img]) => {
      const pid = ip.run(uid, content, drink, loc, img).lastInsertRowid;
      uids.forEach(cuid => { if (cuid !== uid && Math.random() > 0.3) try { ic.run(cuid, pid); } catch {} });
    });
    console.log('✅ Backchodi posts seeded');
  }
} catch (e) { console.error('Backchodi seed error:', e.message); }

module.exports = db;
