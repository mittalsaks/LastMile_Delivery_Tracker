import StatusBadge from './StatusBadge';

// history: array of { status, createdAt, changedBy, notes }
export default function Timeline({ history }) {
  if (!history || history.length === 0) {
    return <p className="muted">No tracking history yet.</p>;
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  return (
    <ol className="timeline">
      {sorted.map((entry, idx) => (
        <li key={entry._id || idx} className="timeline-item">
          <span className="timeline-dot" />
          <div className="timeline-content">
            <div className="timeline-row">
              <StatusBadge status={entry.status} />
              <span className="timeline-time">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
            {entry.notes && <p className="timeline-note">{entry.notes}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}