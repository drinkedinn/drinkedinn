// server/test/deleteUserCoverage.test.js
//
// A structural check, not an example-based one.
//
// deleteUser.js keeps a hand-maintained list of tables that reference a user.
// Several tables added to db.js after that list was written were never added to
// it, so erasure returned {ok:true} and the API answered {deleted:true} while
// the data was still there — the failure mode a per-table test suite misses,
// because nobody writes a test for the table they forgot.
//
// This reads the schema and fails if the two ever disagree again. A table may
// be covered three ways: listed in OWNED, deleted directly in the function
// body (HANDLED_DIRECTLY), or deliberately kept (RETAINED, which must carry a
// written reason).

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { OWNED, RETAINED, HANDLED_DIRECTLY } = require('../lib/deleteUser');

const SCHEMA = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');

// Columns naming a user, by the conventions this schema uses.
const USER_COL = /\b\w*(?:user|actor|sender|receiver|blocker|blocked|reporter|referrer|referred|owner|member|author|target)\w*_id\b/gi;

// Tables are declared two ways in db.js: individually in a template literal
// ending in `)` + backtick, and as several statements inside one literal, each
// ending in `);`. Matching only the first form found 14 of 42 tables and made
// this check nearly vacuous.
const CREATE_TABLE = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\s*\)\s*[;`]/g;

function tablesReferencingAUser() {
  const found = new Map();
  for (const [, name, body] of SCHEMA.matchAll(CREATE_TABLE)) {
    if (name === 'users') continue;
    // FOREIGN KEY / REFERENCES lines name users(id) rather than declaring a
    // column of this table, so they would produce phantom matches.
    const declarations = body
      .split('\n')
      .filter((l) => !/FOREIGN KEY|REFERENCES/i.test(l))
      .join('\n');
    const cols = [...new Set((declarations.match(USER_COL) || []).map((c) => c.toLowerCase()))].sort();
    if (cols.length) found.set(name, cols);
  }
  return found;
}

describe('account erasure coverage', () => {
  test('the schema scan finds the tables it should', () => {
    // Guards the regex itself. Without this, a pattern that silently matches
    // nothing would make every assertion below pass while proving nothing.
    const total = [...SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS/g)].length;
    const matched = [...SCHEMA.matchAll(CREATE_TABLE)].length;
    assert.equal(matched, total, `parsed ${matched} of ${total} CREATE TABLE statements`);
    assert.ok(tablesReferencingAUser().size >= 25, 'far fewer user-referencing tables than expected');
  });

  test('every table that references a user is erased or explicitly retained', () => {
    const schema = tablesReferencingAUser();
    const accounted = new Set([
      ...OWNED.map(([t]) => t),
      ...RETAINED,
      ...HANDLED_DIRECTLY,
    ]);

    const missing = [...schema.keys()].filter((t) => !accounted.has(t)).sort();

    assert.deepEqual(
      missing,
      [],
      `deleteUser.js neither erases nor retains: ${missing.join(', ')}. ` +
        'Add each to OWNED with its user-referencing column(s), or to RETAINED ' +
        'with the reason it is kept — otherwise account deletion reports success ' +
        'while leaving personal data behind.'
    );
  });

  test('OWNED names only tables that exist, with columns that exist', () => {
    const schema = tablesReferencingAUser();
    // safeRun deliberately swallows "no such table" so an older database still
    // erases what it has — which also means a typo here would never surface.
    const unknown = OWNED.map(([t]) => t).filter((t) => !schema.has(t)).sort();
    assert.deepEqual(unknown, [], `OWNED lists tables absent from the schema: ${unknown.join(', ')}`);

    const badCols = [];
    for (const [table, cols] of OWNED) {
      const actual = schema.get(table) || [];
      for (const c of cols) if (!actual.includes(c.toLowerCase())) badCols.push(`${table}.${c}`);
    }
    assert.deepEqual(badCols, [], `OWNED names columns absent from the schema: ${badCols.join(', ')}`);
  });

  test('every retained table is a real table', () => {
    const schema = tablesReferencingAUser();
    const bogus = RETAINED.filter((t) => !schema.has(t));
    assert.deepEqual(bogus, [], `RETAINED lists tables absent from the schema: ${bogus.join(', ')}`);
  });
});
