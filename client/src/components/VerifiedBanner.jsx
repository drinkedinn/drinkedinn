// client/src/components/VerifiedBanner.jsx
//
// GET /api/auth/verify redirects to /?verified=… and nothing read it, so a
// successful verification dropped the user on the app root with no sign
// anything had happened — and a signed-out user was then bounced to /welcome,
// discarding the parameter entirely.
//
// This is mounted in main.jsx OUTSIDE <Routes>, and reads the query string
// once on mount. That matters: whatever route decision follows — including a
// redirect to /welcome that drops the query — this component has already
// captured the value and stays mounted through it.

import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const MESSAGES = {
  '1':       { tone: 'ok',   text: 'Email confirmed. You’re all set.' },
  already:   { tone: 'ok',   text: 'That address was already confirmed — nothing more to do.' },
  expired:   { tone: 'warn', text: 'That link has expired. You can ask for a new one from your profile.' },
  missing:   { tone: 'warn', text: 'That link was incomplete. Try copying it in full from the email.' },
  error:     { tone: 'warn', text: 'Something went wrong confirming your email. Please try again.' },
};

export default function VerifiedBanner() {
  const { t } = useTheme();
  const [state, setState] = useState(null);

  useEffect(() => {
    let flag = null;
    try {
      flag = new URLSearchParams(window.location.search).get('verified');
    } catch { /* malformed query strings must not take the app down */ }
    if (!flag || !MESSAGES[flag]) return;

    setState(MESSAGES[flag]);

    // Drop the parameter so a refresh or a shared URL does not re-announce it,
    // without adding a history entry the back button would have to walk through.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('verified');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch { /* replaceState is unavailable in some embedded webviews */ }

    const timer = setTimeout(() => setState(null), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!state) return null;

  const ok = state.tone === 'ok';
  return (
    <div
      role="status"
      style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, maxWidth: 'calc(100vw - 32px)',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 18px', borderRadius: 12,
        background: ok ? (t?.card || '#fff') : (t?.dangerBg || '#fff4f4'),
        border: `1px solid ${ok ? (t?.border || '#e2e2e2') : (t?.dangerBorder || '#f5c2c2')}`,
        color: ok ? (t?.text || '#111') : (t?.danger || '#b42318'),
        boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
        fontSize: 14, fontFamily: 'Inter, sans-serif',
      }}
    >
      <span aria-hidden="true">{ok ? '✅' : '⚠️'}</span>
      <span>{state.text}</span>
    </div>
  );
}
