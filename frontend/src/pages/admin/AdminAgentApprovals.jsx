import { useEffect, useState } from 'react';
import { getPendingAgents, approveAgent, rejectAgent, openAgentDocument } from '../../api/agentApi';
import AdminLayout from '../../components/AdminLayout';

const DOC_LABELS = {
  aadhaar: 'Aadhaar',
  drivingLicense: 'Driving License',
  pan: 'PAN',
};

export default function AdminAgentApprovals() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [reasonDrafts, setReasonDrafts] = useState({});
  const [docError, setDocError] = useState('');

  const handleViewDoc = async (agentId, docType) => {
    setDocError('');
    try {
      await openAgentDocument(agentId, docType);
    } catch (err) {
      setDocError(err.response?.data?.message || `Could not open ${DOC_LABELS[docType]} document.`);
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPendingAgents();
      setAgents(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load pending agents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (id) => {
    setActioningId(id);
    setError('');
    try {
      await approveAgent(id);
      setAgents((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not approve agent.');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id) => {
    setActioningId(id);
    setError('');
    try {
      await rejectAgent(id, reasonDrafts[id] || '');
      setAgents((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reject agent.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <AdminLayout title="Pending agent approvals" subtitle="Review submitted KYC documents before an agent can log in.">
      <p className="muted">
        Review each agent's submitted details, then approve or reject. This is always a manual
        decision — no automated check can approve an agent on its own.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {docError && <div className="alert alert-error">{docError}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="muted">No pending agent applications right now.</p>
      ) : (
        <div className="card-list">
          {agents.map((agent) => (
            <div className="card" key={agent._id}>
              <div className="card-header">
                <strong>{agent.name}</strong>
                <span className="muted">{agent.email}</span>
              </div>
              <div className="muted small">
                Phone: {agent.phone || '—'} · Address: {agent.address || '—'} · Applied:{' '}
                {new Date(agent.createdAt).toLocaleString()}
              </div>

              <div className="muted small">
                Aadhaar: {agent.identityDocuments?.aadhaarNumber || '—'} · Driving License:{' '}
                {agent.identityDocuments?.drivingLicenseNumber || '—'} · PAN:{' '}
                {agent.identityDocuments?.panNumber || '—'}
              </div>

              <div className="actions">
                {Object.entries(DOC_LABELS).map(([docType, label]) => {
                  const hasDoc =
                    docType === 'aadhaar'
                      ? agent.identityDocuments?.aadhaarDocPath
                      : docType === 'drivingLicense'
                      ? agent.identityDocuments?.drivingLicenseDocPath
                      : agent.identityDocuments?.panDocPath;
                  if (!hasDoc) return null;
                  return (
                    <button
                      key={docType}
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleViewDoc(agent._id, docType)}
                    >
                      View {label}
                    </button>
                  );
                })}
              </div>

              <label className="small">
                Rejection reason (optional, shown to the agent)
                <input
                  value={reasonDrafts[agent._id] || ''}
                  onChange={(e) =>
                    setReasonDrafts({ ...reasonDrafts, [agent._id]: e.target.value })
                  }
                  placeholder="e.g. ID document unreadable, please resubmit"
                />
              </label>

              <div className="actions">
                <button
                  className="btn btn-primary"
                  disabled={actioningId === agent._id}
                  onClick={() => handleApprove(agent._id)}
                >
                  {actioningId === agent._id ? 'Working…' : 'Approve'}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={actioningId === agent._id}
                  onClick={() => handleReject(agent._id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}