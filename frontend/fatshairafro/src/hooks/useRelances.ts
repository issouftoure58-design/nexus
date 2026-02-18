/**
 * Hook pour gérer les relances factures
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || '';

interface Facture {
  id: number;
  numero: string;
  client_nom: string;
  client_email: string;
  client_telephone: string;
  service_nom: string;
  montant_ttc: number;
  date_facture: string;
  date_echeance: string;
  statut: string;
  niveau_relance: number;
  date_derniere_relance: string | null;
  prochain_niveau_relance: number;
  jours_retard: number;
}

interface StatsRelances {
  niveau1: number;
  niveau2: number;
  niveau3: number;
  niveau4: number;
  total: number;
}

interface RelanceHistorique {
  id: number;
  niveau: number;
  type: string;
  email_envoye: boolean;
  sms_envoye: boolean;
  date_envoi: string;
}

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Hook pour récupérer les factures à relancer
 */
export function useFacturesARelancer() {
  return useQuery<Facture[]>({
    queryKey: ['relances', 'factures'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/relances`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Erreur récupération factures');
      const data = await res.json();
      return data.factures || [];
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook pour les stats de relances (badges)
 */
export function useStatsRelances() {
  return useQuery<StatsRelances>({
    queryKey: ['relances', 'stats'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/relances/stats`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Erreur récupération stats');
      const data = await res.json();
      return data.stats || { niveau1: 0, niveau2: 0, niveau3: 0, niveau4: 0, total: 0 };
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Hook pour l'historique des relances d'une facture
 */
export function useHistoriqueRelances(factureId: number | null) {
  return useQuery<RelanceHistorique[]>({
    queryKey: ['relances', 'historique', factureId],
    queryFn: async () => {
      if (!factureId) return [];
      const res = await fetch(`${API_URL}/api/relances/historique/${factureId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Erreur récupération historique');
      const data = await res.json();
      return data.historique || [];
    },
    enabled: !!factureId,
  });
}

/**
 * Hook pour envoyer une relance manuellement
 */
export function useEnvoyerRelance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ factureId, niveau }: { factureId: number; niveau: number }) => {
      const res = await fetch(`${API_URL}/api/relances/${factureId}/envoyer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ niveau }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur envoi relance');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relances'] });
    },
  });
}

/**
 * Hook pour marquer une facture comme payée
 */
export function useMarquerPayee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (factureId: number) => {
      const res = await fetch(`${API_URL}/api/relances/${factureId}/marquer-payee`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur marquage payée');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relances'] });
      queryClient.invalidateQueries({ queryKey: ['factures'] });
    },
  });
}

/**
 * Badge de niveau de relance
 */
export function getNiveauBadge(niveau: number) {
  const configs = {
    0: { label: 'Aucune', color: 'bg-gray-100 text-gray-600' },
    1: { label: 'J-15', color: 'bg-blue-100 text-blue-700' },
    2: { label: 'J+1', color: 'bg-orange-100 text-orange-700' },
    3: { label: 'J+7', color: 'bg-red-100 text-red-700' },
    4: { label: 'J+15', color: 'bg-purple-100 text-purple-700' },
  };
  return configs[niveau as keyof typeof configs] || configs[0];
}

/**
 * Type de relance
 */
export function getTypeRelance(niveau: number) {
  const types = {
    1: 'Préventif',
    2: 'Première relance',
    3: 'Urgence',
    4: 'Mise en demeure',
  };
  return types[niveau as keyof typeof types] || 'Inconnu';
}

export default {
  useFacturesARelancer,
  useStatsRelances,
  useHistoriqueRelances,
  useEnvoyerRelance,
  useMarquerPayee,
  getNiveauBadge,
  getTypeRelance,
};
