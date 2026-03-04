import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Menu, PanelLeftOpen } from 'lucide-react';
import NexusSidebar from './NexusSidebar';

export type SidebarState = 'open' | 'collapsed' | 'hidden';

interface NexusLayoutProps {
  children: React.ReactNode;
}

export default function NexusLayout({ children }: NexusLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [location] = useLocation();

  // Restaurer la préférence utilisateur (desktop uniquement)
  const [sidebarState, setSidebarState] = useState<SidebarState>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      const saved = localStorage.getItem('nexus_sidebar');
      if (saved === 'collapsed' || saved === 'hidden') return saved;
    }
    return 'open';
  });

  // Persister la préférence
  const updateSidebarState = useCallback((newState: SidebarState) => {
    setSidebarState(newState);
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem('nexus_sidebar', newState);
    }
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sur mobile, fermer la sidebar lors de la navigation
  useEffect(() => {
    if (isMobile) {
      setSidebarState('hidden');
    }
  }, [location, isMobile]);

  // Toggle simple : ouvert <-> caché
  const toggleSidebar = useCallback(() => {
    updateSidebarState(sidebarState === 'open' ? 'hidden' : 'open');
  }, [sidebarState, updateSidebarState]);

  const openSidebar = useCallback(() => updateSidebarState('open'), [updateSidebarState]);

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Overlay mobile */}
      {isMobile && sidebarState === 'open' && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarState('hidden')}
        />
      )}

      {/* Bouton menu mobile */}
      {isMobile && sidebarState !== 'open' && (
        <button
          onClick={openSidebar}
          className="fixed top-4 left-4 z-30 p-3 bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl text-white md:hidden"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Bouton réouvrir desktop quand sidebar est rétracté */}
      {!isMobile && sidebarState === 'hidden' && (
        <button
          onClick={openSidebar}
          className="fixed top-4 left-4 z-30 p-2.5 bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl text-cyan-400 hover:text-white hover:border-cyan-400/50 transition-all shadow-lg shadow-cyan-500/10 group"
          title="Ouvrir le panneau"
        >
          <PanelLeftOpen size={20} className="group-hover:scale-110 transition-transform" />
        </button>
      )}

      <NexusSidebar
        state={isMobile ? (sidebarState === 'open' ? 'open' : 'hidden') : sidebarState}
        onToggle={toggleSidebar}
        onSetState={updateSidebarState}
        isMobile={isMobile}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10 w-full">
        <div className={`p-4 md:p-8 ${isMobile && sidebarState !== 'open' ? 'pt-16' : ''} ${!isMobile && sidebarState === 'hidden' ? 'pl-12' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
