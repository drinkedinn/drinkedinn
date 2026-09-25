// client/src/admin/people/__smoke.jsx
// Not shipped — nothing imports it, so Vite never bundles it. It exists so the
// claims this panel makes can be checked rather than believed: every screen
// renders at every permission level, null and missing fields never reach the
// screen as "undefined" or "NaN", no action appears without its permission, and
// a reporter's free text cannot escape peopleApi into the UI.
//
// Run it from client/:
//   ./node_modules/.bin/esbuild src/admin/people/__smoke.jsx --bundle \
//     --platform=node --format=cjs --jsx=automatic \
//     --define:import.meta.env='{"VITE_API_URL":""}' --outfile=/tmp/smoke.cjs \
//   && node /tmp/smoke.cjs
//
// Exits non-zero on any failure.

import { renderToString } from 'react-dom/server';
import PeoplePanel from './PeoplePanel';
import PeopleList from './PeopleList';
import MemberDetail from './MemberDetail';
import RolesPanel from './RolesPanel';
import ActionDialog from './ActionDialog';
import { reportTallyFor } from './peopleApi';

const member = {
  id: 7, name: 'Ada Pour', email: 'ada@example.com', title: 'Bartender',
  avatar: null, onboarded: 1, created_at: '2024-02-11 09:04:00',
  badge: '🏆', verified: 1, premium: 0,
  post_count: 41, connection_count: 12, cheer_count: 130,
};
const sparse = { id: 9 };
const owner = (p) => ['users.read','users.warn','users.suspend','users.ban','users.delete','users.restore','reports.read','roles.read','roles.write'].includes(p);
const none = () => false;

const cases = [
  ['panel-no-perms', <PeoplePanel />],
  ['panel-owner', <PeoplePanel role="owner" permissions={['users.read','roles.read','roles.write','users.delete']} user={{ id: 1 }} />],
  ['list-owner', <PeopleList can={owner} onSelect={() => {}} />],
  ['list-denied', <PeopleList can={none} onSelect={() => {}} />],
  ['detail-owner', <MemberDetail member={member} can={owner} currentUserId={1} rolesKnown />],
  ['detail-self', <MemberDetail member={member} can={owner} currentUserId={7} rolesKnown />],
  ['detail-admin-target', <MemberDetail member={member} can={owner} currentUserId={1} rolesKnown roleRow={{ user_id: 7, role: 'moderator' }} />],
  ['detail-sparse-null-fields', <MemberDetail member={sparse} can={owner} currentUserId={1} />],
  ['detail-readonly', <MemberDetail member={member} can={none} currentUserId={1} />],
  ['detail-null-member', <MemberDetail member={null} can={none} />],
  ['roles-owner', <RolesPanel can={owner} currentUserId={1} />],
  ['roles-denied', <RolesPanel can={none} currentUserId={1} />],
  ['dialog', <ActionDialog title="Delete Ada Pour" tone="danger" confirmName="Ada Pour" summary={<span>effect</span>} onCancel={() => {}} onSubmit={() => {}} />],
  // No `can` prop at all — a shell wiring mistake must fail closed, not throw.
  ['list-no-can', <PeopleList onSelect={() => {}} />],
  ['detail-no-can', <MemberDetail member={member} currentUserId={1} />],
  ['roles-no-can', <RolesPanel currentUserId={1} />],
];

let failures = 0;
const rendered = [];
for (const [name, el] of cases) {
  try {
    // React SSR splits adjacent text nodes with <!-- --> markers. Strip them so
    // an assertion about a sentence is about the sentence, not the plumbing.
    const html = renderToString(el).replace(/<!-- -->/g, '');
    rendered.push([name, html]);
    console.log(`ok   ${name}  (${html.length} chars)`);
  } catch (e) {
    failures += 1;
    console.log(`FAIL ${name}: ${e.message}`);
  }
}

// ── Invariants, not just "it rendered" ───────────────────────────────────────
const assert = (name, ok, msg) => {
  if (ok) { console.log(`ok   ${name}`); return; }
  failures += 1;
  console.log(`FAIL ${name}: ${msg}`);
};

const html = (n) => (rendered.find(([k]) => k === n) || [, ''])[1];

// 1. No password affordance anywhere, at any role.
for (const [name, out] of rendered) {
  assert(`no-password-input:${name}`, !/type="password"/.test(out), 'rendered a password input');
}

// 2. A role with no permissions is offered no action.
assert('denied-no-delete', !/Delete member/.test(html('detail-readonly')), 'Delete offered without users.delete');
assert('denied-no-flags', !/Mark verified|Grant premium/.test(html('detail-readonly')), 'flag buttons offered without users.warn');
assert('denied-no-roster', /roles.read/.test(html('roles-denied')), 'roles-denied did not explain the missing permission');
assert('no-can-denies-list', /users.read/.test(html('list-no-can')), 'list without `can` did not fail closed');
assert('no-can-denies-detail', !/Delete member/.test(html('detail-no-can')), 'detail without `can` offered Delete');

// 3. Self and admin targets are blocked before the server has to refuse.
assert('self-delete-blocked', /cannot delete your own account/i.test(html('detail-self')), 'self-delete not blocked');
assert('admin-delete-blocked', /revoke the role/i.test(html('detail-admin-target')), 'admin-target delete not blocked');

// 4. The reason floor is stated in the dialog, not just enforced.
assert('dialog-states-floor', /8 characters/.test(html('dialog')), 'dialog did not state the 8-character floor');
assert('dialog-states-audit', /audit log/i.test(html('dialog')), 'dialog did not say the action is recorded');
assert('dialog-confirm-name', /Type Ada Pour to confirm/.test(html('dialog')), 'destructive dialog did not demand the typed name');

// 5. A member row with every optional field missing still renders text, not "undefined".
assert('sparse-no-undefined', !/undefined/.test(html('detail-sparse-null-fields')), 'null fields leaked "undefined"');
assert('sparse-no-NaN', !/NaN/.test(html('detail-sparse-null-fields')), 'null counts leaked "NaN"');

// 6. reportTallyFor must never hand a raw reason back to the UI. The child-safety
//    endpoint stores a reporter's free-text account in `reason`; if that string
//    can reach a return value, it can reach the screen.
const SECRET = 'he said he was 14 and she kept messaging him';
const tally = reportTallyFor(7, [
  { target_type: 'user', target_id: 7, reporter_id: 2, status: 'pending', reason: `csae: ${SECRET}` },
  { target_type: 'user', target_id: 7, reporter_id: 3, status: 'resolved', reason: 'spam' },
  { target_type: 'user', target_id: '7', reporter_id: 4, status: 'pending', reason: null },
  { target_type: 'post', target_id: 7, reporter_id: 5, status: 'pending', reason: 'spam' },
  { target_type: 'user', target_id: 9, reporter_id: 7, status: 'pending', reason: 'harassment' },
  null,
  {},
]);
const asText = JSON.stringify(tally);
assert('tally-no-raw-reason', !asText.includes(SECRET), `leaked the reason text: ${asText}`);
assert('tally-received', tally.received === 3, `expected 3 received, got ${tally.received}`);
assert('tally-filed', tally.filed === 1, `expected 1 filed, got ${tally.filed}`);
assert('tally-pending', tally.pendingReceived === 2, `expected 2 open, got ${tally.pendingReceived}`);
assert('tally-severe', tally.severe === 1, `expected 1 child-safety, got ${tally.severe}`);
assert('tally-categories', tally.categories.join(',') === 'child safety,other,spam', `got ${tally.categories.join(',')}`);
assert('tally-bad-id', reportTallyFor(undefined, [{ target_type: 'user', target_id: 7 }]).received === 0, 'a missing member id matched rows');
assert('tally-bad-input', reportTallyFor(7, null).received === 0, 'null report list threw or counted');

console.log(failures ? `\n${failures} FAILURES` : `\nall ${rendered.length} render, all invariants hold`);
process.exit(failures ? 1 : 0);
