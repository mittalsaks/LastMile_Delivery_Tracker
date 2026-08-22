import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthSidePanel from '../components/AuthSidePanel';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function AdminLogin() {
  const { loginAsAdmin, loginAsAdminWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginAsAdmin(form.email, form.password);
      navigate('/admin/orders');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    try {
      await loginAsAdminWithGoogle(credential);
      navigate('/admin/orders');
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Google sign-in failed. Make sure this Google account matches an existing admin.'
      );
    }
  };

  return (
    <div className="auth-page">
      <AuthSidePanel />
      <div className="auth-form-side">
        <Link to="/" className="auth-back-link">← Back to home</Link>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Admin log in</h1>
          <p className="muted">This login is only for staff admin accounts.</p>

          {error && <div className="alert alert-error">{error}</div>}

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
            {loading ? 'Logging in…' : 'Log in as admin'}
          </button>

          <div className="muted center" style={{ margin: '8px 0' }}>or</div>
          <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError} />
          <p className="muted small center">
            Only works if this Google account's email matches an existing admin.
          </p>

          <p className="muted center">
            Not an admin? <Link to="/login">Customer / agent log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}