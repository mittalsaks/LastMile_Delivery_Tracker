import { useEffect, useState } from 'react';
import { getRateCards, createRateCard, updateRateCard, deleteRateCard } from '../../api/rateCardApi';
import { getZones } from '../../api/zoneApi';
import AdminLayout from '../../components/AdminLayout';

const emptyForm = {
  orderType: 'B2C',
  rateType: 'intra',
  fromZone: '',
  toZone: '',
  baseRate: '',
  ratePerKg: '',
};

export default function AdminRateCards() {
  const [rateCards, setRateCards] = useState([]);
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [rcRes, zRes] = await Promise.all([getRateCards(), getZones()]);
      setRateCards(rcRes.data || rcRes);
      setZones(zRes.data || zRes);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load rate cards.');
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
    const payload = {
      ...form,
      baseRate: Number(form.baseRate),
      ratePerKg: Number(form.ratePerKg),
      toZone: form.rateType === 'intra' ? form.fromZone : form.toZone,
    };
    try {
      if (editingId) {
        await updateRateCard(editingId, payload);
      } else {
        await createRateCard(payload);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save rate card.');
    }
  };

  const handleEdit = (rc) => {
    setEditingId(rc._id);
    setForm({
      orderType: rc.orderType,
      rateType: rc.rateType,
      fromZone: rc.fromZone?._id || rc.fromZone,
      toZone: rc.toZone?._id || rc.toZone,
      baseRate: rc.baseRate,
      ratePerKg: rc.ratePerKg,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rate card?')) return;
    try {
      await deleteRateCard(id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete rate card.');
    }
  };

  const zoneName = (idOrObj) => {
    if (!idOrObj) return '—';
    if (typeof idOrObj === 'object') return idOrObj.name;
    return zones.find((z) => z._id === idOrObj)?.name || idOrObj;
  };

  return (
    <AdminLayout title="Rate cards" subtitle="Base and per-kg pricing for each zone-to-zone route.">
      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit rate card' : 'Create rate card'}</h2>
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
            Rate type
            <select
              value={form.rateType}
              onChange={(e) => setForm({ ...form, rateType: e.target.value })}
            >
              <option value="intra">Intra-zone</option>
              <option value="inter">Inter-zone</option>
            </select>
          </label>
        </div>

        <div className="row">
          <label>
            From zone
            <select
              required
              value={form.fromZone}
              onChange={(e) => setForm({ ...form, fromZone: e.target.value })}
            >
              <option value="" disabled>
                Select zone…
              </option>
              {zones.map((z) => (
                <option key={z._id} value={z._id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          {form.rateType === 'inter' && (
            <label>
              To zone
              <select
                required
                value={form.toZone}
                onChange={(e) => setForm({ ...form, toZone: e.target.value })}
              >
                <option value="" disabled>
                  Select zone…
                </option>
                {zones.map((z) => (
                  <option key={z._id} value={z._id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="row">
          <label>
            Base rate (₹)
            <input
              type="number"
              min="0"
              required
              value={form.baseRate}
              onChange={(e) => setForm({ ...form, baseRate: e.target.value })}
            />
          </label>
          <label>
            Rate per kg (₹)
            <input
              type="number"
              min="0"
              required
              value={form.ratePerKg}
              onChange={(e) => setForm({ ...form, ratePerKg: e.target.value })}
            />
          </label>
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit">
            {editingId ? 'Save changes' : 'Create rate card'}
          </button>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading rate cards…</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Rate type</th>
                <th>From → To</th>
                <th>Base</th>
                <th>Per kg</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rateCards.map((rc) => (
                <tr key={rc._id}>
                  <td>{rc.orderType}</td>
                  <td>{rc.rateType}</td>
                  <td className="small">
                    {zoneName(rc.fromZone)} {rc.rateType === 'inter' ? `→ ${zoneName(rc.toZone)}` : ''}
                  </td>
                  <td>₹{rc.baseRate}</td>
                  <td>₹{rc.ratePerKg}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost small" onClick={() => handleEdit(rc)}>
                        Edit
                      </button>
                      <button className="btn btn-danger small" onClick={() => handleDelete(rc._id)}>
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
