#!/usr/bin/env node
/**
 * Replace the four seeded posts that would fail an app-store alcohol review.
 *
 * Apple 1.4.3 and Google Play do not ban alcohol references — an 18+ app may
 * show people enjoying a drink. What they reject is content ENCOURAGING
 * excessive or irresponsible consumption. Nineteen of the twenty-three seeded
 * posts pass that test and are left exactly as they are.
 *
 * These four did not:
 *   #7  "Tried 23 new whiskeys" + "found 4 bars that open at 11am"
 *       — volume and daytime drinking presented as achievements.
 *   #8  "show up slightly tipped to the client meeting"
 *       — intoxication at work, recommended as a strategy.
 *   #9  "replaces your morning standup … we are all at the pub right now"
 *   #22 drinking instead of working, during work hours.
 *
 * The joke in each is about corporate culture, not about drinking, so the
 * voice survives: the subject moves to places and moments, which is where the
 * brand points anyway.
 *
 * Matched on a distinctive fragment rather than by id, so it is safe to run
 * against a database whose ids differ, and safe to run twice — a second run
 * matches nothing and reports 0 updated.
 *
 * Usage:  node scripts/fix-seed-content.js            # dry run
 *         node scripts/fix-seed-content.js --apply
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"/, '').replace(/"$/, '');
  }
  return out;
}
const fileEnv = loadEnvFile(path.join(ROOT, '.env.production'));
const URL_ = process.env.TURSO_DB_URL || fileEnv.TURSO_DB_URL;
const TOKEN = process.env.TURSO_DB_AUTH_TOKEN || fileEnv.TURSO_DB_AUTH_TOKEN;
if (!URL_) { console.error('No TURSO_DB_URL — run: npx vercel env pull .env.production --environment=production'); process.exit(1); }

const { createClient } = require(path.join(ROOT, 'server/node_modules/@libsql/client'));
const db = createClient({ url: URL_, authToken: TOKEN });

// Each `match` is a phrase the rewrite REMOVES, never the opening line.
// Anchoring on text that survives means the script can never tell done from
// not-done and reports "would update" forever. Note also that SQLite LIKE is
// case-insensitive for ASCII, so "The" still matches a rewritten "the".
const REWRITES = [
  { label: "#7", match: "23 new whiskeys", content: "Just submitted my Q3 performance review.\n\nKey achievements:\n\u2705 Found the rooftop with the best sunset in the city\n\u2705 Learned every barman's name at my local\n\u2705 Convinced my team that a 'walking meeting' should end somewhere with a view\n\nSeeking salary appraisal. DMs open. \ud83c\udf07\n\n#performance #leadership #results #places" },
  { label: "#8", match: "slightly tipped", content: "Hot take: the best way to 'disrupt the industry' is to take the client somewhere with character instead of a beige meeting room.\n\nSuddenly everyone is 'aligned.' The deck 'makes sense.' The budget gets approved.\n\nI have 11 years of qualitative data. Will share it over dinner. \ud83c\udf35\n\n#thoughtleadership #disruption #data" },
  { label: "#9", match: "An app that replaces your morning standup", content: "My startup pitch:\n\nAn app that replaces your Monday standup with one good question and a change of scenery.\n\nSame amount of actual work gets done. Team morale goes from 2/10 to 9/10. Burnout drops 100%.\n\nSeeking $2M seed. I already have 6 co-founders. We are all out at the same table right now. \ud83c\udf7d\ufe0f\n\n#startup #funding #innovation #novc" },
  { label: "#22", match: "Convinced my entire team that stand-up meetings", content: "Convinced my entire team that our Friday wrap-up is better somewhere with a terrace.\n\nWe are now 45 minutes into a heated debate about whether pineapple belongs on a pizza.\n\nAll the work got done first. Morale is the highest it has ever been.\n\nBest. Friday. Ever. \ud83c\udf4d\n\n#teamwork #friday #pineapple" },
  { label: "#15", match: "Year 1: More ros\u00e9", content: "My 5-year plan:\n\nYear 1: Ros\u00e9\nYear 2: Ros\u00e9 but in nicer places\nYear 3: Ros\u00e9 in places that have a view\nYear 4: Be known for having good ros\u00e9 taste\nYear 5: Write a LinkedIn post about my ros\u00e9 journey\n\nCurrently on Year 3. Absolutely crushing it. \ud83e\udd42\n\n#goals #planning #ros\u00e9 #vision" },
  { label: "#10", match: "Day 1 of quitting alcohol", content: "Day 1 of my new morning routine:\n\nLost 2 clients. Missed a deadline. Got a parking ticket. Argued with the printer.\n\nDay 2: Back to the old routine.\n\nCorrelation is not causation. But it is suspicious. \ud83e\udded\n\n#habits #routine #productivity" },
  { label: "#12", match: "I showed her my bar cart", content: "My therapist asked what makes me feel at peace.\n\nI showed her a photo of the rooftop I go to when the week has been too long.\n\nShe asked where it was.\n\nI have made a convert. \ud83c\udf07\n\n#therapy #places #peace" },
];

(async () => {
  console.log(APPLY ? 'Applying rewrites…\n' : 'Dry run — nothing will be written.\n');
  let updated = 0, missing = 0;

  for (const r of REWRITES) {
    const rows = await db.execute({
      sql: 'SELECT id, content FROM posts WHERE content LIKE ?',
      args: ['%' + r.match + '%'],
    });
    if (!rows.rows.length) { console.log(`  skip  ${r.label} — not present (already rewritten?)`); missing++; continue; }
    for (const row of rows.rows) {
      if (APPLY) {
        await db.execute({ sql: 'UPDATE posts SET content = ? WHERE id = ?', args: [r.content, row.id] });
      }
      console.log(`  ${APPLY ? 'ok   ' : 'would'} ${r.label} -> post id ${row.id}`);
      updated++;
    }
  }

  const total = await db.execute('SELECT COUNT(*) c FROM posts');
  console.log(`\n  ${updated} post(s) ${APPLY ? 'updated' : 'would be updated'}, ${missing} already clean, ${total.rows[0].c} posts total.`);
  if (!APPLY) console.log('  Re-run with --apply to write.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
