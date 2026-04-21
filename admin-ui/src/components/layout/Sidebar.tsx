/**
 * Sidebar NEXUS - Menu adaptatif selon plan
 *
 * Features:
 * - Menu filtré selon plan (Starter/Pro/Business)
 * - Menu filtré selon modules activés
 * - Badge Upgrade si pas Business
 * - Collapse/expand
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Crown,
  Calculator,
  GitBranch,
  AlertTriangle,
  Banknote,
  Star,
  FileText,
  Phone,
  CalendarCheck,
  Clock,
  Bot,
  ClipboardList,
  UtensilsCrossed,
  Bed,
  LayoutGrid,
  X,
  Zap,
  UserPlus,
  ShoppingBag,
  Share2,
  UserCheck,
  Lock,
} from 'lucide-react';
import { useState, useCallback, useEffect, memo } from 'react';
import { authApi } from '@/lib/api';

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
  hideForBusinessTypes?: string[]; // Masquer pour ces types (ex: ['commerce'])
}

interface UpgradeModalData {
  feature: string;
  requiredPlan?: PlanType;
  requiredModule?: string;
}

// Prix des plans pour le modal (modele 2026 — revision 21 avril 2026)
const PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 69,
  pro: 199,
  business: 599,
};

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

// Mapping modules vers plans requis (modele 2026 — revision 21 avril 2026)
// Free : modules de base. Starter : toute IA + modules essentiels. Pro : multi-sites, illimite. Business : RH, Compta, Sentinel, White-label, API, SSO.
const MODULE_TO_PLAN: Record<string, PlanType> = {
  // Free (modules de base, accessibles meme en gratuit avec quotas)
  'reservations': 'free',
  'facturation': 'free',
  'ecommerce': 'free',
  // Starter (toute IA + modules essentiels)
  'agent_ia_web': 'starter',
  'whatsapp': 'starter',
  'telephone': 'starter',
  'stock': 'starter',
  'devis': 'starter',
  'crm_avance': 'starter',
  'marketing': 'starter',
  'analytics': 'starter',
  'seo': 'starter',
  'pipeline': 'starter',
  // Business (modules premium)
  'comptabilite': 'business',
  'rh': 'business',
  'sentinel': 'business',
};

// Mapping requiredModule → module RBAC pour filtrer par permissions utilisateur
const MODULE_TO_RBAC: Record<string, string> = {
  reservations: 'reservations',
  facturation: 'comptabilite',
  agent_ia_web: 'ia',
  whatsapp: 'ia',
  telephone: 'ia',
  analytics: 'stats',
  comptabilite: 'comptabilite',
  stock: 'stock',
  rh: 'rh',
  marketing: 'marketing',
  seo: 'seo',
  sentinel: 'modules',
  ecommerce: 'services',
  devis: 'services',
};

// ══════════════════════════════════════════════════════════════════════════════
// MENU CONFIGURATION - Mappé aux modules actifs
// ══════════════════════════════════════════════════════════════════════════════

// Principal - Modules de base (socle)
const mainNav: NavItem[] = [
  { icon: LayoutDashboard, label: 'Tableau de bord', path: '/', alwaysShow: true },
  { icon: Calendar, label: 'Agenda', path: '/agenda', alwaysShow: true }, // RDV business entrepreneur
  { icon: CalendarCheck, label: 'Prestations', path: '/activites', requiredModule: 'reservations', hideForBusinessTypes: ['commerce'] },
  { icon: Users, label: 'Clients', path: '/clients', alwaysShow: true }, // Inclus dans socle
  { icon: Briefcase, label: 'Services', path: '/services', alwaysShow: true }, // Inclus dans socle
  { icon: UserPlus, label: 'Equipe', path: '/equipe', alwaysShow: true },
  { icon: Clock, label: 'Disponibilites', path: '/disponibilites', requiredModule: 'reservations' },
  { icon: UtensilsCrossed, label: 'Menu', path: '/menu', requiredModule: 'reservations', businessTypes: ['restaurant'] },
  { icon: LayoutGrid, label: 'Plan de salle', path: '/salle', requiredModule: 'reservations', businessTypes: ['restaurant'] },
  { icon: Bed, label: 'Chambres', path: '/chambres', requiredModule: 'reservations', businessTypes: ['hotel'] },
  { icon: Banknote, label: 'Tarifs Saisons', path: '/tarifs', requiredModule: 'reservations', businessTypes: ['hotel'] },
  { icon: ShoppingBag, label: 'Commandes', path: '/commandes', requiredModule: 'ecommerce', businessTypes: ['commerce'] },
  { icon: Star, label: 'Avis Clients', path: '/avis-clients', alwaysShow: true },
];

// IA & Automatisation
const iaNav: NavItem[] = [
  { icon: Bot, label: 'Agent IA Web', path: '/ia-admin', requiredModule: 'agent_ia_web' },
  { icon: MessageSquare, label: 'WhatsApp IA', path: '/ia-whatsapp', requiredModule: 'whatsapp' },
  { icon: Phone, label: 'Téléphone IA', path: '/ia-telephone', requiredModule: 'telephone' },
];

// Business - Modules avancés
const businessNav: NavItem[] = [
  { icon: FileText, label: 'Facturation', path: '/facturation', requiredModule: 'facturation' },
  { icon: TrendingUp, label: 'Analytics', path: '/analytics', requiredModule: 'analytics' },
  { icon: Calculator, label: 'Comptabilité', path: '/comptabilite', requiredModule: 'comptabilite' },
  { icon: Package, label: 'Stock', path: '/stock', requiredModule: 'stock' },
  { icon: UserCog, label: 'Équipe RH', path: '/rh', requiredModule: 'rh' },
];

// Marketing - Modules marketing
const marketingNav: NavItem[] = [
  { icon: Megaphone, label: 'Campagnes', path: '/campagnes', requiredModule: 'marketing' },
  { icon: FileText, label: 'Templates Email', path: '/email-templates', requiredModule: 'marketing' },
  { icon: Target, label: 'Analytics Mktg', path: '/marketing-analytics', requiredModule: 'marketing' },
  { icon: ClipboardList, label: 'Segments CRM', path: '/segments', requiredModule: 'marketing' },
  { icon: GitBranch, label: 'Workflows', path: '/workflows', requiredModule: 'marketing' },
  { icon: Banknote, label: 'Pipeline', path: '/pipeline', requiredModule: 'pipeline', businessTypes: ['security', 'service', 'service_domicile'] },
  { icon: Calculator, label: 'Devis', path: '/devis', requiredModule: 'devis', businessTypes: ['security', 'service', 'service_domicile'] },
  { icon: Search, label: 'SEO', path: '/seo', requiredModule: 'seo' },
  { icon: FileText, label: 'Articles SEO', path: '/seo/articles', requiredModule: 'seo' },
  { icon: AlertTriangle, label: 'Anti-Churn', path: '/churn', requiredModule: 'marketing' },
  { icon: Share2, label: 'Reseaux Sociaux', path: '/reseaux-sociaux', requiredModule: 'marketing' },
  { icon: UserCheck, label: 'Onboarding', path: '/onboarding-sequences', requiredModule: 'marketing' },
];

// Système
const systemNav: NavItem[] = [
  { icon: Shield, label: 'Sentinel', path: '/sentinel', requiredModule: 'sentinel' },
  { icon: FileText, label: 'Journal d\'audit', path: '/audit-log', alwaysShow: true },
  { icon: Settings, label: 'Paramètres', path: '/parametres', alwaysShow: true },
];

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface SidebarProps {
  onLogout?: () => void;
}

export const Sidebar = memo(function Sidebar({ onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<UpgradeModalData | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, string[]> | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { name, plan, hasPlan, hasModule, isLoading } = useTenant();
  const { t: _t, businessType, businessInfo: _businessInfo } = useProfile();

  // Charger les permissions effectives de l'utilisateur
  useEffect(() => {
    authApi.getPermissions()
      .then(data => setUserPermissions(data.permissions))
      .catch(() => setUserPermissions(null));
  }, []);

  const isItemLocked = useCallback((item: NavItem): boolean => {
    if (item.alwaysShow) return false;
    if (item.requiredModule) return !hasModule(item.requiredModule);
    if (item.requiredPlan) return !hasPlan(item.requiredPlan);
    return false;
  }, [hasModule, hasPlan]);

  const shouldShowItem = useCallback((item: NavItem): boolean => {
    // 1. Filtrer par business type (pertinence metier)
    if (item.businessTypes && item.businessTypes.length > 0) {
      if (!businessType || !item.businessTypes.includes(businessType)) {
        return false;
      }
    }
    if (item.hideForBusinessTypes && businessType && item.hideForBusinessTypes.includes(businessType)) {
      return false;
    }
    // 2. Filtrer par permissions RBAC — uniquement si l'item n'est PAS locke.
    // Si le tenant n'a pas le module (plan Free par ex.), on affiche quand meme
    // l'item en mode verrouille → effet vitrine + FOMO upgrade.
    if (userPermissions && item.requiredModule && !isItemLocked(item)) {
      const rbacModule = MODULE_TO_RBAC[item.requiredModule];
      if (rbacModule) {
        const perms = userPermissions[rbacModule];
        if (!perms || perms.length === 0) return false;
      }
    }
    return true;
  }, [businessType, userPermissions, isItemLocked]);

  const getRequiredPlanForItem = useCallback((item: NavItem): PlanType => {
    if (item.requiredModule) return MODULE_TO_PLAN[item.requiredModule] || 'starter';
    return item.requiredPlan || 'starter';
  }, []);

  const getVisibleItems = useCallback((items: NavItem[]): NavItem[] => {
    return items.filter(shouldShowItem);
  }, [shouldShowItem]);

  const handleLockedItemClick = useCallback((item: NavItem) => {
    const requiredPlan = getRequiredPlanForItem(item);
    setUpgradeModal({
      feature: item.label,
      requiredPlan,
      requiredModule: item.requiredModule,
    });
  }, [getRequiredPlanForItem]);

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    const locked = isItemLocked(item);

    if (locked) {
      const requiredPlan = getRequiredPlanForItem(item);
      // Item verrouille - cliquable mais ouvre le modal d'upgrade
      return (
        <button
          onClick={() => handleLockedItemClick(item)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            'hover:bg-white/10 text-white/40 hover:text-white/60 group',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? `${item.label} (${PLAN_NAMES[requiredPlan] || 'Starter'})` : undefined}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">{item.label}</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-white/40 group-hover:text-cyan-300 bg-white/5 px-1.5 py-0.5 rounded">
                <Lock className="w-2.5 h-2.5" />
                {PLAN_NAMES[requiredPlan] || 'Starter'}
              </span>
            </>
          )}
        </button>
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

  // Plan badge — Modele 2026 (Free / Starter / Pro / Business)
  const PlanBadge = () => {
    const colors: Record<string, string> = {
      free: 'bg-gray-500',
      starter: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      pro: 'bg-gradient-to-r from-blue-500 to-indigo-500',
      business: 'bg-gradient-to-r from-yellow-500 to-orange-500',
      // Legacy alias
      basic: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    };

    const labels: Record<string, string> = {
      free: 'Free',
      starter: 'Starter',
      pro: 'Pro',
      business: 'Business',
      basic: 'Starter',
    };

    return (
      <span
        className={cn(
          'px-2 py-0.5 text-xs font-semibold text-white rounded-full',
          colors[plan] || 'bg-gray-500'
        )}
      >
        {labels[plan] || 'Free'}
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

      {/* Modal Upgrade */}
      {upgradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-8 text-white relative">
              <button
                onClick={() => setUpgradeModal(null)}
                className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Fonctionnalite Premium</h2>
                  <p className="text-white/80 text-sm">{upgradeModal.feature}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-600 mb-6">
                Cette fonctionnalite est disponible a partir du plan{' '}
                <span className="font-semibold text-gray-900">
                  {PLAN_NAMES[upgradeModal.requiredPlan || 'starter']}
                </span>.
              </p>

              {/* Plan card */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl mb-6 border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">
                    Plan {PLAN_NAMES[upgradeModal.requiredPlan || 'starter']}
                  </span>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-gray-900">
                      {PLAN_PRICES[upgradeModal.requiredPlan || 'starter']}€
                    </span>
                    <span className="text-gray-500 ml-1">/mois</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  {upgradeModal.requiredPlan === 'business'
                    ? 'RH, Compta, Sentinel, White-label, API, SSO + 20 000 credits IA inclus / mois'
                    : upgradeModal.requiredPlan === 'pro'
                    ? 'Multi-sites, tout illimite, 20 users + 5 000 credits IA inclus / mois'
                    : 'Toute l\'IA + stock, workflows, pipeline, devis, SEO + 1 000 credits IA inclus / mois'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setUpgradeModal(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Plus tard
                </button>
                <button
                  onClick={() => {
                    setUpgradeModal(null);
                    navigate('/subscription');
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Crown className="w-4 h-4" />
                  Voir les plans
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
});

export default Sidebar;
