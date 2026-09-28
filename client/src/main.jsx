import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import AdminApp from './admin/AdminApp.jsx';
import LandingPage from './components/LandingPage.jsx';
import AgeGate from './components/AgeGate.jsx';
import { PrivacyPolicy, Terms, Guidelines, ChildSafety } from './components/LegalPage.jsx';
import { ForgotPassword, ResetPassword } from './components/PasswordReset.jsx';
import VerifiedBanner from './components/VerifiedBanner.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './index.css';

function Root() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          {/* Outside <Routes> on purpose: it reads ?verified on mount and
              must survive whatever routing decision follows, including the
              redirect to /welcome that drops the query string. */}
          <VerifiedBanner />
          <Routes>
            {/* Legal pages sit outside the age gate and the auth flow — app store
                reviewers and anyone else must be able to read them with no barrier. */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/guidelines" element={<Guidelines />} />
            <Route path="/child-safety" element={<ChildSafety />} />

            {/* Password reset sits out here for the same reason: someone
                locked out of their account cannot be asked to clear an age
                gate first. The server emails a link to /reset-password, and
                without these two routes it fell through to /* and rendered
                the sign-in form — the token was never read. */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route
              path="/*"
              element={
                <AgeGate>
                  <Routes>
                    <Route path="/admin/*" element={<AdminApp />} />
                    <Route path="/welcome" element={<LandingPage />} />
                    <Route path="/*" element={<App />} />
                  </Routes>
                </AgeGate>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
