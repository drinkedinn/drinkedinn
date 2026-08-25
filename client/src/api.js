import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'; // On Vercel, /api routes go to the serverless function

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('di_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('di_token');
      localStorage.removeItem('di_user');
      // Reload to a clean signed-out state, but guard against an infinite loop:
      // only reload once per few seconds so a persistent 401 can't spin forever.
      try {
        const last = Number(sessionStorage.getItem('di_401_reload') || 0);
        if (Date.now() - last > 5000) {
          sessionStorage.setItem('di_401_reload', String(Date.now()));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
    return Promise.reject(err);
  }
);

export default api;
