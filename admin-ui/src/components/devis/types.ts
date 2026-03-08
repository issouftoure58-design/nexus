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
