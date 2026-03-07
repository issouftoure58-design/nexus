import { Navigate } from 'react-router-dom';

interface NexusProtectedRouteProps {
  children: React.ReactNode;
}

export default function NexusProtectedRoute({ children }: NexusProtectedRouteProps) {
  const token = localStorage.getItem('nexus_superadmin_token');
  if (!token) {
    return <Navigate to="/nexus/login" replace />;
  }

  try {
    const adminUser = JSON.parse(localStorage.getItem('nexus_superadmin_user') || '{}');
    if (adminUser.role !== 'super_admin') {
      return <Navigate to="/nexus/login" replace />;
    }
  } catch {
    return <Navigate to="/nexus/login" replace />;
  }

  return <>{children}</>;
}
