/**
 * AppLayout - Layout principal inspiré GitHub
 *
 * Features:
 * - Menu hamburger global (≡)
 * - Header fixe avec recherche
 * - Zone de contenu flexible
 */

import { ReactNode, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalMenu } from './GlobalMenu';
import { Menu, Search, Bell, User, Settings, LogOut, ChevronRight } from 'lucide-react';
import { TrialBanner } from '../TrialBanner';
import { api } from '@/lib/api';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fermer les dropdowns si on clique ailleurs
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Récupérer les infos user du token
  const getUserInfo = () => {
    // Utiliser le token du tenant actuel
    const currentTenant = localStorage.getItem('nexus_current_tenant');
    const tokenKey = currentTenant ? `nexus_admin_token_${currentTenant}` : 'nexus_admin_token';
    const token = localStorage.getItem(tokenKey) || localStorage.getItem('nexus_admin_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
          email: payload.email || 'admin@nexus.dev',
          initials: payload.email?.[0]?.toUpperCase() || 'U',
          tenant: payload.tenant_slug
        };
      } catch { /* ignore */ }
    }
    return { email: 'admin@nexus.dev', initials: 'U', tenant: null };
  };

  const handleLogout = () => {
    api.clearToken();
    window.location.href = '/login';
  };

  const userInfo = getUserInfo();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Global Menu (slide-out) */}
      <GlobalMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Header fixe */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white hidden sm:block">
                NEXUS Admin
              </span>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-xl mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher... (⌘K)"
                className="w-full pl-10 pr-4 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md transition-colors relative"
              >
                <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span className="font-semibold text-gray-900 dark:text-white">Notifications</span>
                    <span className="text-xs text-cyan-600 cursor-pointer hover:underline">Tout marquer lu</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <div className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-cyan-500 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Nouvelle prestation confirmée</p>
                      <p className="text-xs text-gray-500">Marie Dupont - Coupe + Brushing demain 14h</p>
                      <p className="text-xs text-gray-400 mt-1">Il y a 5 min</p>
                    </div>
                    <div className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Paiement reçu</p>
                      <p className="text-xs text-gray-500">45€ - Facture #2026-0045</p>
                      <p className="text-xs text-gray-400 mt-1">Il y a 2h</p>
                    </div>
                    <div className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Rappel J-1 envoyé</p>
                      <p className="text-xs text-gray-500">3 clients notifiés pour demain</p>
                      <p className="text-xs text-gray-400 mt-1">Hier</p>
                    </div>
                  </div>
                  <div
                    onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                    className="p-3 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-cyan-600 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-center gap-1"
                  >
                    Voir toutes les notifications <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>

            {/* User Menu Dropdown */}
            <div className="relative" ref={userRef}>
              <button
                onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
                className="flex items-center gap-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{userInfo.initials}</span>
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{userInfo.email}</p>
                    <p className="text-xs text-gray-500">Administrateur</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { navigate('/settings/profile'); setUserMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Mon profil
                    </button>
                    <button
                      onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Paramètres
                    </button>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Trial Banner */}
      <TrialBanner />

      {/* Main content */}
      <main className="min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>
    </div>
  );
}
