import { useState } from 'react';
import { createAdmin } from '../../api/authApi';
import AdminLayout from '../../components/AdminLayout';

const emptyForm = { name: '', email: '', password: '', phone: '' };

export default function AdminUsers() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const newAdmin = await createAdmin(form);
      setSuccess(`Admin account created for ${newAdmin.email}.`);
      setForm(emptyForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Add admin" subtitle="Admin accounts are created here by an existing admin only.">
      <p className="muted">
        Admin accounts can only be created here, by an existing admin. There is no
        public sign-up path for the admin role.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form className="card form-grid" onSubmit={handleSubmit}>
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
          Phone (optional)
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create admin'}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}