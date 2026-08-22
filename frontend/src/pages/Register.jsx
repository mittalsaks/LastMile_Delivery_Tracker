import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthSidePanel from '../components/AuthSidePanel';
import GoogleSignInButton from '../components/GoogleSignInButton';

const ROLE_HOME = {
  customer: '/customer/place-order',
  agent: '/agent',
};

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [kyc, setKyc] = useState({ aadhaarNumber: '', panNumber: '', drivingLicenseNumber: '' });
  const [docs, setDocs] = useState({ aadhaarDoc: null, panDoc: null, drivingLicenseDoc: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');

  const isAgent = form.role === 'agent';

  const handleDocChange = (field) => (e) => {
    setDocs({ ...docs, [field]: e.target.files?.[0] || null });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPendingMessage('');

    if (isAgent) {
      if (!kyc.aadhaarNumber || !kyc.drivingLicenseNumber || !docs.aadhaarDoc || !docs.drivingLicenseDoc) {
        setError('Aadhaar number, Driving License number, and scans of both documents are required for agents.');
        return;
      }
    }

    setLoading(true);
    try {
      // Agents submit multipart/form-data (identity documents); customers
      // keep submitting a plain object — authApi/axios handles both.
      let payload = form;
      if (isAgent) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        Object.entries(kyc).forEach(([k, v]) => v && fd.append(k, v));
        Object.entries(docs).forEach(([k, v]) => v && fd.append(k, v));
        payload = fd;
      }

      const result = await register(payload);

      // Agents come back without a token — they're pending admin approval,
      // not logged in. Show the message instead of redirecting.
      if (result.agentStatus === 'pending') {
        setPendingMessage(
          result.message ||
            'Registration received. An admin will review your documents before you can log in.'
        );
        setForm({ name: '', email: '', password: '', role: 'customer' });
        setKyc({ aadhaarNumber: '', panNumber: '', drivingLicenseNumber: '' });
        setDocs({ aadhaarDoc: null, panDoc: null, drivingLicenseDoc: null });
        return;
      }

      navigate(ROLE_HOME[result.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    try {
      const user = await loginWithGoogle(credential);
      navigate(ROLE_HOME[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-up failed. Please try again.');
    }
  };

  return (
    <div className="auth-page">
      <AuthSidePanel />
      <div className="auth-form-side">
        <Link to="/" className="auth-back-link">← Back to home</Link>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Create account</h1>
          <p className="muted">Register as a customer or delivery agent.</p>

          {error && <div className="alert alert-error">{error}</div>}

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

          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

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
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>

          <label>
            Account type
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="customer">Customer</option>
              <option value="agent">Delivery agent</option>
            </select>
          </label>
          <p className="muted small">
            Admin accounts are created directly in the database, not through self-registration.
          </p>

          {!isAgent && (
            <>
              <div className="muted center" style={{ margin: '8px 0' }}>or sign up with</div>
              <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError} />
            </>
          )}

          {isAgent && (
            <div className="kyc-section" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', marginTop: '4px' }}>
              <p className="muted small" style={{ marginBottom: '8px' }}>
                Delivery agents must verify their identity. An admin reviews these documents before
                your account can log in.
              </p>

              <label>
                Aadhaar number
                <input
                  required
                  value={kyc.aadhaarNumber}
                  onChange={(e) => setKyc({ ...kyc, aadhaarNumber: e.target.value })}
                />
              </label>
              <label>
                Upload Aadhaar (JPG/PNG/PDF, max 5MB)
                <input required type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleDocChange('aadhaarDoc')} />
              </label>

              <label>
                Driving License number
                <input
                  required
                  value={kyc.drivingLicenseNumber}
                  onChange={(e) => setKyc({ ...kyc, drivingLicenseNumber: e.target.value })}
                />
              </label>
              <label>
                Upload Driving License (JPG/PNG/PDF, max 5MB)
                <input required type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleDocChange('drivingLicenseDoc')} />
              </label>

              <label>
                PAN number <span className="muted small">(optional)</span>
                <input
                  value={kyc.panNumber}
                  onChange={(e) => setKyc({ ...kyc, panNumber: e.target.value })}
                />
              </label>
              <label>
                Upload PAN <span className="muted small">(optional)</span>
                <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleDocChange('panDoc')} />
              </label>
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="muted center">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}