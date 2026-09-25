// client/src/admin/command/index.js
// Entry points for the integrator.
//
//   import { CommandCentre, AuditLog } from './command';
//   …
//   {page === 'command' && <CommandCentre permissions={adminPerms} role={adminRole} />}
//   {page === 'audit'   && <AuditLog      permissions={adminPerms} role={adminRole} />}
//
// Both props are OPTIONAL. `permissions` is an array or Set of permission
// strings from server/lib/permissions.js; `role` is the role name, used only
// for wording. If the shell does not pass them, each panel resolves the
// caller's own role from GET /api/admin/roles/me instead of guessing.
//
// Gating: CommandCentre needs `analytics.read` (its health strip additionally
// needs `health.read` and fails on its own if absent); AuditLog needs
// `audit.read`. Neither panel writes anything, so no reason prompt applies.

export { default as CommandCentre } from './CommandCentre.jsx';
export { default as AuditLog } from './AuditLog.jsx';
export { default as useAdminIdentity, resetAdminIdentity } from './useAdminIdentity';
export { makeGate } from './permissions';
export { outcomeOf, splitAction, actorLabel } from './AuditRow.jsx';
export { buildDays } from './SignupsChart.jsx';
export { normaliseCountries } from './CountryBars.jsx';
