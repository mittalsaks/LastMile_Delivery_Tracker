import { useEffect, useState } from 'react';
import { getZones, createZone, updateZone, deleteZone } from '../../api/zoneApi';
import AdminLayout from '../../components/AdminLayout';

const emptyForm = { name: '', pincodes: '', areas: '' };

export default function AdminZones() {
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getZones();
      setZones(res.data || res);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load zones.');
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
      name: form.name,
      pincodes: form.pincodes.split(',').map((s) => s.trim()).filter(Boolean),
      areas: form.areas.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await updateZone(editingId, payload);
      } else {
        await createZone(payload);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save zone.');
    }
  };

  const handleEdit = (zone) => {
    setEditingId(zone._id);
    setForm({
      name: zone.name,
      pincodes: (zone.pincodes || []).join(', '),
      areas: (zone.areas || []).join(', '),
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this zone?')) return;
    try {
      await deleteZone(id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete zone.');
    }
  };

  return (
    <AdminLayout title="Zones" subtitle="Define pincode and area coverage for each delivery zone.">
      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit zone' : 'Create zone'}</h2>
        <label>
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Pincodes (comma-separated)
          <input
            value={form.pincodes}
            onChange={(e) => setForm({ ...form, pincodes: e.target.value })}
            placeholder="110001, 110002"
          />
        </label>
        <label>
          Areas (comma-separated)
          <input
            value={form.areas}
            onChange={(e) => setForm({ ...form, areas: e.target.value })}
            placeholder="Connaught Place, Karol Bagh"
          />
        </label>
        <div className="actions">
          <button className="btn btn-primary" type="submit">
            {editingId ? 'Save changes' : 'Create zone'}
          </button>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading zones…</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Pincodes</th>
                <th>Areas</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z._id}>
                  <td>{z.name}</td>
                  <td className="small">{(z.pincodes || []).join(', ')}</td>
                  <td className="small">{(z.areas || []).join(', ')}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost small" onClick={() => handleEdit(z)}>
                        Edit
                      </button>
                      <button className="btn btn-danger small" onClick={() => handleDelete(z._id)}>
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
