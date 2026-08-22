import client from './client';

export const registerUser = (payload) => client.post('/auth/register', payload).then((r) => r.data);
export const loginUser = (payload) => client.post('/auth/login', payload).then((r) => r.data);
export const loginAdmin = (payload) => client.post('/auth/admin-login', payload).then((r) => r.data);
export const getProfile = () => client.get('/auth/me').then((r) => r.data);

// Staff-only — only succeeds when called by a logged-in admin (enforced server-side).
export const createAdmin = (payload) => client.post('/auth/create-admin', payload).then((r) => r.data);

// One-time web setup — only succeeds while zero admins exist anywhere.
export const setupFirstAdmin = (payload) => client.post('/auth/setup-first-admin', payload).then((r) => r.data);
export const getFirstAdminSetupStatus = () => client.get('/auth/setup-first-admin/status').then((r) => r.data);

// Staff-only — admin's "create order on behalf of a customer" flow.
export const getCustomers = (search) =>
  client.get('/auth/customers', { params: search ? { search } : {} }).then((r) => r.data);
// intent: 'admin' restricts this to an *existing* admin account only (see
// backend authController.googleAuth docblock) — never creates a new account.
export const googleAuth = (credential, intent) =>
  client.post('/auth/google', { credential, intent }).then((r) => r.data);

// Forgot / reset password
export const forgotPassword = (email) => client.post('/auth/forgot-password', { email }).then((r) => r.data);
export const resetPassword = (token, password) =>
  client.post(`/auth/reset-password/${token}`, { password }).then((r) => r.data);