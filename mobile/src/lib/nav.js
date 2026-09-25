// src/lib/nav.js
// Navigate by route name from anywhere in the app.
//
// THE TRAP THIS EXISTS FOR
//
// The app has a root stack containing a 'Tabs' route, and the tab navigator
// nested inside it owns Home / Explore / Places / Profile. A navigation action
// bubbles UP through parent navigators — it never reaches DOWN into a nested
// one. So from a screen pushed on the root stack (PostDetail, User, Places
// detail, Safety, anything), `navigation.navigate('Profile')` is not handled by
// anybody: React Navigation walks up, finds no navigator that owns the name,
// and drops it. In dev that logs "The action 'NAVIGATE' ... was not handled by
// any navigator"; in a release build it is a silent no-op and the tap does
// nothing at all.
//
// The same call from a tab screen works, which is why this is easy to miss —
// and why checking only "is the route registered somewhere?" does not catch it.
// The route IS registered. It is just not reachable from there.
//
// navigateByName resolves the name against the navigators actually above the
// caller, and falls back to the nested form through 'Tabs'. It works whether
// the caller sits on the stack or in a tab, and survives a screen being moved
// between the two.

/**
 * @param {object} navigation  the navigation prop / useNavigation() result
 * @param {string} name        route name, e.g. 'Profile' | 'Explore' | 'Home'
 * @param {object} [params]
 */
export function navigateByName(navigation, name, params) {
  if (!navigation?.navigate || !name) return;
  let nav = navigation;
  for (let depth = 0; nav && depth < 6; depth += 1) {
    let names;
    try { names = nav.getState?.()?.routeNames; } catch { names = null; }
    if (Array.isArray(names) && names.includes(name)) {
      nav.navigate(name, params);
      return;
    }
    nav = nav.getParent?.();
  }
  // Not owned by any navigator above us — assume the tab shell.
  navigation.navigate('Tabs', params ? { screen: name, params } : { screen: name });
}

export default navigateByName;
