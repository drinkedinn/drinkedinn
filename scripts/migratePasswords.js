// scripts/migratePasswords.js
// Re-hash accounts from bcrypt to PBKDF2.
//
// Why this exists: bcrypt cost 12 needs ~230ms of CPU, and the Cloudflare
// Workers free tier allows 10ms. Logins for accounts still on bcrypt would
// fail there. Real accounts migrate automatically on their next successful
// login — this script handles the seeded demo accounts, whose passwords are
// known, so they work immediately.
//
//   PASSWORD_PEPPER=... TURSO_DB_URL=... node scripts/migratePasswords.js
//   ...                                  node scripts/migratePasswords.js --dry-run

require('dotenv').config();

const db = require('../server/db');
const pw = require('../server/lib/password');

// Seeded accounts only. Real users are never touched — we don't have their
// plaintext, and guessing is not a migration strategy.
const KNOWN = [
  { match: /@demo\.com$/i, password: 'demo123' },
  { match: /@drinkeden\.app$/i, password: 'demo123' },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.PASSWORD_PEPPER) {
    console.error('PASSWORD_PEPPER must be set — it is mixed into every hash.');
    process.exit(1);
  }

  await db.init();
  const users = await db.all('SELECT id, email, password FROM users');

  let migrated = 0;
  let skippedCurrent = 0;
  const stranded = [];

  for (const u of users) {
    if (!pw.needsRehash(u.password)) { skippedCurrent += 1; continue; }

    const known = KNOWN.find((k) => k.match.test(u.email || ''));
    if (!known) { stranded.push(u.email); continue; }

    // Only re-hash if the known password actually verifies — never overwrite a
    // password that someone has since changed.
    const matches = await pw.verify(known.password, u.password);
    if (!matches) { stranded.push(u.email); continue; }

    if (!dryRun) {
      const upgraded = await pw.hash(known.password);
      await db.run('UPDATE users SET password = ? WHERE id = ?', [upgraded, u.id]);
    }
    migrated += 1;
  }

  console.log(`\n${dryRun ? 'Would migrate' : 'Migrated'}: ${migrated}`);
  console.log(`Already current:  ${skippedCurrent}`);
  console.log(`Still on bcrypt:  ${stranded.length}`);

  if (stranded.length) {
    console.log('\nThese migrate automatically on their next successful login:');
    stranded.slice(0, 20).forEach((e) => console.log(`  ${e}`));
    if (stranded.length > 20) console.log(`  ... and ${stranded.length - 20} more`);
    console.log('\nOn the Workers free tier that one login may exceed the CPU limit.');
    console.log('If it does, the account needs a password reset instead.');
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
