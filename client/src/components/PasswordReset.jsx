// client/src/components/PasswordReset.jsx
//
// The two pages the reset flow needs. Neither existed: the server emailed a
// link to /reset-password and the SPA had no such route, so the link fell
// through the catch-all and rendered the ordinary sign-in form. Nothing read
// the token, so POST /auth/reset-password was never called and the link
// expired unused. The mobile app's "Forgot your password?" opened
// /forgot-password, which was equally absent.
//
// Both sit OUTSIDE AgeGate in main.jsx, like the legal pages. Someone locked
// out of their account cannot be asked to pass a gate that stores its answer
// against a session they do not have.

import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';

function Shell({ children, t }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at 50% 100%, ${t.accent}15 0%, ${t.bg} 65%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ marginBottom: 24 }}><Logo /></div>
      <div style={{
        width: '100%', maxWidth: 420, background: t.card,
        border: `1px solid ${t.border}`, borderRadius: 18, padding: 28,
      }}>
        {children}
      </div>
      <p style={{ marginTop: 20 }}>
        <Link to="/" style={{ color: t.textMuted, fontSize: 13, textDecoration: 'none' }}>
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}

function field(t, props) {
  return (
    <input
      {...props}
      style={{
        width: '100%', background: t.inputBg, border: `1.5px solid ${t.border}`,
        borderRadius: 12, padding: '14px 18px', color: t.text, fontSize: 15,
        outline: 'none', marginBottom: 12, fontFamily: 'Inter, sans-serif',
      }}
    />
  );
}

function button(t, { loading, children }) {
  return (
    <button type="submit" disabled={loading} style={{
      width: '100%', padding: 14,
      background: loading ? t.cardAlt : 'linear-gradient(135deg, #f5a623, #ffcc5c)',
      border: 'none', borderRadius: 12, color: loading ? t.textMuted : '#fff',
      fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
    }}>
      {children}
    </button>
  );
}

const noteStyle = (t, danger) => ({
  background: danger ? t.dangerBg : t.cardAlt,
  border: `1px solid ${danger ? t.dangerBorder : t.border}`,
  borderRadius: 10, padding: '12px 14px',
  color: danger ? t.danger : t.text, fontSize: 13, marginBottom: 16,
});

export function ForgotPassword() {
  const { t } = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      // Deliberately ignored. The endpoint answers identically whether or not
      // the address exists, and showing an error here would leak through the
      // error channel what the response body is careful not to say.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Shell t={t}>
        <h1 style={{ color: t.text, fontSize: 22, marginTop: 0 }}>Check your inbox</h1>
        <div style={noteStyle(t)}>
          If that address has an account, a reset link is on its way. It is good
          for one hour and can be used once.
        </div>
        <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>
          Nothing arrived? Check spam, then try again — requesting a new link
          replaces the previous one.
        </p>
      </Shell>
    );
  }

  return (
    <Shell t={t}>
      <h1 style={{ color: t.text, fontSize: 22, marginTop: 0 }}>Reset your password</h1>
      <p style={{ color: t.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20 }}>
        Enter the email you signed up with and we'll send you a link.
      </p>
      <form onSubmit={submit}>
        {field(t, {
          type: 'email', required: true, placeholder: 'Email Address',
          value: email, onChange: (e) => setEmail(e.target.value),
        })}
        {button(t, { loading, children: loading ? 'Sending…' : 'Send reset link' })}
      </form>
    </Shell>
  );
}

export function ResetPassword() {
  const { t } = useTheme();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Those passwords do not match.');

    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, password });
      // The reset bumps token_version, so every prior session is already dead.
      // The endpoint hands back a token minted at the new version — using it
      // means a successful reset lands the user signed in rather than bouncing
      // them to the login screen, which reads as the reset having failed.
      if (data?.token) login(data.token, data.user);
      window.location.assign('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset your password.');
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Shell t={t}>
        <h1 style={{ color: t.text, fontSize: 22, marginTop: 0 }}>Link incomplete</h1>
        <div style={noteStyle(t, true)}>
          This page needs a reset token, and the link you followed has none.
          Some mail clients shorten long links — try copying it in full.
        </div>
        <Link to="/forgot-password" style={{ color: t.accent, fontSize: 14 }}>
          Request a new link
        </Link>
      </Shell>
    );
  }

  return (
    <Shell t={t}>
      <h1 style={{ color: t.text, fontSize: 22, marginTop: 0 }}>Choose a new password</h1>
      <p style={{ color: t.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20 }}>
        This signs you out everywhere else.
      </p>
      <form onSubmit={submit}>
        {field(t, {
          type: 'password', required: true, placeholder: 'New password',
          value: password, onChange: (e) => setPassword(e.target.value),
        })}
        {field(t, {
          type: 'password', required: true, placeholder: 'Confirm new password',
          value: confirm, onChange: (e) => setConfirm(e.target.value),
        })}
        {error && <div style={noteStyle(t, true)}>{error}</div>}
        {button(t, { loading, children: loading ? 'Saving…' : 'Set new password' })}
      </form>
    </Shell>
  );
}
