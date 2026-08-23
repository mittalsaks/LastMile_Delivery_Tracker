import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import CursorFx from './components/CursorFx';
import AdminLogin from './pages/AdminLogin';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SetupFirstAdmin from './pages/SetupFirstAdmin';
import PlaceOrder from './pages/customer/PlaceOrder';
import MyOrders from './pages/customer/MyOrders';
import OrderTracking from './pages/customer/OrderTracking';
import AgentDashboard from './pages/agent/AgentDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCreateOrder from './pages/admin/AdminCreateOrder';
import AdminAgents from './pages/admin/AdminAgents';
import AdminZones from './pages/admin/AdminZones';
import AdminRateCards from './pages/admin/AdminRateCards';
import AdminCodConfig from './pages/admin/AdminCodConfig';
import AdminUsers from './pages/admin/AdminUsers';
import Landing from './pages/Landing';
import AdminAgentApprovals from './pages/admin/AdminAgentApprovals';
const ROLE_HOME = {
  customer: '/customer/place-order',
  agent: '/agent',
  admin: '/admin/orders',
};

function Home() {
  const { user } = useAuth();
  if (!user) return <Landing />;
  return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
}

// Auth pages (login/register/setup) and the public landing page render their
// own full-bleed dark chrome, and admin pages render their own sidebar via
// AdminLayout — so the shared top Navbar should never show on any of those,
// regardless of whether a stale session is still logged in.
const NO_NAVBAR_PATHS = ['/', '/login', '/admin/login', '/register', '/setup', '/forgot-password'];

function ChromeNavbar() {
  const location = useLocation();
  const hideNavbar =
    NO_NAVBAR_PATHS.includes(location.pathname) ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/reset-password');
  if (hideNavbar) return null;
  return <Navbar />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/setup" element={<SetupFirstAdmin />} />

      <Route
        path="/customer/place-order"
        element={
          <ProtectedRoute roles={['customer']}>
            <PlaceOrder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/orders"
        element={
          <ProtectedRoute roles={['customer']}>
            <MyOrders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/orders/:orderId/tracking"
        element={
          <ProtectedRoute roles={['customer']}>
            <OrderTracking />
          </ProtectedRoute>
        }
      />

      <Route
        path="/agent"
        element={
          <ProtectedRoute roles={['agent']}>
            <AgentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/orders"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminOrders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orders/new"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminCreateOrder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/zones"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminZones />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/ratecards"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminRateCards />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/codconfig"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminCodConfig />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/agents/pending"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminAgentApprovals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/agents"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminAgents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Home />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CursorFx />
        <ChromeNavbar />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}