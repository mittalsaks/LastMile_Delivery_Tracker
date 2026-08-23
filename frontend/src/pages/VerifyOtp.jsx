import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthSidePanel from '../components/AuthSidePanel';

const ROLE_HOME = {
  customer: '/customer/place-order',
  agent: '/agent',
};

const RESEND_COOLDOWN_SECONDS = 30;

// Step 2 of registration (and the gate landing spot if someone tries to log
// in before finishing it). Expects router state: { email, message? }.
// If someone lands here directly with no email in state, send them back to
// register — there's nothing to verify.
export default function VerifyOtp() {
  const { confirmOtp, resendOtpCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || '';
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(location.state?.message || '');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pendingMessage, setPendingMessage] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const result = await confirmOtp(email, otp.trim());

      // Agents come back without a token — verified, but still pending
      // admin approval of their documents.
      if (result.agentStatus === 'pending') {
        setPendingMessage(
          result.message || 'Email verified. An admin will review your documents before you can log in.'
        );
        return;
      }

      navigate(ROLE_HOME[result.role] || '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    try {
      const res = await resendOtpCode(email);
      setInfo(res.message || 'A new code has been sent.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend the code. Please try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthSidePanel />
      <div className="auth-form-side">
        <Link to="/register" className="auth-back-link">← Back to register</Link>

        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Verify your email</h1>
          <p className="muted">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below to finish creating your
            account.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          {info && !pendingMessage && (
            <div
              className="alert"
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              {info}
            </div>
          )}

          {pendingMessage && (
            <div
              className="alert"
              style={{
                background: 'rgba(234,179,8,0.15)',
                color: '#eab308',
                border: '1px solid rgba(234,179,8,0.3)',
              }}
            >
              {pendingMessage}
            </div>
          )}

          {!pendingMessage && (
            <>
              <label>
                6-digit code
                <input
                  ref={inputRef}
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  style={{ letterSpacing: '6px', fontSize: '20px', textAlign: 'center' }}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </label>

              <button className="btn btn-primary" type="submit" disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying…' : 'Verify & continue'}
              </button>

              <p className="muted center" style={{ marginTop: '8px' }}>
                Didn't get a code?{' '}
                <button
                  type="button"
                  className="auth-inline-back"
                  style={{ display: 'inline', padding: 0 }}
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
                </button>
              </p>
            </>
          )}

          {pendingMessage && (
            <Link to="/login" className="btn btn-primary" style={{ textAlign: 'center' }}>
              Go to login
            </Link>
          )}

          <p className="muted center">
            Wrong email? <Link to="/register">Start over</Link>
          </p>
        </form>
      </div>
    </div>
  );
}