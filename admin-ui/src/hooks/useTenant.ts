/**
 * Hook useTenant - Détection automatique du tenant
 *
 * Ordre de détection :
 * 1. Token JWT (tenant_id ou tenant_slug dans payload)
 * 2. Subdomain (fatshair.nexus.ai → fatshairafro)
 * 3. URL param (?tenant=xxx)
 * 4. localStorage
 * 5. Défaut dev local
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

// Modele 2026 — revision 27 avril 2026 (voir memory/business-model-2026.md)
// Free 0€ / Starter 69€ / Pro 199€ / Business 499€ / Enterprise 899€
// Credits inclus : Free 500cr, Starter 4000cr, Pro 20000cr, Business 50000cr, Enterprise 100000cr
// 'basic' est DEPRECATED — garde pour retro-compat (alias de starter)
export type PlanType = 'free' | 'starter' | 'pro' | 'business' | 'enterprise' | 'basic';

/**
 * Normalise les anciens noms de plan vers les nouveaux
 * basic → starter (retro-compat)
 */
export function normalizePlan(plan: PlanType | string | undefined): 'free' | 'starter' | 'pro' | 'business' | 'enterprise' {
  if (plan === 'basic') return 'starter';
  if (plan === 'free' || plan === 'starter' || plan === 'pro' || plan === 'business' || plan === 'enterprise') return plan;
  return 'free';
}

export interface TenantModules {
  // Modules de base
  reservations?: boolean;
  clients?: boolean;
  services?: boolean;
  facturation?: boolean;

  // Modules Pro
  crm_avance?: boolean;
  analytics?: boolean;
  comptabilite?: boolean;
  marketing?: boolean;
  commercial?: boolean;
  stock?: boolean;

  // Modules Business
  seo?: boolean;
  rh?: boolean;
  sentinel?: boolean;
  churn_prevention?: boolean;

  // Modules métier optionnels
  salon?: boolean;
  restaurant?: boolean;

  // Agents IA
  agent_ia_web?: boolean;
  agent_ia_whatsapp?: boolean;
  agent_ia_telephone?: boolean;

  [key: string]: boolean | undefined;
}

export interface TenantBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  favicon?: string;
}

export interface TenantQuotas {
  clients_max: number;
  storage_gb: number;
  posts_ia_month: number;
  images_ia_month: number;
  reservations_month: number;
  messages_ia_month: number;
}

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  plan: PlanType;
  plan_choisi?: PlanType;      // Plan choisi au signup (visible après conversion)
  modules: TenantModules;
  branding: TenantBranding;
  quotas: TenantQuotas;
  statut: 'actif' | 'essai' | 'expire' | 'suspendu' | 'annule';
  essai_fin?: string;
  onboarding_completed?: boolean;
  template_id?: string;
  business_profile?: string;
  onboarding_step?: number;
  profession_id?: string;
}

interface TenantResponse {
  success: boolean;
  tenant: Tenant;
}

// ══════════════════════════════════════════════════════════════════════════════
// DÉTECTION TENANT SLUG
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Détecte le slug du tenant depuis différentes sources
 */
function detectTenantSlug(): string {
  // 1. Source de vérité : nexus_current_tenant (mis à jour par api.setToken)
  const currentTenant = localStorage.getItem('nexus_current_tenant');
  if (currentTenant) {
    return currentTenant;
  }

  // 2. Fallback : décoder JWT token
  const token = localStorage.getItem('nexus_admin_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      if (payload.tenant_slug) {
        return payload.tenant_slug;
      }

      if (payload.tenant_id && typeof payload.tenant_id === 'string') {
        return payload.tenant_id;
      }
    } catch (e) {
      console.warn('[useTenant] Failed to decode JWT:', e);
    }
  }

  // 3. Essayer subdomain
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // Format: tenant.nexus.ai ou tenant.localhost
  if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'admin' && parts[0] !== 'app') {
    const subdomain = parts[0];

    // Map subdomain → slug
    const subdomainMap: Record<string, string> = {
      'fatshair': 'fatshairafro',
      'fatshairafo': 'fatshairafro',
      'test': 'nexus-test',
      'nexus-test': 'nexus-test',
      'domicile': 'test-domicile',
      'test-domicile': 'test-domicile',
    };

    if (subdomainMap[subdomain]) {
      return subdomainMap[subdomain];
    }

    if (subdomain !== 'localhost' && subdomain !== '127') {
      return subdomain;
    }
  }

  // 4. Essayer URL param
  const params = new URLSearchParams(window.location.search);
  const tenantParam = params.get('tenant');
  if (tenantParam) {
    localStorage.setItem('nexus_tenant_slug', tenantParam);
    return tenantParam;
  }

  // 5. Fallback : localStorage legacy
  const savedTenant = localStorage.getItem('nexus_tenant_slug');
  if (savedTenant) {
    return savedTenant;
  }

  // 6. Default pour dev local uniquement
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'nexus-test';
  }

  // 7. Production: pas de fallback — tenant requis
  // Ne pas alarmer si pas de token (état normal sur la page de login)
  const hasToken = !!localStorage.getItem('nexus_admin_token');
  if (hasToken) {
    console.error('[useTenant] ERREUR: Impossible de détecter le tenant');
  }
  return '';
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAN HIERARCHY
// ══════════════════════════════════════════════════════════════════════════════

const PLAN_ORDER: Array<'free' | 'starter' | 'pro' | 'business' | 'enterprise'> = ['free', 'starter', 'pro', 'business', 'enterprise'];

/**
 * Vérifie si le plan actuel inclut le plan requis
 * Les anciens noms (starter/pro) sont automatiquement normalisés
 */
function hasPlanAccess(currentPlan: PlanType, requiredPlan: PlanType): boolean {
  const currentIndex = PLAN_ORDER.indexOf(normalizePlan(currentPlan));
  const requiredIndex = PLAN_ORDER.indexOf(normalizePlan(requiredPlan));
  return currentIndex >= requiredIndex;
}

// ══════════════════════════════════════════════════════════════════════════════
// DEFAULT QUOTAS BY PLAN
// ══════════════════════════════════════════════════════════════════════════════

// Quotas par defaut (modele 2026 — revision 27 avril 2026)
// Free       : freemium strict, IA bloquee (500 credits limite)
// Starter    : toute IA + CRM, 200 limites, 4 000 credits IA inclus
// Pro        : facturation, devis, pipeline, equipe, planning, marketing complet, stock, fidelite, 20 000 credits
// Business   : + compta basique, SEO, API, 50 000 credits
// Enterprise : + RH, compta analytique, Sentinel, white-label, SSO, 100 000 credits
const DEFAULT_QUOTAS: Record<'free' | 'starter' | 'pro' | 'business' | 'enterprise', TenantQuotas> = {
  free: {
    clients_max: 5,
    storage_gb: 1,
    posts_ia_month: 0,
    images_ia_month: 0,
    reservations_month: 5,
    messages_ia_month: 0,
  },
  starter: {
    clients_max: 200,
    storage_gb: 10,
    posts_ia_month: 0, // 4 000 credits IA inclus (gere via ai_credits)
    images_ia_month: 0,
    reservations_month: 200,
    messages_ia_month: 0, // 4 000 credits IA inclus (gere via ai_credits)
  },
  pro: {
    clients_max: -1, // Illimite
    storage_gb: 50,
    posts_ia_month: 0, // 20 000 credits IA inclus (gere via ai_credits)
    images_ia_month: 0,
    reservations_month: -1, // Illimite
    messages_ia_month: 0, // 20 000 credits IA inclus (gere via ai_credits)
  },
  business: {
    clients_max: -1, // Illimite
    storage_gb: 200,
    posts_ia_month: 0, // 50 000 credits IA inclus (gere via ai_credits)
    images_ia_month: 0,
    reservations_month: -1, // Illimite
    messages_ia_month: 0,
  },
  enterprise: {
    clients_max: -1, // Illimite
    storage_gb: -1, // Illimite
    posts_ia_month: 0, // 100 000 credits IA inclus (gere via ai_credits)
    images_ia_month: 0,
    reservations_month: -1, // Illimite
    messages_ia_month: 0,
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useTenant() {
  const tenantSlug = detectTenantSlug();

  // Mode démo désactivé - authentification réelle requise
  const DEMO_MODE = false;
  const hasToken = !!localStorage.getItem('nexus_admin_token');

  // Charger config tenant depuis API
  const { data, isLoading, error, refetch } = useQuery<TenantResponse>({
    queryKey: ['tenant', tenantSlug],
    queryFn: async () => {
      try {
        // En mode démo sans token, essayer avec le slug
        const endpoint = hasToken ? '/tenants/me' : `/tenants/by-slug/${tenantSlug}`;
        const response = await api.get<TenantResponse>(endpoint);
        return response;
      } catch (err) {
        console.error('[useTenant] Failed to load tenant config:', err);
        // En mode démo, retourner config fictive
        if (DEMO_MODE) {
          return {
            success: true,
            tenant: {
              id: 1,
              slug: tenantSlug,
              name: 'Salon Élégance Paris',
              plan: 'business' as PlanType,
              modules: {
                reservations: true,
                clients: true,
                services: true,
                facturation: true,
                crm_avance: true,
                analytics: true,
                comptabilite: true,
                marketing: true,
                commercial: true,
                stock: true,
                seo: true,
                rh: true,
                sentinel: true,
                churn_prevention: true,
                agent_ia_web: true,
                agent_ia_whatsapp: true,
                agent_ia_telephone: true,
              },
              branding: {
                primaryColor: '#0891b2',
              },
              quotas: DEFAULT_QUOTAS.business,
              statut: 'actif' as const,
            },
          };
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // Cache 5 min
    retry: DEMO_MODE ? 0 : 2,
    // En mode démo, toujours charger
    enabled: DEMO_MODE || hasToken,
  });

  const tenant = data?.tenant;

  // Sauvegarder tenant slug en localStorage si trouvé
  if (tenant?.slug) {
    localStorage.setItem('nexus_tenant_slug', tenant.slug);
  }

  // Valeurs par défaut si pas encore chargé
  // Le backend retourne le plan effectif. Modele 2026 : default = Free
  const currentPlan: PlanType = tenant?.plan || 'free';
  const currentModules = tenant?.modules || {};
  const currentBranding = tenant?.branding || {};
  const currentQuotas = tenant?.quotas || DEFAULT_QUOTAS[normalizePlan(currentPlan)];

  // Plan choisi au signup (pour affichage upgrade sur la page abonnement)
  const chosenPlan: PlanType = tenant?.plan_choisi || currentPlan;

  return {
    // Données tenant
    tenant,
    isLoading,
    error,
    refetch,

    // Raccourcis
    slug: tenant?.slug || tenantSlug,
    name: tenant?.name || 'NEXUS',
    plan: currentPlan,         // Plan effectif (Free pendant essai)
    chosenPlan,                // Plan choisi au signup (pour info upgrade)
    modules: currentModules,
    branding: currentBranding,
    quotas: currentQuotas,
    statut: tenant?.statut || 'actif',

    // Helpers plan — bases sur le plan effectif (modele 2026 — 27 avril)
    hasPlan: (requiredPlan: PlanType) => hasPlanAccess(currentPlan, requiredPlan),
    isStarter: hasPlanAccess(currentPlan, 'starter'),
    isPro: hasPlanAccess(currentPlan, 'pro'),
    isBusiness: hasPlanAccess(currentPlan, 'business'),
    isEnterprise: hasPlanAccess(currentPlan, 'enterprise'),
    // DEPRECATED — alias retro-compat (a supprimer apres migration consumers)
    isBasic: hasPlanAccess(currentPlan, 'starter'),

    // Helpers modules
    hasModule: (moduleName: string) => currentModules[moduleName] === true,

    // Helper quotas
    getQuota: (quotaName: keyof TenantQuotas) => currentQuotas[quotaName],
    isQuotaUnlimited: (quotaName: keyof TenantQuotas) => currentQuotas[quotaName] === -1,

    // Onboarding
    onboardingCompleted: tenant?.onboarding_completed || false,

    // Infos essai
    isOnTrial: tenant?.statut === 'essai',
    trialEndsAt: tenant?.essai_fin ? new Date(tenant.essai_fin) : null,

    // Détection
    detectedSlug: tenantSlug,
  };
}

export type UseTenantReturn = ReturnType<typeof useTenant>;
