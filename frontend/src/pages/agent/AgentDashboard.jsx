import { useEffect, useState } from 'react';
import { getMyAgentOrders, setMyAvailability, setMyZone } from '../../api/agentApi';
import { updateOrderStatus } from '../../api/orderApi';
import { getZones } from '../../api/zoneApi';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';

// Mirrors backend/src/utils/statusTransitions.js — keep in sync if that
// map changes. Used only to decide which buttons to show; the backend is
// still the source of truth and will reject invalid transitions regardless.
const VALID_NEXT = {
  Created: ['Picked Up'],
  'Picked Up': ['In Transit'],
  'In Transit': ['Out for Delivery'],
  'Out for Delivery': ['Delivered', 'Failed'],
  Delivered: [],
  Failed: [],
  Rescheduled: ['Picked Up'],
};

export default function AgentDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [available, setAvailable] = useState(user?.agentDetails?.isAvailable ?? true);
  const [zones, setZones] = useState([]);
  const [myZone, setMyZoneState] = useState(user?.agentDetails?.currentZone?._id || user?.agentDetails?.currentZone || '');
  const [zoneSaving, setZoneSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyAgentOrders();
      setOrders(res.data || res);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your deliveries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getZones()
      .then((res) => setZones(res.data || res))
      .catch(() => {}); // non-fatal — zone picker just stays empty
  }, []);

  const [autoAssignNotice, setAutoAssignNotice] = useState('');

  const toggleAvailability = async () => {
    const next = !available;
    setAvailable(next); // optimistic
    setAutoAssignNotice('');
    try {
      const res = await setMyAvailability(next);
      // Going available can immediately pull in orders that were waiting
      // for someone to be free — refresh the list so they show up right away.
      if (next && res.meta?.autoAssignedCount > 0) {
        setAutoAssignNotice(
          `${res.meta.autoAssignedCount} waiting order(s) were just auto-assigned.`
        );
        load();
      }
    } catch (err) {
      setAvailable(!next); // revert on failure
      setError(err.response?.data?.message || 'Could not update availability.');
    }
  };

  const handleZoneChange = async (e) => {
    const zoneId = e.target.value;
    const previous = myZone;
    setMyZoneState(zoneId); // optimistic
    setZoneSaving(true);
    try {
      await setMyZone(zoneId);
    } catch (err) {
      setMyZoneState(previous); // revert on failure
      setError(err.response?.data?.message || 'Could not update your zone.');
    } finally {
      setZoneSaving(false);
    }
  };

  const handleStatusChange = async (orderId, status) => {
    setUpdating(orderId);
    setError('');
    try {
      await updateOrderStatus(orderId, status);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update status.');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div className="page">Loading your deliveries…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>My deliveries</h1>
        <div className="agent-controls">
          <label className="field-inline">
            <span>My zone</span>
            <select value={myZone} onChange={handleZoneChange} disabled={zoneSaving}>
              <option value="">Not set — won't receive zone-based auto-assignment</option>
              {zones.map((z) => (
                <option key={z._id} value={z._id}>{z.name}</option>
              ))}
            </select>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={available} onChange={toggleAvailability} />
            <span>{available ? 'Available for new assignments' : 'Unavailable'}</span>
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {autoAssignNotice && <div className="alert alert-success">{autoAssignNotice}</div>}

      {orders.length === 0 && <p className="muted">No orders assigned to you right now.</p>}

      <div className="order-list">
        {orders.map((order) => {
          const nextOptions = VALID_NEXT[order.status] || [];
          return (
            <div className="card order-card" key={order._id}>
              <div className="order-card-header">
                <span className="order-id">#{order._id.slice(-8)}</span>
                <StatusBadge status={order.status} />
              </div>
              <p className="muted small">
                Pickup: {order.pickupAddress?.addressLine}, {order.pickupAddress?.city}
              </p>
              <p className="muted small">
                Drop: {order.dropAddress?.addressLine}, {order.dropAddress?.city}
              </p>

              {nextOptions.length > 0 ? (
                <div className="actions">
                  {nextOptions.map((status) => (
                    <button
                      key={status}
                      className={status === 'Failed' ? 'btn btn-danger' : 'btn btn-primary'}
                      disabled={updating === order._id}
                      onClick={() => handleStatusChange(order._id, status)}
                    >
                      Mark {status}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted small">No further action needed.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}