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

/**
 * Génère la clé localStorage pour un tenant donné
 */
function getTokenKey(tenantSlug?: string): string {
  return tenantSlug ? `nexus_admin_token_${tenantSlug}` : 'nexus_admin_token';
}

class ApiClient {
  private token: string | null = null;
  private currentTenant: string | null = null;

  constructor() {
    // Récupérer le tenant actuel
    this.currentTenant = localStorage.getItem('nexus_current_tenant');

    // Charger le token du tenant actuel
    if (this.currentTenant) {
      this.token = localStorage.getItem(getTokenKey(this.currentTenant));
    }

    // Fallback: ancien système (migration)
    if (!this.token) {
      this.token = localStorage.getItem('nexus_admin_token');
      // Si on a un ancien token, extraire le tenant et migrer
      if (this.token) {
        const { tenant_slug } = extractTenantFromJWT(this.token);
        if (tenant_slug) {
          this.currentTenant = tenant_slug;
          localStorage.setItem('nexus_current_tenant', tenant_slug);
          localStorage.setItem(getTokenKey(tenant_slug), this.token);
          // Garder l'ancien pour compatibilité temporaire
        }
      }
    }
  }

  setToken(token: string) {
    this.token = token;

    // Extraire le tenant du JWT et stocker avec clé spécifique
    const { tenant_slug } = extractTenantFromJWT(token);
    if (tenant_slug) {
      this.currentTenant = tenant_slug;
      localStorage.setItem('nexus_current_tenant', tenant_slug);
      localStorage.setItem(getTokenKey(tenant_slug), token);
    }

    // Garder aussi l'ancien système pour compatibilité
    localStorage.setItem('nexus_admin_token', token);
  }

  clearToken() {
    // Supprimer le token du tenant actuel
    if (this.currentTenant) {
      localStorage.removeItem(getTokenKey(this.currentTenant));
    }

    this.token = null;
    this.currentTenant = null;

    // Nettoyer l'ancien système aussi
    localStorage.removeItem('nexus_admin_token');
    localStorage.removeItem('nexus_current_tenant');
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
  get: (id: number) => api.get<{
    service: Service;
    stats: {
      ca_total: number;
      nb_rdv_total: number;
      nb_rdv_termines: number;
      nb_rdv_annules: number;
      nb_clients_uniques: number;
      derniere_reservation: string | null;
    };
    top_clients: Array<{ id: number; prenom: string; nom: string; nb_rdv: number }>;
    historique_rdv: Array<{
      id: number;
      date: string;
      heure: string;
      statut: string;
      prix_total: number;
      client_nom: string;
    }>;
  }>(`/admin/services/${id}`),
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
  getStats: async (): Promise<ComptaStats> => {
    // Utiliser le dashboard pour obtenir les stats
    const dashboard = await api.get<{
      moisActuel: {
        revenus: { total: string };
        depenses: { total: string };
        resultat: { net: string };
      };
    }>('/admin/compta/dashboard');

    // Récupérer les factures impayées
    const facturesRes = await api.get<{ factures: Invoice[] }>('/factures');

    return {
      ca_mois: parseFloat(dashboard.moisActuel?.revenus?.total || '0'),
      depenses_mois: parseFloat(dashboard.moisActuel?.depenses?.total || '0'),
      benefice_mois: parseFloat(dashboard.moisActuel?.resultat?.net || '0'),
      factures_impayees: facturesRes.factures?.filter(f => f.statut !== 'payee' && f.statut !== 'annulee').length || 0,
    };
  },
  getFactures: (params?: FacturesParams) => {
    const query = new URLSearchParams();
    if (params?.statut) query.set('statut', params.statut);
    return api.get<{ factures: Invoice[] }>(`/factures?${query}`);
  },
  getDepenses: () => api.get<{ depenses: Expense[] }>('/depenses'),
  createDepense: (data: CreateExpenseData) => api.post<{ depense: Expense }>('/depenses', data),
  marquerDepensePayee: (id: number, payee: boolean, mode_paiement?: string) =>
    api.patch<{ success: boolean; depense: Expense }>(`/depenses/${id}/payer`, { payee, mode_paiement }),
  getTVA: (mois?: string) => api.get<TVAData>(`/depenses/tva${mois ? `?mois=${mois}` : ''}`),
  updateFactureStatut: (id: number, statut: string, mode_paiement?: string) =>
    api.patch<{ facture: Invoice }>(`/factures/${id}/statut`, { statut, mode_paiement }),
  getFacture: (id: number) => api.get<{ facture: Invoice }>(`/factures/${id}`),
  getFacturePDF: (id: number) => api.get<{ success: boolean; facture: Invoice; html: string; tenant: string }>(`/factures/${id}/pdf`),
  sendFacture: (id: number) => api.post<{ success: boolean; message: string }>(`/factures/${id}/envoyer`),
  sendAllFactures: () => api.post<{ success: boolean; nb_envoyees: number }>('/factures/envoyer-toutes'),
  syncFactures: () => api.post<{ success: boolean; message: string; nb_creees: number; nb_mises_a_jour: number; nb_echecs?: number; total_reservations?: number }>('/factures/generer-manquantes'),
  // Relances
  getRelances: () => api.get<{ success: boolean; factures: RelanceFacture[]; stats: RelanceStats }>('/relances'),
  getRelanceHistorique: (factureId: number) => api.get<{ success: boolean; historique: RelanceHistorique[] }>(`/relances/historique/${factureId}`),
  envoyerRelance: (factureId: number, niveau: number) => api.post<{ success: boolean; message: string }>(`/relances/${factureId}/envoyer`, { niveau }),
  marquerPayee: (factureId: number) => api.patch<{ success: boolean }>(`/relances/${factureId}/marquer-payee`),
  transmettreContentieux: (factureId: number, service: 'interne' | 'huissier') => api.post<{ success: boolean; message: string }>(`/relances/${factureId}/contentieux`, { service }),
  // Relance Settings
  getRelanceSettings: () => api.get<{ success: boolean; settings: RelanceSettings }>('/relances/settings'),
  saveRelanceSettings: (settings: RelanceSettings) => api.put<{ success: boolean; message: string; settings: RelanceSettings }>('/relances/settings', { settings }),
  // Journaux Comptables
  getJournaux: () => api.get<Journal[]>('/journaux'),
  getEcritures: (params?: { journal?: string; periode?: string; compte?: string; non_lettrees?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.journal) query.set('journal', params.journal);
    if (params?.periode) query.set('periode', params.periode);
    if (params?.compte) query.set('compte', params.compte);
    if (params?.non_lettrees) query.set('non_lettrees', 'true');
    return api.get<{ ecritures: EcritureComptable[]; totaux: { debit: number; credit: number; solde: number; solde_banque?: number; solde_caisse?: number } }>(`/journaux/ecritures?${query}`);
  },
  getEcrituresBanque: (params?: { periode?: string; non_pointees?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.periode) query.set('periode', params.periode);
    if (params?.non_pointees) query.set('non_pointees', 'true');
    return api.get<{ ecritures: EcritureComptable[]; solde_comptable: number }>(`/journaux/ecritures/banque?${query}`);
  },
  pointerEcritures: (ids: number[], lettrage?: string) => api.post<{ success: boolean }>('/journaux/ecritures/pointer', { ids, lettrage }),
  genererToutesEcritures: () => api.post<{ success: boolean; message: string }>('/journaux/generer/tout'),
  // À Nouveaux
  genererANouveaux: (exercicePrecedent: number) =>
    api.post<{ success: boolean; message: string; resultat?: number; resultat_type?: string; nb_ecritures: number; exercice?: number }>('/journaux/generer/a-nouveaux', { exercice_precedent: exercicePrecedent }),
  getANouveauxStatus: (exercice: number) =>
    api.get<{ exercice: number; generes: boolean; nb_ecritures: number; totaux: { debit: number; credit: number } }>(`/journaux/a-nouveaux/status?exercice=${exercice}`),
  getBalance: (params?: { periode?: string; exercice?: number }) => {
    const query = new URLSearchParams();
    if (params?.periode) query.set('periode', params.periode);
    if (params?.exercice) query.set('exercice', params.exercice.toString());
    return api.get<{ balance: BalanceCompte[]; totaux: { debit: number; credit: number; solde_debiteur: number; solde_crediteur: number } }>(`/journaux/balance?${query}`);
  },

  // États comptables avancés
  getPlanComptable: () => api.get<{ comptes: CompteComptable[]; classes: Record<string, { libelle: string; comptes: CompteComptable[] }> }>('/journaux/plan-comptable'),

  getGrandLivre: (params?: { compte?: string; periode_debut?: string; periode_fin?: string; exercice?: number }) => {
    const query = new URLSearchParams();
    if (params?.compte) query.set('compte', params.compte);
    if (params?.periode_debut) query.set('periode_debut', params.periode_debut);
    if (params?.periode_fin) query.set('periode_fin', params.periode_fin);
    if (params?.exercice) query.set('exercice', params.exercice.toString());
    return api.get<GrandLivreResponse>(`/journaux/grand-livre?${query}`);
  },

  getGrandLivreCompte: (compte: string, exercice?: number) => {
    const query = exercice ? `?exercice=${exercice}` : '';
    return api.get<CompteDetailResponse>(`/journaux/grand-livre/${compte}${query}`);
  },

  getBalanceGenerale: (params?: { periode?: string; exercice?: number; avec_sous_comptes?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.periode) query.set('periode', params.periode);
    if (params?.exercice) query.set('exercice', params.exercice.toString());
    if (params?.avec_sous_comptes) query.set('avec_sous_comptes', 'true');
    return api.get<BalanceGeneraleResponse>(`/journaux/balance-generale?${query}`);
  },

  getBalanceClients: (exercice?: number) => {
    const query = exercice ? `?exercice=${exercice}` : '';
    return api.get<BalanceAuxiliaireResponse>(`/journaux/balance-clients${query}`);
  },

  getBalanceFournisseurs: (exercice?: number) => {
    const query = exercice ? `?exercice=${exercice}` : '';
    return api.get<BalanceAuxiliaireResponse>(`/journaux/balance-fournisseurs${query}`);
  },

  getBilan: (exercice?: number) => {
    const query = exercice ? `?exercice=${exercice}` : '';
    return api.get<BilanResponse>(`/journaux/bilan${query}`);
  },

  getCompteResultat: (params?: { exercice?: number; periode?: string }) => {
    const query = new URLSearchParams();
    if (params?.exercice) query.set('exercice', params.exercice.toString());
    if (params?.periode) query.set('periode', params.periode);
    return api.get<CompteResultatResponse>(`/journaux/compte-resultat?${query}`);
  },

  getBalanceAgee: () => api.get<BalanceAgeeResponse>('/journaux/balance-agee'),

  exportFEC: (exercice: number) => {
    window.open(`${API_BASE}/journaux/fec?exercice=${exercice}`, '_blank');
  },
};

// Types Journaux
export interface Journal {
  id: number;
  code: string;
  libelle: string;
  description?: string;
  actif: boolean;
}

export interface EcritureComptable {
  id: number;
  journal_code: string;
  date_ecriture: string;
  numero_piece?: string;
  compte_numero: string;
  compte_libelle?: string;
  libelle: string;
  debit: number;
  credit: number;
  lettrage?: string;
  date_lettrage?: string;
  facture_id?: number;
  depense_id?: number;
  paie_journal_id?: number;
  periode?: string;
  exercice?: number;
  debit_euros?: string;
  credit_euros?: string;
}

export interface BalanceCompte {
  numero: string;
  libelle: string;
  debit: number;
  credit: number;
  solde_debiteur: number;
  solde_crediteur: number;
}

// Types Relances
export interface RelanceFacture {
  id: number;
  numero: string;
  client_nom: string;
  client_email: string;
  client_telephone: string;
  montant_ttc: number;
  date_facture: string;
  date_echeance: string;
  jours_retard: number;
  niveau_relance: number;
  dernier_envoi: string | null;
  statut: string;
  en_contentieux: boolean;
}

export interface RelanceStats {
  total_impayees: number;
  montant_total: number;
  r1_preventive: number;
  r2_echeance: number;
  r3_plus7: number;
  r4_plus15: number;
  r5_mise_demeure: number;
  contentieux: number;
}

export interface RelanceHistorique {
  id: number;
  date_envoi: string;
  niveau: number;
  type: string;
  email_envoye: boolean;
  sms_envoye: boolean;
}

export interface RelanceSettings {
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
  contentieux: number;
}

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

// Trial
export interface TrialStatus {
  success: boolean;
  isTrial: boolean;
  isActive: boolean;
  isExpired: boolean;
  isPaid: boolean;
  daysRemaining: number;
  trialEnd?: string;
  trialStart?: string;
  usage: {
    interactions_ia: number;
    reservations: number;
    sms: number;
    clients: number;
  };
  limits: {
    interactions_ia: number;
    reservations: number;
    sms: number;
    emails: number;
    clients: number;
  };
  alerts: Array<{
    type: 'warning' | 'critical';
    code: string;
    message: string;
    action?: string;
  }>;
  percentComplete: number;
}

export const trialApi = {
  /**
   * Récupère le statut du trial
   */
  getStatus: () => api.get<TrialStatus>('/trial/status'),

  /**
   * Récupère les limites du trial
   */
  getLimits: () => api.get<{ limits: TrialStatus['limits']; duration_days: number }>('/trial/limits'),

  /**
   * Vérifie si une action est autorisée
   */
  checkLimit: (resource: string, amount?: number) =>
    api.post<{ allowed: boolean; used?: number; limit?: number; remaining?: number }>(
      '/trial/check',
      { resource, amount }
    ),

  /**
   * Résumé d'usage pendant le trial
   */
  getUsageSummary: () => api.get<{
    isTrial: boolean;
    daysRemaining: number;
    usage: Record<string, { used: number; limit: number; remaining: number; percentage: number; isAtLimit: boolean }>;
    alerts: TrialStatus['alerts'];
  }>('/trial/usage-summary'),
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
  tags?: string[] | null;
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
  taux_tva?: number;
  taxe_cnaps?: boolean;
  taux_cnaps?: number;
  categorie?: string;
  // Champs calculés par le backend
  prix_ht_base?: number;
  prix_ht?: number;
  prix_tva?: number;
  montant_cnaps?: number;
}

export interface CreateServiceData {
  nom: string;
  description?: string;
  duree: number;
  prix: number;
  taux_tva?: number;
  taxe_cnaps?: boolean;
  taux_cnaps?: number;
  categorie?: string;
  actif?: boolean;
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
  // Montants en centimes
  montant_ht: number;
  montant_ttc: number;
  montant_tva: number;
  taux_tva: number;
  // Noms formattés par le backend
  client_nom: string;
  client_email?: string;
  client_telephone?: string;
  service_nom: string;
  service_description?: string;
  // Dates
  date_facture: string;
  date_prestation: string;
  date_envoi?: string;
  date_paiement?: string;
  // Statut
  statut: 'brouillon' | 'generee' | 'envoyee' | 'payee' | 'annulee';
  // Lien réservation
  reservation_id?: number;
  // Legacy / compatibilité
  montant_ht_euros?: string;
  montant_ttc_euros?: string;
  montant_tva_euros?: string;
}

export interface Expense {
  id: number;
  categorie: string;
  libelle: string;
  description?: string;
  // Montants en centimes
  montant: number;
  montant_ttc: number;
  montant_tva?: number;
  taux_tva?: number;
  deductible_tva?: boolean;
  // Date
  date_depense: string;
  recurrence?: 'ponctuelle' | 'mensuelle' | 'trimestrielle' | 'annuelle';
  justificatif_url?: string;
  // Statut paiement
  payee: boolean;
  date_paiement?: string;
  // Legacy / compatibilité
  montant_euros?: string;
  montant_ttc_euros?: string;
  montant_tva_euros?: string;
}

export interface CreateExpenseData {
  categorie: string;
  libelle?: string;
  description: string;
  montant: number;
  date: string;
  payee?: boolean;
  a_credit?: boolean;
  mode_paiement?: string;
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

export interface TVAData {
  success: boolean;
  mois: string;
  tva: {
    collectee: {
      base_ht: number;
      base_ht_euros: string;
      tva: number;
      tva_euros: string;
      nb_operations: number;
      detail_par_taux: Array<{
        taux: number;
        base_ht_euros: string;
        tva_euros: string;
        nb_operations?: number;
      }>;
    };
    deductible: {
      base_ht: number;
      base_ht_euros: string;
      tva: number;
      tva_euros: string;
      nb_operations: number;
      detail_par_taux: Array<{
        taux: number;
        base_ht_euros: string;
        tva_euros: string;
      }>;
    };
    solde: {
      montant: number;
      montant_euros: string;
      a_payer: boolean;
      credit: boolean;
    };
  };
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

// ══════════════════════════════════════════════════════════════════════════════
// TYPES COMPTABILITÉ AVANCÉS
// ══════════════════════════════════════════════════════════════════════════════

export interface CompteComptable {
  numero: string;
  libelle: string;
  classe: number;
  type: 'general' | 'auxiliaire';
  nature?: 'debit' | 'credit';
}

export interface EcritureGrandLivre {
  id: number;
  date_ecriture: string;
  journal_code: string;
  numero_piece?: string;
  libelle: string;
  debit: number;
  credit: number;
  lettrage?: string;
  solde_progressif?: number;
}

export interface GrandLivreCompte {
  numero: string;
  libelle: string;
  ecritures: EcritureGrandLivre[];
  total_debit: number;
  total_credit: number;
  solde: number;
}

export interface GrandLivreResponse {
  exercice: number;
  periode_debut?: string;
  periode_fin?: string;
  comptes: GrandLivreCompte[];
  totaux: {
    debit: number;
    credit: number;
  };
}

export interface CompteDetailResponse {
  compte: string;
  libelle: string;
  exercice: number;
  ecritures: EcritureGrandLivre[];
  totaux: {
    debit: number;
    credit: number;
    solde: number;
  };
  solde_ouverture?: number;
  solde_cloture?: number;
}

export interface BalanceGeneraleLigne {
  numero: string;
  libelle: string;
  mouvement_debit: number;
  mouvement_credit: number;
  solde_debiteur: number;
  solde_crediteur: number;
  sous_comptes?: BalanceGeneraleLigne[];
}

export interface BalanceGeneraleResponse {
  exercice: number;
  periode?: string;
  avec_sous_comptes: boolean;
  comptes: BalanceGeneraleLigne[];
  totaux: {
    mouvement_debit: number;
    mouvement_credit: number;
    solde_debiteur: number;
    solde_crediteur: number;
  };
}

export interface BalanceAuxiliaireLigne {
  compte: string;
  nom: string;
  mouvement_debit: number;
  mouvement_credit: number;
  solde: number;
  dernier_mouvement?: string;
}

export interface BalanceAuxiliaireResponse {
  type: 'clients' | 'fournisseurs';
  compte_collectif: string;
  exercice: number;
  comptes: BalanceAuxiliaireLigne[];
  totaux: {
    mouvement_debit: number;
    mouvement_credit: number;
    solde: number;
    nb_comptes: number;
  };
}

export interface BilanLigne {
  numero?: string;
  libelle: string;
  montant: number;
  niveau?: number;
  type?: 'titre' | 'compte' | 'total';
}

export interface BilanResponse {
  exercice: number;
  date_cloture: string;
  actif: {
    immobilisations: BilanLigne[];
    actif_circulant: BilanLigne[];
    tresorerie: BilanLigne[];
    total: number;
  };
  passif: {
    capitaux_propres: BilanLigne[];
    dettes: BilanLigne[];
    total: number;
  };
  equilibre: boolean;
}

export interface CompteResultatLigne {
  numero?: string;
  libelle: string;
  montant: number;
  niveau?: number;
  type?: 'titre' | 'compte' | 'total';
}

export interface CompteResultatResponse {
  exercice: number;
  periode?: string;
  charges: {
    exploitation: CompteResultatLigne[];
    financieres: CompteResultatLigne[];
    exceptionnelles: CompteResultatLigne[];
    total: number;
  };
  produits: {
    exploitation: CompteResultatLigne[];
    financiers: CompteResultatLigne[];
    exceptionnels: CompteResultatLigne[];
    total: number;
  };
  resultat: {
    exploitation: number;
    financier: number;
    exceptionnel: number;
    net: number;
    benefice: boolean;
  };
}

export interface BalanceAgeeLigne {
  client_id: number;
  client_nom: string;
  compte: string;
  total_du: number;
  non_echu: number;
  echu_0_30: number;
  echu_31_60: number;
  echu_61_90: number;
  echu_plus_90: number;
  plus_ancienne_facture?: string;
}

export interface BalanceAgeeResponse {
  date_reference: string;
  clients: BalanceAgeeLigne[];
  totaux: {
    total_du: number;
    non_echu: number;
    echu_0_30: number;
    echu_31_60: number;
    echu_61_90: number;
    echu_plus_90: number;
    nb_clients: number;
  };
}
