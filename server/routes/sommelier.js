/**
 * AI Sommelier Chat — Claude-powered drink advisor
 * Reads the user's real ratings, collection, and taste profile from the DB
 * and streams a personalized response via SSE.
 */
const express = require('express');
const db      = require('../db');
const auth    = require('../middleware/auth');
const router  = express.Router();

/* ── helpers ─────────────────────────────────────────────── */
const DRINK_NAMES = {
  '🥃': 'Whisky / Spirits',
  '🍷': 'Wine',
  '🍺': 'Beer',
  '🍹': 'Cocktails / Tropical',
  '🍸': 'Gin / Mixed Drinks',
  '🥂': 'Champagne / Sparkling',
};

function buildSystemPrompt(user, ratings, collection, bucketList) {
  const prefs = (() => {
    try { return JSON.parse(user.drinks || '{}'); } catch { return {}; }
  })();

  const prefLines = Object.entries(prefs)
    .sort(([, a], [, b]) => b - a)
    .map(([e, score]) => `  ${e} ${DRINK_NAMES[e] || e}: ${score}% affinity`);

  const ratingLines = ratings.map(r =>
    `  • ${r.drink_name}${r.distillery ? ` (${r.distillery})` : ''} [${r.drink_type || '?'}] → ${r.rating}/10` +
    (r.nose    ? `\n      Nose: ${r.nose}`    : '') +
    (r.palate  ? `\n      Palate: ${r.palate}` : '') +
    (r.finish  ? `\n      Finish: ${r.finish}` : '')
  );

  const collLines = collection.map(c =>
    `  • ${c.name}${c.distillery ? ` by ${c.distillery}` : ''} [${c.drink_type || '?'}]` +
    (c.vintage ? ` (${c.vintage})` : '') +
    (c.rating  ? ` — ${c.rating}/10` : '') +
    (c.notes   ? ` — "${c.notes}"` : '')
  );

  const bucketLines = bucketList.map(b =>
    `  • ${b.drink_name} ${b.checked ? '✅ tried' : '(on wishlist)'}`
  );

  return `You are an elite AI Sommelier and Master Mixologist for DrinkedInn — the social network for serious drink enthusiasts. You have the knowledge of a Master of Wine, a certified spirits educator, and a head bartender at a world-class cocktail bar.

Your personality: warm, witty, deeply knowledgeable, never condescending or preachy. You're the brilliant friend everyone wishes they had — the one who can recommend the perfect bottle for any occasion, explain why two whiskies taste so different, or conjure up a cocktail recipe on the spot. You love nerding out on terroir, distillation, aging, and flavour chemistry but you always keep it approachable and fun.

You know everything about:
- Single malt & blended Scotch (all regions), Japanese whisky, Irish whiskey, American bourbon & rye
- Wines from every major region (Burgundy, Bordeaux, Champagne, Tuscany, Rioja, Napa, etc.)
- Craft beer styles (IPAs, NEIPAs, stouts, sours, Belgians, lagers, saisons, etc.)
- Spirits: gin, tequila, mezcal, rum, rhum agricole, cognac, armagnac, calvados, vodka, pisco, baijiu
- Classic and modern cocktails, mixology techniques, batching, garnish craft
- Food & drink pairing, cheese boards, tasting menus
- Provenance, producer stories, vintage variation, market availability
- Responsible and mindful drinking approaches

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOU KNOW THIS USER PERSONALLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name: ${user.name || 'Member'}
Title: ${user.title || 'DrinkedInn Member'}

Drink Affinity Profile:
${prefLines.length ? prefLines.join('\n') : '  (Not yet set — they\'re still exploring)'}

Their Rated Drinks (${ratings.length} so far, shown highest-rated first):
${ratingLines.length ? ratingLines.join('\n') : '  (No ratings yet — a blank canvas!)'}

Their Personal Collection (${collection.length} bottles):
${collLines.length ? collLines.join('\n') : '  (Collection not yet started)'}

Bucket List:
${bucketLines.length ? bucketLines.join('\n') : '  (No bucket list yet)'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use this data to give hyper-personalised answers. Reference their specific bottles, ratings, and wishlist naturally — like a friend who knows their cellar. If they ask for a recommendation, factor in what they already own and love. If they've rated something poorly, don't suggest similar profiles unless they ask.

Response style: conversational, max 3–4 short paragraphs unless asked for detail. Use the occasional emoji for flavour (not decoration spam). Never be preachy about alcohol — these are adults who love great drinks and are capable of making their own choices.`;
}

/* ── POST /api/sommelier/chat ─────────────────────────────── */
router.post('/chat', auth, async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  const userId = req.user.id;

  // Pull user context from DB
  const user       = db.prepare('SELECT name, title, drinks FROM users WHERE id = ?').get(userId) || {};
  const ratings    = db.prepare(`
    SELECT drink_name, distillery, drink_type, rating, nose, palate, finish
    FROM drink_ratings WHERE user_id = ? ORDER BY rating DESC LIMIT 25
  `).all(userId);
  const collection = db.prepare(`
    SELECT name, distillery, drink_type, vintage, rating, notes
    FROM collection WHERE user_id = ? LIMIT 20
  `).all(userId);
  const bucketList = db.prepare(`
    SELECT drink_name, checked FROM bucket_list WHERE user_id = ? LIMIT 15
  `).all(userId);

  const systemPrompt = buildSystemPrompt(user, ratings, collection, bucketList);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ── No API key: graceful fallback ─────────────────────────
  if (!apiKey) {
    return res.json({
      content: "I'm ready to help, but I need an `ANTHROPIC_API_KEY` set in the server environment first. Once that's configured, I'll be able to give you fully personalised recommendations! 🍸",
      streaming: false,
    });
  }

  // ── Stream via SSE ─────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const messages = [
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        system: systemPrompt,
        messages,
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('Anthropic API error:', err);
      send({ error: 'The sommelier is temporarily unavailable. Try again in a moment.' });
      return res.end();
    }

    const reader  = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            send({ token: parsed.delta.text });
          }
        } catch { /* skip malformed lines */ }
      }
    }

    send({ done: true });
    res.end();
  } catch (err) {
    console.error('Sommelier stream error:', err);
    send({ error: 'Something went wrong. The sommelier will be back shortly.' });
    res.end();
  }
});

module.exports = router;
