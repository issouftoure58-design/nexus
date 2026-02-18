/**
 * AppLayout - Layout principal inspiré GitHub
 *
 * Features:
 * - Menu hamburger global (≡)
 * - Header fixe avec recherche
 * - Zone de contenu flexible
 */

import { ReactNode, useState } from 'react';
import { GlobalMenu } from './GlobalMenu';
import { Menu, Search, Bell } from 'lucide-react';
import { TrialBanner } from '../TrialBanner';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

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
            <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md transition-colors relative">
              <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <button className="flex items-center gap-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">U</span>
              </div>
            </button>
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
