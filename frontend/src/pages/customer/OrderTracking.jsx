import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderTracking } from '../../api/orderApi';
import StatusBadge from '../../components/StatusBadge';
import Timeline from '../../components/Timeline';

export default function OrderTracking() {
  const { orderId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrderTracking(orderId)
      .then((res) => setData(res.data || res))
      .catch((err) => setError(err.response?.data?.message || 'Could not load tracking info.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <div className="page">Loading tracking info…</div>;
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;

  const order = data.order || data;
  const history = data.history || data.trackingHistory || [];

  return (
    <div className="page">
      <Link className="back-link" to="/customer/orders">← Back to my orders</Link>
      <div className="card">
        <div className="order-card-header">
          <h1>Order #{order._id?.slice(-8)}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="muted">
          {order.pickupAddress?.city} → {order.dropAddress?.city}
        </p>
      </div>

      <div className="card">
        <h2>Tracking timeline</h2>
        <Timeline history={history} />
      </div>
    </div>
  );
}
