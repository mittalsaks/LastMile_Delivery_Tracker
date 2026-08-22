import { Fragment, useEffect, useState } from 'react';
import { getAllAgentsForAdmin, deactivateAgent, reactivateAgent } from '../../api/agentApi';
import { getAllOrders } from '../../api/orderApi';
import StatusBadge from '../../components/StatusBadge';
import AdminLayout from '../../components/AdminLayout';

// Groups an agent's orders by calendar day (newest day first, newest order
// first within a day) so admin can see exactly what was placed each day
// and what's still pending vs already delivered.
const groupOrdersByDay = (orders) => {
  const groups = {};
  for (const order of orders) {
    const day = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    if (!groups[day]) groups[day] = [];
    groups[day].push(order);
  }
  // Object key insertion order already follows the sorted `orders` input
  // (backend returns createdAt desc), so just return entries as-is.
  return Object.entries(groups);
};

const TERMINAL_STATUSES = ['Delivered', 'Failed'];

const STATUS_BADGE = {
  approved: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
  pending: { bg: 'rgba(234,179,8,0.15)', color: '#eab308' },
  rejected: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
};

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [lastMeta, setLastMeta] = useState(null);

  // Per-agent order breakdown, loaded lazily the first time a row is
  // expanded and cached here so re-expanding doesn't re-fetch.
  const [expandedAgentId, setExpandedAgentId] = useState(null);
  const [agentOrders, setAgentOrders] = useState({}); // agentId -> orders[]
  const [ordersLoading, setOrdersLoading] = useState(null); // agentId currently loading

  const toggleOrdersView = async (agentId) => {
    if (expandedAgentId === agentId) {
      setExpandedAgentId(null);
      return;
    }
    setExpandedAgentId(agentId);
    if (!agentOrders[agentId]) {
      setOrdersLoading(agentId);
      try {
        const res = await getAllOrders({ agentId });
        setAgentOrders((prev) => ({ ...prev, [agentId]: res.data || res }));
      } catch (err) {
        setError(err.response?.data?.message || "Could not load this agent's orders.");
      } finally {
        setOrdersLoading(null);
      }
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAllAgentsForAdmin();
      setAgents(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load agents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeactivate = async (agentId) => {
    setActioningId(agentId);
    setError('');
    setLastMeta(null);
    try {
      const res = await deactivateAgent(agentId);
      setLastMeta(res.meta);
      setConfirmingId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not deactivate agent.');
    } finally {
      setActioningId(null);
    }
  };

  const handleReactivate = async (agentId) => {
    setActioningId(agentId);
    setError('');
    try {
      await reactivateAgent(agentId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reactivate agent.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <AdminLayout
      title="Agents"
      subtitle="Full delivery agent roster — workload, ratings, and account status."
    >
      {error && <div className="alert alert-error">{error}</div>}

      {lastMeta && (
        <div
          className="alert"
          style={{
            background: 'rgba(59,130,246,0.12)',
            color: '#93c5fd',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
        >
          {lastMeta.reassignedOrders.length === 0
            ? 'Agent deactivated. They had no in-flight orders to reassign.'
            : `Agent deactivated. ${lastMeta.reassignedOrders.filter((r) => r.reassignedTo).length} of ${
                lastMeta.reassignedOrders.length
              } in-flight order(s) were auto-reassigned` +
              (lastMeta.reassignedOrders.some((r) => !r.reassignedTo)
                ? '; some could not be reassigned automatically (no agent available) and are now Unassigned — please assign manually.'
                : '.')}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading agents…</p>
      ) : agents.length === 0 ? (
        <p className="muted">No agents have registered yet.</p>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email / Phone</th>
                <th>Zone</th>
                <th>Approval</th>
                <th>Account</th>
                <th>Active orders</th>
                <th>Rating</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const badge = STATUS_BADGE[agent.agentStatus] || {};
                const isExpanded = expandedAgentId === agent._id;
                const orders = agentOrders[agent._id];
                const deliveredCount = orders?.filter((o) => o.status === 'Delivered').length ?? null;
                const pendingCount = orders?.filter((o) => !TERMINAL_STATUSES.includes(o.status)).length ?? null;
                return (
                  <Fragment key={agent._id}>
                  <tr>
                    <td>{agent.name}</td>
                    <td>
                      <div>{agent.email}</div>
                      <div className="muted small">{agent.phone || '—'}</div>
                    </td>
                    <td>{agent.agentDetails?.currentZone?.name || '—'}</td>
                    <td>
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 12,
                          textTransform: 'capitalize',
                        }}
                      >
                        {agent.agentStatus}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: agent.isActive ? '#4ade80' : '#f87171',
                          fontWeight: 600,
                        }}
                      >
                        {agent.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td>{agent.activeOrderCount}</td>
                    <td>
                      {agent.totalRatings > 0 ? (
                        <span>
                          ⭐ {agent.averageRating} <span className="muted small">({agent.totalRatings})</span>
                        </span>
                      ) : (
                        <span className="muted small">No ratings yet</span>
                      )}
                    </td>
                    <td>
                      {agent.agentStatus !== 'approved' ? (
                        <span className="muted small">—</span>
                      ) : agent.isActive ? (
                        confirmingId === agent._id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-danger"
                              disabled={actioningId === agent._id}
                              onClick={() => handleDeactivate(agent._id)}
                            >
                              {actioningId === agent._id ? 'Removing…' : 'Confirm remove'}
                            </button>
                            <button className="btn btn-ghost" onClick={() => setConfirmingId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-danger"
                            onClick={() => setConfirmingId(agent._id)}
                          >
                            Remove agent
                          </button>
                        )
                      ) : (
                        <button
                          className="btn btn-ghost"
                          disabled={actioningId === agent._id}
                          onClick={() => handleReactivate(agent._id)}
                        >
                          {actioningId === agent._id ? 'Restoring…' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-ghost small" onClick={() => toggleOrdersView(agent._id)}>
                        {isExpanded ? 'Hide orders' : 'View orders'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} style={{ background: 'transparent', padding: '4px 8px 18px' }}>
                        {ordersLoading === agent._id ? (
                          <p className="muted small">Loading orders…</p>
                        ) : !orders || orders.length === 0 ? (
                          <p className="muted small">This agent hasn't been assigned any orders yet.</p>
                        ) : (
                          <div className="card" style={{ marginBottom: 0 }}>
                            <div style={{ display: 'flex', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
                              <span className="small">
                                <b>{orders.length}</b> <span className="muted">total placed</span>
                              </span>
                              <span className="small">
                                <b style={{ color: '#4ade80' }}>{deliveredCount}</b>{' '}
                                <span className="muted">delivered</span>
                              </span>
                              <span className="small">
                                <b style={{ color: '#fbbf24' }}>{pendingCount}</b>{' '}
                                <span className="muted">still pending</span>
                              </span>
                            </div>
                            {groupOrdersByDay(orders).map(([day, dayOrders]) => (
                              <div key={day} style={{ marginBottom: 14 }}>
                                <div
                                  className="muted small"
                                  style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}
                                >
                                  {day} · {dayOrders.length} order{dayOrders.length > 1 ? 's' : ''}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {dayOrders.map((o) => (
                                    <div
                                      key={o._id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 10,
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border)',
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      <span className="order-id">#{o._id.slice(-8)}</span>
                                      <span className="small">
                                        {o.pickupZone?.name || '—'} → {o.dropZone?.name || '—'}
                                      </span>
                                      <StatusBadge status={o.status} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small" style={{ marginTop: 12 }}>
        "Remove agent" deactivates the account (they can no longer log in or be assigned new
        orders) and automatically reassigns any of their in-flight orders to another available
        agent where possible. It does not delete their history — deactivated agents can be
        reactivated any time.
      </p>
    </AdminLayout>
  );
}