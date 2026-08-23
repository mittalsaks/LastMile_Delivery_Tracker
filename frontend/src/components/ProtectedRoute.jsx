import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wrap a route element. If `roles` is given, only those roles may pass —
// anyone else (including logged-out users) is redirected. The originally
// requested location is passed along so Login can send them back here
// afterwards (e.g. clicking a tracking link from an email while logged out).
export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}