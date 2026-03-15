import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, Settings, LogOut,
  Hexagon, ChevronDown, ChevronRight, PanelLeftClose,
  Shield, BarChart3, Bot, DollarSign,
  ShieldCheck, Brain, HardDrive, AlertTriangle,
} from 'lucide-react';
import type { SidebarState } from './NexusLayout';

interface NexusSidebarProps {
  state: SidebarState;
  onToggle: () => void;
  onSetState: (state: SidebarState) => void;
  isMobile: boolean;
}

interface MenuItem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  label: string;
  path: string;
}

const SENTINEL_TABS = [
  { id: 'overview',     label: 'Vue d\'ensemble', icon: BarChart3,   path: '/nexus/sentinel/overview' },
  { id: 'autopilot',    label: 'Autopilot',       icon: Bot,         path: '/nexus/sentinel/autopilot' },
  { id: 'costs',        label: 'Couts',           icon: DollarSign,  path: '/nexus/sentinel/costs' },
  { id: 'security',     label: 'Securite',        icon: ShieldCheck, path: '/nexus/sentinel/security' },
  { id: 'intelligence', label: 'Intelligence',    icon: Brain,       path: '/nexus/sentinel/intelligence' },
  { id: 'backups',      label: 'Backups',         icon: HardDrive,   path: '/nexus/sentinel/backups' },
  { id: 'errors',       label: 'Erreurs',         icon: AlertTriangle, path: '/nexus/sentinel/errors' },
] as const;

const TOP_ITEMS: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/nexus/dashboard' },
  { icon: Users, label: 'Tenants', path: '/nexus/tenants' },
];

const BOTTOM_ITEMS: MenuItem[] = [
  { icon: CreditCard, label: 'Billing', path: '/nexus/billing' },
  { icon: Settings, label: 'Settings', path: '/nexus/settings' },
];

export default function NexusSidebar({ state, onToggle, isMobile }: NexusSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sentinelExpanded, setSentinelExpanded] = useState(true);

  const isOpen = state === 'open';
  const isHidden = state === 'hidden';
  const pathname = location.pathname;

  const isSentinelActive = pathname.startsWith('/nexus/sentinel');

  useEffect(() => {
    if (isSentinelActive) setSentinelExpanded(true);
  }, [isSentinelActive]);

  const handleLogout = () => {
    localStorage.removeItem('nexus_superadmin_token');
    localStorage.removeItem('nexus_superadmin_user');
    navigate('/nexus/login');
  };

  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('nexus_superadmin_user') || '{}'); }
    catch { return {}; }
  })();

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const isActive = pathname === item.path;

    return (
      <Link
        key={item.path}
        to={item.path}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
          ${isActive
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/30'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
          }
        `}
      >
        <Icon size={20} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className={`
      ${isMobile
        ? `fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
        : `transition-all duration-300 ease-in-out relative z-20 ${isHidden ? 'w-0' : 'w-72'}`
      }
      bg-slate-900/95 backdrop-blur-xl border-r border-cyan-500/20
      flex flex-col flex-shrink-0 overflow-hidden
    `}>
      <div className="p-4 flex items-center justify-between border-b border-cyan-500/20 min-w-[18rem]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Hexagon size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              NEXUS
            </h1>
            <p className="text-xs text-white/50">Operator Panel</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-2 hover:bg-white/10 rounded-lg transition text-white/50 hover:text-white"
          title="Retracter le panneau"
        >
          <PanelLeftClose size={20} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto min-w-[18rem]">
        {TOP_ITEMS.map(renderMenuItem)}

        <div className="pt-3 pb-1">
          <button
            onClick={() => setSentinelExpanded(!sentinelExpanded)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
              ${isSentinelActive
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
              }
            `}
          >
            <Shield size={20} />
            <span className="flex-1 text-left font-medium">SENTINEL</span>
            {sentinelExpanded
              ? <ChevronDown size={16} className="text-white/40" />
              : <ChevronRight size={16} className="text-white/40" />
            }
          </button>

          <div className={`
            overflow-hidden transition-all duration-300 ease-in-out
            ${sentinelExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
          `}>
            <div className="ml-5 pl-3 border-l border-cyan-500/15 space-y-0.5 py-1.5">
              {SENTINEL_TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = pathname === tab.path;

                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all
                      ${isActive
                        ? 'bg-cyan-500/15 text-cyan-300 font-medium'
                        : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                      }
                    `}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="py-1">
          <div className="border-t border-cyan-500/10" />
        </div>

        {BOTTOM_ITEMS.map(renderMenuItem)}
      </nav>

      <div className="p-4 border-t border-cyan-500/20 min-w-[18rem]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/30 flex-shrink-0">
            {adminUser.nom?.[0] || 'N'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{adminUser.nom || 'Operator'}</p>
            <p className="text-xs text-white/50 truncate">{adminUser.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-3 w-full flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 text-white/70 hover:text-red-400 rounded-xl transition-all"
        >
          <LogOut size={18} />
          <span>Deconnexion</span>
        </button>
      </div>
    </aside>
  );
}
