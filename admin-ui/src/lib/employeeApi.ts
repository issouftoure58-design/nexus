/**
 * NEXUS AI — Employee Portal API Client
 * Pattern identique a api.ts mais pour le portail employe.
 * Token stocke sous nexus_employee_token.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const IS_DEV = import.meta.env.DEV;

const TOKEN_KEY = 'nexus_employee_token';

function extractFromJWT(token: string): { tenant_id?: string; tenant_slug?: string; membre_id?: number } {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      tenant_id: payload.tenant_id?.toString(),
      tenant_slug: payload.tenant_slug,
      membre_id: payload.membre_id,
    };
  } catch {
    return {};
  }
}

class EmployeeApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      const { tenant_id, tenant_slug } = extractFromJWT(this.token);
      if (tenant_id) headers['X-Tenant-ID'] = tenant_id;
      if (tenant_slug) headers['X-Tenant-Slug'] = tenant_slug;
    }

    if (IS_DEV) {
      console.log(`[EMP-API] ${options.method || 'GET'} ${endpoint}`);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      console.warn('[EMP-API] 401 — clearing employee auth');
      this.clearToken();
      window.location.href = '/employee/login';
      throw new Error('Session expiree');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur reseau' }));
      const errorMsg = typeof error.error === 'string'
        ? error.error
        : error.error?.message || error.message || 'Erreur serveur';
      throw new Error(errorMsg);
    }

    return response.json();
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const employeeApiClient = new EmployeeApiClient();

// ─── Auth API ────────────────────────────────────────────────────────────────

export const employeeAuthApi = {
  login: (email: string, password: string) =>
    employeeApiClient.post<{
      token: string;
      employee: EmployeeUser;
    }>('/employee/auth/login', { email, password }),

  logout: () => employeeApiClient.post('/employee/auth/logout'),

  me: () => employeeApiClient.get<EmployeeUser>('/employee/auth/me'),

  setupPassword: (token: string, password: string) =>
    employeeApiClient.post<{
      success: boolean;
      token: string;
      employee: EmployeeUser;
    }>('/employee/auth/setup-password', { token, password }),

  changePassword: (currentPassword: string, newPassword: string) =>
    employeeApiClient.post<{ success: boolean }>('/employee/auth/change-password', { currentPassword, newPassword }),
};

// ─── Portal API ──────────────────────────────────────────────────────────────

export const employeePortalApi = {
  getPlanning: (dateDebut: string, dateFin: string) =>
    employeeApiClient.get<PlanningResponse>(`/employee/planning?date_debut=${dateDebut}&date_fin=${dateFin}`),

  getAbsences: () =>
    employeeApiClient.get<AbsencesResponse>('/employee/absences'),

  createAbsence: (data: CreateAbsenceData) =>
    employeeApiClient.post<{ success: boolean; absence: Absence }>('/employee/absences', data),

  getBulletins: (annee?: number) =>
    employeeApiClient.get<{ bulletins: Bulletin[] }>(`/employee/bulletins${annee ? `?annee=${annee}` : ''}`),

  getBulletinPdfUrl: (id: number) =>
    `${API_BASE}/employee/bulletins/${id}/pdf`,

  getProfil: () =>
    employeeApiClient.get<EmployeeProfil>('/employee/profil'),

  updateProfil: (data: UpdateProfilData) =>
    employeeApiClient.put<{ success: boolean }>('/employee/profil', data),
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmployeeUser {
  id: number;
  email: string;
  membre_id: number;
  tenant_id?: string;
  nom: string;
  prenom: string;
  role: string;
  poste: string;
  avatar_url: string | null;
}

export interface PlanningJour {
  rdv: PlanningRdv[];
  absent: boolean;
  type_absence: string | null;
}

export interface PlanningRdv {
  id: number;
  heure: string;
  service_nom: string;
  duree_minutes: number;
  statut: string;
  client_nom: string;
  client_telephone: string | null;
}

export interface PlanningResponse {
  planning: Record<string, PlanningJour>;
  stats: { total_rdv: number; heures_travaillees: number };
  date_debut: string;
  date_fin: string;
}

export interface Absence {
  id: number;
  type: string;
  date_debut: string;
  date_fin: string;
  motif: string | null;
  demi_journee: boolean;
  periode: string | null;
  statut: string;
  created_at: string;
}

export interface AbsenceCompteurs {
  annee: number;
  cp: { acquis: number; pris: number; report: number; solde: number };
  rtt: { acquis: number; pris: number; solde: number };
  rc: { acquis: number; pris: number; solde: number };
}

export interface AbsencesResponse {
  absences: Absence[];
  compteurs: AbsenceCompteurs | null;
}

export interface CreateAbsenceData {
  type: string;
  date_debut: string;
  date_fin?: string;
  motif?: string;
  demi_journee?: boolean;
  periode?: string;
}

export interface Bulletin {
  id: number;
  periode: string;
  salaire_brut: number;
  salaire_net: number;
  net_a_payer: number;
  statut: string;
  created_at: string;
}

export interface EmployeeProfil {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  sexe: string;
  date_naissance: string;
  nationalite: string;
  adresse_rue: string;
  adresse_cp: string;
  adresse_ville: string;
  adresse_pays: string;
  role: string;
  poste: string;
  type_contrat: string;
  date_embauche: string;
  date_fin_contrat: string;
  temps_travail: string;
  heures_hebdo: number;
  jours_travailles: string;
  avatar_url: string | null;
  contact_urgence_nom: string;
  contact_urgence_tel: string;
  contact_urgence_lien: string;
  mutuelle_obligatoire: boolean;
  mutuelle_dispense: boolean;
}

export interface UpdateProfilData {
  telephone?: string;
  adresse_rue?: string;
  adresse_cp?: string;
  adresse_ville?: string;
  adresse_pays?: string;
}

export function getEmployeeToken(): string | null {
  return employeeApiClient.getToken();
}
