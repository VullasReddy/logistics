/**
 * ProtectedRoute.jsx  (Module 1 - "Protected routes")
 * ------------------
 * Wrap a page with this to make sure:
 *   1. the user is logged in            -> otherwise go to /login
 *   2. the user changed a temp password -> otherwise go to /settings
 *   3. the user has the permission      -> otherwise show "No access"
 *
 *   <ProtectedRoute perm="USER_VIEW"><UsersPage /></ProtectedRoute>
 */
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Loader } from './ui';

export default function ProtectedRoute({ perm, children }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (user.must_change_password && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace />;
  }

  if (perm && !can(perm)) {
    return (
      <div className="card empty" style={{ maxWidth: 520, margin: '60px auto' }}>
        <ShieldAlert size={40} color="#f97316" />
        <h2 style={{ margin: '10px 0 6px', color: '#0f172a' }}>No access</h2>
        <p>Your role ({user.role_name}) does not have permission to open this page.
          Ask an administrator if you need access.</p>
      </div>
    );
  }
  return children;
}
