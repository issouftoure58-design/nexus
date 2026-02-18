import { Redirect } from 'wouter';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem('admin_token');

  if (!token) {
    return <Redirect to="/admin/login" />;
  }

  return <>{children}</>;
}
