import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loginUser, loginAdmin, registerUser, setupFirstAdmin, googleAuth, verifyOtp, resendOtp } from '../api/authApi';

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
    // New accounts never get a token here anymore — registerUser only
    // sends an OTP now (res.needsOtpVerification === true). The caller
    // (Register.jsx) shows the OTP step and completes the session via
    // confirmOtp() below once the code is verified.
    return res;
  }, []);

  // Step 2 of registration: confirm the OTP. Customers get logged in
  // immediately (a token comes back); agents come back without one — they
  // still need admin approval — so nothing to store yet in that case.
  const confirmOtp = useCallback(async (email, otp) => {
    const res = await verifyOtp(email, otp);
    if (!res.token) return res;
    return applySession(res);
  }, []);

  const resendOtpCode = useCallback(async (email) => {
    return resendOtp(email);
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

  // --- Keep React state in sync with localStorage, always ---
  //
  // Without this, `user` in memory can silently drift away from what's in
  // localStorage:
  //  1. Same tab: api/client.js clears localStorage on a 401 and fires
  //     'auth:session-expired'. Without this listener, the page you were on
  //     keeps rendering as "logged in" (since `user` state is untouched)
  //     right up until your NEXT click, which then fires an API call with
  //     no token, gets a fresh 401, and only THEN redirects — looking like
  //     a random logout with no cause.
  //  2. Other tabs: logging in/out in one tab changes localStorage, which
  //     fires the native 'storage' event in every OTHER tab of the same
  //     origin. Without this, those other tabs never find out and keep
  //     showing stale logged-in (or logged-out) UI.
  useEffect(() => {
    const syncFromStorage = () => {
      const raw = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (!token || !raw || raw === 'undefined') {
        setUser(null);
        return;
      }
      try {
        setUser(JSON.parse(raw));
      } catch {
        setUser(null);
      }
    };

    window.addEventListener('auth:session-expired', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener('auth:session-expired', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginAsAdmin,
        loginWithGoogle,
        loginAsAdminWithGoogle,
        register,
        confirmOtp,
        resendOtpCode,
        bootstrapAdmin,
        logout,
      }}
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