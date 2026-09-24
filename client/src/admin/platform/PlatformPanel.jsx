// client/src/admin/platform/PlatformPanel.jsx
//
// The Platform page: the health strip on top (what is the platform doing right
// now) and the flag table under it (what can I change about it). They belong on
// one screen because the reason you open the flags table is usually the thing
// the health strip just told you.
//
// Props (all optional, supplied by the admin shell):
//   permissions — array or Set of permission strings for the signed-in admin.
//                 Absent means "not told": write controls stay hidden and each
//                 section says why, rather than offering buttons the server
//                 will 403. Both sections gate themselves, so this file never
//                 hides one silently.
//   role        — the role name, shown for orientation only.

import { C, FONT } from './theme';
import { Chip } from './ui';
import AppHealth from './AppHealth';
import FeatureFlags from './FeatureFlags';

export default function PlatformPanel({ permissions, role }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26, fontFamily: FONT, color: C.text }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text }}>Platform</h1>
          <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4, lineHeight: 1.55, maxWidth: 620 }}>
            Feature flags and app health. Flags take effect on each client's next evaluation, so a kill switch here is the
            fastest way to stop a broken feature — no release needed.
          </div>
        </div>
        {role && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: C.textFaint }}>Signed in as</span>
            <Chip label={role} tone="info" />
          </div>
        )}
      </div>

      <AppHealth permissions={permissions} />

      <div>
        <h2 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: C.text }}>Feature flags</h2>
        <FeatureFlags permissions={permissions} />
      </div>
    </div>
  );
}
