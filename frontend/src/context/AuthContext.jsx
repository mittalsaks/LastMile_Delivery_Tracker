import { createContext, useContext, useState, useCallback } from 'react';
import { loginUser, loginAdmin, registerUser, setupFirstAdmin, googleAuth } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    if (!raw || raw === 'undefined') return null;
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  });

  const applySession = (res) => {
    // Backend returns a flat object: { _id, name, email, role, token }
    const { token, ...userData } = res;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const login = useCallback(async (email, password) => {
    const res = await loginUser({ email, password });
    return applySession(res);
  }, []);

  // Separate credential path — only ever hits /auth/admin-login, which itself
  // refuses to authenticate anyone whose role isn't 'admin'.
  const loginAsAdmin = useCallback(async (email, password) => {
    const res = await loginAdmin({ email, password });
    return applySession(res);
  }, []);

  const register = useCallback(async (payload) => {
    const res = await registerUser(payload);
    // Agents come back without a token (pending approval) — nothing to store yet.
    if (!res.token) return res;
    return applySession(res);
  }, []);

  // One-time bootstrap: creates the first admin and logs them in immediately.
  const bootstrapAdmin = useCallback(async (payload) => {
    const res = await setupFirstAdmin(payload);
    return applySession(res);
  }, []);

  // Google Sign-In — `credential` is the ID token JWT handed to us by
  // Google Identity Services' callback (see GoogleSignInButton component).
  const loginWithGoogle = useCallback(async (credential) => {
    const res = await googleAuth(credential);
    return applySession(res);
  }, []);

  // Admin-only variant — backend rejects unless this Google account's email
  // already belongs to an existing admin (never creates a new account).
  const loginAsAdminWithGoogle = useCallback(async (credential) => {
    const res = await googleAuth(credential, 'admin');
    return applySession(res);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, loginAsAdmin, loginWithGoogle, loginAsAdminWithGoogle, register, bootstrapAdmin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}