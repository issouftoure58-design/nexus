import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Scissors,
  Calendar,
  Users,
  CalendarCheck,
  ShoppingBag,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  CalendarRange,
  Image,
  Share2,
  Bot,
  Search,
  BarChart3,
  ScrollText,
  MessagesSquare,
  Megaphone,
  UserX,
  UsersRound,
  Coins,
  Target,
  ChevronDown,
  ChevronRight,
  Briefcase,
  TrendingUp,
  Sparkles,
  Wrench,
  Store,
  Package,
  Filter,
  Zap,
} from 'lucide-react';
import HalimahProChat from './HalimahProChat';
import { AdminPWAInstall } from './AdminPWAInstall';
import SearchModal from './SearchModal';
import { useTenantBranding } from '@/hooks/useTenantBranding';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  icon: any;
  label: string;
  path: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: any;
  items: MenuItem[];
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const getInitialMobile = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  };

  const [sidebarOpen, setSidebarOpen] = useState(() => !getInitialMobile());
  const [isMobile, setIsMobile] = useState(getInitialMobile);
  const [searchOpen, setSearchOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const branding = useTenantBranding();

  // Track which groups are expanded (start empty, will be set based on current location)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Menu structure with groups
  const menuGroups: MenuGroup[] = [
    {
      id: 'activite',
      label: 'Activité',
      icon: Store,
      items: [
        { icon: Scissors, label: 'Services', path: '/admin/services' },
        { icon: Calendar, label: 'Disponibilités', path: '/admin/disponibilites' },
        { icon: CalendarRange, label: 'Planning', path: '/admin/planning' },
        { icon: CalendarCheck, label: 'Réservations', path: '/admin/reservations' },
        { icon: Users, label: 'Clients', path: '/admin/clients' },
        { icon: Filter, label: 'Segmentation', path: '/admin/segments' },
        { icon: ShoppingBag, label: 'Commandes', path: '/admin/commandes' },
        { icon: MessageSquare, label: 'Avis', path: '/admin/avis' },
      ],
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: TrendingUp,
      items: [
        { icon: Megaphone, label: 'Campagnes', path: '/admin/marketing' },
        { icon: Zap, label: 'Workflows', path: '/admin/workflows' },
        { icon: BarChart3, label: 'A/B Testing', path: '/admin/campagnes' },
        { icon: Share2, label: 'Réseaux Sociaux', path: '/admin/social' },
        { icon: Target, label: 'SEO', path: '/admin/seo' },
        { icon: Image, label: 'Médias IA', path: '/admin/media' },
      ],
    },
    {
      id: 'gestion',
      label: 'Gestion',
      icon: Briefcase,
      items: [
        { icon: UserX, label: 'Commercial', path: '/admin/commercial' },
        { icon: UsersRound, label: 'RH', path: '/admin/rh' },
        { icon: Coins, label: 'Comptabilité', path: '/admin/comptabilite' },
        { icon: Package, label: 'Stock', path: '/admin/stock' },
      ],
    },
    {
      id: 'ia',
      label: 'Intelligence IA',
      icon: Sparkles,
      items: [
        { icon: MessagesSquare, label: 'Assistant IA', path: '/admin/chat' },
        { icon: Bot, label: 'Équipe IA', path: '/admin/equipe' },
      ],
    },
    {
      id: 'systeme',
      label: 'Système',
      icon: Wrench,
      items: [
        { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
        { icon: ScrollText, label: 'Logs Halimah', path: '/admin/logs' },
        { icon: Package, label: 'Mes Modules', path: '/admin/modules' },
        { icon: Settings, label: 'Paramètres', path: '/admin/parametres' },
      ],
    },
  ];

  // Standalone items (always visible)
  const standaloneItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
  ];

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close sidebar on mobile navigation
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location, isMobile]);

  // On first load only, expand the group containing the current page
  useEffect(() => {
    for (const group of menuGroups) {
      if (group.items.some(item => location === item.path || location.startsWith(item.path + '/'))) {
        setExpandedGroups([group.id]);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const adminUser = (() => {
    try {
      const stored = localStorage.getItem('admin_user');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  })();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setLocation('/admin/login');
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const isItemActive = (path: string) => location === path;

  const isGroupActive = (group: MenuGroup) =>
    group.items.some(item => location === item.path || location.startsWith(item.path + '/'));

  return (
    <div className="flex min-h-screen h-[100dvh] bg-zinc-950 overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 african-pattern opacity-5" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      {/* Overlay mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-30 p-3 bg-zinc-900/90 backdrop-blur-xl border border-amber-500/30 rounded-xl text-white md:hidden"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Sidebar */}
      <aside className={`
        ${isMobile
          ? `fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : `${sidebarOpen ? 'w-72' : 'w-20'} relative z-20`
        }
        bg-zinc-900/95 backdrop-blur-xl border-r border-amber-500/20
        transition-all duration-300 flex flex-col
      `}>
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-amber-500/20">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.businessName}
                  className="h-11 w-11"
                />
              ) : (
                <div className="h-11 w-11 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                  </svg>
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                  {branding?.assistantName || 'NEXUS'} Pro
                </h1>
                <p className="text-xs text-white/50">{branding?.businessName || 'Administration'}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Search */}
        {sidebarOpen && (
          <div className="px-4 pt-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 hover:border-amber-500/30 rounded-xl text-white/50 hover:text-white/70 transition-all text-sm"
            >
              <Search size={16} />
              <span className="flex-1 text-left">Rechercher...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded border border-white/10">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {/* Standalone items */}
          {standaloneItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.path);

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                  ${isActive
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/30'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }
                  ${!sidebarOpen && 'justify-center'}
                `}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* Grouped menu items */}
          {sidebarOpen ? (
            <div className="space-y-1 pt-2">
              {menuGroups.map((group) => {
                const GroupIcon = group.icon;
                const isExpanded = expandedGroups.includes(group.id);
                const groupActive = isGroupActive(group);

                return (
                  <div key={group.id} className="space-y-0.5">
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                        ${groupActive && !isExpanded
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-white/50 hover:bg-white/5 hover:text-white/70'
                        }
                      `}
                    >
                      <GroupIcon size={18} className={groupActive ? 'text-amber-400' : ''} />
                      <span className="flex-1 text-left text-sm font-medium">{group.label}</span>
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-white/40" />
                      ) : (
                        <ChevronRight size={16} className="text-white/40" />
                      )}
                    </button>

                    {/* Group items */}
                    {isExpanded && (
                      <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = isItemActive(item.path);

                          return (
                            <Link
                              key={item.path}
                              href={item.path}
                              className={`
                                flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm
                                ${isActive
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium shadow-md shadow-amber-500/20'
                                  : 'text-white/50 hover:bg-white/10 hover:text-white'
                                }
                              `}
                            >
                              <Icon size={16} />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Collapsed state: show group icons only
            <div className="space-y-1 pt-2">
              {menuGroups.map((group) => {
                const GroupIcon = group.icon;
                const groupActive = isGroupActive(group);
                // Find first item to link to
                const firstItem = group.items[0];

                return (
                  <Link
                    key={group.id}
                    href={firstItem.path}
                    className={`
                      flex items-center justify-center p-3 rounded-xl transition-all
                      ${groupActive
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                        : 'text-white/50 hover:bg-white/10 hover:text-white'
                      }
                    `}
                    title={group.label}
                  >
                    <GroupIcon size={20} />
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-amber-500/20">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center font-bold text-white shadow-lg shadow-amber-500/30">
              {adminUser.nom?.[0] || 'F'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{adminUser.nom || 'Admin'}</p>
                <p className="text-xs text-white/50 truncate">{adminUser.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`
              mt-3 w-full flex items-center gap-2 px-3 py-2
              bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30
              text-white/70 hover:text-red-400 rounded-xl transition-all
              ${!sidebarOpen && 'justify-center'}
            `}
          >
            <LogOut size={18} />
            {sidebarOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 w-full min-w-0">
        <div className={`p-4 md:p-8 pb-20 ${isMobile ? 'pt-16' : ''}`}>
          {children}
        </div>
      </main>

      {/* Halimah Pro Chat Assistant */}
      <HalimahProChat />

      {/* PWA Install Prompt */}
      <AdminPWAInstall />

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
