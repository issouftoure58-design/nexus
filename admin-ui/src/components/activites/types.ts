/**
 * Types et constantes partagés pour les composants Activités
 */

// === Entités ===

export interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  type_client?: string;
  raison_sociale?: string | null;
}

export interface Service {
  id: number;
  nom: string;
  prix: number;
  duree_minutes: number;
  actif?: boolean;
  taux_horaire?: number;
  taux_journalier?: number;
  prix_forfait?: number;
  pricing_mode?: 'fixed' | 'hourly' | 'daily' | 'package';
  capacite?: number;
  zone?: string;
  capacite_max?: number;
  vue?: string;
}

export interface Membre {
  id: number;
  nom: string;
  prenom: string;
  role: string;
}

// === API Response Types ===

export interface ReservationsResponse {
  reservations?: Reservation[];
  pagination?: { total: number; pages: number; page: number };
}

export interface ServicesResponse {
  services?: Service[];
}

export interface MembresResponse {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  statut: string;
}

export interface MembresDisponiblesResponse {
  disponibles: Membre[];
  occupes: Membre[];
  non_travail?: Membre[];
}

export interface ClientsResponse {
  clients?: Client[];
}

export interface ClientCreateResponse {
  client?: { id: number };
  id?: number;
}

export interface ReservationDetailResponse {
  reservation?: Reservation;
}

// === Multi-services ===

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
  affectations: ServiceAffectation[];
  membre_id?: number;
  membre_nom?: string;
  heure_debut?: string;
  heure_fin?: string;
  pricing_mode?: 'fixed' | 'hourly' | 'daily' | 'package';
  taux_horaire?: number;
}

export interface ReservationService {
  id: number;
  service_id?: number;
  service_nom: string;
  quantite: number;
  duree_minutes: number;
  prix_unitaire: number;
  prix_total: number;
  membre?: Membre | null;
  heure_debut?: string;
  heure_fin?: string;
}

export interface EditLigne {
  id: number;
  service_nom: string;
  quantite: number;
  membre_id?: number | null;
  membre?: { id: number; nom: string; prenom: string } | null;
  heure_debut: string;
  heure_fin: string;
  duree_minutes?: number;
}

export interface ReservationMembre {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  assignment_role: string;
}

export interface Reservation {
  id: number;
  date?: string;
  date_rdv?: string;
  heure?: string;
  heure_rdv?: string;
  duree?: number;
  duree_minutes?: number;
  duree_totale?: number;
  service?: string | { nom?: string; name?: string; duree_minutes?: number; duree?: number } | null;
  service_nom?: string;
  client?: Client | null;
  clients?: Client | null;
  statut: string;
  prix?: number;
  prix_total?: number;
  montant?: number;
  lieu?: string;
  adresse_client?: string;
  notes?: string;
  frais_deplacement?: number;
  distance_km?: number;
  duree_trajet_minutes?: number;
  created_at?: string;
  created_via?: string;
  membre?: Membre | null;
  membre_id?: number;
  service_id?: number;
  services?: ReservationService[];
  membres?: ReservationMembre[];
  // Restaurant
  table_id?: number;
  nb_couverts?: number;
  service_type?: string;
  allergies?: string;
  // Hotel
  chambre_id?: number;
  nb_personnes?: number;
  date_arrivee?: string;
  date_depart?: string;
  heure_arrivee?: string;
}

// === Formulaires ===

export interface Filters {
  periode: string;
  statut: string;
  service: string;
  date_debut: string;
  date_fin: string;
}

export interface NewRdvForm {
  client_id: number;
  service: string;
  date_rdv: string;
  heure_rdv: string;
  heure_fin: string;
  date_fin: string;
  nb_agents: number;
  lieu: string;
  adresse_prestation: string;
  adresse_facturation: string;
  adresse_facturation_identique: boolean;
  frais_deplacement: number;
  notes: string;
  membre_id: number;
  remise_type: string;
  remise_valeur: number;
  remise_motif: string;
  table_id: number;
  nb_couverts: number;
  chambre_id: number;
  nb_personnes: number;
  date_checkout: string;
  heure_checkin: string;
  heure_checkout: string;
  extras: string[];
}

export interface EditForm {
  service_nom: string;
  date: string;
  heure: string;
  statut: string;
  notes: string;
  membre_id: number;
  // Restaurant
  table_id?: number;
  nb_couverts?: number;
  // Hotel
  chambre_id?: number;
  nb_personnes?: number;
  date_checkout?: string;
  heure_checkout?: string;
}

export interface NewClientForm {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
}

export interface Stats {
  aujourd_hui: number;
  semaine: number;
  en_attente: number;
}

export interface Totals {
  sousTotalServices: number;
  dureeTotale: number;
  fraisDeplacement: number;
  remise: number;
  montantHT: number;
  tva: number;
  totalTTC: number;
  pricingMode: string;
  heuresParJour: number;
  nbJours: number;
  nbAgents: number;
}

// === Constantes ===

export const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  demande: { label: 'Demande', color: 'text-gray-700 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  en_attente: { label: 'En attente', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  confirme: { label: 'Confirmé', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  termine: { label: 'Terminé', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  annule: { label: 'Annulé', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  no_show: { label: 'Absent', color: 'text-gray-500 dark:text-gray-500', bgColor: 'bg-gray-200 dark:bg-gray-700' },
};

export const MODES_PAIEMENT = [
  { value: 'cb', label: 'Carte bancaire', icon: '\uD83D\uDCB3' },
  { value: 'especes', label: 'Esp\u00e8ces', icon: '\uD83D\uDCB5' },
  { value: 'virement', label: 'Virement', icon: '\uD83C\uDFE6' },
  { value: 'cheque', label: 'Ch\u00e8que', icon: '\uD83D\uDCDD' },
  { value: 'prelevement', label: 'Pr\u00e9l\u00e8vement', icon: '\uD83D\uDD04' },
];

// === Helpers ===

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};

export const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  if (!startTime) return '';
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
};

export const calculateHours = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 0;
  const cleanStart = startTime.replace('--', '00');
  const cleanEnd = endTime.replace('--', '00');
  const [startH, startM] = cleanStart.split(':').map(Number);
  const [endH, endM] = cleanEnd.split(':').map(Number);
  if (isNaN(startH) || isNaN(endH)) return 0;
  const startMinutes = startH * 60 + (startM || 0);
  let endMinutes = endH * 60 + (endM || 0);
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  return Math.round((endMinutes - startMinutes) / 60 * 100) / 100;
};

export const calculateDays = (startDate: string, endDate: string): number => {
  if (!startDate) return 1;
  if (!endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
};

export const DEFAULT_NEW_RDV_FORM: NewRdvForm = {
  client_id: 0,
  service: '',
  date_rdv: '',
  heure_rdv: '',
  heure_fin: '',
  date_fin: '',
  nb_agents: 1,
  lieu: 'salon',
  adresse_prestation: '',
  adresse_facturation: '',
  adresse_facturation_identique: true,
  frais_deplacement: 0,
  notes: '',
  membre_id: 0,
  remise_type: '',
  remise_valeur: 0,
  remise_motif: '',
  table_id: 0,
  nb_couverts: 2,
  chambre_id: 0,
  nb_personnes: 2,
  date_checkout: '',
  heure_checkin: '14:00',
  heure_checkout: '11:00',
  extras: [],
};

export const DEFAULT_NEW_CLIENT_FORM: NewClientForm = {
  prenom: '',
  nom: '',
  telephone: '',
  email: '',
};

export const DEFAULT_FILTERS: Filters = {
  periode: 'a_venir',
  statut: 'tous',
  service: '',
  date_debut: '',
  date_fin: '',
};
