/**
 * Marketing API Client — Campagnes, Templates, Analytics
 */
import { api } from './api';

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

export interface CampagneVariante {
  nom: string;
  poids: number;
  envois?: number;
  ouvertures?: number;
  clics?: number;
  conversions?: number;
  taux_ouverture?: number;
  taux_clic?: number;
  taux_conversion?: number;
}

export interface Campagne {
  id: number;
  tenant_id: string;
  nom: string;
  description?: string;
  type: string;
  statut: 'brouillon' | 'en_cours' | 'termine' | 'archive';
  ab_testing_actif: boolean;
  variantes: CampagneVariante[];
  date_debut?: string;
  date_fin?: string;
  total_envois?: number;
  total_ouvertures?: number;
  total_clics?: number;
  total_conversions?: number;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: number;
  tenant_id: string;
  nom: string;
  sujet: string;
  corps: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsOverviewStats {
  envois: number;
  ouvertures: number;
  clics: number;
  conversions: number;
  taux_ouverture: number;
  taux_clic: number;
  taux_conversion: number;
}

export interface AnalyticsOverview {
  success: boolean;
  periode: number;
  stats: AnalyticsOverviewStats;
  campagnes: {
    total: number;
    en_cours: number;
    terminees: number;
  };
  top_campagnes: Campagne[];
}

export interface AnalyticsEvolutionPoint {
  date: string;
  envois: number;
  ouvertures: number;
  clics: number;
  conversions: number;
}

// ══════════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════════

export const marketingApi = {
  // Campagnes
  getCampagnes: () =>
    api.get<{ success: boolean; campagnes: Campagne[] }>('/marketing/campagnes'),

  getCampagne: (id: number) =>
    api.get<{ success: boolean; campagne: Campagne; analytics: CampagneVariante[] }>(`/marketing/campagnes/${id}`),

  createCampagne: (data: { nom: string; description?: string; type: string; ab_testing_actif?: boolean; variantes: Pick<CampagneVariante, 'nom' | 'poids'>[] }) =>
    api.post<{ success: boolean; campagne: Campagne }>('/marketing/campagnes', data),

  deleteCampagne: (id: number) =>
    api.delete<{ success: boolean }>(`/marketing/campagnes/${id}`),

  startCampagne: (id: number) =>
    api.post<{ success: boolean; campagne: Campagne }>(`/marketing/campagnes/${id}/start`),

  stopCampagne: (id: number) =>
    api.post<{ success: boolean; campagne: Campagne }>(`/marketing/campagnes/${id}/stop`),

  declareWinner: (id: number, variante_nom: string) =>
    api.post<{ success: boolean; campagne: Campagne }>(`/marketing/campagnes/${id}/declare-winner`, { variante_nom }),

  // Email Templates
  getTemplates: () =>
    api.get<{ success: boolean; templates: EmailTemplate[] }>('/marketing/email-templates'),

  createTemplate: (data: { nom: string; sujet: string; corps: string }) =>
    api.post<{ success: boolean; template: EmailTemplate }>('/marketing/email-templates', data),

  deleteTemplate: (id: number) =>
    api.delete<{ success: boolean }>(`/marketing/email-templates/${id}`),

  // Analytics
  getAnalyticsOverview: (periode = 30) =>
    api.get<AnalyticsOverview>(`/marketing/analytics/overview?periode=${periode}`),

  getAnalyticsEvolution: (periode = 30) =>
    api.get<{ success: boolean; evolution: AnalyticsEvolutionPoint[] }>(`/marketing/analytics/evolution?periode=${periode}`),
};
