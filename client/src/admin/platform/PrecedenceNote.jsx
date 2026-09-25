// client/src/admin/platform/PrecedenceNote.jsx
//
// The one thing an admin must not get wrong at 3am: an allow-list does NOT
// beat the off switch. Someone who believes it does will leave a broken
// feature running for the people it hurts most, because "the allow-list will
// keep it on for the test accounts anyway".

import { useState } from 'react';
import { C } from './theme';
import { Card, Mono } from './ui';

const STEPS = [
  {
    n: 1,
    title: 'Off wins',
    body: <>If <Mono>enabled</Mono> is off, the answer is <strong style={{ color: C.red }}>no</strong> — for everyone, including allow-listed user ids and staff. Nothing below is even read.</>,
    tone: C.red,
  },
  {
    n: 2,
    title: 'Allow-list forces on',
    body: <>A user id in <Mono>user_ids</Mono> gets the feature and skips every rule below. It only ever turns people <em>on</em> — it never excludes anyone else.</>,
    tone: C.accentHi,
  },
  {
    n: 3,
    title: 'Countries filter out',
    body: <>If <Mono>countries</Mono> is set, anyone outside it is excluded. Codes are matched upper-case; a user with no country recorded never matches.</>,
    tone: C.accentHi,
  },
  {
    n: 4,
    title: 'Staff-only stops here',
    body: <>With <Mono>staff_only</Mono> on, admins get it and everyone else does not — and the rollout percent is <strong>never consulted</strong>.</>,
    tone: C.amber,
  },
  {
    n: 5,
    title: 'Then the rollout percent',
    body: <>0% is off, 100% is on, anything between is a stable slice. The bucket is hashed per flag, so a user in one flag's 10% is not automatically in another's.</>,
    tone: C.green,
  },
];

export default function PrecedenceNote() {
  const [open, setOpen] = useState(true);

  return (
    <Card style={{ padding: '16px 20px', background: C.accent + '0d', borderColor: C.accent + '33' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }} aria-hidden="true">🧭</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>How a flag is decided, in order</div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 12px', color: C.textMuted, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <ol style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map((s) => (
            <li key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 7, background: s.tone + '22', color: s.tone, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.n}
              </span>
              <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6, minWidth: 0 }}>
                <strong style={{ color: C.text }}>{s.title}.</strong>{' '}{s.body}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
