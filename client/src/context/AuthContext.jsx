import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('di_token');
    const saved = localStorage.getItem('di_user');
    if (token && saved) {
      setUser(JSON.parse(saved));
      api.get('/users/me')
        .then(res => { setUser(res.data); localStorage.setItem('di_user', JSON.stringify(res.data)); })
        .catch(logout)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('di_token', token);
    localStorage.setItem('di_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('di_token');
    localStorage.removeItem('di_user');
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await api.get('/users/me');
    setUser(res.data);
    localStorage.setItem('di_user', JSON.stringify(res.data));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
