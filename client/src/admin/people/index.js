// client/src/admin/people/index.js
//
// The People panel: member administration and the admin roster.
// Wire the default export into the admin shell:
//
//   import PeoplePanel from './people';
//   …
//   {page === 'people' && (
//     <PeoplePanel
//       permissions={adminPermissions}  // Set | string[] from GET /admin/roles/me
//       role={adminRole}                // optional; used only if permissions is absent
//       currentUserId={user.id}         // lets the panel refuse self-targeting actions
//     />
//   )}
//
// Where the permission set comes from: GET /api/admin/roles/me returns
// { user_id, role, permissions: [...] } and is deliberately NOT gated on
// roles.read, so every admin — down to `support` — can read their own. Fetch it
// once in the shell and pass `permissions` down. With neither prop the panel
// fails closed: read-only, with a banner saying why.
//
// Gating: `users.read` to see anything. Actions are gated individually on
// users.warn / users.suspend / users.ban / users.delete and roles.read /
// roles.write, and are not rendered at all when the role lacks them.

export { default } from './PeoplePanel';
export { default as PeoplePanel } from './PeoplePanel';
export { default as PeopleList } from './PeopleList';
export { default as MemberDetail } from './MemberDetail';
export { default as RolesPanel } from './RolesPanel';
export { default as ActionDialog } from './ActionDialog';
export { PERM } from './usePermissions';
