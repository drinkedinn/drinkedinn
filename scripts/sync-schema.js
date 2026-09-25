#!/usr/bin/env node
/**
 * Apply the canonical schema to a Turso database, from Node.
 *
 * WHY THIS EXISTS
 * The Worker cannot do this itself. Every statement is an HTTP round trip to
 * Turso and a Worker invocation may make at most 50 subrequests on the free
 * plan; a full db.init() measures 76. It therefore died 26 statements short on
 * every cold isolate AND consumed the whole budget before the route handler
 * ran. server/worker.js no longer calls init() at all -- this script is how
 * schema reaches production.
 *
 * WHY IT DOES NOT JUST CALL init()
 * init() is not only DDL. Lines ~883-890 of server/db.js loop every user and
 * force `onboarded = 1`, overwriting the `drinks` column with a canned demo
 * preset for anyone who has not set one. There are also several seed blocks
 * that insert demo groups, challenges and private messages, and only the first
 * of them honours SKIP_DEMO_SEED. None of that may touch production.
 *
 * So instead: build the canonical schema in a throwaway LOCAL database, diff it
 * against the target, and apply only the additive difference -- CREATE TABLE,
 * CREATE INDEX, and ALTER TABLE ADD COLUMN. Never an UPDATE, DELETE or INSERT.
 * Row counts are asserted unchanged before and after.
 *
 * USAGE
 *   node scripts/sync-schema.js            # dry run -- print the plan, change nothing
 *   node scripts/sync-schema.js --apply    # execute the plan
 *
 * Credentials come from .env.production (or the real environment, which wins).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

// ── credentials ────────────────────────────────────────────────────────────
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

if (!URL_) {
  console.error('No TURSO_DB_URL. Pull it first:');
  console.error('  npx vercel link --yes --scope drinkedinn-dabda538 --project drinkeden');
  console.error('  npx vercel env pull .env.production --environment=production --yes');
  process.exit(1);
}

const { createClient } = require(path.join(ROOT, 'server/node_modules/@libsql/client'));

// ── helpers ────────────────────────────────────────────────────────────────
const schemaOf = async (c) => {
  const r = await c.execute(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'"
  );
  return new Map(r.rows.map((x) => [x.name, { type: x.type, sql: x.sql }]));
};
const columnsOf = async (c, table) => {
  const r = await c.execute(`PRAGMA table_info(${table})`);
  return new Map(r.rows.map((x) => [x.name, x]));
};
const counts = async (c) => {
  const out = {};
  for (const t of ['users', 'posts', 'comments', 'connections']) {
    try { out[t] = String((await c.execute(`SELECT COUNT(*) c FROM ${t}`)).rows[0].c); }
    catch { out[t] = 'n/a'; }
  }
  return out;
};

(async () => {
  // 1. Canonical schema, built in a throwaway local file.
  const tmp = path.join(os.tmpdir(), 'di-schema-ref-' + process.pid + '.db');
  fs.rmSync(tmp, { force: true });

  process.env.TURSO_DB_URL = 'file:' + tmp;
  process.env.TURSO_DB_AUTH_TOKEN = '';
  process.env.SKIP_DEMO_SEED = '1';

  // init() is chatty, and its seed blocks throw harmlessly against an empty
  // scratch database (no users to seed against). None of that noise concerns
  // the caller, who is here for a schema diff -- so both streams are muted for
  // the duration and restored immediately after.
  const realLog = console.log, realErr = console.error;
  console.log = () => {}; console.error = () => {};
  try {
    await require(path.join(ROOT, 'server/db.js')).init();
  } finally {
    console.log = realLog; console.error = realErr;
  }

  const ref = createClient({ url: 'file:' + tmp });
  const target = createClient({ url: URL_, authToken: TOKEN });

  // Local file databases have no host; remote ones get their subdomain masked
  // so a database name never lands in a log or a screenshot.
  let label;
  if (/^file:/.test(URL_)) {
    label = URL_;
  } else {
    try {
      label = new URL(URL_.replace(/^libsql:/, 'https:')).host.replace(/^[^.]+/, '<db>');
    } catch {
      label = '<unparseable url>';
    }
  }
  console.log(`target: ${label}`);

  const [T, R] = await Promise.all([schemaOf(target), schemaOf(ref)]);
  console.log(`target has ${T.size} objects; canonical schema has ${R.size}\n`);

  // 1b. Targeted nullability migrations.
  //
  // The additive diff below can add tables, indexes and columns, but it cannot
  // RELAX a constraint -- SQLite has no "ALTER COLUMN DROP NOT NULL", so that
  // needs a table rebuild. These are listed explicitly rather than inferred,
  // because a rebuild copies data and is not something to derive from a diff.
  //
  // drink_groups.created_by was NOT NULL, so deleting the member who founded a
  // group raised a FOREIGN KEY violation and their account deletion failed
  // outright -- a GDPR / App Store 5.1.1(v) problem. Making it nullable lets
  // lib/deleteUser.js orphan the group instead of destroying it, which keeps
  // the other members' posts.
  const REBUILDS = [
    {
      table: 'drink_groups',
      column: 'created_by',
      reason: 'allow orphaning a group when its founder deletes their account',
      ddl: `CREATE TABLE drink_groups_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              description TEXT DEFAULT '',
              drink_type TEXT DEFAULT '🥃',
              avatar TEXT DEFAULT '',
              created_by INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (created_by) REFERENCES users(id)
            )`,
      copy: `INSERT INTO drink_groups_new (id, name, description, drink_type, avatar, created_by, created_at)
             SELECT id, name, description, drink_type, avatar, created_by, created_at FROM drink_groups`,
    },
  ];

  const rebuilds = [];
  for (const r of REBUILDS) {
    if (!T.has(r.table)) continue;
    const info = await columnsOf(target, r.table);
    const col = info.get(r.column);
    if (!col) continue;
    if (Number(col.notnull) === 0) continue;      // already migrated
    rebuilds.push(r);
  }

  if (rebuilds.length) {
    console.log(`REBUILD -- ${rebuilds.length} table(s) need a constraint relaxed:`);
    for (const r of rebuilds) console.log(`  [nullable] ${r.table}.${r.column}  -- ${r.reason}`);
    console.log('');
  }

  if (rebuilds.length && APPLY) {
    for (const r of rebuilds) {
      const before = Number((await target.execute(`SELECT COUNT(*) c FROM ${r.table}`)).rows[0].c);
      // FK enforcement off across the swap: another table references this one,
      // and the drop/rename would otherwise be refused.
      await target.execute('PRAGMA foreign_keys=OFF');
      try {
        await target.execute(`DROP TABLE IF EXISTS ${r.table}_new`);
        await target.execute(r.ddl);
        await target.execute(r.copy);
        await target.execute(`DROP TABLE ${r.table}`);
        await target.execute(`ALTER TABLE ${r.table}_new RENAME TO ${r.table}`);
      } finally {
        await target.execute('PRAGMA foreign_keys=ON');
      }
      const after = Number((await target.execute(`SELECT COUNT(*) c FROM ${r.table}`)).rows[0].c);
      if (before !== after) {
        console.error(`  !! ${r.table} row count changed ${before} -> ${after} during rebuild`);
        process.exit(1);
      }
      console.log(`  ok    ${r.table}.${r.column} is now nullable (${after} rows preserved)`);
    }
    console.log('');
  }

  // 2. Diff -- additive only.
  const plan = [];
  for (const [name, o] of R) {
    if (!T.has(name)) plan.push({ kind: `create ${o.type}`, name, sql: o.sql });
  }
  for (const [name, o] of R) {
    if (o.type !== 'table' || !T.has(name)) continue;
    const [tc, rc] = await Promise.all([columnsOf(target, name), columnsOf(ref, name)]);
    for (const [cn, ci] of rc) {
      if (tc.has(cn)) continue;
      let sql = `ALTER TABLE ${name} ADD COLUMN ${cn} ${ci.type || 'TEXT'}`;
      if (ci.dflt_value !== null && ci.dflt_value !== undefined) sql += ` DEFAULT ${ci.dflt_value}`;
      plan.push({ kind: 'add column', name: `${name}.${cn}`, sql });
    }
  }

  const orphans = [...T.keys()].filter((n) => !R.has(n));

  if (!plan.length) {
    // Must not claim "in sync" when a rebuild is still outstanding — that
    // reads as "nothing to run" and the migration never gets applied.
    if (rebuilds.length && !APPLY) {
      console.log(`Nothing to add, but ${rebuilds.length} rebuild(s) above are pending.`);
      console.log('Re-run with --apply to perform them.');
    } else {
      console.log('Schema is already in sync. Nothing to do.');
    }
    fs.rmSync(tmp, { force: true });
    return;
  }

  console.log(`PLAN -- ${plan.length} additive statement(s):`);
  for (const p of plan) console.log(`  [${p.kind}] ${p.name}`);
  if (orphans.length) console.log(`\n  target-only, left untouched: ${orphans.join(', ')}`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to execute.');
    fs.rmSync(tmp, { force: true });
    return;
  }

  // 3. Apply, asserting no data moved.
  const before = await counts(target);
  console.log(`\nrow counts before: ${JSON.stringify(before)}\n`);

  let ok = 0, skipped = 0, failed = 0;
  for (const p of plan) {
    try { await target.execute(p.sql); console.log(`  ok    ${p.name}`); ok++; }
    catch (e) {
      if (/already exists|duplicate column/i.test(e.message)) { console.log(`  skip  ${p.name}`); skipped++; }
      else { console.log(`  FAIL  ${p.name}: ${e.message.slice(0, 100)}`); failed++; }
    }
  }

  const after = await counts(target);
  console.log(`\napplied=${ok} skipped=${skipped} failed=${failed}`);
  console.log(`row counts after:  ${JSON.stringify(after)}`);

  fs.rmSync(tmp, { force: true });

  for (const k of Object.keys(before)) {
    if (before[k] !== after[k]) {
      console.error(`\n!! ${k} row count changed ${before[k]} -> ${after[k]} -- this script must never do that`);
      process.exit(1);
    }
  }
  console.log('row counts unchanged - no data was touched');
  if (failed) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
