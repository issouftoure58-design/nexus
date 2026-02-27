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
import { useProfile } from '@/contexts/ProfileContext';
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
  Banknote,
  FileText,
  Share2,
  Sparkles,
  Phone,
  Headphones,
  CalendarCheck,
  Bot,
  ClipboardList,
  UtensilsCrossed,
  Bed,
  LayoutGrid,
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
  requiredModule?: string;  // Module requis pour afficher cet item
  alwaysShow?: boolean;     // Toujours afficher (dashboard, paramètres)
  businessTypes?: string[]; // Types de business requis (ex: ['restaurant'])
}

// ══════════════════════════════════════════════════════════════════════════════
// MENU CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// MENU CONFIGURATION - Mappé aux modules actifs
// ══════════════════════════════════════════════════════════════════════════════

// Principal - Modules de base (socle)
const mainNav: NavItem[] = [
  { icon: LayoutDashboard, label: 'Tableau de bord', path: '/', alwaysShow: true },
  { icon: Calendar, label: 'Agenda', path: '/agenda', alwaysShow: true }, // RDV business entrepreneur
  { icon: CalendarCheck, label: 'Prestations', path: '/activites', requiredModule: 'reservations' },
  { icon: Users, label: 'Clients', path: '/clients', alwaysShow: true }, // Inclus dans socle
  { icon: Briefcase, label: 'Services', path: '/services', alwaysShow: true }, // Inclus dans socle
  { icon: UtensilsCrossed, label: 'Menu', path: '/menu', requiredModule: 'reservations', businessTypes: ['restaurant'] },
  { icon: LayoutGrid, label: 'Plan de salle', path: '/salle', requiredModule: 'reservations', businessTypes: ['restaurant'] },
  { icon: Bed, label: 'Chambres', path: '/chambres', requiredModule: 'reservations', businessTypes: ['hotel'] },
  { icon: Banknote, label: 'Tarifs Saisons', path: '/tarifs', requiredModule: 'reservations', businessTypes: ['hotel'] },
];

// IA & Automatisation
const iaNav: NavItem[] = [
  { icon: Bot, label: 'Agent IA Web', path: '/ia-admin', requiredModule: 'agent_ia_web' },
  { icon: MessageSquare, label: 'WhatsApp IA', path: '/ia-whatsapp', requiredModule: 'whatsapp' },
  { icon: Phone, label: 'Téléphone IA', path: '/ia-telephone', requiredModule: 'telephone' },
  { icon: Headphones, label: 'Standard IA', path: '/ia-standard', requiredModule: 'standard_ia' },
  { icon: CalendarCheck, label: 'Résa IA Omnicanal', path: '/ia-reservation', requiredModule: 'ia_reservation' },
  { icon: Sparkles, label: 'Assistant Personnel', path: '/assistant', requiredModule: 'assistant_ia' },
];

// Business - Modules avancés
const businessNav: NavItem[] = [
  { icon: TrendingUp, label: 'Analytics', path: '/analytics', requiredModule: 'analytics' },
  { icon: Calculator, label: 'Comptabilité', path: '/comptabilite', requiredModule: 'comptabilite' },
  { icon: Package, label: 'Stock', path: '/stock', requiredModule: 'ecommerce' },
  { icon: UserCog, label: 'Équipe RH', path: '/rh', requiredModule: 'rh_avance' },
  { icon: Banknote, label: 'Paie', path: '/paie', requiredModule: 'paie' },
];

// Marketing - Modules marketing
const marketingNav: NavItem[] = [
  { icon: Share2, label: 'Réseaux Sociaux', path: '/social', requiredModule: 'social_media' },
  { icon: Target, label: 'Segments CRM', path: '/segments', requiredModule: 'marketing' },
  { icon: GitBranch, label: 'Workflows', path: '/workflows', requiredModule: 'marketing' },
  { icon: Megaphone, label: 'Pipeline', path: '/pipeline', requiredModule: 'marketing' },
  { icon: FileText, label: 'Devis', path: '/devis', requiredModule: 'marketing' },
  { icon: Search, label: 'SEO', path: '/seo', requiredModule: 'seo' },
  { icon: AlertTriangle, label: 'Anti-Churn', path: '/churn', requiredModule: 'marketing' },
];

// Système
const systemNav: NavItem[] = [
  { icon: Shield, label: 'Sentinel', path: '/sentinel', requiredModule: 'sentinel_pro' },
  { icon: Settings, label: 'Paramètres', path: '/parametres', alwaysShow: true },
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
  const { t, businessType, businessInfo } = useProfile();

  /**
   * Vérifie si l'item doit être affiché
   * Mode dynamique: on affiche SEULEMENT les modules actifs
   */
  const shouldShowItem = (item: NavItem): boolean => {
    // Items toujours visibles
    if (item.alwaysShow) return true;

    // Si types de business requis, vérifier que le tenant correspond
    if (item.businessTypes && item.businessTypes.length > 0) {
      if (!businessType || !item.businessTypes.includes(businessType)) {
        return false;
      }
    }

    // Si module requis, vérifier qu'il est actif
    if (item.requiredModule) {
      return hasModule(item.requiredModule);
    }

    // Si plan requis (fallback), vérifier le plan
    if (item.requiredPlan) {
      return hasPlan(item.requiredPlan);
    }

    return true;
  };

  /**
   * Vérifie si l'item est verrouillé (visible mais pas accessible)
   * Note: En mode dynamique, on cache les items au lieu de les verrouiller
   */
  const isItemLocked = (item: NavItem): boolean => {
    return false; // Plus de verrouillage, on cache simplement
  };

  /**
   * Filtre les items visibles d'une section
   * Mode dynamique: affiche seulement les modules actifs du tenant
   */
  const getVisibleItems = (items: NavItem[]): NavItem[] => {
    return items.filter(shouldShowItem);
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
        <NavSection title="IA & Automatisation" items={iaNav} />
        <NavSection title="Business" items={businessNav} />
        <NavSection title="Marketing" items={marketingNav} />
        <NavSection title="Système" items={systemNav} />
      </nav>

      {/* Bouton Gérer mes modules */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <Link
            to="/subscription"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Crown className="w-5 h-5" />
            <span>Gérer mes modules</span>
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
