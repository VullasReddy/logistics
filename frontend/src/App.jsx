/**
 * App.jsx - all page routes in one place.
 * Each module page is protected by the permission it needs.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Branches from './pages/Branches';
import Company from './pages/Company';
import Subscriptions from './pages/Subscriptions';
import Configuration from './pages/Configuration';
import AuditLogs from './pages/AuditLogs';
import AccountSettings from './pages/AccountSettings';

/** Users without DASHBOARD_VIEW land on their first allowed page instead. */
function Home() {
  const { can } = useAuth();
  if (can('DASHBOARD_VIEW')) return <Dashboard />;
  return <Navigate to="/settings" replace />;
}

const page = (perm, element) => <ProtectedRoute perm={perm}>{element}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Home />} />
        <Route path="users" element={page('USER_VIEW', <Users />)} />
        <Route path="roles" element={page('ROLE_VIEW', <Roles />)} />
        <Route path="branches" element={page('BRANCH_VIEW', <Branches />)} />
        <Route path="company" element={page('COMPANY_VIEW', <Company />)} />
        <Route path="subscriptions" element={page('SUBSCRIPTION_VIEW', <Subscriptions />)} />
        <Route path="configuration" element={page('SETTINGS_VIEW', <Configuration />)} />
        <Route path="audit-logs" element={page('AUDIT_VIEW', <AuditLogs />)} />
        <Route path="settings" element={<AccountSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
