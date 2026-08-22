import client from './client';

export const getCodConfigs = () => client.get('/codconfig').then((r) => r.data);
export const createCodConfig = (payload) => client.post('/codconfig', payload).then((r) => r.data);
export const updateCodConfig = (id, payload) => client.put(`/codconfig/${id}`, payload).then((r) => r.data);
export const deleteCodConfig = (id) => client.delete(`/codconfig/${id}`).then((r) => r.data);
