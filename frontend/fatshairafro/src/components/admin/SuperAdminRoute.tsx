import { Redirect } from 'wouter';

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

export default function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    return <Redirect to="/admin/login" />;
  }

  const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
  if (adminUser.role !== 'super_admin') {
    return <Redirect to="/admin/dashboard" />;
  }

  return <>{children}</>;
}
