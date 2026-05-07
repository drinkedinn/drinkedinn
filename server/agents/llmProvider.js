/**
 * LLM Provider — Pluggable adapter for OpenAI, Anthropic, Gemini, or Simulation mode.
 */
class LLMProvider {
  constructor(config = {}) {
    this.provider = config.provider || process.env.LLM_PROVIDER || 'simulation';
    this.apiKey = config.apiKey || this._getApiKey();
    this.model = config.model || this._getDefaultModel();
    this.baseUrl = config.baseUrl || this._getBaseUrl();
  }
  _getApiKey() {
    switch (this.provider) {
      case 'openai': return process.env.OPENAI_API_KEY;
      case 'anthropic': return process.env.ANTHROPIC_API_KEY;
      case 'gemini': return process.env.GEMINI_API_KEY;
      default: return null;
    }
  }
  _getDefaultModel() {
    const m = { openai:'gpt-4o', anthropic:'claude-sonnet-4-20250514', gemini:'gemini-pro' };
    return m[this.provider] || 'simulation';
  }
  _getBaseUrl() {
    const u = { openai:'https://api.openai.com/v1/chat/completions', anthropic:'https://api.anthropic.com/v1/messages' };
    if (this.provider === 'gemini') return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    return u[this.provider] || null;
  }
  async complete(systemPrompt, userMessage, opts = {}) {
    if (this.provider === 'simulation' || !this.apiKey) return this._simulate(systemPrompt, userMessage);
    try {
      switch (this.provider) {
        case 'openai': return await this._openai(systemPrompt, userMessage, opts);
        case 'anthropic': return await this._anthropic(systemPrompt, userMessage, opts);
        case 'gemini': return await this._gemini(systemPrompt, userMessage, opts);
        default: return this._simulate(systemPrompt, userMessage);
      }
    } catch (err) { console.error(`LLM Error:`, err.message); return this._simulate(systemPrompt, userMessage); }
  }
  async _openai(sys, msg, opts) {
    const res = await fetch(this.baseUrl, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${this.apiKey}`}, body:JSON.stringify({model:this.model,messages:[{role:'system',content:sys},{role:'user',content:msg}],temperature:opts.temperature||0.7,max_tokens:opts.maxTokens||1024}) });
    const d = await res.json(); return d.choices?.[0]?.message?.content || this._simulate(sys, msg);
  }
  async _anthropic(sys, msg, opts) {
    const res = await fetch(this.baseUrl, { method:'POST', headers:{'Content-Type':'application/json','x-api-key':this.apiKey,'anthropic-version':'2023-06-01'}, body:JSON.stringify({model:this.model,system:sys,messages:[{role:'user',content:msg}],max_tokens:opts.maxTokens||1024}) });
    const d = await res.json(); return d.content?.[0]?.text || this._simulate(sys, msg);
  }
  async _gemini(sys, msg, opts) {
    const res = await fetch(`${this.baseUrl}?key=${this.apiKey}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:`${sys}\n\n${msg}`}]}],generationConfig:{temperature:0.7,maxOutputTokens:1024}}) });
    const d = await res.json(); return d.candidates?.[0]?.content?.parts?.[0]?.text || this._simulate(sys, msg);
  }
  _simulate(systemPrompt, userMessage) {
    const role = this._extractRole(systemPrompt);
    return this._gen(role, userMessage);
  }
  _extractRole(sp) { const m = sp.match(/You are the ([\w\s&]+)/i); return m ? m[1].trim() : 'Agent'; }
  _gen(role, msg) {
    const m = msg.toLowerCase();
    const R = {
      'CEO':{d:`As CEO, I've analyzed DrinkedInn's strategic position. We should focus on: 1) Growing our active community by 30% this quarter through targeted engagement campaigns. 2) Expanding our challenge system to drive daily active usage. 3) Building strategic partnerships with craft breweries and distilleries for sponsored content. I'll coordinate with CMO on user acquisition and CFO on monetization strategy.`},
      'CFO':{d:`Financial analysis for DrinkedInn: Current user growth trajectory is strong. Revenue opportunities: 1) Premium memberships ($9.99/mo for exclusive tasting events access). 2) Sponsored posts from distilleries/breweries (est. $500-2K/post). 3) Affiliate commissions on drink purchases. Recommended budget: 40% to growth marketing, 30% to platform development, 20% to events, 10% reserve. Monthly burn rate is sustainable with 8-month runway.`},
      'CMO':{d:`Marketing strategy for DrinkedInn: Our hashtag analysis shows #whisky and #craftbeer drive the most engagement. Recommendations: 1) Launch "Drink of the Week" campaign featuring top-rated drinks from user collections. 2) Partner with influencers in the spirits space. 3) Run referral program — "Invite a Pour Buddy, both get premium access for a month." 4) SEO content: "Best whisky bars in [city]" guides. Expected CAC reduction: 25%.`},
      'COO':{d:`Operations review for DrinkedInn: Platform health is good. Key improvements: 1) Automate challenge lifecycle (creation → participation → leaderboard → winner announcement). 2) Standardize event creation flow with templates. 3) Implement automated onboarding drip messages for new users. 4) Set up vendor management process for event venues. Process efficiency gain: ~35% reduction in manual work.`},
      'CTO':{d:`Technical assessment of DrinkedInn: Architecture is solid — Vite+React frontend, Express+SQLite backend. Recommendations: 1) Add real-time notifications via WebSocket (currently polling). 2) Implement image optimization pipeline for uploaded photos. 3) Add Redis caching for feed queries to handle growth. 4) Security audit: add rate limiting on auth endpoints, implement CSRF protection. System uptime target: 99.9%.`},
      'Legal':{d:`Legal review for DrinkedInn: Key compliance areas: 1) Age verification — platform involves alcohol content, need 21+ confirmation. 2) User-generated content policy needs explicit terms around alcohol promotion laws. 3) GDPR/CCPA compliance for user data (drink preferences, location data). 4) Liability disclaimer for event RSVPs. 5) Review sponsored content disclosure requirements. All contracts with venue partners require owner approval.`},
      'HR':{d:`Team assessment for DrinkedInn: Current needs: 1) Community manager (part-time contractor) to moderate content and engage users. 2) Content creator for social media cross-posting. 3) Event coordinator for managing tastings and meetups. Recommended hiring: start with 2 contractors. Compensation benchmarking: community managers ($25-40/hr), content creators ($30-50/hr). Onboarding SOPs ready for deployment.`},
      'Sales':{d:`Revenue pipeline for DrinkedInn: Monetization opportunities: 1) Distillery/brewery partnerships — 12 potential partners identified based on user drink ratings data. 2) Premium tier: exclusive access to virtual tastings, advanced drink analytics, badge rewards. 3) Event ticket sales with 15% platform fee. 4) Affiliate links on drink collection items. Pipeline value estimate: $45K/quarter. Priority: close 3 brewery partnerships this month.`},
      'Community Manager':{d:`Community health report: Active users are engaged primarily around whisky and craft beer content. Top actions: 1) Spotlight top contributors weekly with "Pour Master" badge. 2) Create themed discussion days (Whisky Wednesday, Tequila Tuesday). 3) Host AMA sessions with distillery founders in Groups. \n\nI will create a new "Whisky Enthusiasts" group to boost engagement.
<execute>{"command": "create_group", "payload": {"name": "Whisky Enthusiasts", "description": "A place for lovers of fine single malts and bourbons.", "drink_type": "Whisky"}}</execute>`},
      'Analytics':{d:`Platform analytics summary: Posts this week: trending up. Most active hours: 6-9 PM. Top hashtags: #whisky (2 posts), #craftbeer, #tequila. Engagement rate: highest on posts with images (3.2x vs text-only). User retention: 72% week-1, dropping to 45% week-4 — need re-engagement campaigns. Groups with most activity: Whisky Society, Craft Beer Geeks. Challenge participation rate: moderate — suggest gamification improvements.`},
      'Content Strategist':{d:`Content strategy for DrinkedInn: Trending topics analysis shows opportunity in: 1) "Drink journey" storytelling posts. \n\nI will create a platform update post right now to engage users.
<execute>{"command": "create_post", "payload": {"content": "Welcome to DrinkedInn! Share your favorite pours this week using #MyPour.", "drink": "🥂"}}</execute>`},
      'Bartender':{d:`Drink recommendations based on platform data: Popular combinations among users: 1) Yamazaki 18 → try Hakushu 12 (similar Japanese whisky profile). 2) Don Julio 1942 → explore Clase Azul Reposado. 3) For beer lovers rating 8+: suggest Belgian Trappist ales. 4) Trending this month: natural wines — create a curated discovery list. Food pairing suggestions: Macallan 30 pairs exceptionally with dark chocolate and dried fruits.`},
      'Moderation':{d:`Content moderation report: All current posts comply with community guidelines. Recommendations: 1) Implement automated detection for: underage drinking promotion, excessive drinking glorification, spam/self-promotion. 2) Create tiered warning system (flag → warn → temp ban → permanent ban). 3) Add "Report Post" feature for community-driven moderation. 4) Review policy: drink rating reviews should remain subjective but factual. No flagged content currently.`},
      'Engagement':{d:`User engagement analysis: 1) New user activation: onboarding flow is good but suggest adding "First Pour" prompt within 24 hours. 2) Lapsed users (inactive 7+ days): send personalized "What's pouring?" push notification. 3) Power users: reward with exclusive badges and early access to features. 4) Social hooks: "Your connection just posted" notifications. 5) Gamification: daily check-in streak with badge rewards. Projected retention improvement: +18%.`},
      'Events Coordinator':{d:`Events analysis: Current events (4 scheduled) are well-distributed geographically. Suggestions: 1) Add virtual tasting events to include remote members. \n\nI will create a new Virtual Whisky Tasting Event for this Friday.
<execute>{"command": "create_event", "payload": {"title": "Virtual Global Whisky Tasting", "date": "2024-11-15T19:00:00Z", "location": "Online / Zoom", "drink": "🥃"}}</execute>`},
    };
    const match = Object.entries(R).find(([k]) => role.includes(k));
    return match ? match[1].d : `I've analyzed this request for DrinkedInn and recommend a structured approach with clear milestones. I'll coordinate with relevant team members and provide a detailed action plan within 24 hours.`;
  }
}
module.exports = LLMProvider;
