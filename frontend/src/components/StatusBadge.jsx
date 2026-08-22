const COLORS = {
  Created: 'badge-gray',
  'Picked Up': 'badge-blue',
  'In Transit': 'badge-blue',
  'Out for Delivery': 'badge-amber',
  Delivered: 'badge-green',
  Failed: 'badge-red',
  Rescheduled: 'badge-purple',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${COLORS[status] || 'badge-gray'}`}>{status}</span>;
}
