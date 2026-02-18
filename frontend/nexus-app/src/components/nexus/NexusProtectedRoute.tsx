import { Redirect } from 'wouter';

interface NexusProtectedRouteProps {
  children: React.ReactNode;
}

export default function NexusProtectedRoute({ children }: NexusProtectedRouteProps) {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    return <Redirect to="/nexus/login" />;
  }

  const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
  if (adminUser.role !== 'super_admin') {
    return <Redirect to="/nexus/login" />;
  }

  return <>{children}</>;
}
