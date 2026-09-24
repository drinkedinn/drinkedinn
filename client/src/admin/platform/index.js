// client/src/admin/platform/index.js
// Entry points for the integrator. PlatformPanel is the whole page; the two
// screens are exported separately in case they are wired as their own routes.

export { default as PlatformPanel } from './PlatformPanel';
export { default as FeatureFlags } from './FeatureFlags';
export { default as AppHealth } from './AppHealth';
export { default } from './PlatformPanel';
