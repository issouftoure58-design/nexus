/**
 * API Client NEXUS - Multi-tenant
 *
 * Features:
 * - Auto-injection du token JWT
 * - Auto-injection des headers tenant (X-Tenant-ID, X-Tenant-Slug)
 * - Gestion des erreurs 401 (déconnexion auto)
 * - Logging en mode dev
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const IS_DEV = import.meta.env.DEV;

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
  skipTenant?: boolean;
}

/**
 * Extrait les infos tenant depuis le JWT
 */
function extractTenantFromJWT(token: string): { tenant_id?: string; tenant_slug?: string } {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      tenant_id: payload.tenant_id?.toString(),
      tenant_slug: payload.tenant_slug,
    };
  } catch {
    return {};
  }
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('nexus_admin_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('nexus_admin_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('nexus_admin_token');
    localStorage.removeItem('nexus_tenant_slug');
  }

  /**
   * Requête HTTP avec headers automatiques
   */
  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { skipAuth, skipTenant, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // 1. Ajouter token Authorization
    if (!skipAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;

      // 2. Extraire et ajouter headers tenant depuis JWT
      if (!skipTenant) {
        const { tenant_id, tenant_slug } = extractTenantFromJWT(this.token);

        if (tenant_id) {
          headers['X-Tenant-ID'] = tenant_id;
        }
        if (tenant_slug) {
          headers['X-Tenant-Slug'] = tenant_slug;
        }
      }
    }

    // 3. Fallback : tenant slug depuis localStorage
    if (!skipTenant && !headers['X-Tenant-Slug']) {
      const savedSlug = localStorage.getItem('nexus_tenant_slug');
      if (savedSlug) {
        headers['X-Tenant-Slug'] = savedSlug;
      }
    }

    // Log en dev
    if (IS_DEV) {
      console.log(`[API] ${fetchOptions.method || 'GET'} ${endpoint}`, {
        tenant: headers['X-Tenant-ID'] || headers['X-Tenant-Slug'] || 'none',
      });
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    // Gestion erreur 401 : déconnexion auto
    if (response.status === 401) {
      console.warn('[API] 401 Unauthorized - clearing auth');
      this.clearToken();
      window.location.href = '/login';
      throw new Error('Session expirée');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));

      if (IS_DEV) {
        console.error(`[API] Error ${response.status}:`, error);
      }

      throw new Error(error.error || error.message || 'Erreur serveur');
    }

    const data = await response.json();

    if (IS_DEV) {
      console.log(`[API] Response ${endpoint}:`, response.status);
    }

    return data;
  }

  // GET request
  get<T>(endpoint: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  // POST request
  post<T>(endpoint: string, data?: unknown, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  put<T>(endpoint: string, data?: unknown, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PATCH request
  patch<T>(endpoint: string, data?: unknown, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  delete<T>(endpoint: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();

// ══════════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; admin: { id: number; email: string; nom: string; role: string } }>(
      '/admin/auth/login',
      { email, password },
      { skipAuth: true }
    ),
  verify: () => api.get<{ admin: { id: number; email: string; nom: string; role: string } }>('/admin/auth/me'),
  logout: () => api.post('/admin/auth/logout'),
};

// Dashboard Stats
export const statsApi = {
  getDashboard: () => api.get<DashboardStats>('/admin/stats/dashboard'),
};

// Clients
export const clientsApi = {
  list: (params?: ClientsParams) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ClientsResponse>(`/admin/clients?${query}`);
  },
  get: (id: number) => api.get<ClientDetail>(`/admin/clients/${id}`),
  create: (data: CreateClientData) => api.post<{ client: Client }>('/admin/clients', data),
  update: (id: number, data: Partial<Client>) => api.put<{ client: Client }>(`/admin/clients/${id}`, data),
  delete: (id: number) => api.delete(`/admin/clients/${id}`),
};

// Reservations
export const reservationsApi = {
  list: (params?: ReservationsParams) => {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.statut) query.set('statut', params.statut);
    if (params?.page) query.set('page', String(params.page));
    return api.get<ReservationsResponse>(`/admin/reservations?${query}`);
  },
  get: (id: number) => api.get<Reservation>(`/admin/reservations/${id}`),
  create: (data: CreateReservationData) => api.post<{ reservation: Reservation }>('/admin/reservations', data),
  updateStatus: (id: number, statut: string) => api.patch(`/admin/reservations/${id}/statut`, { statut }),
  delete: (id: number) => api.delete(`/admin/reservations/${id}`),
};

// Services
export const servicesApi = {
  list: () => api.get<{ services: Service[] }>('/admin/services'),
  create: (data: CreateServiceData) => api.post<{ service: Service }>('/admin/services', data),
  update: (id: number, data: Partial<Service>) => api.put<{ service: Service }>(`/admin/services/${id}`, data),
  delete: (id: number) => api.delete(`/admin/services/${id}`),
};

// Stock
export const stockApi = {
  list: () => api.get<{ produits: Product[] }>('/admin/stock'),
  create: (data: CreateProductData) => api.post<{ produit: Product }>('/admin/stock', data),
  update: (id: number, data: Partial<Product>) => api.put<{ produit: Product }>(`/admin/stock/${id}`, data),
  delete: (id: number) => api.delete(`/admin/stock/${id}`),
  ajusterQuantite: (id: number, quantite: number, raison: string) =>
    api.post(`/admin/stock/${id}/ajuster`, { quantite, raison }),
};

// Comptabilité
export const comptaApi = {
  getStats: () => api.get<ComptaStats>('/admin/compta/stats'),
  getFactures: (params?: FacturesParams) => {
    const query = new URLSearchParams();
    if (params?.statut) query.set('statut', params.statut);
    return api.get<{ factures: Invoice[] }>(`/admin/factures?${query}`);
  },
  getDepenses: () => api.get<{ depenses: Expense[] }>('/admin/depenses'),
  createDepense: (data: CreateExpenseData) => api.post<{ depense: Expense }>('/admin/depenses', data),
};

// Analytics
export const analyticsApi = {
  getOverview: () => api.get<AnalyticsOverview>('/admin/analytics/overview'),
  getRevenue: (period: string) => api.get<RevenueData>(`/admin/analytics/revenue?period=${period}`),
  getClients: () => api.get<ClientsAnalytics>('/admin/analytics/clients'),
};

// RH / Team
export const rhApi = {
  getTeam: () => api.get<{ members: TeamMember[] }>('/admin/rh/team'),
  createMember: (data: CreateMemberData) => api.post<{ member: TeamMember }>('/admin/rh/team', data),
  updateMember: (id: number, data: Partial<TeamMember>) => api.put<{ member: TeamMember }>(`/admin/rh/team/${id}`, data),
  deleteMember: (id: number) => api.delete(`/admin/rh/team/${id}`),
};

// Quotas
export const quotasApi = {
  get: () => api.get<QuotasData>('/quotas'),
};

// Tenant
export const tenantApi = {
  /**
   * Récupère les infos du tenant actuel (détecté via JWT)
   */
  getMe: () => api.get<TenantResponse>('/tenants/me'),

  /**
   * Met à jour le branding du tenant
   */
  updateBranding: (data: Partial<TenantBranding>) =>
    api.patch<TenantResponse>('/tenants/me/branding', data),

  /**
   * Liste des modules disponibles pour upgrade
   */
  getAvailableModules: () =>
    api.get<{ modules: AvailableModule[] }>('/tenants/modules/available'),
};

// Subscription
export const subscriptionApi = {
  /**
   * Récupère l'abonnement actuel
   */
  getCurrent: () => api.get<SubscriptionData>('/subscription'),

  /**
   * Change de plan
   */
  changePlan: (plan: 'starter' | 'pro' | 'business') =>
    api.post<{ success: boolean; redirect_url?: string }>('/subscription/change', { plan }),

  /**
   * Active/désactive un module
   */
  toggleModule: (moduleId: string, active: boolean) =>
    api.post<{ success: boolean }>('/subscription/modules', { moduleId, active }),

  /**
   * Récupère l'historique des factures
   */
  getInvoices: () => api.get<{ invoices: SubscriptionInvoice[] }>('/subscription/invoices'),

  /**
   * Portail de paiement Stripe
   */
  getPortalUrl: () => api.get<{ url: string }>('/subscription/portal'),
};

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

// Tenant Types
export interface TenantBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  favicon?: string;
}

export interface TenantResponse {
  success: boolean;
  tenant: {
    id: number;
    slug: string;
    name: string;
    plan: 'starter' | 'pro' | 'business';
    modules: Record<string, boolean>;
    branding: TenantBranding;
    quotas: {
      clients_max: number;
      storage_gb: number;
      posts_ia_month: number;
      images_ia_month: number;
      reservations_month: number;
      messages_ia_month: number;
    };
    statut: 'actif' | 'essai' | 'suspendu' | 'annule';
    essai_fin?: string;
  };
}

export interface AvailableModule {
  id: string;
  name: string;
  description: string;
  price: number;
  requiredPlan: 'starter' | 'pro' | 'business';
}

export interface SubscriptionData {
  plan: 'starter' | 'pro' | 'business';
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  modules: string[];
  monthlyPrice: number;
}

export interface SubscriptionInvoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'open' | 'void';
  pdfUrl?: string;
}

export interface DashboardStats {
  ca: { jour: number; mois: number };
  rdv: { confirmes: number; en_attente: number; annules: number; termines: number };
  servicesPopulaires: Array<{ service: string; count: number }>;
  nbClients: number;
  prochainRdv: Reservation | null;
  graphiqueCa: Array<{ date: string; jour: string; ca: number }>;
}

export interface Client {
  id: number;
  prenom: string;
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  created_at: string;
  nb_rdv?: number;
  dernier_rdv?: { date: string; statut: string } | null;
}

export interface ClientDetail {
  client: Client & { derniere_visite: string | null };
  stats: {
    ca_total: number;
    nb_rdv_total: number;
    nb_rdv_honores: number;
    nb_rdv_annules: number;
    service_favori: string | null;
    frequence_jours: number | null;
  };
  notes: Array<{ id: number; note: string; created_at: string }>;
  historique_rdv: Reservation[];
}

export interface ClientsParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ClientsResponse {
  clients: Client[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface CreateClientData {
  prenom: string;
  nom: string;
  telephone: string;
  email?: string;
}

export interface Reservation {
  id: number;
  client_id: number;
  service_nom: string;
  date: string;
  heure: string;
  duree: number;
  prix_total: number;
  statut: 'demande' | 'confirme' | 'en_attente' | 'en_attente_paiement' | 'termine' | 'annule';
  notes: string | null;
  clients?: { nom: string; prenom: string; telephone: string };
}

export interface ReservationsParams {
  date?: string;
  statut?: string;
  page?: number;
}

export interface ReservationsResponse {
  reservations: Reservation[];
  pagination: { page: number; total: number; pages: number };
}

export interface CreateReservationData {
  client_id: number;
  service_id: number;
  date: string;
  heure: string;
  notes?: string;
}

export interface Service {
  id: number;
  nom: string;
  description: string | null;
  duree: number;
  prix: number;
  actif: boolean;
}

export interface CreateServiceData {
  nom: string;
  description?: string;
  duree: number;
  prix: number;
}

export interface Product {
  id: number;
  nom: string;
  description: string | null;
  quantite: number;
  prix_achat: number;
  prix_vente: number;
  seuil_alerte: number;
}

export interface CreateProductData {
  nom: string;
  description?: string;
  quantite: number;
  prix_achat: number;
  prix_vente: number;
  seuil_alerte?: number;
}

export interface Invoice {
  id: number;
  numero: string;
  client_id: number;
  montant: number;
  statut: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  date_emission: string;
  date_echeance: string;
  clients?: { nom: string; prenom: string };
}

export interface Expense {
  id: number;
  categorie: string;
  description: string;
  montant: number;
  date: string;
}

export interface CreateExpenseData {
  categorie: string;
  description: string;
  montant: number;
  date: string;
}

export interface FacturesParams {
  statut?: string;
}

export interface ComptaStats {
  ca_mois: number;
  depenses_mois: number;
  benefice_mois: number;
  factures_impayees: number;
}

export interface AnalyticsOverview {
  ca_total: number;
  ca_variation: number;
  nb_clients: number;
  clients_variation: number;
  nb_rdv: number;
  rdv_variation: number;
  taux_conversion: number;
}

export interface RevenueData {
  data: Array<{ date: string; ca: number }>;
}

export interface ClientsAnalytics {
  nouveaux_clients: number;
  clients_actifs: number;
  clients_perdus: number;
  taux_retention: number;
}

export interface TeamMember {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  email: string;
  telephone: string;
  actif: boolean;
}

export interface CreateMemberData {
  nom: string;
  prenom: string;
  role: string;
  email: string;
  telephone: string;
}

export interface QuotasData {
  plan: string;
  quotas: {
    clients: { used: number; limit: number };
    messages_ia: { used: number; limit: number };
    reservations: { used: number; limit: number };
  };
}
