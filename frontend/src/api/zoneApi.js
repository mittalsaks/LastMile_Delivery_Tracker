import client from './client';

export const getZones = () => client.get('/zones').then((r) => r.data);
export const createZone = (payload) => client.post('/zones', payload).then((r) => r.data);
export const updateZone = (id, payload) => client.put(`/zones/${id}`, payload).then((r) => r.data);
export const deleteZone = (id) => client.delete(`/zones/${id}`).then((r) => r.data);
