// src/admin/content/index.js
// Entry points for the Content & Places panel. The shell imports from here:
//
//   import { ContentList, PlacesAdmin } from './content';
//   ...
//   {page === 'content' && <ContentList permissions={adminPerms} role={adminRole} />}
//   {page === 'places'  && <PlacesAdmin permissions={adminPerms} role={adminRole} />}
//
// `permissions` is an array or Set of permission strings from
// server/lib/permissions.js; `role` is the role name, used only for wording.
// Pass nothing and the panel fails closed: read views render, every mutating
// control is withheld.

export { default as ContentList } from './ContentList';
export { default as PlacesAdmin } from './PlacesAdmin';
export { PERMS, can, hasPermissionSource } from './permissions';
export { findDuplicateGroups, normaliseName, normaliseCity } from './duplicates';
