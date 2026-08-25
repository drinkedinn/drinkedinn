import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import AdminApp from './admin/AdminApp.jsx';
import LandingPage from './components/LandingPage.jsx';
import AgeGate from './components/AgeGate.jsx';
import { PrivacyPolicy, Terms, Guidelines } from './components/LegalPage.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './index.css';

function Root() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Legal pages sit outside the age gate and the auth flow — app store
                reviewers and anyone else must be able to read them with no barrier. */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/guidelines" element={<Guidelines />} />

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
