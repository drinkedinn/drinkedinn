// server/test/helpers.js
// Shared setup for tests that need a database.
//
// Env must be set BEFORE requiring db or config — both read process.env at
// module load.
//
// The database file is per-PROCESS. `node --test` runs each test file in its
// own process, so a single shared path meant several processes writing one
// SQLite file: "SQLITE_BUSY: database is locked", roughly a third of the suite
// red. That was previously contained by pinning --test-concurrency=1, which
// works for `npm test` but leaves a plain `node --test test/` failing for
// reasons that look like real breakage. Isolating the file fixes the cause, so
// the suite is correct however it is invoked — and can run in parallel.
//
// The demo seed is skipped: it is slow, hashes a password per account, and no
// test depends on it.

const path = require('path');
const fs = require('fs');
const os = require('os');

const DB_PATH = path.join(os.tmpdir(), `drinkedinn-test-${process.pid}.db`);

process.env.TURSO_DB_URL = `file:${DB_PATH}`;
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-32';
process.env.NODE_ENV = 'test';
process.env.SKIP_DEMO_SEED = '1';
delete process.env.TURSO_DB_AUTH_TOKEN;

// Leave no litter in the temp directory, however the process ends.
function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(DB_PATH + suffix); } catch {}
  }
}
process.on('exit', cleanup);

const db = require('../db');

let ready = null;
/** Initialise the schema once per process. */
function setup() {
  if (!ready) ready = db.init();
  return ready;
}

/** Wipe the test database entirely — call before a suite that needs a clean slate. */
function reset() {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(DB_PATH + suffix); } catch {}
  }
  ready = null;
}

let seq = 0;
/**
 * Create a user with sensible defaults. Pass `age` for a date of birth.
 */
async function makeUser(overrides = {}) {
  seq += 1;
  const age = overrides.age ?? 30;
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - age);

  const fields = {
    name: `Test ${seq}`,
    email: `t${seq}.${Date.now()}@test.local`,
    password: 'x',
    date_of_birth: overrides.date_of_birth !== undefined ? overrides.date_of_birth : dob.toISOString().slice(0, 10),
    country_code: overrides.country_code ?? 'GB',
    age_assurance_level: overrides.age_assurance_level ?? 0,
    brand_content_opt_out: overrides.brand_content_opt_out ?? 0,
    is_admin: overrides.is_admin ?? 0,
  };

  const cols = Object.keys(fields);
  const { lastInsertRowid } = await db.run(
    `INSERT INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    cols.map((c) => fields[c])
  );
  return db.get('SELECT * FROM users WHERE id = ?', [lastInsertRowid]);
}

async function makePost(userId, content = 'a pour') {
  const { lastInsertRowid } = await db.run(
    'INSERT INTO posts (user_id, content, drink) VALUES (?, ?, ?)',
    [userId, content, '🥃']
  );
  return lastInsertRowid;
}

module.exports = { db, setup, reset, makeUser, makePost, DB_PATH };
