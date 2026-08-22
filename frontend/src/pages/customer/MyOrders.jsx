import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyOrders, requestReschedule } from '../../api/orderApi';
import StatusBadge from '../../components/StatusBadge';
import FeedbackForm from '../../components/FeedbackForm';

export default function MyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rescheduling, setRescheduling] = useState(null); // orderId currently being rescheduled
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [ratingOrderId, setRatingOrderId] = useState(null); // orderId whose feedback form is open

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyOrders();
      setOrders(res.data || res);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitReschedule = async (orderId) => {
    setActionError('');
    if (!newDate) {
      setActionError('Pick a new delivery date first.');
      return;
    }
    try {
      await requestReschedule(orderId, { newDate, reason });
      setRescheduling(null);
      setNewDate('');
      setReason('');
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not submit reschedule request.');
    }
  };

  if (loading) return <div className="page">Loading your orders…</div>;

  return (
    <div className="page">
      <h1>My orders</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {orders.length === 0 && !error && (
        <p className="muted">You haven't placed any orders yet.</p>
      )}

      <div className="order-list">
        {orders.map((order) => (
          <div className="card order-card" key={order._id}>
            <div className="order-card-header">
              <span className="order-id">#{order._id.slice(-8)}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="muted small">
              {order.pickupAddress?.city} → {order.dropAddress?.city} · {order.orderType} ·{' '}
              {order.paymentType}
            </p>
            <p className="muted small">Total: ₹{order.charge?.totalCharge ?? '—'}</p>

            <div className="actions">
              <button
                className="btn btn-ghost"
                onClick={() => navigate(`/customer/orders/${order._id}/tracking`)}
              >
                Track order
              </button>
              {order.status === 'Failed' && rescheduling !== order._id && (
                <button className="btn btn-secondary" onClick={() => setRescheduling(order._id)}>
                  Request reschedule
                </button>
              )}
              {order.status === 'Delivered' && ratingOrderId !== order._id && (
                <button className="btn btn-secondary" onClick={() => setRatingOrderId(order._id)}>
                  Rate this delivery
                </button>
              )}
            </div>

            {ratingOrderId === order._id && (
              <FeedbackForm orderId={order._id} onClose={() => setRatingOrderId(null)} />
            )}

            {rescheduling === order._id && (
              <div className="reschedule-form">
                {actionError && <div className="alert alert-error small">{actionError}</div>}
                <label>
                  New delivery date
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </label>
                <label>
                  Reason (optional)
                  <input value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
                <div className="actions">
                  <button className="btn btn-primary" onClick={() => submitReschedule(order._id)}>
                    Submit
                  </button>
                  <button className="btn btn-ghost" onClick={() => setRescheduling(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
