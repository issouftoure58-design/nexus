/**
 * Sidebar NEXUS - Menu adaptatif selon plan
 *
 * Features:
 * - Menu filtré selon plan (Starter/Pro/Business)
 * - Menu filtré selon modules activés
 * - Badge Upgrade si pas Business
 * - Collapse/expand
 */

import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTenant, PlanType } from '@/hooks/useTenant';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Briefcase,
  TrendingUp,
  Package,
  UserCog,
  Settings,
  MessageSquare,
  Megaphone,
  Search,
  Target,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Lock,
  Crown,
  Calculator,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string | number;
  requiredPlan?: PlanType;
  requiredModule?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// MENU CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

// Principal - Tous plans
const mainNav: NavItem[] = [
  { icon: LayoutDashboard, label: 'Tableau de bord', path: '/' },
  { icon: Calendar, label: 'Réservations', path: '/reservations' },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: Briefcase, label: 'Services', path: '/services' },
];

// Business - Pro et Business
const businessNav: NavItem[] = [
  { icon: TrendingUp, label: 'Analytics', path: '/analytics', requiredPlan: 'pro' },
  { icon: Calculator, label: 'Comptabilité', path: '/comptabilite', requiredPlan: 'pro' },
  { icon: Package, label: 'Stock', path: '/stock', requiredPlan: 'pro' },
  { icon: UserCog, label: 'Équipe', path: '/rh', requiredPlan: 'pro' },
];

// Marketing - Pro et Business
const marketingNav: NavItem[] = [
  { icon: Target, label: 'Segments CRM', path: '/segments', requiredPlan: 'pro' },
  { icon: GitBranch, label: 'Workflows', path: '/workflows', requiredPlan: 'pro' },
  { icon: Megaphone, label: 'Pipeline', path: '/pipeline', requiredPlan: 'pro' },
  { icon: Search, label: 'SEO', path: '/seo', requiredPlan: 'business' },
  { icon: AlertTriangle, label: 'Anti-Churn', path: '/churn', requiredPlan: 'business' },
];

// Système - Business uniquement
const systemNav: NavItem[] = [
  { icon: MessageSquare, label: 'IA Admin', path: '/ia-admin', requiredPlan: 'pro' },
  { icon: Shield, label: 'Sentinel', path: '/sentinel', requiredPlan: 'business' },
  { icon: Settings, label: 'Paramètres', path: '/parametres' },
];

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface SidebarProps {
  onLogout?: () => void;
}

export function Sidebar({ onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { name, plan, hasPlan, hasModule, isLoading } = useTenant();

  /**
   * Vérifie si l'item est verrouillé (visible mais pas accessible)
   */
  const isItemLocked = (item: NavItem): boolean => {
    // Check plan requirement
    if (item.requiredPlan && !hasPlan(item.requiredPlan)) {
      return true;
    }
    // Check module requirement
    if (item.requiredModule && !hasModule(item.requiredModule)) {
      return true;
    }
    return false;
  };

  /**
   * Filtre les items visibles d'une section
   * On montre les items verrouillés aussi pour donner envie d'upgrader
   */
  const getVisibleItems = (items: NavItem[]): NavItem[] => {
    // Pour l'instant, on montre tout mais on marque les items verrouillés
    return items;
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    const locked = isItemLocked(item);

    if (locked) {
      // Item verrouillé - afficher mais non cliquable
      return (
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-not-allowed opacity-50',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? `${item.label} (Plan ${item.requiredPlan} requis)` : undefined}
        >
          <Icon className="h-5 w-5 flex-shrink-0 text-white/40" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-white/40">{item.label}</span>
              <Lock className="h-4 w-4 text-yellow-500" />
            </>
          )}
        </div>
      );
    }

    return (
      <Link
        to={item.path}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-white/10',
          isActive ? 'bg-white/20 text-white font-medium' : 'text-white/70 hover:text-white',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-cyan-400')} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <span className="px-2 py-0.5 text-xs bg-cyan-500 text-white rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  const NavSection = ({ title, items }: { title: string; items: NavItem[] }) => {
    const visibleItems = getVisibleItems(items);

    // Ne pas afficher la section si tous les items sont cachés
    if (visibleItems.length === 0) return null;

    return (
      <div className="space-y-1">
        {!collapsed && (
          <h3 className="px-3 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            {title}
          </h3>
        )}
        {visibleItems.map((item) => (
          <NavLink key={item.path} item={item} />
        ))}
      </div>
    );
  };

  // Plan badge
  const PlanBadge = () => {
    const colors = {
      starter: 'bg-gray-500',
      pro: 'bg-blue-500',
      business: 'bg-gradient-to-r from-yellow-500 to-orange-500',
    };

    const labels = {
      starter: 'Starter',
      pro: 'Pro',
      business: 'Business',
    };

    return (
      <span
        className={cn(
          'px-2 py-0.5 text-xs font-semibold text-white rounded-full',
          colors[plan]
        )}
      >
        {labels[plan]}
      </span>
    );
  };

  return (
    <aside
      className={cn(
        'h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900',
        'flex flex-col transition-all duration-300 border-r border-white/10',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'h-16 flex items-center border-b border-white/10',
          collapsed ? 'justify-center px-2' : 'px-4'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg">NEXUS</span>
              <span className="text-white/50 text-xs truncate max-w-[140px]">
                {isLoading ? '...' : name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Plan badge */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-xs">Plan actuel</span>
            <PlanBadge />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        <NavSection title="Principal" items={mainNav} />
        <NavSection title="Business" items={businessNav} />
        <NavSection title="Marketing" items={marketingNav} />
        <NavSection title="Système" items={systemNav} />
      </nav>

      {/* Upgrade button si pas Business */}
      {plan !== 'business' && !collapsed && (
        <div className="px-3 pb-2">
          <Link
            to="/subscription"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-semibold hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl"
          >
            <Crown className="w-5 h-5" />
            <span>Passer à {plan === 'starter' ? 'Pro' : 'Business'}</span>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-white/10 p-2 space-y-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
            'text-white/50 hover:text-white hover:bg-white/10 transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm">Réduire</span>
            </>
          )}
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
              'text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors',
              collapsed && 'justify-center px-2'
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="text-sm">Déconnexion</span>}
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
