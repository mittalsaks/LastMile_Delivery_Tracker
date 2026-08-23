import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Step 1: which account type is being created? null = still on the picker
  // screen. There is no "Admin" option here — admin accounts are never
  // created through self-registration (see the note rendered below).
  const [selectedRole, setSelectedRole] = useState(null);

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [kyc, setKyc] = useState({ aadhaarNumber: '', panNumber: '', drivingLicenseNumber: '' });
  const [docs, setDocs] = useState({ aadhaarDoc: null, panDoc: null, drivingLicenseDoc: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isAgent = selectedRole === 'agent';

  const handleDocChange = (field) => (e) => {
    setDocs({ ...docs, [field]: e.target.files?.[0] || null });
  };

  const chooseRole = (role) => {
    setError('');
    setForm({ name: '', email: '', password: '', role });
    setSelectedRole(role);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

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

      // registerUser no longer logs anyone in directly — it always sends an
      // OTP first (2-step verification), so hand off to the OTP screen with
      // the email it needs.
      if (result.needsOtpVerification) {
        navigate('/verify-otp', { state: { email: result.email, message: result.message } });
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

        {!selectedRole && (
          <div className="auth-card">
            <h1>Create account</h1>
            <p className="muted">Choose the type of account you want to create.</p>

            <div className="role-picker">
              <button type="button" className="role-option" onClick={() => chooseRole('customer')}>
                <span className="role-option-title">Customer</span>
                <span className="role-option-desc">Place and track your orders</span>
              </button>
              <button type="button" className="role-option" onClick={() => chooseRole('agent')}>
                <span className="role-option-title">Delivery agent</span>
                <span className="role-option-desc">Deliver orders, verified by admin</span>
              </button>
            </div>

            <p className="muted small">
              Admin accounts are created directly in the database, not through self-registration —
              only one admin can access the admin dashboard.
            </p>

            <p className="muted center">
              Already have an account? <Link to="/login">Log in</Link>
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
              ← Change account type
            </button>
            <h1>Create {ROLE_LABELS[selectedRole]} account</h1>
            <p className="muted">
              {isAgent
                ? 'Delivery agents must verify their identity before they can log in.'
                : 'Register as a customer to place and track orders.'}
            </p>

            {error && <div className="alert alert-error">{error}</div>}

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
        )}
      </div>
    </div>
  );
}