/**
 * GlobalMenu - Menu latéral global (slide-out)
 * Inspiré du menu hamburger GitHub
 */

import {
  X, Home, Calendar, Users, Scissors, Package, TrendingUp,
  Megaphone, Bot, CreditCard, Settings, LogOut, BarChart3,
  FileText, Target, GitBranch, Search, AlertTriangle, Shield, UserCog
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface GlobalMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { icon: Home, label: 'Home', path: '/' },
  { type: 'separator', label: 'Principal' },
  { icon: Calendar, label: 'Réservations', path: '/reservations' },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: Scissors, label: 'Services', path: '/services' },
  { type: 'separator', label: 'Business' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', plan: 'pro' },
  { icon: FileText, label: 'Comptabilité', path: '/comptabilite', plan: 'pro' },
  { icon: Package, label: 'Stock', path: '/stock', plan: 'pro' },
  { icon: UserCog, label: 'Équipe RH', path: '/rh', plan: 'pro' },
  { type: 'separator', label: 'Marketing' },
  { icon: Target, label: 'Segments CRM', path: '/segments', plan: 'pro' },
  { icon: GitBranch, label: 'Workflows', path: '/workflows', plan: 'pro' },
  { icon: Megaphone, label: 'Pipeline', path: '/pipeline', plan: 'pro' },
  { icon: Search, label: 'SEO', path: '/seo', plan: 'business' },
  { icon: AlertTriangle, label: 'Anti-Churn', path: '/churn', plan: 'business' },
  { type: 'separator', label: 'Système' },
  { icon: Bot, label: 'IA Admin', path: '/ia-admin', plan: 'pro' },
  { icon: Shield, label: 'Sentinel', path: '/sentinel', plan: 'business' },
  { type: 'separator' },
  { icon: CreditCard, label: 'Mon abonnement', path: '/subscription' },
  { icon: Settings, label: 'Paramètres', path: '/parametres' },
];

export function GlobalMenu({ isOpen, onClose }: GlobalMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_admin_token');
    window.location.href = '/login';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div className="fixed top-0 left-0 h-full w-80 bg-white dark:bg-gray-900 z-50 shadow-xl transform transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">NEXUS</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="p-2 overflow-y-auto h-[calc(100%-8rem)]">
          {menuItems.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <div key={index} className="my-2">
                  <div className="border-t border-gray-200 dark:border-gray-800" />
                  {item.label && (
                    <div className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {item.label}
                    </div>
                  )}
                </div>
              );
            }

            const Icon = item.icon!;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path!)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors
                  ${isActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-cyan-600 dark:text-cyan-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {item.plan && (
                  <span className={`
                    text-xs px-1.5 py-0.5 rounded
                    ${item.plan === 'pro' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : ''}
                    ${item.plan === 'business' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : ''}
                  `}>
                    {item.plan.toUpperCase()}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
}
