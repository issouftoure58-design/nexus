/**
 * Types partages pour les composants Devis
 * Source de verite: @/lib/api pour Devis, DevisCreateData, DevisStats
 */

// Types pour les templates de devis
export interface DevisTemplateLigne {
  description: string;
  quantite: number;
  prix_unitaire: number;
}

export interface DevisTemplate {
  id: string;
  metier: string;
  nom: string;
  description: string;
  lignes: DevisTemplateLigne[];
  conditions: string;
}

// Types pour les donnees
export interface Client {
  id: number;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  type_client?: string;
  raison_sociale?: string;
}

export interface Service {
  id: number;
  nom: string;
  prix: number;
  duree: number;
  taux_horaire?: number; // centimes/heure
  taxe_cnaps?: boolean;
  taux_cnaps?: number;
}

export type StatutDevis = 'brouillon' | 'envoye' | 'accepte' | 'rejete' | 'expire' | 'annule' | 'execute';

export const STATUT_LABELS: Record<StatutDevis, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: 'text-gray-600', bg: 'bg-gray-100' },
  envoye: { label: 'Envoye', color: 'text-blue-600', bg: 'bg-blue-100' },
  accepte: { label: 'Accepte', color: 'text-green-600', bg: 'bg-green-100' },
  execute: { label: 'Execute', color: 'text-purple-600', bg: 'bg-purple-100' },
  rejete: { label: 'Rejete', color: 'text-red-600', bg: 'bg-red-100' },
  expire: { label: 'Expire', color: 'text-orange-600', bg: 'bg-orange-100' },
  annule: { label: 'Annule', color: 'text-gray-500', bg: 'bg-gray-200' },
};

// Affectation individuelle pour chaque unite de service
export interface ServiceAffectation {
  index: number;
  membre_id?: number;
  membre_nom?: string;
  heure_debut?: string;
  heure_fin?: string;
}

export interface ServiceLigne {
  service_id: number;
  service_nom: string;
  quantite: number;
  prix_unitaire: number;
  duree_minutes: number;
  // Mode horaire
  taux_horaire?: number; // centimes/heure
  // Affectations multiples (une par quantite)
  affectations: ServiceAffectation[];
  // Legacy - pour compatibilite
  heure_debut?: string;
  heure_fin?: string;
  // Plage de dates par ligne (security / multi-day)
  date_debut?: string;
  date_fin?: string;
}

// Interface ressource pour les affectations (modele generique)
export interface Ressource {
  id: number;
  nom: string;
  categorie?: string;
  type?: { nom: string; categorie: string };
  membre?: { nom: string; prenom: string };
}

export interface DevisLigneDetail {
  id: number;
  service_id: number;
  service_nom: string;
  quantite: number;
  duree_minutes: number;
  prix_unitaire: number;
  prix_total: number;
  // Dates par ligne (pipeline)
  date_debut?: string;
  date_fin?: string;
  // Affectation (mode horaire)
  membre_id?: number;
  heure_debut?: string;
  heure_fin?: string;
  taux_horaire?: number;
}

// Type pour les affectations enrichies avec heures
export interface AffectationExec {
  membre_id: number;
  heure_debut: string;
  heure_fin: string;
}

// Helper functions partagees entre composants
export const formatMontant = (centimes: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(centimes / 100);
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('fr-FR');
};

export const formatDateLong = (date: string): string => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

export const METIER_LABELS: Record<string, string> = {
  coiffure: 'Coiffure',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  services: 'Services'
};

// ─── Forfaits (contrats recurrents Security) ───

export type StatutForfait = 'brouillon' | 'envoye' | 'accepte' | 'actif' | 'annule';
export type StatutPeriode = 'planifie' | 'en_cours' | 'cloture';

export const STATUT_FORFAIT_LABELS: Record<StatutForfait, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: 'text-gray-600', bg: 'bg-gray-100' },
  envoye: { label: 'Envoye', color: 'text-blue-600', bg: 'bg-blue-100' },
  accepte: { label: 'Accepte', color: 'text-cyan-600', bg: 'bg-cyan-100' },
  actif: { label: 'Actif', color: 'text-green-600', bg: 'bg-green-100' },
  annule: { label: 'Annule', color: 'text-red-600', bg: 'bg-red-100' },
};

export const STATUT_PERIODE_LABELS: Record<StatutPeriode, { label: string; color: string; bg: string }> = {
  planifie: { label: 'Planifie', color: 'text-gray-600', bg: 'bg-gray-100' },
  en_cours: { label: 'En cours', color: 'text-blue-600', bg: 'bg-blue-100' },
  cloture: { label: 'Cloture', color: 'text-green-600', bg: 'bg-green-100' },
};

export interface ForfaitPoste {
  id?: number;
  forfait_id?: number;
  service_id?: number;
  service_nom: string;
  effectif: number;
  jours: boolean[];
  heure_debut: string;
  heure_fin: string;
  taux_horaire: number; // centimes/heure
  cout_mensuel_ht?: number; // centimes
}

export interface ForfaitAffectation {
  id?: number;
  forfait_id?: number;
  periode_id?: number;
  poste_id: number;
  membre_id?: number;
  membre_nom?: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
}

export interface ForfaitPeriode {
  id: number;
  forfait_id: number;
  mois: string;
  date_debut: string;
  date_fin: string;
  statut: StatutPeriode;
  reservation_id?: number;
  facture_id?: number;
  montant_prevu: number;
  montant_reel?: number;
  notes?: string;
  affectations?: ForfaitAffectation[];
}

export interface Forfait {
  id: number;
  numero: string;
  client_id?: number;
  client_nom?: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  montant_mensuel_ht: number; // centimes
  taux_tva: number;
  statut: StatutForfait;
  notes?: string;
  devis_id?: number;
  created_at?: string;
  postes?: ForfaitPoste[];
  periodes?: ForfaitPeriode[];
  stats?: {
    total_periodes: number;
    periodes_cloturees: number;
    periodes_planifiees: number;
  };
}

export interface ForfaitCreateData {
  nom: string;
  client_id?: number;
  client_nom?: string;
  date_debut: string;
  date_fin: string;
  montant_mensuel_ht: number;
  taux_tva?: number;
  notes?: string;
  numero_commande?: string;
  devis_id?: number;
  postes: Omit<ForfaitPoste, 'id' | 'forfait_id'>[];
}
