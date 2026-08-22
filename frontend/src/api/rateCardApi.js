import client from './client';

export const getRateCards = () => client.get('/ratecards').then((r) => r.data);
export const createRateCard = (payload) => client.post('/ratecards', payload).then((r) => r.data);
export const updateRateCard = (id, payload) => client.put(`/ratecards/${id}`, payload).then((r) => r.data);
export const deleteRateCard = (id) => client.delete(`/ratecards/${id}`).then((r) => r.data);
