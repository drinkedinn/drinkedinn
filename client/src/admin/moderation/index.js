// client/src/admin/moderation/index.js
//
// The Moderation panel. Wire the default export into the admin shell:
//
//   import ModerationQueue from './moderation';
//   …
//   {page === 'moderation' && (
//     <ModerationQueue
//       permissions={adminPermissions}   // Set | string[] — see permissions.js
//       role={adminRole}                 // optional, shown for orientation
//       currentUserId={user.id}          // optional, lets a row say "You"
//     />
//   )}
//
// All three props are OPTIONAL. With none of them the panel asks the server for
// the caller's own role and permissions (GET /api/admin/roles/me, which is
// deliberately not gated — see server/routes/adminRoles.js) and uses that. The
// prop wins when it is given, so the shell stays the single source of truth
// once it has one.
//
// Gating: `reports.read` to see the queue at all, `reports.action` for priority
// and resolve, `reports.assign` for assignment. Buttons an admin cannot use are
// not rendered; the server remains the real gate.

export { default } from './ModerationQueue';
export { default as ModerationQueue } from './ModerationQueue';
export { default as ReportDetail } from './ReportDetail';
export { default as useAdminIdentity } from './useAdminIdentity';
export { PERMS } from './permissions';
