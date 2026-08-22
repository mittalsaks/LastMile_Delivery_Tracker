import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAllOrders,
  assignAgent,
  autoAssignAgent,
  updateOrderStatus,
  reassignForReschedule,
} from '../../api/orderApi';
import { getAllAgents } from '../../api/agentApi';
import { getZones } from '../../api/zoneApi';
import StatusBadge from '../../components/StatusBadge';
import AdminLayout from '../../components/AdminLayout';

const ALL_STATUSES = [
  'Created',
  'Picked Up',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Failed',
  'Rescheduled',
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [zones, setZones] = useState([]);
  // NOTE: keys here must match the backend's GET /api/orders query params
  // exactly (status, zone, agentId) — the agent filter used to be sent as
  // `agent`, which the backend silently ignored (it only reads `agentId`),
  // so filtering by agent never actually worked.
  const [filters, setFilters] = useState({ status: '', zone: '', agentId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v)
      );
      const [ordersRes, agentsRes, zonesRes] = await Promise.all([
        getAllOrders(cleanFilters),
        getAllAgents(),
        getZones(),
      ]);
      setOrders(ordersRes.data || ordersRes);
      setAgents(agentsRes.data || agentsRes);
      setZones(zonesRes.data || zonesRes);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (e) => {
    e.preventDefault();
    load();
  };

  const withBusy = async (orderId, fn) => {
    setBusyId(orderId);
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleManualAssign = (orderId, agentId) => {
    if (!agentId) return;
    withBusy(orderId, () => assignAgent(orderId, agentId));
  };

  const handleAutoAssign = (orderId) => withBusy(orderId, () => autoAssignAgent(orderId));

  const handleOverrideStatus = (orderId, status) => {
    if (!status) return;
    withBusy(orderId, () => updateOrderStatus(orderId, status));
  };

  const handleRescheduleReassign = (orderId, mode) =>
    withBusy(orderId, () => reassignForReschedule(orderId, { mode }));

  const total = orders.length;
  const delivered = orders.filter((o) => o.status === 'Delivered').length;
  const inTransit = orders.filter((o) => ['In Transit', 'Out for Delivery', 'Picked Up'].includes(o.status)).length;
  const activeAgents = new Set(orders.filter((o) => o.assignedAgent).map((o) => o.assignedAgent._id)).size;

  return (
    <AdminLayout
      title="All orders"
      subtitle="Track, assign and override delivery orders across zones."
      headerAction={
        <Link to="/admin/orders/new" className="btn btn-primary small">
          + Create order
        </Link>
      }
    >
      {error && <div className="alert alert-error">{error}</div>}

      <div className="admin-stat-row">
        <div className="admin-stat-card blue featured">
          <div>
            <div className="admin-stat-top">
              <div className="admin-stat-ico" style={{ background: 'rgba(59,130,246,.18)' }}>📦</div>
            </div>
            <span className="admin-stat-num">{total}</span>
            <span className="admin-stat-label">Total orders</span>
          </div>
        </div>
        <div className="admin-stat-card green">
          <div className="admin-stat-top">
            <div className="admin-stat-ico" style={{ background: 'rgba(74,222,128,.18)' }}>✅</div>
          </div>
          <span className="admin-stat-num compact">{delivered}</span>
          <span className="admin-stat-label">Delivered</span>
        </div>
        <div className="admin-stat-card orange">
          <div className="admin-stat-top">
            <div className="admin-stat-ico" style={{ background: 'rgba(251,146,60,.18)' }}>🚚</div>
          </div>
          <span className="admin-stat-num compact">{inTransit}</span>
          <span className="admin-stat-label">In transit</span>
        </div>
        <div className="admin-stat-card purple">
          <div className="admin-stat-top">
            <div className="admin-stat-ico" style={{ background: 'rgba(167,139,250,.18)' }}>🧑‍✈️</div>
          </div>
          <span className="admin-stat-num compact">{activeAgents}</span>
          <span className="admin-stat-label">Active agents</span>
        </div>
      </div>

      <form className="filter-bar" onSubmit={applyFilters}>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filters.zone}
          onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
        >
          <option value="">All zones</option>
          {zones.map((z) => (
            <option key={z._id} value={z._id}>
              {z.name}
            </option>
          ))}
        </select>
        <select
          value={filters.agentId}
          onChange={(e) => setFilters({ ...filters, agentId: e.target.value })}
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">
          Apply filters
        </button>
      </form>

      {loading ? (
        <p className="muted">Loading orders…</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Route</th>
                <th>Status</th>
                <th>Assigned agent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>#{order._id.slice(-8)}</td>
                  <td className="small">
                    {order.pickupAddress?.city} → {order.dropAddress?.city}
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="small">{order.assignedAgent?.name || '— unassigned —'}</td>
                  <td>
                    <div className="table-actions">
                      <select
                        disabled={busyId === order._id}
                        defaultValue=""
                        onChange={(e) => handleManualAssign(order._id, e.target.value)}
                      >
                        <option value="" disabled>
                          {order.assignedAgent ? 'Reassign agent…' : 'Assign agent…'}
                        </option>
                        {agents.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.name}
                          </option>
                        ))}
                      </select>

                      {/* New orders auto-assign themselves on creation (see
                          orderController.createOrder), so this button only
                          needs to appear when that didn't happen — i.e. the
                          order still has no agent (auto-assign found nobody
                          available at the time). Once an order has an agent,
                          the "Reassign agent…" dropdown above is how the
                          admin changes it — showing a second, always-on
                          Auto-assign button here was the confusing part. */}
                      {!order.assignedAgent && (
                        <button
                          className="btn btn-ghost small"
                          disabled={busyId === order._id}
                          onClick={() => handleAutoAssign(order._id)}
                        >
                          Auto-assign
                        </button>
                      )}

                      {order.status === 'Rescheduled' && (
                        <button
                          className="btn btn-ghost small"
                          disabled={busyId === order._id}
                          onClick={() => handleRescheduleReassign(order._id, 'auto')}
                        >
                          Reassign (reschedule)
                        </button>
                      )}

                      <select
                        disabled={busyId === order._id}
                        defaultValue=""
                        onChange={(e) => handleOverrideStatus(order._id, e.target.value)}
                      >
                        <option value="" disabled>
                          Override status…
                        </option>
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
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