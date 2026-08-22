import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthSidePanel from '../components/AuthSidePanel';
import { getFirstAdminSetupStatus } from '../api/authApi';

const ROLE_HOME = {
  customer: '/customer/place-order',
  agent: '/agent',
  admin: '/admin/orders',
};

export default function SetupFirstAdmin() {
  const { bootstrapAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [setupAvailable, setSetupAvailable] = useState(false);

  useEffect(() => {
    getFirstAdminSetupStatus()
      .then((res) => setSetupAvailable(res.setupAvailable))
      .catch(() => setSetupAvailable(false))
      .finally(() => setCheckingStatus(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await bootstrapAdmin(form);
      navigate(ROLE_HOME[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Setup failed.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthSidePanel />
      <div className="auth-form-side">
        <Link to="/" className="auth-back-link">← Back to home</Link>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>First-time setup</h1>
          <p className="muted">
            Create the first admin account for this platform. This page works
            only once — it disables itself automatically as soon as an admin
            account exists.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          {!checkingStatus && !setupAvailable && (
            <div className="alert alert-error">
              Setup has already been completed. An admin account already
              exists — please <Link to="/login">log in</Link> instead.
            </div>
          )}

          {(checkingStatus || setupAvailable) && (
            <>
              <label>
                Name
                <input
                  required
                  disabled={checkingStatus}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  required
                  disabled={checkingStatus}
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
                  disabled={checkingStatus}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || checkingStatus}
              >
                {loading ? 'Creating admin…' : 'Create first admin'}
              </button>
            </>
          )}

          <p className="muted center">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}