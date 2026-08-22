import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AuthSidePanel from '../components/AuthSidePanel';
import { resetPassword } from '../api/authApi';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthSidePanel />
      <div className="auth-form-side">
        <Link to="/login" className="auth-back-link">← Back to login</Link>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Reset password</h1>
          <p className="muted">Choose a new password for your account.</p>

          {error && <div className="alert alert-error">{error}</div>}

          {done ? (
            <div
              className="alert"
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              Password reset — redirecting you to log in…
            </div>
          ) : (
            <>
              <label>
                New password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              <label>
                Confirm new password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>

              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
