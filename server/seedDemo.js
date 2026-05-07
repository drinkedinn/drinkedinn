/**
 * DrinkedInn — Demo Account Seeder
 * Seeds 50 realistic accounts with posts, connections, cheers
 * Run: node server/seedDemo.js
 * Or auto-runs from db.js if users < 50
 */

const db   = require('./db');
const bcry = require('bcryptjs');

const HASH = bcry.hashSync('demo123', 10);

// ─── 44 new users (6 already exist) ────────────────────────────────────────
const NEW_USERS = [
  // ── Indians ────────────────────────────────────────────────────────────────
  { name:'Rahul Mehta',        email:'rahul@drinkeden.app',    title:'VP Marketing @ BrewBox | Weekend Whisky Philosopher',          avatar:'https://i.pravatar.cc/150?img=11', drinks:'{"🥃":88,"🍺":72,"🍷":50,"🍹":40}' },
  { name:'Ananya Singh',       email:'ananya@drinkeden.app',   title:'UX Designer | Gin & Tonic Is My Design System',                avatar:'https://i.pravatar.cc/150?img=9',  drinks:'{"🍸":92,"🍹":80,"🥂":60,"🥃":45}' },
  { name:'Karan Malhotra',     email:'karan@drinkeden.app',    title:'Investment Banker | Champagne Budget, Bonus Pending',          avatar:'https://i.pravatar.cc/150?img=15', drinks:'{"🥂":90,"🍷":85,"🥃":70,"🍸":50}' },
  { name:'Shreya Iyer',        email:'shreya@drinkeden.app',   title:'Founder @ DrinkLab | Disrupting Sobriety One Sip At A Time',  avatar:'https://i.pravatar.cc/150?img=26', drinks:'{"🥃":80,"🍺":85,"🍹":75,"🍷":60}' },
  { name:'Rohit Verma',        email:'rohit@drinkeden.app',    title:'Data Scientist | My Models Run On Craft Beer',                 avatar:'https://i.pravatar.cc/150?img=17', drinks:'{"🍺":95,"🥃":65,"🍹":50,"🍸":40}' },
  { name:'Pooja Nair',         email:'pooja@drinkeden.app',    title:'Brand Manager | Sommelier in Training (Failing Gloriously)',   avatar:'https://i.pravatar.cc/150?img=23', drinks:'{"🍷":92,"🥂":88,"🍹":55,"🥃":40}' },
  { name:'Aditya Kumar',       email:'aditya@drinkeden.app',   title:'Product Manager @ SipStack | Roadmap: More Drinks',            avatar:'https://i.pravatar.cc/150?img=13', drinks:'{"🥃":85,"🍸":70,"🍺":75,"🥂":55}' },
  { name:'Divya Sharma',       email:'divya@drinkeden.app',    title:'Travel Blogger | 40 Countries, 400 Bars, 0 Regrets',           avatar:'https://i.pravatar.cc/150?img=29', drinks:'{"🍹":90,"🍸":85,"🥂":75,"🍷":70}' },
  { name:'Nikhil Patel',       email:'nikhil@drinkeden.app',   title:'CTO | Ships Code & Craft IPAs with Equal Passion',            avatar:'https://i.pravatar.cc/150?img=18', drinks:'{"🍺":97,"🥃":60,"🍹":45,"🍷":35}' },
  { name:'Prachi Gupta',       email:'prachi@drinkeden.app',   title:'CMO @ PourHouse | Making Brands Liquid Since 2015',           avatar:'https://i.pravatar.cc/150?img=27', drinks:'{"🍸":88,"🍹":82,"🥂":70,"🍷":60}' },
  { name:'Sameer Bose',        email:'sameer@drinkeden.app',   title:'Strategy Consultant | My Advice Gets Better After 2 Drinks',  avatar:'https://i.pravatar.cc/150?img=19', drinks:'{"🥃":85,"🍷":70,"🍺":65,"🥂":55}' },
  { name:'Kavya Reddy',        email:'kavya@drinkeden.app',    title:'Creative Director | Art Director By Day, Bar Director By Night',avatar:'https://i.pravatar.cc/150?img=31', drinks:'{"🍷":88,"🍸":80,"🥂":78,"🥃":50}' },
  { name:'Aryan Shah',         email:'aryan@drinkeden.app',    title:'Serial Entrepreneur | 3 Exits, 1 Liver, Infinite Ambition',   avatar:'https://i.pravatar.cc/150?img=20', drinks:'{"🥃":90,"🍺":80,"🥂":75,"🍹":60}' },
  { name:'Nisha Kulkarni',     email:'nisha@drinkeden.app',    title:'People & Culture Head | HR Stands for High-quality Rosé',     avatar:'https://i.pravatar.cc/150?img=33', drinks:'{"🥂":92,"🍷":88,"🍹":65,"🍸":55}' },
  { name:'Varun Malhotra',     email:'varun@drinkeden.app',    title:'Revenue Head @ B2Booze | Closing Deals at the Bar Since 2018',avatar:'https://i.pravatar.cc/150?img=21', drinks:'{"🥃":80,"🍺":85,"🍸":70,"🥂":60}' },
  { name:'Tanya Chopra',       email:'tanya@drinkeden.app',    title:'Senior Journalist | Investigative Cocktail Correspondent',     avatar:'https://i.pravatar.cc/150?img=35', drinks:'{"🍸":90,"🍹":85,"🥂":70,"🍷":65}' },
  { name:'Akash Joshi',        email:'akash@drinkeden.app',    title:'Cloud Architect | My Infrastructure Is As Reliable As My Bar', avatar:'https://i.pravatar.cc/150?img=22', drinks:'{"🍺":90,"🥃":75,"🍹":55,"🍷":40}' },
  { name:'Riya Agarwal',       email:'riya@drinkeden.app',     title:'CFO | Chief Fun Officer | Numbers By Day, Negronis By Night',  avatar:'https://i.pravatar.cc/150?img=37', drinks:'{"🍸":85,"🥂":80,"🍷":75,"🥃":60}' },
  { name:'Siddharth Nair',     email:'siddharth@drinkeden.app',title:'Growth Hacker @ PintScale | Hacking My Way Through Craft Beer',avatar:'https://i.pravatar.cc/150?img=24', drinks:'{"🍺":95,"🥃":65,"🍹":50,"🍸":45}' },
  { name:'Meenal Desai',       email:'meenal@drinkeden.app',   title:'COO | Operations Are Smooth. So Is My Single Malt.',          avatar:'https://i.pravatar.cc/150?img=39', drinks:'{"🥃":88,"🍷":72,"🥂":68,"🍺":55}' },
  { name:'Manish Gupta',       email:'manish@drinkeden.app',   title:'Head Bartender @ Foo Bar Goa | Liquid Architect',             avatar:'https://i.pravatar.cc/150?img=28', drinks:'{"🍸":95,"🍹":90,"🥂":75,"🥃":70}' },
  { name:'Sonal Mehta',        email:'sonal@drinkeden.app',    title:'Wine Educator | WSET Level 3 | Swirl. Sniff. Sip. Repeat.',   avatar:'https://i.pravatar.cc/150?img=41', drinks:'{"🍷":96,"🥂":90,"🍸":55,"🍹":50}' },
  { name:'Deepak Rao',         email:'deepak@drinkeden.app',   title:'Craft Beer Evangelist | Converted 47 Kingfisher Drinkers',    avatar:'https://i.pravatar.cc/150?img=30', drinks:'{"🍺":98,"🥃":55,"🍹":40,"🍷":35}' },
  { name:'Pallavi Joshi',      email:'pallavi@drinkeden.app',  title:'Events Director | Every Great Event Ends At The Bar',         avatar:'https://i.pravatar.cc/150?img=43', drinks:'{"🥂":90,"🍹":85,"🍸":80,"🍷":70}' },
  { name:'Rajesh Khanna',      email:'rajesh@drinkeden.app',   title:'Hospitality Consultant | 25 Years. 10,000 Bottles. 0 Regrets',avatar:'https://i.pravatar.cc/150?img=32', drinks:'{"🥃":92,"🍷":85,"🥂":80,"🍺":65}' },

  // ── International ──────────────────────────────────────────────────────────
  { name:'James Chen',         email:'james@drinkeden.app',    title:'Product Lead @ Grab | Singapore\'s Most Opinionated Whisky Nerd',avatar:'https://i.pravatar.cc/150?img=3',  drinks:'{"🥃":90,"🍺":75,"🍹":60,"🍷":50}' },
  { name:'Sofia Rossi',        email:'sofia@drinkeden.app',    title:'Wine Consultant | Milan | Turned Down 3 Jobs To Stay In Tuscany',avatar:'https://i.pravatar.cc/150?img=44', drinks:'{"🍷":97,"🥂":90,"🍸":55,"🍹":45}' },
  { name:'Lena Müller',        email:'lena@drinkeden.app',     title:'Marketing Director | Berlin | Riesling Is Not Optional, It Is Required',avatar:'https://i.pravatar.cc/150?img=45', drinks:'{"🍷":92,"🥂":80,"🍸":70,"🍺":65}' },
  { name:'Carlos Rivera',      email:'carlos@drinkeden.app',   title:'Mezcalero | Oaxaca | 3rd Generation. The Agave Chose Me.',     avatar:'https://i.pravatar.cc/150?img=5',  drinks:'{"🍹":96,"🥃":70,"🍸":65,"🍺":40}' },
  { name:'Emma Thompson',      email:'emma@drinkeden.app',     title:'Brand Strategist | London | Gin Is A Personality, Not A Drink',avatar:'https://i.pravatar.cc/150?img=46', drinks:'{"🍸":94,"🥂":85,"🍷":75,"🍹":65}' },
  { name:'Raj Pillai',         email:'raj@drinkeden.app',      title:'Investment Banker | Dubai | Sipping Scotch In Tax-Free Paradise',avatar:'https://i.pravatar.cc/150?img=6', drinks:'{"🥃":92,"🥂":85,"🍷":70,"🍸":60}' },
  { name:'Yuki Tanaka',        email:'yuki@drinkeden.app',     title:'Master Brewer | Kyoto | My Sake Has More Awards Than My LinkedIn',avatar:'https://i.pravatar.cc/150?img=47', drinks:'{"🍶":97,"🥃":65,"🍷":60,"🥂":55}' },
  { name:'Marie Dubois',       email:'marie@drinkeden.app',    title:'Head Sommelier | Paris | Wine Is Not A Drink, It Is A Conversation',avatar:'https://i.pravatar.cc/150?img=48', drinks:'{"🍷":98,"🥂":92,"🍸":55,"🍹":45}' },
  { name:'Alex Kim',           email:'alex@drinkeden.app',     title:'Tech Lead @ Kakao | Seoul | Soju Is Just Startup Culture',    avatar:'https://i.pravatar.cc/150?img=7',  drinks:'{"🥃":82,"🍺":78,"🍹":70,"🍸":60}' },
  { name:'Priya Chandrasekaran',email:'priyas@drinkeden.app',  title:'Partner @ McKinsey Singapore | My Frameworks Pair Well With Gin',avatar:'https://i.pravatar.cc/150?img=49', drinks:'{"🍸":88,"🍷":80,"🥂":75,"🥃":60}' },
  { name:'Diego Santos',       email:'diego@drinkeden.app',    title:'Rum Aficionado | São Paulo | Cachaça Is My Spirit Animal',   avatar:'https://i.pravatar.cc/150?img=8',  drinks:'{"🍹":94,"🥃":65,"🍺":60,"🍸":55}' },
  { name:'Hannah Weber',       email:'hannah@drinkeden.app',   title:'Riesling Specialist | Cologne | Dry Not Sweet. Non Negotiable.',avatar:'https://i.pravatar.cc/150?img=50', drinks:'{"🍷":95,"🥂":85,"🍸":60,"🍺":45}' },
  { name:'Tariq Al-Rashid',    email:'tariq@drinkeden.app',    title:'Whisky Collector | Dubai | 200 Bottles. Wife Doesn\'t Know.',  avatar:'https://i.pravatar.cc/150?img=10', drinks:'{"🥃":97,"🥂":70,"🍷":65,"🍺":50}' },
  { name:'Isabelle Laurent',   email:'isabelle@drinkeden.app', title:'Champagne Director | Reims | I Don\'t Drink Prosecco. I Have Standards.',avatar:'https://i.pravatar.cc/150?img=52', drinks:'{"🥂":97,"🍷":88,"🍸":65,"🍹":50}' },
  { name:'Marcus Johnson',     email:'marcus@drinkeden.app',   title:'Bourbon Evangelist | Nashville | Pappy Is Not A Myth. I Have Proof.',avatar:'https://i.pravatar.cc/150?img=12', drinks:'{"🥃":96,"🍺":75,"🍹":55,"🍸":45}' },
  { name:'Kenji Watanabe',     email:'kenji@drinkeden.app',    title:'Bar Owner | Osaka | 12 Years Behind The Bar. Still Prefer The Other Side.',avatar:'https://i.pravatar.cc/150?img=14', drinks:'{"🍶":90,"🥃":88,"🍸":75,"🍺":60}' },
  { name:'Pedro Alves',        email:'pedro@drinkeden.app',    title:'Port Wine Producer | Porto | Tawny Not Ruby. This Is The Way.',avatar:'https://i.pravatar.cc/150?img=16', drinks:'{"🍷":95,"🥂":80,"🥃":65,"🍺":50}' },
  { name:'Natasha Ivanova',    email:'natasha@drinkeden.app',  title:'Brand Director | Moscow | I Moved To Negronis. Still Russian.',avatar:'https://i.pravatar.cc/150?img=53', drinks:'{"🍸":88,"🥃":80,"🥂":75,"🍷":65}' },
];

// ─── Post content pool ──────────────────────────────────────────────────────
const POSTS = [
  // Rahul Mehta
  { u:'rahul@drinkeden.app',   c:`Mumbai 2am. Found a bar that still had Karuizawa on the menu. Ordered immediately without checking the price. Saw the bill. Cried. Drank another. Net result: worth it. 🥃\n\n#whisky #mumbai #noregrets #karuizawa`, d:'🥃', l:'📍 Mumbai, India', lat:19.076,  lng:72.8777, img:'' },
  { u:'rahul@drinkeden.app',   c:`Hot take: The only KPIs that matter are:\n\nK - Keep the whisky\nP - Pouring (consistently)\nI - In (the glass)\n\nShare this with your leadership team and see who laughs. Those are your real teammates. 🥃\n\n#leadership #kpi #whisky #hotake`, d:'🥃', l:'📍 Mumbai, India', lat:19.076,  lng:72.8777, img:'' },
  { u:'rahul@drinkeden.app',   c:`Tried to explain the difference between a blended and single malt to my CEO during a team dinner.\n\n45 minutes later he ordered the cheapest thing on the menu anyway.\n\nI have resigned. Not from the job. From trying. 🥃\n\n#singlevsblended #corporate #whisky`, d:'🥃', l:'📍 Mumbai, India', lat:19.076,  lng:72.8777, img:'' },

  // Ananya Singh
  { u:'ananya@drinkeden.app',  c:`The perfect gin & tonic is a UX problem.\n\nBad G&T: Wrong proportions. Wrong glass. Warm tonic. No garnish. Confused user.\nGood G&T: Ice cold. 2:1 tonic to gin. Cucumber ribbon. Delighted user.\n\nI spend my days thinking about this. 🍸\n\n#ux #design #gin #ginandtonic`, d:'🍸', l:'📍 Bangalore, India', lat:12.971, lng:77.594, img:'https://images.unsplash.com/photo-1560508179-b2c9a3f8e92b?w=600&q=80' },
  { u:'ananya@drinkeden.app',  c:`Just prototyped a new cocktail for 3 hours. Iterated 7 times. Did user testing (on myself). \n\nFinal product: A Negroni with Islay scotch instead of gin.\n\nDesign thinking works for everything. 🍸\n\n#design #thinking #negroni #cocktail`, d:'🍸', l:'📍 Bangalore, India', lat:12.971, lng:77.594, img:'' },

  // Karan Malhotra
  { u:'karan@drinkeden.app',   c:`Just expensed a bottle of Dom Pérignon as "client entertainment."\n\nThere was no client.\n\nI was the client. I entertained myself for 2 hours. ROI: 400%.\n\n🥂 #finance #expense #champagne #dompérignon`, d:'🥂', l:'📍 Delhi, India', lat:28.613, lng:77.209, img:'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80' },
  { u:'karan@drinkeden.app',   c:`My honest assessment of champagne brands:\n\n• Moët: Reliable. Like a blue chip stock.\n• Krug: A unicorn. Price reflects it.\n• Veuve Clicquot: The IPO everyone buys.\n• Bollinger: James Bond. Need I say more.\n• Prosecco: A meme. Not a champagne.\n\n🥂 Controversial? Maybe. Accurate? Absolutely.\n\n#champagne #wine #finance #investing`, d:'🥂', l:'🇫🇷 Reims, France', lat:49.258, lng:4.032, img:'' },

  // Shreya Iyer
  { u:'shreya@drinkeden.app',  c:`Pitch deck slide 1: Problem\nThe problem: Terrible bar menus with no story behind the drinks.\n\nPitch deck slide 2: Solution\nDrinkedInn.\n\nPitch deck slide 3: Market Size\n(Gestures broadly at every human who has ever had a bad day)\n\nCurrently raising Series A. DMs open. 🥃\n\n#startup #fundraising #drinkedinn`, d:'🥃', l:'📍 Hyderabad, India', lat:17.385, lng:78.486, img:'' },
  { u:'shreya@drinkeden.app',  c:`My co-founder and I have an agreement:\n\nAll major product decisions made sober.\nAll pivots discussed over tequila.\n\nWe have pivoted 4 times. The product is now something completely different and much better.\n\n🌵 Tequila-driven development is underrated.\n\n#startup #founder #tequila #pivot`, d:'🍹', l:'📍 Hyderabad, India', lat:17.385, lng:78.486, img:'' },

  // Rohit Verma
  { u:'rohit@drinkeden.app',   c:`Correlation analysis I ran this weekend:\n\nVariable A: Number of craft IPAs consumed\nVariable B: Quality of my Sunday\n\nR² = 0.94. P-value < 0.001.\n\nStatistically significant. I've published my findings. The paper is this post. 🍺\n\n#datascience #statistics #craftbeer #research`, d:'🍺', l:'📍 Pune, India', lat:18.520, lng:73.856, img:'' },
  { u:'rohit@drinkeden.app',   c:`I built a model that predicts:\n\n• How good a craft beer will be based on its label design\n• Accuracy: 73%\n• Training data: 340 beers I personally consumed\n\nThis is the most useful work I have done in my career.\n\n🍺 #ml #craftbeer #datascience #modelaccuracy`, d:'🍺', l:'📍 Pune, India', lat:18.520, lng:73.856, img:'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&q=80' },
  { u:'rohit@drinkeden.app',   c:`Went to the Craft Beer Festival in Pune.\n\nDrank 14 samples. Took detailed notes on all of them. Notes became progressively less coherent after sample 9.\n\nSample 14 review: "round. good. yes."\n\nPublishing the full report shortly. 🍺\n\n#craftbeer #pune #festival #research`, d:'🍺', l:'📍 Pune, India', lat:18.520, lng:73.856, img:'' },

  // Pooja Nair
  { u:'pooja@drinkeden.app',   c:`WSET Level 3 exam tomorrow. I am terrified.\n\nNot because of the theory. Because I have to spit out the tasting samples.\n\nI have practiced spitting wine for 2 weeks. My bathroom still smells like Bordeaux.\n\n🍷 Pray for me.\n\n#wset #wine #sommelier #study`, d:'🍷', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'' },
  { u:'pooja@drinkeden.app',   c:`I passed WSET Level 3. 🍷\n\nDistinguish mark.\n\nTo celebrate I opened a bottle I've been saving for 3 years. A 2016 Barolo from Giacomo Conterno. Violets, tar, roses, eternity.\n\nSome wines taste like they were made for this exact moment. This was that moment.\n\n#wset #barolo #wine #achievement`, d:'🍷', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=600&q=80' },

  // Aditya Kumar
  { u:'aditya@drinkeden.app',  c:`Product roadmap Q3:\n\nMust have: Whisky at the team offsite\nShould have: Backup whisky\nNice to have: Whisky that pairs with the dinner they're serving\nWon't have: Any more standup meetings before 10am\n\n🥃 Approved by nobody. Still shipping. #product #roadmap #pm`, d:'🥃', l:'📍 Gurgaon, India', lat:28.457, lng:77.026, img:'' },
  { u:'aditya@drinkeden.app',  c:`Me: This feature will take 2 weeks.\nMy manager: Can we do it in 2 days?\nMe: *opens whisky*\nMe: 3 weeks.\n\n🥃 Negotiation is a skill. Know your leverage. #pm #product #negotiation`, d:'🥃', l:'📍 Gurgaon, India', lat:28.457, lng:77.026, img:'' },

  // Divya Sharma
  { u:'divya@drinkeden.app',   c:`Bar menu spotted in Kyoto that just said: "Whisky. Good." for ¥800.\n\nNo description. No tasting notes. No pretension.\n\nI sat there for 3 hours. It was good.\n\nThis bar understands the assignment. 🥃✈️\n\n#kyoto #japan #travel #whisky #minimalism`, d:'🥃', l:'🇯🇵 Kyoto, Japan', lat:35.011, lng:135.768, img:'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=600&q=80' },
  { u:'divya@drinkeden.app',   c:`40 countries. One thing I've learned:\n\nEvery culture has a drink that tells you exactly who they are.\n\nFrance: Wine slowly with food.\nJapan: Whisky silently with respect.\nMexico: Tequila loudly with strangers.\nIndia: Whisky with soda that makes whisky lovers cry.\n\n🌍 Travel is anthropology. The bar is the classroom. ✈️\n\n#travel #drinks #culture #40countries`, d:'🍹', l:'🌍 Worldwide', lat:20.0, lng:0.0, img:'' },
  { u:'divya@drinkeden.app',   c:`Santorini at sunset with a glass of Assyrtiko.\n\nI quit my job via email 20 minutes later.\n\nCorrelation? Absolutely.\n\n🥂 No ragrets. #santorini #greece #wine #lifechange #travel`, d:'🥂', l:'🇬🇷 Santorini, Greece', lat:36.393, lng:25.461, img:'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80' },

  // Nikhil Patel
  { u:'nikhil@drinkeden.app',  c:`Our system has 99.97% uptime.\n\nI have 0% uptime on Sundays.\n\nI am more reliable than the system.\n\nThink about that while I drink this IPA. 🍺\n\n#engineering #devops #sre #craftbeer`, d:'🍺', l:'📍 Ahmedabad, India', lat:23.022, lng:72.571, img:'' },
  { u:'nikhil@drinkeden.app',  c:`Unpopular opinion from a CTO:\n\nThe best engineering decisions I have ever made were made in a pub, not a meeting room.\n\nLess slides. More beer. Better architecture.\n\n🍺 This is my TED talk. #cto #engineering #craftbeer #startup`, d:'🍺', l:'📍 Ahmedabad, India', lat:23.022, lng:72.571, img:'https://images.unsplash.com/photo-1600788886242-5c96aabe3757?w=600&q=80' },

  // Sameer Bose
  { u:'sameer@drinkeden.app',  c:`Strategy framework for choosing a single malt:\n\n1. Ignore the brand\n2. Look at the distillery's location\n3. Ask: peat or sherry?\n4. Budget: spend 20% more than you planned\n5. Drink it neat. Always neat.\n\nThis is better than the BCG matrix and I will stand by that. 🥃\n\n#strategy #consulting #whisky #framework`, d:'🥃', l:'📍 Kolkata, India', lat:22.572, lng:88.363, img:'' },
  { u:'sameer@drinkeden.app',  c:`Client: We need a comprehensive transformation roadmap.\n\nMe (internally): *opens Glenfarclas 25*\n\nMe (to client): I see exactly what needs to change here.\n\nClient: That was fast.\n\nMe: Good whisky clears the mind.\n\n🥃 Billed 4 hours for that conversation. #consulting #strategy`, d:'🥃', l:'📍 Kolkata, India', lat:22.572, lng:88.363, img:'' },

  // Kavya Reddy
  { u:'kavya@drinkeden.app',   c:`Designed a wine label last year for a small Tuscan producer.\n\nJust found out the wine won three awards.\n\nI am taking full creative credit. The wine was already excellent but my label made people pick it up.\n\nDesign matters. So does the Sangiovese. 🍷\n\n#design #wine #tuscany #branding`, d:'🍷', l:'🇮🇹 Tuscany, Italy', lat:43.771, lng:11.248, img:'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=600&q=80' },
  { u:'kavya@drinkeden.app',   c:`The most honest creative brief I ever received:\n\n"Make the cocktail menu look like it was designed by someone who actually drinks."\n\nI drank everything on the menu first for 'research'.\n\nBest brief. Best project. Best portfolio piece. 🍸\n\n#design #cocktails #creative #brief`, d:'🍸', l:'📍 Hyderabad, India', lat:17.385, lng:78.486, img:'' },

  // Aryan Shah
  { u:'aryan@drinkeden.app',   c:`Things I've learned from 3 startup exits:\n\n1. The best investors I met were at a whisky bar, not at a pitch event\n2. Your co-founder chemistry test: how you handle a bad bottle of wine together\n3. The deal memo always takes longer than expected. So does a 25-year Scotch. Both are worth the wait.\n\n🥃 #startup #founder #exits #whisky`, d:'🥃', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'' },
  { u:'aryan@drinkeden.app',   c:`My VC said our burn rate was too high.\n\nI said our whisky collection was an appreciating asset.\n\nHe hung up.\n\nHe called back 3 days later and asked what we were drinking.\n\nWe closed the round. 🥃 #vc #funding #startup #whisky`, d:'🥃', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'' },

  // Nisha Kulkarni
  { u:'nisha@drinkeden.app',   c:`Company culture isn't about ping pong tables.\n\nIt's about whether your team chooses to get a drink together on a Friday without being asked.\n\nWe do. Every Friday. It started with rosé. It became a ritual. It became family. 🥂\n\n#culture #hr #people #team #wine`, d:'🥂', l:'📍 Pune, India', lat:18.520, lng:73.856, img:'' },
  { u:'nisha@drinkeden.app',   c:`Exit interview question I wish I could ask:\n\n"Was the wine at our events ever good enough?"\n\nIf no: please stay. I'll fix the wine. Everything else is fixable too.\n\nIf yes: you were leaving for money. That's fair. 🍷\n\n#hr #retention #wine #culture`, d:'🍷', l:'📍 Pune, India', lat:18.520, lng:73.856, img:'' },

  // Varun Malhotra
  { u:'varun@drinkeden.app',   c:`Sales truth nobody tells you:\n\nI have closed exactly 0 enterprise deals in a meeting room.\n\nEvery single one was at a bar, at a dinner, or at an airport lounge. \n\nThe presentation was the opener. The drink was the closer.\n\n🥃 #sales #revenue #enterprise #b2b`, d:'🥃', l:'📍 Delhi, India', lat:28.613, lng:77.209, img:'' },
  { u:'varun@drinkeden.app',   c:`The Glenlivet 18 at the Delhi airport duty free: ₹4,200.\n\nThe same bottle at a 5-star hotel bar: ₹18,000 a peg.\n\nI bought three bottles. I am carrying them in my laptop bag.\n\nThis is what efficiency looks like. 🥃 #travel #whisky #economics`, d:'🥃', l:'📍 Delhi, India', lat:28.613, lng:77.209, img:'' },

  // Tanya Chopra
  { u:'tanya@drinkeden.app',   c:`I've interviewed 200+ CEOs.\n\nMy method: always suggest a bar over a boardroom.\n\nIn a bar, they're honest. They lean forward. They forget their PR training. The good stuff comes out after the second drink.\n\nThe best interviews happen when guards are down. 🍸\n\n#journalism #interview #media #gin`, d:'🍸', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'' },
  { u:'tanya@drinkeden.app',   c:`The Bombay Canteen on a rainy Tuesday evening is one of the greatest places on earth.\n\nSpiced rum cocktail. Distant thunder. Notebook open. Nobody asking me to "circle back."\n\nThis is the life. 🍹\n\n#mumbai #rain #cocktails #writing #journalists`, d:'🍹', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80' },

  // Akash Joshi
  { u:'akash@drinkeden.app',   c:`Deployed 47 microservices this quarter.\n\nAlso brewed a batch of pale ale at home.\n\nThe pale ale had zero downtime. The microservices had three incidents.\n\nConsidering a career change. 🍺 #devops #microservices #homebrewing #craftbeer`, d:'🍺', l:'📍 Bangalore, India', lat:12.971, lng:77.594, img:'' },
  { u:'akash@drinkeden.app',   c:`Infrastructure analogy that finally helped my PM understand containers:\n\n"A Docker container is like a pint glass. Standardized. Portable. You can run the same beer anywhere."\n\nHe got it immediately. We ordered another round. Meeting adjourned.\n\n🍺 #docker #devops #containers #craftbeer`, d:'🍺', l:'📍 Bangalore, India', lat:12.971, lng:77.594, img:'' },

  // Siddharth Nair
  { u:'siddharth@drinkeden.app',c:`A/B tested two beer menus at a bar event I helped organize.\n\nVersion A: Standard menu with beer descriptions\nVersion B: Same menu but each beer had a "pairs well with: [life situation]"\n\n"Pairs with: pretending to work from home"\nConversion up 340%. Beer sold out.\n\nGrowth hacking is everywhere. 🍺\n\n#growth #ab #testing #craftbeer`, d:'🍺', l:'📍 Bangalore, India', lat:12.971, lng:77.594, img:'' },
  { u:'siddharth@drinkeden.app',c:`My retention funnel:\n\nAcquisition: Someone tells them about a great bar\nActivation: First great drink\nRetention: They bring someone else\nRevenue: They become a regular\nReferral: They become an evangelist\n\nThis is also how DrinkedInn works. And friendships.\n\n🍺 #growth #retention #funnel`, d:'🍺', l:'📍 Bangalore, India', lat:12.971, lng:77.594, img:'' },

  // Manish Gupta (bartender)
  { u:'manish@drinkeden.app',  c:`12 years behind this bar.\n\nWhat I've learned: People don't come for the drink. They come for the feeling.\n\nThey want to feel understood. They want to feel less alone. They want to forget that Tuesday exists.\n\nThe drink is just how I say: I hear you. You're okay.\n\n🍸 #bartender #goa #hospitality #life`, d:'🍸', l:'📍 Goa, India', lat:15.299, lng:74.124, img:'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=80' },
  { u:'manish@drinkeden.app',  c:`New cocktail I've been working on:\n\n• 45ml Amrut Fusion\n• 15ml Coconut water reduction\n• 10ml Tamarind\n• 2 dashes Angostura\n• Stirred. Rocks. Expressed orange peel.\n\nCalling it: "The Mumbai Summer"\n\nBecause it hits you without warning and it's somehow beautiful. 🍸\n\n#cocktail #bartender #recipe #amrut`, d:'🍸', l:'📍 Goa, India', lat:15.299, lng:74.124, img:'' },

  // Sonal Mehta (wine educator)
  { u:'sonal@drinkeden.app',   c:`The most common question I get as a wine educator:\n\n"What's a good wine under ₹2000?"\n\nMy answer: Grover Zampa La Réserve Rouge. Every time.\n\nIndian wine has arrived. We just haven't admitted it yet. 🍷\n\n#wine #india #indian wine #WSET`, d:'🍷', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600&q=80' },
  { u:'sonal@drinkeden.app',   c:`Wine class moment that made my month:\n\nStudent tastes a Burgundy for the first time.\n\nSilent for 30 seconds.\n\n"This tastes like it has feelings."\n\nShe was 24. That's the best tasting note I've ever heard from anyone at any level.\n\n🍷 #wine #education #burgundy #sommelier`, d:'🍷', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'' },

  // Deepak Rao (craft beer)
  { u:'deepak@drinkeden.app',  c:`When I started my craft beer journey 8 years ago there were 3 craft breweries in India.\n\nToday there are 140+.\n\nI have been to most of them.\n\nThis is the most important thing I have contributed to this country's culture.\n\n🍺 #craftbeer #india #brewery #culture`, d:'🍺', l:'📍 Bangalore, India', lat:12.971, lng:77.594, img:'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=600&q=80' },
  { u:'deepak@drinkeden.app',  c:`Unpopular opinion:\n\nKingfisher is fine.\n\nThere. I said it. Not everything needs to be a double dry-hopped hazy NEIPA.\n\nSometimes it's 40 degrees. You're on a beach. You need something cold.\n\nKingfisher understands this. Respect.\n\n🍺 #craftbeer #india #kingfisher #unpopular`, d:'🍺', l:'📍 Goa, India', lat:15.299, lng:74.124, img:'' },
  { u:'deepak@drinkeden.app',  c:`Converted another Kingfisher drinker today.\n\nTook them to Toit. Ordered a Bombshell Blonde and a Bangalore Pale Ale.\n\nThey went silent for 2 minutes after the first sip.\n\n"Why didn't anyone tell me about this?"\n\nCount: 47. 🍺\n\n#craftbeer #bangalore #toit #convert`, d:'🍺', l:'📍 Bangalore, India', lat:12.971, lng:77.594, img:'' },

  // International users
  { u:'james@drinkeden.app',   c:`Singapore whisky scene update:\n\nJoel's Bar just got a 40-year Springbank.\nBlackwattle has a new Japanese omakase whisky experience.\nMR. STORK is back with the best view and a decent Nikka.\n\nLife in Singapore is expensive. The whisky makes it worth it. 🥃\n\n#singapore #whisky #bar #guide`, d:'🥃', l:'🇸🇬 Singapore', lat:1.352, lng:103.819, img:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80' },
  { u:'james@drinkeden.app',   c:`Product lesson I learned at a whisky tasting:\n\nThe host said: "Don't read the label before you taste it. The label tells you what to think. The whisky tells you what it is."\n\nI think about this every time I read user reviews before testing my own product.\n\n🥃 #product #whisky #bias #ux`, d:'🥃', l:'🇸🇬 Singapore', lat:1.352, lng:103.819, img:'' },

  { u:'sofia@drinkeden.app',   c:`I left a €200/day consulting contract to spend a week harvesting grapes in Montalcino.\n\nThe math made no sense. The soul math was perfect.\n\nBrunello di Montalcino starts here: muddy boots, aching back, September sun, and the most beautiful vines you've ever seen. 🍷🇮🇹\n\n#brunello #tuscany #harvest #wine #italy`, d:'🍷', l:'🇮🇹 Tuscany, Italy', lat:43.055, lng:11.489, img:'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&q=80' },
  { u:'sofia@drinkeden.app',   c:`The most important thing a wine educator taught me:\n\n"If you like it, it's a good wine. Everything else is context."\n\nI spent 5 years in wine academia learning to unlearn this.\n\nShe was right from the beginning. 🍷\n\n#wine #education #italy #sommelier`, d:'🍷', l:'🇮🇹 Milan, Italy', lat:45.464, lng:9.189, img:'' },

  { u:'carlos@drinkeden.app',  c:`My grandfather's mezcal recipe is 80 years old.\n\nHarvest: Wild Tobalá agave, 12+ years old.\nCook: 3 days in earthen pit.\nFerment: Open-air, wild yeast, 10 days.\nDistill: Clay pot still.\n\nYou cannot rush this. You cannot automate this. You cannot disrupt this.\n\nSome things are sacred. 🌵\n\n#mezcal #oaxaca #artisanal #tradition`, d:'🍹', l:'🇲🇽 Oaxaca, Mexico', lat:17.073, lng:-96.726, img:'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80' },
  { u:'carlos@drinkeden.app',  c:`Every time someone asks if mezcal is "just tequila with a worm" I age 3 years.\n\nNo.\n\nTequila is ONE agave. Blue Weber. One region. One style.\n\nMezcal is 30+ agave varieties. 8 states. A thousand stories.\n\nAsk me again and I'll age 5 years. 🌵\n\n#mezcal #tequila #mexico #education`, d:'🍹', l:'🇲🇽 Oaxaca, Mexico', lat:17.073, lng:-96.726, img:'' },

  { u:'emma@drinkeden.app',    c:`London gin bar count: officially lost track.\n\nBut I can tell you: The Connaught Bar still makes the best Martini in the world. The trolley, the ritual, the silence before the first sip.\n\nSome experiences are irreplaceable. 🍸🇬🇧\n\n#london #gin #martini #bar #connaught`, d:'🍸', l:'🇬🇧 London, UK', lat:51.507, lng:-0.127, img:'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=600&q=80' },
  { u:'emma@drinkeden.app',    c:`Brand truth I keep telling clients:\n\nYour brand is how the room feels when you walk in.\n\nA great bar has a brand. You feel it before you see the menu. The light. The music. The first thing the bartender says.\n\nThat's the brand. Everything else is decoration. 🍸\n\n#branding #strategy #london #gin`, d:'🍸', l:'🇬🇧 London, UK', lat:51.507, lng:-0.127, img:'' },

  { u:'raj@drinkeden.app',     c:`Dubai advantage nobody talks about:\n\nDuty free on the way IN.\n\nI landed at 2am with three bottles of Glenfarclas and the conviction that I had made excellent financial decisions.\n\nThe portfolio is performing. My liver is philosophical about it. 🥃\n\n#dubai #dutyfree #whisky #finance`, d:'🥃', l:'🇦🇪 Dubai, UAE', lat:25.204, lng:55.270, img:'' },
  { u:'raj@drinkeden.app',     c:`Investment banking truth:\n\nThe best deals get done between 11pm and 2am.\nNot because of the hour.\nBecause of what hour 11pm means in a city like London or New York.\n\nThe whisky loosens the number. The conversation becomes real.\n\nI've never closed a deal over a 9am coffee. 🥃\n\n#banking #deals #whisky #finance`, d:'🥃', l:'🇦🇪 Dubai, UAE', lat:25.204, lng:55.270, img:'' },

  { u:'yuki@drinkeden.app',    c:`My sake has won awards in Paris, London and New York.\n\nThe most important review I ever received was from an 85-year-old farmer in Niigata who tasted it and said:\n\n"It tastes like my mother's cooking."\n\nNo award compares to that. 🍶\n\n#sake #japan #craft #kyoto`, d:'🍶', l:'🇯🇵 Kyoto, Japan', lat:35.011, lng:135.768, img:'https://images.unsplash.com/photo-1519872436884-2d36e8fa1f67?w=600&q=80' },
  { u:'yuki@drinkeden.app',    c:`The difference between cheap sake and great sake:\n\nCheap: Made fast. Maximum yield. Minimum polish.\nGreat: Rice polished to 50% or less. Cold fermentation. Time. Patience.\n\nBoth are called sake. Only one earns silence when tasted.\n\n🍶 #sake #junmai #daiginjo #japan #craft`, d:'🍶', l:'🇯🇵 Kyoto, Japan', lat:35.011, lng:135.768, img:'' },

  { u:'marie@drinkeden.app',   c:`Tasted a 1978 Pomerol at a private dinner in Paris last night.\n\nI don't have the vocabulary for it. I am a sommelier with 20 years experience and I literally did not have words.\n\nI sat in silence for a full minute. The host smiled. He'd waited for that reaction.\n\n🍷🇫🇷 Some wines are not drinks. They are time travel.\n\n#wine #pomerol #paris #sommelier`, d:'🍷', l:'🇫🇷 Paris, France', lat:48.856, lng:2.352, img:'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600&q=80' },

  { u:'tariq@drinkeden.app',   c:`Current collection: 200 bottles.\n\nOldest: 1965 Macallan (unopened. obviously.)\nNewest: Brora 40 Year from last week.\nMost regretted purchase: A blend I won't name.\nMost surprising: An Indian single malt that beat a 25-year Speyside in a blind tasting.\n\n🥃 The collection grows. The shelf space does not.\n\n#whisky #collection #collector #macallan`, d:'🥃', l:'🇦🇪 Dubai, UAE', lat:25.204, lng:55.270, img:'' },

  { u:'marcus@drinkeden.app',  c:`I drove 6 hours to a small distillery in Kentucky that produces 800 cases a year.\n\nThey were sold out.\n\nI drove back. Stopped at a gas station. Found a bottle of their 4-year on the shelf behind the Twizzlers.\n\nThings happen for a reason. 🥃 #bourbon #kentucky #whisky #hunting`, d:'🥃', l:'🇺🇸 Nashville, USA', lat:36.174, lng:-86.767, img:'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&q=80' },
  { u:'marcus@drinkeden.app',  c:`Bourbon myth I'm ending right now:\n\nA higher proof does not mean better bourbon.\n\nSome of the most complex bourbons I've tasted are 90 proof.\nSome of the worst headaches came from 140 proof barrel strength I bought because of hype.\n\nBalance over brute force. Always. 🥃\n\n#bourbon #whisky #education #proof`, d:'🥃', l:'🇺🇸 Nashville, USA', lat:36.174, lng:-86.767, img:'' },

  { u:'kenji@drinkeden.app',   c:`My bar is 12 years old.\n\n200 seats. Never ran a single ad. No social media for 6 years.\n\nJust: be consistent. Make every drink with intention. Remember regulars' orders. Close at 2am no matter what.\n\nThe bar fills itself. Hospitality is not marketing. It's character.\n\n🍶🍸 #bar #osaka #hospitality #japan`, d:'🥃', l:'🇯🇵 Osaka, Japan', lat:34.693, lng:135.502, img:'' },

  { u:'pedro@drinkeden.app',   c:`Port wine tourist: "Is Tawny or Ruby better?"\n\nMe: "What do you want to feel?"\n\nTourist: confused.\n\nMe: Ruby = a bonfire. Tawny = a fireplace. One is excitement. One is home.\n\nTourist: "Then Tawny."\n\nGood answer. 🍷🇵🇹\n\n#port #wine #porto #portugal`, d:'🍷', l:'🇵🇹 Porto, Portugal', lat:41.157, lng:-8.629, img:'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&q=80' },

  { u:'isabelle@drinkeden.app', c:`Champagne is the only wine where the method is inseparable from the result.\n\nSecondary fermentation in the bottle. 15+ months on lees. Riddling. Disgorgement.\n\nEvery bubble is earned. Every bottle is a labor of years.\n\nThis is why I have no patience for Prosecco. That's not an opinion. That's science. 🥂🇫🇷\n\n#champagne #reims #france #wine #method`, d:'🥂', l:'🇫🇷 Reims, France', lat:49.258, lng:4.031, img:'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80' },

  { u:'natasha@drinkeden.app',  c:`I grew up in Moscow. I know vodka.\n\nThen I discovered Negroni in Milan in 2018.\n\nI have never been the same.\n\nI don't know who I was before Campari. She is gone. I am better now. 🍸\n\n#negroni #campari #gin #milan #italy #russia`, d:'🍸', l:'🇮🇹 Milan, Italy', lat:45.464, lng:9.189, img:'' },

  // Extra backchodi posts
  { u:'pallavi@drinkeden.app',  c:`Event planner truth bomb:\n\nYou can cut the DJ budget. You can cut the decor budget.\n\nYou CANNOT cut the bar budget.\n\nI have watched the most beautifully decorated events die because of bad wine. I have watched ugly events become legendary because the bar was exceptional.\n\nThe bar IS the event. 🥂\n\n#events #planning #bar #wine`, d:'🥂', l:'📍 Delhi, India', lat:28.613, lng:77.209, img:'' },
  { u:'pallavi@drinkeden.app',  c:`Three things that will make or break your corporate event:\n\n1. The food\n2. The drinks (but really just this one)\n3. The drinks\n\nIn that order. #events #corporate #bar`, d:'🥂', l:'📍 Delhi, India', lat:28.613, lng:77.209, img:'' },

  { u:'rajesh@drinkeden.app',   c:`25 years in hospitality. Here's what I know:\n\nThe best bars in the world have three things in common:\n\n1. The bartender remembers your name\n2. Your glass is never empty without you noticing\n3. You don't want to leave\n\nThat's it. That's the whole MBA. 🥃\n\n#hospitality #bar #service #expertise`, d:'🥃', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80' },

  { u:'riya@drinkeden.app',     c:`Q4 forecast:\n\n• Revenue: Looking good\n• Expenses: Controlled (mostly)\n• Morale: Directly proportional to the quality of whisky served at the last all-hands\n• Risk: We switched to a cheaper brand. Morale dropped 34%. Correlation established.\n\nRecommendation: This is a fixed cost, not a variable one. 🍸\n\n#finance #cfo #whisky #corporate`, d:'🍸', l:'📍 Mumbai, India', lat:19.076, lng:72.877, img:'' },

  { u:'meenal@drinkeden.app',   c:`Operations lesson learned the hard way:\n\nWe planned a team retreat down to the minute. Transport, hotel, agenda, food.\n\nForgot to plan the bar.\n\nThey closed at 10pm. 22 people. No drinks. No stories.\n\nNever again. The bar is in the budget. The bar is on the agenda. The bar is the strategy. 🥃\n\n#operations #planning #team #retreat`, d:'🥃', l:'📍 Ahmedabad, India', lat:23.022, lng:72.571, img:'' },

  { u:'prachi@drinkeden.app',   c:`The best marketing campaign I ever ran:\n\nBudget: ₹0\nChannel: My personal Instagram\nContent: "Found the perfect gin bar in Bangalore. You need to go."\nResult: Bar went from quiet Tuesday to 3-week waitlist.\n\nAuthenticity is the only marketing strategy that compounds.\n\n🍸 #marketing #cmo #authenticity #gin`, d:'🍸', l:'📍 Bangalore, India', lat:12.971, lng:77.594, img:'' },

  { u:'lena@drinkeden.app',     c:`German wine unpopular opinion:\n\nRiesling is the most complex white grape on earth and the French have done a very good job convincing the world otherwise.\n\nA Mosel Spätlese at 8% with 40 years of age will outlive your Chardonnay and taste better doing it.\n\nI said what I said. 🍷🇩🇪\n\n#riesling #germany #wine #mosel`, d:'🍷', l:'🇩🇪 Berlin, Germany', lat:52.520, lng:13.404, img:'' },

  { u:'alex@drinkeden.app',     c:`Korean drinking culture lesson:\n\nYou never pour your own drink.\nThe oldest person pours first.\nYou face away when drinking in front of elders.\nYou keep everyone's glass full.\n\nThis is not drinking. This is a philosophy.\n\nSeoul has a lot to teach the world about respect at the table. 🥃\n\n#korea #soju #culture #seoul #drinking`, d:'🥃', l:'🇰🇷 Seoul, South Korea', lat:37.566, lng:126.977, img:'' },

  { u:'priyas@drinkeden.app',   c:`McKinsey rule I've broken:\n\nWe say: All recommendations must be data-driven.\n\nI say: The best decisions I've made for clients happened over gin at 11pm when someone finally said what they actually thought.\n\nData informs. Honesty decides.\n\n🍸 #consulting #mckinsey #gin #truth`, d:'🍸', l:'🇸🇬 Singapore', lat:1.352, lng:103.819, img:'' },

  { u:'diego@drinkeden.app',    c:`Cachaça is the most misunderstood spirit on earth.\n\nEveryone thinks Caipirinha. But aged Cachaça — 3 years in Amburana wood — is something else entirely. Coconut, vanilla, a sweetness that sneaks up on you.\n\nBrazil has been sitting on a secret for 500 years.\n\n🍹🇧🇷 #cachaca #brazil #rum #spirit`, d:'🍹', l:'🇧🇷 São Paulo, Brazil', lat:-23.550, lng:-46.633, img:'' },

  { u:'hannah@drinkeden.app',   c:`Convinced 6 people at dinner last night that the best wine on the table was the ₹1800 Riesling I brought.\n\nThey kept reaching for the ₹6000 Barolo.\n\nI finished the Riesling alone.\n\nSometimes being right is a lonely business. 🍷🇩🇪\n\n#riesling #wine #germany #dinner`, d:'🍷', l:'🇩🇪 Cologne, Germany', lat:50.937, lng:6.960, img:'' },
];

function seed() {
  const existingCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (existingCount >= 50) {
    console.log(`ℹ️  Already have ${existingCount} users — skipping demo seed`);
    return;
  }

  console.log(`👥 Seeding demo accounts (current: ${existingCount})...`);

  const iUser  = db.prepare('INSERT OR IGNORE INTO users (name,email,password,title,avatar,drinks,onboarded) VALUES (?,?,?,?,?,?,1)');
  const iPost  = db.prepare('INSERT INTO posts (user_id,content,drink,location,lat,lng,image_url) VALUES (?,?,?,?,?,?,?)');
  const iCheer = db.prepare('INSERT OR IGNORE INTO cheers (user_id,post_id) VALUES (?,?)');
  const iConn  = db.prepare('INSERT OR IGNORE INTO connections (user_id,target_id) VALUES (?,?)');

  // Insert new users
  const emailToId = {};
  NEW_USERS.forEach(u => {
    const { lastInsertRowid } = iUser.run(u.name, u.email, HASH, u.title, u.avatar, u.drinks);
    if (lastInsertRowid) emailToId[u.email] = lastInsertRowid;
  });

  // Re-fetch ALL user ids for cheers/connections
  const allUsers = db.prepare('SELECT id FROM users').all().map(r => r.id);

  // Insert posts
  const newPostIds = [];
  POSTS.forEach(p => {
    const uid = emailToId[p.u] || db.prepare('SELECT id FROM users WHERE email=?').get(p.u)?.id;
    if (!uid) return;
    const pid = iPost.run(uid, p.c, p.d, p.l||'', p.lat||null, p.lng||null, p.img||'').lastInsertRowid;
    newPostIds.push({ pid, uid });
  });

  // Cheer new posts randomly (3–8 cheers each)
  newPostIds.forEach(({ pid, uid }) => {
    const cheerCount = 3 + Math.floor(Math.random() * 6);
    const shuffled = allUsers.filter(id => id !== uid).sort(() => Math.random() - 0.5);
    shuffled.slice(0, cheerCount).forEach(cuid => { try { iCheer.run(cuid, pid); } catch {} });
  });

  // Create connections (each new user connected to 8–15 random others)
  const newIds = Object.values(emailToId);
  newIds.forEach(uid => {
    const count = 8 + Math.floor(Math.random() * 8);
    const shuffled = allUsers.filter(id => id !== uid).sort(() => Math.random() - 0.5);
    shuffled.slice(0, count).forEach(tid => {
      try { iConn.run(uid, tid); iConn.run(tid, uid); } catch {}
    });
  });

  console.log(`✅ Demo seed complete — ${newIds.length} accounts, ${newPostIds.length} posts`);
}

seed();
