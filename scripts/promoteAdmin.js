// scripts/promoteAdmin.js
// Grant admin to an existing account. Run once after the account is created.
// Admin is ONLY granted this way — no email-based escalation in the app.
//
//   TURSO_DB_URL=... TURSO_DB_AUTH_TOKEN=... JWT_SECRET=... \
//     node scripts/promoteAdmin.js rahul@drinkedinn.app
//
// Use --force to promote an unverified account (e.g. seeded demo accounts).

require('dotenv').config();

const db = require('../server/db');

async function main() {
  const email = (process.argv[2] || '').toLowerCase();
  const force = process.argv.includes('--force');

  if (!email) {
    console.error('Usage: node scripts/promoteAdmin.js <email> [--force]');
    process.exit(1);
  }

  await db.init();

  const user = await db.get('SELECT id, email_verified FROM users WHERE email = ?', [email]);
  if (!user) {
    console.error(`No account found for ${email}. Register first.`);
    process.exit(1);
  }
  if (!force && user.email_verified !== 1) {
    console.error(`${email} is not email-verified. Verify first, or use --force.`);
    process.exit(1);
  }

  await db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id]);
  console.log(`✅ ${email} is now an admin.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
