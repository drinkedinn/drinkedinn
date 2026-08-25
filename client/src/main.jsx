import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import AdminApp from './admin/AdminApp.jsx';
import LandingPage from './components/LandingPage.jsx';
import AgeGate from './components/AgeGate.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './index.css';

function Root() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AgeGate>
            <Routes>
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="/welcome" element={<LandingPage />} />
              <Route path="/*" element={<App />} />
            </Routes>
          </AgeGate>
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
