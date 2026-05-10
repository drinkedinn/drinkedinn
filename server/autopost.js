/**
 * DrinkedInn AutoPost Engine
 * Each demo account posts 1-3 times daily at random times.
 * Content is persona-matched and randomised from a large library.
 */

const db     = require('./db');
const bcrypt = require('bcryptjs');

// ── CONTENT LIBRARY ──────────────────────────────────────────────────────────
const POSTS = [
  // Backchodi / corporate parody
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
  { content: `Just got a LinkedIn invite from someone I've literally never met.\n\nThey wrote: "I'd love to synergize our professional journeys."\n\nI'm on DrinkedInn now. Come find me when you want to actually talk. 🥃`, drink: '🥃', location: '' },
  { content: `My job title says "Senior Manager."\n\nMy actual job: professionally attending meetings about meetings and pretending to find them productive.\n\nThis Scotch, however, IS productive. 🥃 #seniorroles`, drink: '🥃', location: '' },
  { content: `Company townhall observation:\n\nThe bigger the slide deck, the more vague the strategy.\n\nOur CEO used 84 slides to say "work harder."\n\nCurrently on slide 3 of a Glenfiddich 15. 🥃 #townhall`, drink: '🥃', location: '' },
  { content: `Things I've learned from 7 years of corporate life:\n\n1. The person who schedules the most meetings does the least work\n2. "Urgent" means nothing\n3. Beer > email\n\n🍺 #corporatewisdom`, drink: '🍺', location: '' },
  { content: `Gentle reminder: Your "always-on" work culture is not a personality trait.\n\nIt's a trauma response.\n\nThis cocktail, however, IS a personality. 🍹 #boundaries #worklifebalance`, drink: '🍹', location: '' },

  // Drink experiences
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
  { content: `Tequila last night.\n\nContracts I've reviewed in my head since: 0.\n\nDeep thoughts I've had about my life choices: many.\n\n🍹 Worth it. #tequila #weeknightbad`, drink: '🍹', location: 'Goa, India', lat: 15.2993, lng: 74.124 },
  { content: `Paul John Bold.\n\nGoan single malt. Slightly peated. Aggressively tropical.\n\nIndia doesn't need to import anything. We're MAKING this now.\n\n🥃🇮🇳 #pauljohn #goa #indianwhisky`, drink: '🥃', location: 'Goa, India', lat: 15.2993, lng: 74.124 },
  { content: `Gin and tonic by the sea.\n\nSome problems solve themselves with the right view and the right drink.\n\n🍸 #gin #goa #beachbar`, drink: '🍸', location: 'Goa, India', lat: 15.2993, lng: 74.124 },
  { content: `Sake for the first time in Osaka.\n\nI was not prepared for how elegant it is.\n\nChilled. Clean. Subtly complex. Like the city itself.\n\n🍶🇯🇵 #sake #osaka #japan`, drink: '🍶', location: 'Osaka, Japan', lat: 34.6937, lng: 135.5023 },
  { content: `Beer garden in Munich. Masskrug in hand. 1 litre of Hofbräu.\n\nDemocracy in its purest form.\n\n🍺🇩🇪 #munich #oktoberfest #beerculture`, drink: '🍺', location: 'Munich, Germany', lat: 48.1351, lng: 11.582 },
  { content: `Whisky tasting event tonight. Tried 8 different single malts.\n\nFavourite: Springbank 10. Coastal, slightly briny, creamy finish.\n\nWhat a weird and wonderful rabbit hole whisky is.\n\n🥃 #whiskytasting #springbank`, drink: '🥃', location: 'Delhi, India', lat: 28.7041, lng: 77.1025 },
  { content: `Moscow Mule at a rooftop in Singapore.\n\nCopper cup so cold it hurt my hand.\n\nGinger and lime and vodka and a skyline.\n\n🍹🇸🇬 Worth every cent. #singapore #moscowmule`, drink: '🍹', location: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { content: `First legal drink in a bar: Kingfisher at 18.\n\nDrink at 35: Ardbeg 10, no ice, slightly reverent.\n\nThat's character development. 🥃\n\n#growthmindset #whisky #ardbeg`, drink: '🥃', location: '' },

  // Reflective / life observations
  { content: `Theory: the quality of your drink choices is inversely proportional to how many meetings you had that day.\n\n4 meetings = beer. 8 meetings = wine. 12 meetings = the good Scotch. 🥃 #datadriven`, drink: '🥃', location: '' },
  { content: `People who say "I don't drink" with judgment in their eyes:\n\nBrother, I'm not asking you to. I'm asking you to let me have this gin in peace.\n\n🍸 #nojudgement #ginandtonic`, drink: '🍸', location: '' },
  { content: `The older I get the more I understand why people have a "favourite whisky."\n\nIt's not snobbery. It's having figured out exactly what you like.\n\nThat's wisdom. 🥃 #selfawareness`, drink: '🥃', location: '' },
  { content: `Friday at 7pm is a completely different species of hour.\n\nThe week dissolved. Responsibilities are theoretical. The glass is full.\n\n🥂 This is what we work for. #fridayfeeling`, drink: '🥂', location: '' },
  { content: `My relationship with coffee: complicated, codependent, necessary.\n\nMy relationship with whisky: simple, honest, medicinal.\n\n🥃 One helps me start. One helps me stop. #balance`, drink: '🥃', location: '' },
  { content: `A good bar is basically therapy but the doctor is licensed and the medicine is aged in oak.\n\n🥃 12 years minimum. #selfcare #whisky`, drink: '🥃', location: '' },
  { content: `Things that pair well with a difficult week:\n\n1. A long shower\n2. No notifications\n3. Something peaty\n4. Silence\n\n🥃 Not necessarily in that order. #weekendvibes`, drink: '🥃', location: '' },
  { content: `Nobody talks about how choosing a cocktail at a new bar is a personality test.\n\nI asked for a Negroni. They were out of Campari.\n\nWe're not compatible. 🍸 #standards #negroni`, drink: '🍸', location: '' },
  { content: `My bucket list:\n\n✅ Islay distillery tour\n⬜ Bourbon Trail, Kentucky\n⬜ Japanese whisky bar crawl, Tokyo\n⬜ Cognac region, France\n\n🥃 Progress is slow but deliberate. #bucketlist #whiskytravel`, drink: '🥃', location: '' },
  { content: `The best conversations I've ever had happened around a table with drinks and no phones.\n\nThe worst? In a meeting room with a projector and "parking lot" items.\n\n🍺 You know which one I prefer. #realconnections`, drink: '🍺', location: '' },
  { content: `Pub quiz with colleagues tonight.\n\nWe lost.\n\nBut we came in first for "team that had the most fun losing." That counts.\n\n🍺 #pubquiz #teambuilding #winning`, drink: '🍺', location: '' },
  { content: `Wine list at dinner had 4 pages.\n\nI confidently pointed to the second cheapest bottle and acted like I knew exactly what I was doing.\n\nI did not. It was delicious anyway. 🍷 #winelife`, drink: '🍷', location: '' },
  { content: `A Scotch whisky is:\n\n1% barley\n1% water\n98% patience\n\n🥃 Aged 12 years so you don't have to wait that long. #singlemalt #scotland`, drink: '🥃', location: '' },
  { content: `Some people collect stamps.\n\nSome collect sneakers.\n\nI collect empty whisky bottles and the memories attached to them.\n\n🥃 Same principle. More ABV. #collection`, drink: '🥃', location: '' },
];

const LOCATIONS = [
  { location: 'Mumbai, India',     lat: 19.076,   lng: 72.8777 },
  { location: 'Bangalore, India',  lat: 12.9716,  lng: 77.5946 },
  { location: 'Delhi, India',      lat: 28.7041,  lng: 77.1025 },
  { location: 'Pune, India',       lat: 18.5204,  lng: 73.8567 },
  { location: 'Goa, India',        lat: 15.2993,  lng: 74.124  },
  { location: 'Hyderabad, India',  lat: 17.385,   lng: 78.4867 },
  { location: 'Singapore',         lat: 1.3521,   lng: 103.8198},
  { location: 'Tokyo, Japan',      lat: 35.6762,  lng: 139.6503},
  { location: 'London, UK',        lat: 51.5074,  lng: -0.1278 },
  { location: '',                  lat: null,     lng: null    },
  { location: '',                  lat: null,     lng: null    },
  { location: '',                  lat: null,     lng: null    },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const rand  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function getPostersForToday() {
  // All demo accounts except user id=1 (admin)
  return db.prepare(`
    SELECT id, name, email, drinks FROM users
    WHERE id > 1 AND onboarded = 1
    ORDER BY RANDOM()
  `).all();
}

function pickContent(user) {
  // Pick a random post from the library
  const base = rand(POSTS);
  // Optionally pick location from post or random location
  const useLoc = base.location ? { location: base.location, lat: base.lat || null, lng: base.lng || null } : (Math.random() > 0.5 ? rand(LOCATIONS) : { location: '', lat: null, lng: null });
  return {
    content:  base.content,
    drink:    base.drink,
    location: useLoc.location,
    lat:      useLoc.lat || null,
    lng:      useLoc.lng || null,
  };
}

function doPost(userId, content, drink, location, lat, lng) {
  try {
    db.prepare(`
      INSERT INTO posts (user_id, content, drink, location, lat, lng, image_url, has_poll)
      VALUES (?, ?, ?, ?, ?, ?, '', 0)
    `).run(userId, content, drink, location || '', lat, lng);
  } catch (e) {
    console.error('AutoPost error:', e.message);
  }
}

function addRandomCheers(postId) {
  // 3-12 random users cheer the new post
  const users = db.prepare('SELECT id FROM users WHERE id != 1 ORDER BY RANDOM() LIMIT ?').all(randInt(3, 12));
  for (const u of users) {
    try {
      db.prepare('INSERT OR IGNORE INTO cheers (user_id, post_id) VALUES (?, ?)').run(u.id, postId);
    } catch {}
  }
}

// ── SCHEDULER ─────────────────────────────────────────────────────────────────
function schedulePost(userId, delayMs, content, drink, location, lat, lng) {
  setTimeout(() => {
    doPost(userId, content, drink, location, lat, lng);
    // Get the just-inserted post ID and add cheers
    const row = db.prepare('SELECT id FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
    if (row) {
      setTimeout(() => addRandomCheers(row.id), randInt(5000, 60000));
    }
    console.log(`🤖 AutoPost: user ${userId} posted`);
  }, delayMs);
}

// ── DAILY BOOT ────────────────────────────────────────────────────────────────
function scheduleDailyPosts() {
  const now     = new Date();
  const posters = getPostersForToday();

  // Each poster gets 1-3 posts today at random times between 8am–11pm
  for (const user of posters) {
    const postCount = randInt(1, 3);
    const usedContents = new Set();

    for (let i = 0; i < postCount; i++) {
      // Random hour 8–23, random minute
      const postHour = randInt(8, 23);
      const postMin  = randInt(0, 59);
      const target   = new Date(now);
      target.setHours(postHour, postMin, 0, 0);

      let delayMs = target - now;
      if (delayMs < 0) delayMs += 24 * 60 * 60 * 1000; // push to tomorrow if past

      // Pick unique content
      let pick;
      let attempts = 0;
      do { pick = pickContent(user); attempts++; }
      while (usedContents.has(pick.content) && attempts < 10);
      usedContents.add(pick.content);

      schedulePost(user.id, delayMs, pick.content, pick.drink, pick.location, pick.lat, pick.lng);
    }
  }

  console.log(`🤖 AutoPost: scheduled posts for ${posters.length} accounts today`);

  // Re-schedule for next day at midnight
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 5, 0, 0); // 00:05 to avoid exact midnight issues
  setTimeout(scheduleDailyPosts, midnight - now);
}

module.exports = { start: scheduleDailyPosts };
