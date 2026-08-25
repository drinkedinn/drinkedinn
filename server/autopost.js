/**
 * DrinkedInn AutoPost Engine (async Turso compatible)
 * Each demo account posts 1-3 times daily at random times.
 * On Vercel: runs once per invocation (stateless). Locally: runs on interval.
 */

const db = require('./db');

// ── CONTENT LIBRARY ──────────────────────────────────────────────────────────
const POSTS = [
  { content: `My manager just said "let's take this offline" about a topic that was ALREADY offline.\n\nCurrently processing this over a large whisky.\n\n#corporatelife #MondayMood 🥃`, drink: '🥃', location: '' },
  { content: `Annual review feedback:\n"You need to be more proactive."\n\nI proactively ordered a second drink. Growth mindset activated.\n\n#performance #careerdevelopment 🍺`, drink: '🍺', location: '' },
  { content: `LinkedIn post I almost wrote:\n"Humbled and excited to announce I survived another stand-up without saying anything meaningful."\n\nInstead I'm here. Cheers. 🥂\n\n#authentic #nosynergy`, drink: '🥂', location: '' },
  { content: `The 5 stages of a Monday:\n1. Denial (hit snooze 4x)\n2. Anger (saw 47 unread emails)\n3. Bargaining ("just one coffee")\n4. Depression (it's 10am)\n5. Acceptance (it's now 6pm and this gin is helping)\n\n🍸 #mondayvibes`, drink: '🍸', location: '' },
  { content: `Hot take: "let's circle back" is just corporate for "I hope you forget about this."\n\nI never forget. Especially after whisky.\n\n🥃 #circlingback #corporatespeak`, drink: '🥃', location: '' },
  { content: `Our company has 14 values.\n\nI can only remember 2: Free beer Fridays and unlimited leave (which nobody takes).\n\nCurrently practising value #1. 🍺\n\n#companyculture`, drink: '🍺', location: '' },
  { content: `Someone put "innovative thinker" on their LinkedIn.\n\nTheir most recent innovation: a new way to reply-all to emails nobody asked to be CC'd on.\n\n🥃 Whisky helps me cope. #linkedinlunatics`, drink: '🥃', location: '' },
  { content: `Performance review season tip:\n\nFor every buzzword your manager uses, take a mental sip.\n\nYou'll be too drunk to care about your rating by slide 3. 🍺\n\n#performancereview #survival`, drink: '🍺', location: '' },
  { content: `"We need to be more data-driven."\n\nSaid the person who just made a ₹2 crore decision based on a gut feeling in a cab.\n\n🥃 I have data that says whisky > gut feelings. #analytics`, drink: '🥃', location: '' },
  { content: `Corporate email translation guide:\n\n"As per my last email" = READ. THE. THREAD.\n"Going forward" = you messed up\n"Great question" = I have no idea\n"Let's align" = I don't trust you\n\n🍸 Cheers to the decoded life. #corporatelife`, drink: '🍸', location: '' },
  { content: `First time trying a Japanese whisky tonight.\n\nYamazaki 12. The nose literally stopped my conversation mid-sentence.\n\nStrawberry, oak, a hint of something I can't name but would happily chase forever. 🇯🇵🥃\n\n#japanesewhisky #yamazaki`, drink: '🥃', location: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { content: `Laphroaig 10 is not a whisky.\n\nIt's a medical procedure you enjoy.\n\nIf you know, you know. 🏴󠁧󠁢󠁳󠁣󠁴󠁿🥃\n\n#islay #laphroaig #peated`, drink: '🥃', location: 'Islay, Scotland', lat: 55.6308, lng: -6.1782 },
  { content: `Rooftop bar. 8pm. Negroni in hand.\n\nThis is what adulting is supposed to feel like.\n\n🍸 Not spreadsheets. THIS.\n\n#negroni #rooftopbar #bombay`, drink: '🍸', location: 'Mumbai, India', lat: 19.076, lng: 72.8777 },
  { content: `Tried Amrut Fusion for the first time.\n\nA BANGALORE distillery making a whisky that could embarrass Scottish distilleries.\n\nProud doesn't cover it. 🇮🇳🥃\n\n#amrut #indianwhisky #bangalorelife`, drink: '🥃', location: 'Bangalore, India', lat: 12.9716, lng: 77.5946 },
  { content: `The Macallan 18 is what I imagine money tastes like.\n\nRich sherry, dark chocolate, orange peel.\n\nI don't make decisions at work anymore. I just ask: what would The Macallan do?\n\n🥃 #macallan #speyside`, drink: '🥃', location: '' },
  { content: `Aperol Spritz on a Friday evening with the whole team.\n\nThis is the real Q4 strategy.\n\n🍹 #teambuilding #fridayfeeling #aperol`, drink: '🍹', location: 'Bangalore, India', lat: 12.9716, lng: 77.5946 },
  { content: `Craft beer flights at a new microbrewery in Pune.\n\nSix different beers. Each one a small essay on why life is worth living.\n\n🍺 #craftbeer #pune #microbrewery`, drink: '🍺', location: 'Pune, India', lat: 18.5204, lng: 73.8567 },
  { content: `Old Monk. Soda. Ice.\n\nI'm not being ironic. This is nostalgia at 40% ABV.\n\n🥃 Some things don't need to be premium to be perfect. #oldmonk #desiwhisky`, drink: '🥃', location: '' },
  { content: `Just discovered: the correct pairing for a biryani is a chilled Kingfisher.\n\nThis is not a hot take. This is science.\n\n🍺 #biryani #kingfisher #foodanddrink`, drink: '🍺', location: 'Hyderabad, India', lat: 17.385, lng: 78.4867 },
  { content: `Champagne at 11pm on a Wednesday because someone got promoted.\n\nThis is what the office COULD look like if we stopped pretending professionalism means joyless.\n\n🥂 #celebrate #champagne`, drink: '🥂', location: '' },
  { content: `Theory: the quality of your drink choices is inversely proportional to how many meetings you had that day.\n\n4 meetings = beer. 8 meetings = wine. 12 meetings = the good Scotch. 🥃 #datadriven`, drink: '🥃', location: '' },
  { content: `Friday at 7pm is a completely different species of hour.\n\nThe week dissolved. Responsibilities are theoretical. The glass is full.\n\n🥂 This is what we work for. #fridayfeeling`, drink: '🥂', location: '' },
  { content: `A good bar is basically therapy but the doctor is licensed and the medicine is aged in oak.\n\n🥃 12 years minimum. #selfcare #whisky`, drink: '🥃', location: '' },
  { content: `Nobody talks about how choosing a cocktail at a new bar is a personality test.\n\nI asked for a Negroni. They were out of Campari.\n\nWe're not compatible. 🍸 #standards #negroni`, drink: '🍸', location: '' },
  { content: `The best conversations I've ever had happened around a table with drinks and no phones.\n\nThe worst? In a meeting room with a projector and "parking lot" items.\n\n🍺 You know which one I prefer. #realconnections`, drink: '🍺', location: '' },
  { content: `Pub quiz with colleagues tonight.\n\nWe lost.\n\nBut we came in first for "team that had the most fun losing." That counts.\n\n🍺 #pubquiz #teambuilding #winning`, drink: '🍺', location: '' },
  { content: `A Scotch whisky is:\n\n1% barley\n1% water\n98% patience\n\n🥃 Aged 12 years so you don't have to wait that long. #singlemalt #scotland`, drink: '🥃', location: '' },
];

const LOCATIONS = [
  { location: 'Mumbai, India', lat: 19.076, lng: 72.8777 },
  { location: 'Bangalore, India', lat: 12.9716, lng: 77.5946 },
  { location: 'Delhi, India', lat: 28.7041, lng: 77.1025 },
  { location: 'Pune, India', lat: 18.5204, lng: 73.8567 },
  { location: 'Goa, India', lat: 15.2993, lng: 74.124 },
  { location: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { location: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { location: '', lat: null, lng: null },
  { location: '', lat: null, lng: null },
];

const rand = arr => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Post 1-3 times for random demo users. Call this on a schedule or per-request. */
async function autoPostOnce() {
  try {
    const users = await db.all("SELECT id, name FROM users WHERE id > 1 AND onboarded = 1 ORDER BY RANDOM() LIMIT 6");
    if (!users.length) return;

    for (const user of users) {
      const count = randInt(1, 2);
      for (let i = 0; i < count; i++) {
        const base = rand(POSTS);
        const loc = base.location
          ? { location: base.location, lat: base.lat, lng: base.lng }
          : (Math.random() > 0.5 ? rand(LOCATIONS) : { location: '', lat: null, lng: null });

        const { lastInsertRowid: pid } = await db.run(
          'INSERT INTO posts (user_id, content, drink, location, lat, lng, image_url, has_poll) VALUES (?, ?, ?, ?, ?, ?, \'\', 0)',
          [user.id, base.content, base.drink, loc.location, loc.lat, loc.lng]
        );

        // Add random cheers
        const cheerUsers = await db.all('SELECT id FROM users WHERE id != ? ORDER BY RANDOM() LIMIT ?', [user.id, randInt(3, 10)]);
        for (const cu of cheerUsers) {
          try { await db.run('INSERT OR IGNORE INTO cheers (user_id, post_id) VALUES (?, ?)', [cu.id, pid]); } catch {}
        }
      }
    }
    console.log(`🤖 AutoPost: ${users.length} users posted`);
  } catch (e) {
    console.error('AutoPost error:', e.message);
  }
}

/** For local dev: schedule periodic posting */
function start() {
  // Post once on startup (after a delay to let DB init)
  setTimeout(autoPostOnce, 10000);
  // Then every 4 hours
  setInterval(autoPostOnce, 4 * 60 * 60 * 1000);
  console.log('🤖 AutoPost engine started (every 4 hours)');
}

module.exports = { start, autoPostOnce };
