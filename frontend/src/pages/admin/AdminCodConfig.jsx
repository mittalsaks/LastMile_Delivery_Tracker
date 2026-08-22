import { useEffect, useState } from 'react';
import {
  getCodConfigs,
  createCodConfig,
  updateCodConfig,
  deleteCodConfig,
} from '../../api/codConfigApi';
import AdminLayout from '../../components/AdminLayout';

const emptyForm = { orderType: 'B2C', surchargeType: 'flat', value: '' };

export default function AdminCodConfig() {
  const [configs, setConfigs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getCodConfigs();
      setConfigs(res.data || res);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load COD configs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form, value: Number(form.value) };
    try {
      if (editingId) {
        await updateCodConfig(editingId, payload);
      } else {
        await createCodConfig(payload);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save COD config.');
    }
  };

  const handleEdit = (c) => {
    setEditingId(c._id);
    setForm({ orderType: c.orderType, surchargeType: c.surchargeType, value: c.value });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this COD config?')) return;
    try {
      await deleteCodConfig(id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete COD config.');
    }
  };

  return (
    <AdminLayout title="COD surcharge config" subtitle="Set flat or percentage surcharges for cash-on-delivery orders.">
      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit config' : 'Create config'}</h2>
        <div className="row">
          <label>
            Order type
            <select
              value={form.orderType}
              onChange={(e) => setForm({ ...form, orderType: e.target.value })}
            >
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
            </select>
          </label>
          <label>
            Surcharge type
            <select
              value={form.surchargeType}
              onChange={(e) => setForm({ ...form, surchargeType: e.target.value })}
            >
              <option value="flat">Flat (₹)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
          </label>
          <label>
            Value
            <input
              type="number"
              min="0"
              required
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </label>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit">
            {editingId ? 'Save changes' : 'Create config'}
          </button>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading configs…</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order type</th>
                <th>Surcharge type</th>
                <th>Value</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c._id}>
                  <td>{c.orderType}</td>
                  <td>{c.surchargeType}</td>
                  <td>{c.surchargeType === 'percentage' ? `${c.value}%` : `₹${c.value}`}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost small" onClick={() => handleEdit(c)}>
                        Edit
                      </button>
                      <button className="btn btn-danger small" onClick={() => handleDelete(c._id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
