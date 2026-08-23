import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthSidePanel from '../components/AuthSidePanel';
import GoogleSignInButton from '../components/GoogleSignInButton';

const ROLE_HOME = {
  customer: '/customer/place-order',
  agent: '/agent',
};

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggedInAs, setLoggedInAs] = useState('');

  // If we got here because a protected route (e.g. an order tracking link
  // from an email) redirected an unauthenticated visitor, send them back to
  // that exact page after login instead of always dropping them on the
  // generic role home page.
  const redirectTarget = location.state?.from
    ? location.state.from.pathname + (location.state.from.search || '')
    : null;

  const goHomeFor = (user) => {
    setLoggedInAs(user.role);
    setTimeout(() => {
      navigate(redirectTarget || ROLE_HOME[user.role] || '/');
    }, 900);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      goHomeFor(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    try {
      const user = await loginWithGoogle(credential);
      goHomeFor(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    }
  };

  return (
    <div className="auth-page">
      <AuthSidePanel />
      <div className="auth-form-side">
        <Link to="/" className="auth-back-link">← Back to home</Link>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Log in</h1>
          <p className="muted">Access your delivery dashboard.</p>

          {error && <div className="alert alert-error">{error}</div>}

          {loggedInAs && (
            <div
              className="alert"
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              Logged in as <strong style={{ textTransform: 'capitalize' }}>{loggedInAs}</strong> — redirecting…
            </div>
          )}

          <label>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>

          <p className="muted" style={{ textAlign: 'right', marginTop: '-8px' }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>

          <div className="muted center" style={{ margin: '8px 0' }}>or</div>
          <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError} />

          <p className="muted center">
            No account? <Link to="/register">Register</Link>
          </p>
          <p className="muted center small">
            Are you an admin? <Link to="/admin/login">Admin log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}