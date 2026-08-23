// api/client.js — single axios instance, attaches JWT automatically.
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 (expired/invalid/missing token) — sends user back to login.
//
// IMPORTANT: this used to just wipe localStorage directly. That desyncs
// AuthContext's `user` state (kept in React memory) from localStorage,
// especially across multiple tabs — e.g. a 401 fires in Tab A (background
// poll, stale token, another login overwriting the token, etc.), Tab A
// clears localStorage, but Tab B's UI still *looks* logged in because its
// React state never got told. Then the very next click in Tab B does a
// perfectly normal-looking API call with no token -> instant 401 -> instant
// redirect to /login, with no visible cause ("bina kuch hue login pe chala
// jaana").
//
// Fix: broadcast a custom event so ANY mounted AuthProvider (in this tab or
// synced via the 'storage' listener in AuthContext) clears its `user` state
// at the same moment localStorage is cleared, so the UI never lies about
// being logged in.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      const hadSession = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Let AuthContext (and any other listener) know right now, in this
      // tab, that the session just died — not just "storage changed".
      window.dispatchEvent(new CustomEvent('auth:session-expired'));

      if (hadSession && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;