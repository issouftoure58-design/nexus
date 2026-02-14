/**
 * ServiceLayout - Layout pour les pages de service
 * Avec barre de navigation horizontale (tabs)
 */

import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface Tab {
  label: string;
  path: string;
}

interface ServiceLayoutProps {
  children: ReactNode;
  title: string;
  icon: LucideIcon;
  tabs: Tab[];
  actions?: ReactNode;
}

export function ServiceLayout({ children, title, icon: Icon, tabs, actions }: ServiceLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Service Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                <Icon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
            </div>
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`
                    px-4 py-2 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
}
