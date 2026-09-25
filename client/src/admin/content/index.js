// src/admin/content/index.js
// Entry points for the Content & Places panel. The shell imports from here:
//
//   import { ContentList, PlacesAdmin } from './content';
//   ...
//   {page === 'content' && <ContentList permissions={adminPerms} role={adminRole} />}
//   {page === 'places'  && <PlacesAdmin permissions={adminPerms} role={adminRole} />}
//
// Both props are OPTIONAL. `permissions` is an array or Set of permission
// strings from server/lib/permissions.js and `role` is the role name (used
// only for wording). When the shell passes neither, each panel asks the server
// itself via GET /api/admin/roles/me — a route deliberately open to every
// admin — and falls closed if that fails: read views explain themselves,
// mutating controls are never rendered on a guess.

export { default as ContentList } from './ContentList';
export { default as PlacesAdmin } from './PlacesAdmin';
export { default as usePanelPermissions } from './usePanelPermissions';
export { PERMS, can, hasPermissionSource, toPermissionSet } from './permissions';
export { findDuplicateGroups, duplicateNote, normaliseName, normaliseCity } from './duplicates';
