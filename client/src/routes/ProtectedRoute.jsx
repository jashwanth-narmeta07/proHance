import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { FullPageSpinner } from '../components/ui.jsx';

export default function ProtectedRoute({ children, permission }) {
  const { isAuthenticated, isInitializing, hasPermission } = useAuth();
  const location = useLocation();

  if (isInitializing) return <FullPageSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
