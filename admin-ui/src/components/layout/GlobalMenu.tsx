/**
 * GlobalMenu - Menu latéral global (slide-out)
 * Inspiré du menu hamburger GitHub
 */

import {
  X, Home, Calendar, CalendarCheck, CalendarDays, Users, Scissors, Package,
  Megaphone, Bot, CreditCard, Settings, LogOut, BarChart3,
  FileText, Target, GitBranch, Search, AlertTriangle, Shield, UserCog,
  Clock, Star, ListChecks, BookOpen, UserPlus, UtensilsCrossed,
  ShoppingBag, LayoutGrid, Bed, Banknote, Phone, MessageSquare, Share2,
  UserCheck, Lock
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { useProfile } from '@/contexts/ProfileContext';
import { useTenant } from '@/hooks/useTenant';

interface GlobalMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { icon: Home, label: 'Home', path: '/' },
  { type: 'separator', label: 'Principal' },
  { icon: Calendar, label: 'Agenda', path: '/agenda' },
  { icon: CalendarCheck, label: 'Prestations', path: '/activites', hideFor: ['commerce'] },
  { icon: CalendarDays, label: 'Planning', path: '/planning' },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: Scissors, label: 'Services', path: '/services' },
  { icon: UtensilsCrossed, label: 'Menu / Carte', path: '/menu', businessType: 'restaurant' },
  { icon: ShoppingBag, label: 'Commandes', path: '/commandes', businessType: 'commerce' },
  { icon: LayoutGrid, label: 'Plan de salle', path: '/salle', businessType: 'restaurant' },
  { icon: Bed, label: 'Chambres', path: '/chambres', businessType: 'hotel' },
  { icon: Banknote, label: 'Tarifs Saisons', path: '/tarifs', businessType: 'hotel' },
  { icon: UserPlus, label: 'Equipe', path: '/equipe' },
  { icon: Clock, label: 'Disponibilités', path: '/disponibilites' },
  { icon: Star, label: 'Fidélité', path: '/fidelite' },
  { icon: ListChecks, label: 'Liste d\'attente', path: '/waitlist' },
  { icon: Star, label: 'Avis Clients', path: '/avis-clients' },
  { type: 'separator', label: 'Business' },
  { icon: CreditCard, label: 'Facturation', path: '/facturation' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', plan: 'business' },
  { icon: FileText, label: 'Comptabilité', path: '/comptabilite', plan: 'business' },
  { icon: Package, label: 'Stock', path: '/stock', plan: 'starter' },
  { icon: UserCog, label: 'Équipe RH', path: '/rh', plan: 'business' },
  { type: 'separator', label: 'Marketing' },
  { icon: Target, label: 'Segments CRM', path: '/segments', plan: 'starter' },
  { icon: GitBranch, label: 'Workflows', path: '/workflows', plan: 'starter' },
  { icon: Megaphone, label: 'Pipeline', path: '/pipeline', plan: 'starter', hideFor: ['salon', 'restaurant', 'hotel', 'commerce'] },
  { icon: FileText, label: 'Devis', path: '/devis', plan: 'starter', hideFor: ['salon', 'restaurant', 'hotel', 'commerce'] },
  { icon: Search, label: 'SEO', path: '/seo', plan: 'starter' },
  { icon: FileText, label: 'Articles SEO', path: '/seo/articles', plan: 'starter' },
  { icon: AlertTriangle, label: 'Anti-Churn', path: '/churn', plan: 'starter' },
  { icon: Share2, label: 'Réseaux Sociaux', path: '/reseaux-sociaux', plan: 'starter' },
  { icon: UserCheck, label: 'Onboarding', path: '/onboarding-sequences', plan: 'starter' },
  { type: 'separator', label: 'Système' },
  { icon: Bot, label: 'Agent IA Web', path: '/ia-admin', plan: 'starter' },
  { icon: MessageSquare, label: 'WhatsApp IA', path: '/ia-whatsapp', plan: 'starter' },
  { icon: Phone, label: 'Téléphone IA', path: '/ia-telephone', plan: 'starter' },
  { icon: Shield, label: 'Sentinel', path: '/sentinel', plan: 'business' },
  { type: 'separator' },
  { icon: CreditCard, label: 'Mon abonnement', path: '/subscription' },
  { icon: BookOpen, label: 'Mode d\'emploi', path: '/guide' },
  { icon: Settings, label: 'Paramètres', path: '/parametres' },
];

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

export function GlobalMenu({ isOpen, onClose }: GlobalMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isBusinessType } = useProfile();
  const { hasPlan } = useTenant();

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLockedClick = () => {
    navigate('/subscription');
    onClose();
  };

  const handleLogout = () => {
    api.clearToken();
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
          {menuItems.filter(item => {
            // On ne filtre QUE sur le business type (pertinence metier).
            // Les items non inclus dans le plan restent visibles en mode verrouille
            // (effet vitrine + FOMO upgrade).
            if (item.businessType && !isBusinessType(item.businessType as any)) return false;
            if (item.hideFor && item.hideFor.some((t: string) => isBusinessType(t as any))) return false;
            return true;
          }).map((item, index) => {
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
            const isLocked = !!(item.plan && !hasPlan(item.plan as any));
            const planLabel = item.plan ? (PLAN_NAMES[item.plan] || 'Starter') : '';

            return (
              <button
                key={item.path}
                onClick={() => isLocked ? handleLockedClick() : handleNavigate(item.path!)}
                className={`
                  group w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors
                  ${isActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-cyan-600 dark:text-cyan-400'
                    : isLocked
                      ? 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {isLocked && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    {planLabel}
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
