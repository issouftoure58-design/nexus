/**
 * Domain Models — Single source of truth for NEXUS types
 *
 * All domain interfaces live here. Components import from '@/types/models'
 * instead of defining local duplicates.
 */

// ════════════════════════════════════════════════════════════════════
// BUSINESS TYPES
// ════════════════════════════════════════════════════════════════════

export type BusinessType = 'service_domicile' | 'salon' | 'restaurant' | 'hotel' | 'commerce' | 'security';

export type PlanType = 'starter' | 'pro' | 'business';

// ════════════════════════════════════════════════════════════════════
// TENANT
// ════════════════════════════════════════════════════════════════════

export interface TenantModules {
  reservations?: boolean;
  clients?: boolean;
  services?: boolean;
  facturation?: boolean;
  crm_avance?: boolean;
  analytics?: boolean;
  comptabilite?: boolean;
  marketing?: boolean;
  commercial?: boolean;
  stock?: boolean;
  seo?: boolean;
  rh?: boolean;
  sentinel?: boolean;
  churn_prevention?: boolean;
  salon?: boolean;
  restaurant?: boolean;
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
  statut: 'actif' | 'essai' | 'expire' | 'suspendu' | 'annule';
  essai_fin?: string;
  onboarding_completed?: boolean;
  template_id?: string;
  business_profile?: string;
  onboarding_step?: number;
  profession_id?: string;
}

// ════════════════════════════════════════════════════════════════════
// CLIENT
// ════════════════════════════════════════════════════════════════════

export interface Client {
  id: number;
  prenom: string;
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  code_postal?: string | null;
  ville?: string | null;
  complement_adresse?: string | null;
  type_client?: 'particulier' | 'professionnel' | null;
  raison_sociale?: string | null;
  siret?: string | null;
  created_at: string;
  nb_rdv?: number;
  dernier_rdv?: { date: string; statut: string } | null;
  tags?: string[] | null;
}

export interface ClientDetail {
  client: Client & { derniere_visite: string | null; loyalty_points?: number };
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

export interface CreateClientData {
  prenom: string;
  nom: string;
  telephone: string;
  email?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  complement_adresse?: string;
  type_client?: 'particulier' | 'professionnel';
  raison_sociale?: string;
  siret?: string;
  tags?: string[];
}

// ════════════════════════════════════════════════════════════════════
// SERVICE
// ════════════════════════════════════════════════════════════════════

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
  // Multi-business pricing
  taux_horaire?: number;
  taux_journalier?: number;
  prix_forfait?: number;
  pricing_mode?: 'fixed' | 'hourly' | 'daily' | 'package';
  // Computed by backend
  prix_ht_base?: number;
  prix_ht?: number;
  prix_tva?: number;
  montant_cnaps?: number;
  // Restaurant/Hotel
  capacite?: number;
  zone?: string;
  capacite_max?: number;
  vue?: string;
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

// ════════════════════════════════════════════════════════════════════
// RESERVATION
// ════════════════════════════════════════════════════════════════════

export type ReservationStatut = 'demande' | 'confirme' | 'en_attente' | 'en_attente_paiement' | 'termine' | 'annule';

export interface Reservation {
  id: number;
  client_id: number;
  service_nom: string;
  date?: string;
  date_rdv?: string;
  heure?: string;
  heure_rdv?: string;
  duree?: number;
  duree_minutes?: number;
  duree_totale?: number;
  prix_total: number;
  statut: ReservationStatut | string;
  notes: string | null;
  clients?: { nom: string; prenom: string; telephone: string };
  client?: Client | null;
  service?: string | { nom?: string; name?: string; duree_minutes?: number; duree?: number } | null;
  service_id?: number;
  lieu?: string;
  adresse_client?: string;
  frais_deplacement?: number;
  distance_km?: number;
  duree_trajet_minutes?: number;
  created_at?: string;
  created_via?: string;
  membre?: TeamMember | null;
  membre_id?: number;
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

export interface CreateReservationData {
  client_id: number;
  service_id: number;
  date: string;
  heure: string;
  notes?: string;
  membre_id?: number;
}

// ════════════════════════════════════════════════════════════════════
// FACTURE (INVOICE)
// ════════════════════════════════════════════════════════════════════

export type InvoiceStatut = 'brouillon' | 'generee' | 'envoyee' | 'payee' | 'annulee';

export interface Invoice {
  id: number;
  numero: string;
  client_id: number;
  montant_ht: number;
  montant_ttc: number;
  montant_tva: number;
  taux_tva: number;
  client_nom: string;
  client_email?: string;
  client_telephone?: string;
  service_id?: number;
  service_nom: string;
  service_description?: string;
  date_facture: string;
  date_prestation: string;
  date_envoi?: string;
  date_paiement?: string;
  statut: InvoiceStatut;
  reservation_id?: number;
  type?: 'facture' | 'avoir';
  facture_origine_id?: number;
  avoir_emis?: boolean;
  motif_avoir?: string;
  montant_ht_euros?: string;
  montant_ttc_euros?: string;
  montant_tva_euros?: string;
}

// Alias francais
export type Facture = Invoice;

// ════════════════════════════════════════════════════════════════════
// DEVIS (QUOTE)
// ════════════════════════════════════════════════════════════════════

export type DevisStatut = 'brouillon' | 'envoye' | 'accepte' | 'rejete' | 'expire' | 'annule' | 'execute';

export interface Devis {
  id: string;
  numero: string;
  client_id?: number;
  client_nom?: string;
  client_email?: string;
  client_telephone?: string;
  client_adresse?: string;
  adresse_facturation?: string;
  service_id?: string;
  service_nom?: string;
  service_description?: string;
  duree_minutes?: number;
  lieu?: string;
  montant_ht: number;
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  frais_deplacement?: number;
  statut: DevisStatut;
  date_devis: string;
  validite_jours: number;
  date_expiration?: string;
  date_envoi?: string;
  date_acceptation?: string;
  date_rejet?: string;
  date_execution?: string;
  date_prestation?: string;
  date_fin_prestation?: string;
  heure_prestation?: string;
  pricing_mode?: 'fixed' | 'hourly' | 'daily' | 'package';
  nb_jours?: number;
  nb_agents?: number;
  membre_ids?: number[];
  opportunite_id?: number;
  reservation_id?: string;
  notes?: string;
  raison_rejet?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  clients?: { id: number; nom: string; prenom?: string; email?: string; telephone?: string };
  opportunites?: { id: number; nom: string; etape: string };
  reservations?: { id: string; date: string; heure: string; statut: string };
}

export interface DevisStats {
  total: number;
  brouillon: number;
  envoye: number;
  accepte: number;
  rejete: number;
  montant_total: number;
}

// ════════════════════════════════════════════════════════════════════
// TEAM MEMBER
// ════════════════════════════════════════════════════════════════════

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

export interface AdminTeamMember {
  id: string;
  email: string;
  nom: string;
  role: string;
  custom_permissions: Record<string, string[]> | null;
  actif: boolean;
  created_at: string;
}

// ════════════════════════════════════════════════════════════════════
// PRODUCT (STOCK)
// ════════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════

export interface DashboardStats {
  clients_total?: number;
  rdv_mois?: number;
  ca_mois?: number;
  ca_jour?: number;
  [key: string]: number | undefined;
}

// ════════════════════════════════════════════════════════════════════
// EXPENSE
// ════════════════════════════════════════════════════════════════════

export interface Expense {
  id: number;
  categorie: string;
  libelle: string;
  description?: string;
  montant: number;
  montant_ttc: number;
  montant_tva?: number;
  taux_tva?: number;
  deductible_tva?: boolean;
  date_depense: string;
  recurrence?: 'ponctuelle' | 'mensuelle' | 'trimestrielle' | 'annuelle';
  justificatif_url?: string;
  payee: boolean;
  date_paiement?: string;
  montant_euros?: string;
  montant_ttc_euros?: string;
  montant_tva_euros?: string;
}
