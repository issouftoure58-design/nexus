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

export type PlanType = 'starter' | 'pro' | 'business';

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
  modules: TenantModules;
  branding: TenantBranding;
  quotas: TenantQuotas;
  statut: 'actif' | 'essai' | 'suspendu' | 'annule';
  essai_fin?: string;
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
  // 1. Essayer JWT token
  const token = localStorage.getItem('nexus_admin_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      // Slug directement dans token
      if (payload.tenant_slug) {
        console.log('[useTenant] Detected from JWT slug:', payload.tenant_slug);
        return payload.tenant_slug;
      }

      // tenant_id dans token - mapper vers slug
      if (payload.tenant_id) {
        // Map connu des tenant_id → slug
        const idToSlug: Record<string, string> = {
          'fatshairafro': 'fatshairafro',
          'nexus-test': 'nexus-test',
          'decovent': 'decovent',
        };

        // Si tenant_id est un string (slug direct)
        if (typeof payload.tenant_id === 'string' && idToSlug[payload.tenant_id]) {
          console.log('[useTenant] Detected from JWT tenant_id:', payload.tenant_id);
          return payload.tenant_id;
        }

        // Si tenant_id est un number, on le garde comme fallback
        console.log('[useTenant] JWT tenant_id (numeric):', payload.tenant_id);
      }
    } catch (e) {
      console.warn('[useTenant] Failed to decode JWT:', e);
    }
  }

  // 2. Essayer subdomain
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
      'deco': 'decovent',
      'decovent': 'decovent',
    };

    if (subdomainMap[subdomain]) {
      console.log('[useTenant] Detected from subdomain:', subdomain, '→', subdomainMap[subdomain]);
      return subdomainMap[subdomain];
    }

    // Si pas de mapping, utiliser le subdomain directement
    if (subdomain !== 'localhost' && subdomain !== '127') {
      console.log('[useTenant] Using subdomain as slug:', subdomain);
      return subdomain;
    }
  }

  // 3. Essayer URL param
  const params = new URLSearchParams(window.location.search);
  const tenantParam = params.get('tenant');
  if (tenantParam) {
    console.log('[useTenant] Detected from URL param:', tenantParam);
    localStorage.setItem('nexus_tenant_slug', tenantParam);
    return tenantParam;
  }

  // 4. Fallback : localStorage
  const savedTenant = localStorage.getItem('nexus_tenant_slug');
  if (savedTenant) {
    console.log('[useTenant] Using saved tenant:', savedTenant);
    return savedTenant;
  }

  // 5. Default pour dev local
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('[useTenant] Dev mode - using default tenant: nexus-test');
    return 'nexus-test';
  }

  // 6. Fallback final
  console.warn('[useTenant] Cannot detect tenant slug, using default');
  return 'nexus-test';
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAN HIERARCHY
// ══════════════════════════════════════════════════════════════════════════════

const PLAN_ORDER: PlanType[] = ['starter', 'pro', 'business'];

/**
 * Vérifie si le plan actuel inclut le plan requis
 */
function hasPlanAccess(currentPlan: PlanType, requiredPlan: PlanType): boolean {
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const requiredIndex = PLAN_ORDER.indexOf(requiredPlan);
  return currentIndex >= requiredIndex;
}

// ══════════════════════════════════════════════════════════════════════════════
// DEFAULT QUOTAS BY PLAN
// ══════════════════════════════════════════════════════════════════════════════

const DEFAULT_QUOTAS: Record<PlanType, TenantQuotas> = {
  starter: {
    clients_max: 1000,
    storage_gb: 2,
    posts_ia_month: 100,
    images_ia_month: 100,
    reservations_month: 500,
    messages_ia_month: 1000,
  },
  pro: {
    clients_max: 3000,
    storage_gb: 10,
    posts_ia_month: 500,
    images_ia_month: 500,
    reservations_month: 2000,
    messages_ia_month: 5000,
  },
  business: {
    clients_max: -1, // Illimité
    storage_gb: 50,
    posts_ia_month: 2000,
    images_ia_month: 2000,
    reservations_month: -1, // Illimité
    messages_ia_month: -1, // Illimité
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
  const currentPlan: PlanType = tenant?.plan || 'starter';
  const currentModules = tenant?.modules || {};
  const currentBranding = tenant?.branding || {};
  const currentQuotas = tenant?.quotas || DEFAULT_QUOTAS[currentPlan];

  return {
    // Données tenant
    tenant,
    isLoading,
    error,
    refetch,

    // Raccourcis
    slug: tenant?.slug || tenantSlug,
    name: tenant?.name || 'NEXUS',
    plan: currentPlan,
    modules: currentModules,
    branding: currentBranding,
    quotas: currentQuotas,
    statut: tenant?.statut || 'actif',

    // Helpers plan
    hasPlan: (requiredPlan: PlanType) => hasPlanAccess(currentPlan, requiredPlan),
    isPro: hasPlanAccess(currentPlan, 'pro'),
    isBusiness: hasPlanAccess(currentPlan, 'business'),

    // Helpers modules
    hasModule: (moduleName: string) => currentModules[moduleName] === true,

    // Helper quotas
    getQuota: (quotaName: keyof TenantQuotas) => currentQuotas[quotaName],
    isQuotaUnlimited: (quotaName: keyof TenantQuotas) => currentQuotas[quotaName] === -1,

    // Infos essai
    isOnTrial: tenant?.statut === 'essai',
    trialEndsAt: tenant?.essai_fin ? new Date(tenant.essai_fin) : null,

    // Détection
    detectedSlug: tenantSlug,
  };
}

export type UseTenantReturn = ReturnType<typeof useTenant>;
