import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { api } from '@/lib/api';

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function Layout({ children, title, subtitle }: LayoutProps) {
  const handleLogout = () => {
    api.clearToken();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar onLogout={handleLogout} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
