import client from './client';

export const getAllAgents = () => client.get('/agents').then((r) => r.data);
export const getMyAgentOrders = () => client.get('/agents/me/orders').then((r) => r.data);
export const setMyAvailability = (isAvailable) =>
  client.patch('/agents/me/availability', { isAvailable }).then((r) => r.data);
export const setMyZone = (currentZone) =>
  client.patch('/agents/me/availability', { currentZone }).then((r) => r.data);

// Admin: agent approval pipeline
export const getPendingAgents = () => client.get('/agents/pending').then((r) => r.data);
export const approveAgent = (agentId) => client.patch(`/agents/${agentId}/approve`).then((r) => r.data);
export const rejectAgent = (agentId, reason) =>
  client.patch(`/agents/${agentId}/reject`, { reason }).then((r) => r.data);

// Documents are served through an authenticated route (not a public static
// folder), so we fetch them as a blob with the JWT attached, then open the
// result in a new tab. docType is one of: aadhaar | pan | drivingLicense
export const openAgentDocument = async (agentId, docType) => {
  const res = await client.get(`/agents/${agentId}/documents/${docType}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(res.data);
  window.open(url, '_blank', 'noopener,noreferrer');
  // Revoke after a short delay so the new tab has time to load it.
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
};

// Admin: full agent roster + performance management
export const getAllAgentsForAdmin = (params = {}) =>
  client.get('/agents/all', { params }).then((r) => r.data);
export const deactivateAgent = (agentId) =>
  client.patch(`/agents/${agentId}/deactivate`).then((r) => r.data);
export const reactivateAgent = (agentId) =>
  client.patch(`/agents/${agentId}/reactivate`).then((r) => r.data);
export const getAgentFeedbackSummary = (agentId) =>
  client.get(`/agents/${agentId}/feedback`).then((r) => r.data);