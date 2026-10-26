import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetail from './pages/ProjectDetail';
import InventoryActivityPage from './pages/InventoryActivityPage';

function Protected({
  children,
  adminOnly = false,
}: {
  children: JSX.Element;
  adminOnly?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 32 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.roles?.includes('admin')) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={<Protected><ProjectsPage /></Protected>} />
      <Route path="/projects/:id" element={<Protected><ProjectDetail /></Protected>} />
      <Route path="/inventory-activity" element={<Protected><InventoryActivityPage /></Protected>} />
    </Routes>
  );
}
