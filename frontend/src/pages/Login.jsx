import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthSidePanel from '../components/AuthSidePanel';
import GoogleSignInButton from '../components/GoogleSignInButton';

const ROLE_HOME = {
  customer: '/customer/place-order',
  agent: '/agent',
};

const ROLE_LABELS = {
  customer: 'Customer',
  agent: 'Delivery agent',
};

export default function Login() {
  const { login, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Step 1: which role is this login for? null = still on the picker screen.
  // Admin is handled by navigating straight to the separate /admin/login page —
  // it's never a tab on this shared form.
  const [selectedRole, setSelectedRole] = useState(null);

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

  // Guards against logging in as the wrong role from this tab — e.g. picking
  // "Customer" but entering an agent's credentials. The backend has no way
  // to know which tab the person meant, so this check happens here: if the
  // account's real role doesn't match the tab they chose, we immediately
  // sign them back out instead of letting them into the wrong dashboard.
  const enforceSelectedRole = (user) => {
    if (user.role !== selectedRole) {
      logout();
      setError(
        `This account is registered as ${ROLE_LABELS[user.role] || user.role}, not ${
          ROLE_LABELS[selectedRole] || selectedRole
        }. Go back and pick the right role.`
      );
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (enforceSelectedRole(user)) {
        goHomeFor(user);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    try {
      const user = await loginWithGoogle(credential);
      if (enforceSelectedRole(user)) {
        goHomeFor(user);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    }
  };

  const chooseRole = (role) => {
    if (role === 'admin') {
      navigate('/admin/login');
      return;
    }
    setError('');
    setForm({ email: '', password: '' });
    setSelectedRole(role);
  };

  return (
    <div className="auth-page">
      <AuthSidePanel />
      <div className="auth-form-side">
        <Link to="/" className="auth-back-link">← Back to home</Link>

        {!selectedRole && (
          <div className="auth-card">
            <h1>Log in</h1>
            <p className="muted">Choose how you want to log in.</p>

            <div className="role-picker">
              <button type="button" className="role-option" onClick={() => chooseRole('customer')}>
                <span className="role-option-title">Customer</span>
                <span className="role-option-desc">Place and track your orders</span>
              </button>
              <button type="button" className="role-option" onClick={() => chooseRole('agent')}>
                <span className="role-option-title">Delivery agent</span>
                <span className="role-option-desc">Manage your delivery assignments</span>
              </button>
              <button type="button" className="role-option" onClick={() => chooseRole('admin')}>
                <span className="role-option-title">Admin</span>
                <span className="role-option-desc">Manage zones, rates, agents &amp; orders</span>
              </button>
            </div>

            <p className="muted center">
              No account? <Link to="/register">Register</Link>
            </p>
          </div>
        )}

        {selectedRole && (
          <form className="auth-card" onSubmit={handleSubmit}>
            <button
              type="button"
              className="auth-inline-back"
              onClick={() => {
                setSelectedRole(null);
                setError('');
              }}
            >
              ← Change role
            </button>
            <h1>Log in as {ROLE_LABELS[selectedRole]}</h1>
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

            {selectedRole === 'customer' && (
              <>
                <div className="muted center" style={{ margin: '8px 0' }}>or</div>
                <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError} />
              </>
            )}

            <p className="muted center">
              No account? <Link to="/register">Register</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}