// client/src/admin/command/__smoke.jsx
//
// Not shipped and not imported by index.js — it exists so the null-handling
// claims in this panel can be checked rather than asserted. It renders every
// state of every component against missing, malformed and legacy-shaped data
// and fails loudly if any of them throws.
//
//   cd client
//   ./node_modules/.bin/esbuild --bundle src/admin/command/__smoke.jsx \
//     --outfile=/tmp/smoke.cjs --format=cjs --jsx=automatic --platform=node \
//     --define:import.meta.env='{}' && node /tmp/smoke.cjs
//
import { renderToStaticMarkup } from 'react-dom/server';
import CommandCentre from './CommandCentre.jsx';
import AuditLog from './AuditLog.jsx';
import AuditRow from './AuditRow.jsx';
import SignupsChart from './SignupsChart.jsx';
import CountryBars from './CountryBars.jsx';
import HealthStrip from './HealthStrip.jsx';

let fails = 0;
const t = (label, fn) => {
  try { const html = fn(); console.log(`ok   ${label} (${html.length} chars)`); }
  catch (e) { fails++; console.log(`FAIL ${label}: ${e.message}`); }
};
const R = (el) => renderToStaticMarkup(el);

t('CommandCentre full perms', () => R(<CommandCentre role="owner" permissions={['analytics.read','health.read']} />));
t('CommandCentre no perms', () => R(<CommandCentre role="support" permissions={['users.read']} />));
t('CommandCentre analytics only', () => R(<CommandCentre role="marketing" permissions={['analytics.read']} />));
t('CommandCentre no props', () => R(<CommandCentre />));
t('AuditLog with perm', () => R(<AuditLog role="owner" permissions={['audit.read']} />));
t('AuditLog denied', () => R(<AuditLog role="moderator" permissions={['content.read']} />));
t('AuditLog no props', () => R(<AuditLog />));

const rows = [
  {},
  { id: 1, actor_id: null, action: null, target_type: null, target_id: null, detail: null, created_at: null },
  { id: 2, actor_id: 0, action: 'DELETE /api/admin/users/:id', target_type: 'id', target_id: '9', created_at: Date.now(),
    detail: { role: 'owner', status: 403, ok: false, reason: 'policy violation repeat', body: { reason: 'policy violation repeat', password: '[redacted]', nested: '[object]', n: 3, b: true, z: null, e: '' }, ms: 12 } },
  { id: 3, actor_name: 'Ada', actor_email: 'a@b.c', action: 'brand.review', target_type: 'brand', target_id: '4', created_at: Date.now(),
    detail: { status: 'active', verified: true } },
  { id: 4, action: 'user.delete', created_at: '1700000000000', detail: 'not-json-parsed' },
  { id: 5, action: 'PUT /api/admin/flags/:key', created_at: Date.now(), detail: { ok: true, status: 200, role: 'engineering', body: {}, ms: 3 } },
];
rows.forEach((row, i) => {
  t(`AuditRow #${i} collapsed`, () => R(<table><tbody><AuditRow row={row} expanded={false} onToggle={()=>{}} columnCount={6} domId={`k${i}`} /></tbody></table>));
  t(`AuditRow #${i} expanded`, () => R(<table><tbody><AuditRow row={row} expanded onToggle={()=>{}} columnCount={6} domId={`k${i}`} /></tbody></table>));
});

t('SignupsChart null', () => R(<SignupsChart signups={null} loading={false} />));
t('SignupsChart loading', () => R(<SignupsChart signups={undefined} loading />));
t('SignupsChart real', () => R(<SignupsChart signups={[{day:'2026-09-20',c:4},{day:'2026-09-24',c:11}]} loading={false} />));
t('SignupsChart junk', () => R(<SignupsChart signups={[null, {day:{}, c:'x'}, 'nope']} loading={false} />));
t('CountryBars null', () => R(<CountryBars countries={null} loading={false} />));
t('CountryBars loading', () => R(<CountryBars countries={[]} loading />));
t('CountryBars real', () => R(<CountryBars countries={[{country:'IN',c:900},{country:'US',c:120},{country:'ZZZ',c:3},{country:'',c:1}]} loading={false} />));
t('HealthStrip null', () => R(<HealthStrip health={null} loading={false} error={null} denied={false} role="owner" />));
t('HealthStrip denied', () => R(<HealthStrip health={null} loading={false} error={null} denied role="support" />));
t('HealthStrip error', () => R(<HealthStrip health={null} loading={false} error="Could not load." denied={false} />));
t('HealthStrip ok', () => R(<HealthStrip health={{db:'ok',r2:'local-disk',checked_at:Date.now()}} loading={false} error={null} denied={false} />));
t('HealthStrip db error', () => R(<HealthStrip health={{db:'error',db_error:'SQLITE_BUSY',r2:'weird',checked_at:null}} loading={false} error={null} denied={false} />));

console.log(fails ? `\n${fails} FAILURES` : '\nall render checks passed');
process.exit(fails ? 1 : 0);
