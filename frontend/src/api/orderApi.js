import client from './client';

export const calculateCharge = (payload) =>
  client.post('/orders/calculate-charge', payload).then((r) => r.data);

export const createOrder = (payload) => client.post('/orders', payload).then((r) => r.data);

export const getMyOrders = () => client.get('/orders/my').then((r) => r.data);

export const getAllOrders = (params) => client.get('/orders', { params }).then((r) => r.data);

export const getOrderTracking = (orderId) =>
  client.get(`/orders/${orderId}/tracking`).then((r) => r.data);

export const updateOrderStatus = (orderId, status) =>
  client.patch(`/orders/${orderId}/status`, { status }).then((r) => r.data);

export const assignAgent = (orderId, agentId) =>
  client.patch(`/orders/${orderId}/assign`, { agentId }).then((r) => r.data);

export const autoAssignAgent = (orderId) =>
  client.patch(`/orders/${orderId}/auto-assign`).then((r) => r.data);

export const requestReschedule = (orderId, payload) =>
  client.patch(`/orders/${orderId}/reschedule`, payload).then((r) => r.data);

export const reassignForReschedule = (orderId, payload) =>
  client.patch(`/orders/${orderId}/reschedule/reassign`, payload).then((r) => r.data);

// Feedback (customer, post-delivery)
export const submitFeedback = (orderId, payload) =>
  client.post(`/orders/${orderId}/feedback`, payload).then((r) => r.data);
export const getFeedbackForOrder = (orderId) =>
  client.get(`/orders/${orderId}/feedback`).then((r) => r.data);
