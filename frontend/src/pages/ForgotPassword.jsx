import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthSidePanel from '../components/AuthSidePanel';
import { forgotPassword } from '../api/authApi';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      // Backend always returns a generic success message, whether or not
      // the account exists — don't leak that information here either.
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
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
          <h1>Forgot password</h1>
          <p className="muted">
            Enter your account email and we'll send you a link to reset your password.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          {submitted ? (
            <div
              className="alert"
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              If an account with that email exists, a password reset link has been sent.
              Check your inbox (and spam folder).
            </div>
          ) : (
            <>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </>
          )}

          <p className="muted center">
            Remembered it? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
