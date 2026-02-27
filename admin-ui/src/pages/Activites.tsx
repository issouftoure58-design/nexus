/**
 * Activités - Page complète des activités business NEXUS
 * CRUD complet avec filtres, modals, export CSV
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar, Plus, ChevronLeft, ChevronRight, Clock, User, Phone,
  Filter, MoreHorizontal, RefreshCw, X, Eye, Edit, Trash2,
  Download, RotateCcw, Mail, MapPin, Building, Home, PlusCircle, MinusCircle
} from 'lucide-react';
import { ServiceLayout } from '../components/layout/ServiceLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EntityLink } from '../components/EntityLink';
import { useProfile } from '../contexts/ProfileContext';
import { FeatureField, BusinessTypeField, PricingFields } from '../components/forms';

// Tabs de navigation
const tabs = [
  { label: 'Prestations', path: '/activites' },
  { label: 'Historique', path: '/activites/historique' },
  { label: 'Paramètres', path: '/activites/parametres' },
];

interface Client {
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

interface Service {
  id: number;
  nom: string;
  prix: number;
  duree_minutes: number;
  actif?: boolean;
  // Pricing modes alternatifs
  taux_horaire?: number; // centimes/heure
  taux_journalier?: number; // centimes/jour
  prix_forfait?: number; // centimes
  pricing_mode?: 'fixed' | 'hourly' | 'daily' | 'package';
}

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  role: string;
}

// Ligne de service pour multi-services avec assignation salarié
// Affectation individuelle pour chaque unité de service
interface ServiceAffectation {
  index: number;
  membre_id?: number;
  membre_nom?: string;
  heure_debut?: string;
  heure_fin?: string;
}

interface ServiceLigne {
  service_id: number;
  service_nom: string;
  quantite: number;
  prix_unitaire: number; // en centimes
  duree_minutes: number;
  // Affectations multiples (une par quantité)
  affectations: ServiceAffectation[];
  // Legacy - pour compatibilité
  membre_id?: number;
  membre_nom?: string;
  heure_debut?: string;
  heure_fin?: string;
  // Mode de tarification
  pricing_mode?: 'fixed' | 'hourly' | 'daily' | 'package';
  taux_horaire?: number; // centimes/heure (pour mode hourly)
}

interface ReservationService {
  id: number;
  service_id?: number;
  service_nom: string;
  quantite: number;
  duree_minutes: number;
  prix_unitaire: number;
  prix_total: number;
  membre?: Membre | null;
}

// Ligne de réservation pour l'édition des heures effectives
interface EditLigne {
  id: number;
  service_nom: string;
  quantite: number;
  membre_id?: number | null;
  membre?: { id: number; nom: string; prenom: string } | null;
  heure_debut: string;
  heure_fin: string;
  duree_minutes?: number;
}

interface ReservationMembre {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  assignment_role: string;
}

interface Reservation {
  id: number;
  date?: string;
  date_rdv?: string;
  heure?: string;
  heure_rdv?: string;
  duree?: number;
  duree_totale?: number;
  service?: any;
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
  // Multi-services et multi-membres
  services?: ReservationService[];
  membres?: ReservationMembre[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  demande: { label: 'Demande', color: 'text-gray-700 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  en_attente: { label: 'En attente', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  confirme: { label: 'Confirmé', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  termine: { label: 'Terminé', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  annule: { label: 'Annulé', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  no_show: { label: 'Absent', color: 'text-gray-500 dark:text-gray-500', bgColor: 'bg-gray-200 dark:bg-gray-700' },
};

const MODES_PAIEMENT = [
  { value: 'cb', label: 'Carte bancaire', icon: '💳' },
  { value: 'especes', label: 'Espèces', icon: '💵' },
  { value: 'virement', label: 'Virement', icon: '🏦' },
  { value: 'cheque', label: 'Chèque', icon: '📝' },
  { value: 'prelevement', label: 'Prélèvement', icon: '🔄' },
];

export default function Activites() {
  const navigate = useNavigate();
  const location = useLocation();

  // Profile métier (adaptatif selon le tenant)
  const { profile, t, isPricingMode, isFieldVisible, hasFeature, businessType } = useProfile();

  // Déterminer l'onglet actif
  const currentTab = location.pathname.includes('/historique')
    ? 'historique'
    : location.pathname.includes('/parametres')
      ? 'parametres'
      : 'planning';

  // États principaux
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filters, setFilters] = useState({
    periode: 'a_venir',
    statut: 'tous',
    service: '',
    date_debut: '',
    date_fin: ''
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Stats rapides
  const [stats, setStats] = useState({
    aujourd_hui: 0,
    semaine: 0,
    en_attente: 0
  });

  // Services pour dropdown
  const [services, setServices] = useState<Service[]>([]);

  // Membres équipe pour assignation
  const [membres, setMembres] = useState<Membre[]>([]);

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRdv, setSelectedRdv] = useState<Reservation | null>(null);
  const [editingRdv, setEditingRdv] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState({ service_nom: '', date: '', heure: '', statut: '', notes: '', membre_id: 0 });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editLignes, setEditLignes] = useState<EditLigne[]>([]);

  // Modal paiement (pour marquer terminé)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingTermineRdvId, setPendingTermineRdvId] = useState<number | null>(null);
  const [selectedModePaiement, setSelectedModePaiement] = useState('cb');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Modal affectation personnel (obligatoire pour terminer)
  const [showMembreModal, setShowMembreModal] = useState(false);
  const [pendingTermineRdv, setPendingTermineRdv] = useState<Reservation | null>(null);
  const [selectedMembreId, setSelectedMembreId] = useState<number>(0);
  const [membreLoading, setMembreLoading] = useState(false);

  // Création RDV
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [createNewClient, setCreateNewClient] = useState(false);

  // Multi-services et multi-membres
  const [serviceLignes, setServiceLignes] = useState<ServiceLigne[]>([]);
  const [membreIds, setMembreIds] = useState<number[]>([]);

  // Membres disponibles (filtrés selon date/heure)
  const [membresDisponibles, setMembresDisponibles] = useState<Membre[]>([]);
  const [membresOccupes, setMembresOccupes] = useState<{id: number; nom: string; prenom: string; raison: string}[]>([]);
  const [loadingDisponibilites, setLoadingDisponibilites] = useState(false);

  const [newRdvForm, setNewRdvForm] = useState({
    client_id: 0,
    service: '', // Conservé pour rétro-compatibilité
    date_rdv: '',
    heure_rdv: '',
    // Champs pour mode horaire (sécurité, consulting...)
    heure_fin: '',
    date_fin: '', // Pour prestations multi-jours
    nb_agents: 1, // Nombre d'agents/ressources
    lieu: 'salon',
    adresse_prestation: '', // Adresse où a lieu la prestation
    adresse_facturation: '', // Adresse de facturation
    adresse_facturation_identique: true, // Si true, utilise adresse_prestation
    frais_deplacement: 0,
    notes: '',
    membre_id: 0, // Conservé pour rétro-compatibilité
    // Geste commercial
    remise_type: '', // 'pourcentage' | 'montant' | ''
    remise_valeur: 0,
    remise_motif: ''
  });
  const [newClientForm, setNewClientForm] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    email: ''
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Token helper
  const getToken = () => localStorage.getItem('nexus_admin_token');

  // Charger les données
  useEffect(() => {
    fetchReservations();
    fetchStats();
    fetchServices();
    fetchMembres();
  }, [filters, page, currentTab]);

  // Fermer dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort: 'date',
        order: 'desc'
      });

      // Appliquer les filtres
      if (filters.statut !== 'tous') {
        params.append('statut', filters.statut);
      }
      if (filters.service) {
        params.append('service', filters.service);
      }

      // Filtres de période basés sur l'onglet actif
      const today = new Date().toISOString().split('T')[0];

      if (currentTab === 'historique') {
        // Historique: RDV passés (avant aujourd'hui)
        params.append('date_fin', today);
        params.set('order', 'desc'); // Plus récents en premier
      } else {
        // Planning: RDV à venir
        if (filters.periode === 'a_venir' || filters.periode === 'tous') {
          params.append('date_debut', today);
        } else if (filters.periode === 'aujourd_hui') {
          params.append('date_debut', today);
          params.append('date_fin', today);
        } else if (filters.periode === 'semaine') {
          const startOfWeek = new Date();
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          params.append('date_debut', startOfWeek.toISOString().split('T')[0]);
          params.append('date_fin', endOfWeek.toISOString().split('T')[0]);
        } else if (filters.periode === 'mois') {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
          params.append('date_debut', startOfMonth.toISOString().split('T')[0]);
          params.append('date_fin', endOfMonth.toISOString().split('T')[0]);
        } else if (filters.periode === 'personnalise' && filters.date_debut && filters.date_fin) {
          params.append('date_debut', filters.date_debut);
          params.append('date_fin', filters.date_fin);
        }
      }

      const response = await fetch(`/api/admin/reservations?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Erreur chargement');

      const data = await response.json();

      // Normaliser les données
      const normalized = (data.reservations || data || []).map((r: any) => {
        let serviceName = 'Service';
        let serviceDuree = 60;
        if (typeof r.service === 'object' && r.service !== null) {
          serviceName = r.service.nom || r.service.name || 'Service';
          serviceDuree = r.service.duree_minutes || r.service.duree || 60;
        } else if (typeof r.service === 'string') {
          serviceName = r.service;
        } else if (r.service_nom) {
          serviceName = r.service_nom;
        }

        return {
          ...r,
          client: r.clients || r.client || null,
          service_nom: serviceName,
          duree: r.duree || r.duree_minutes || serviceDuree,
          date: r.date || r.date_rdv,
          heure: r.heure || r.heure_rdv,
          prix: r.prix_total ?? r.montant ?? r.prix ?? 0,
        };
      });

      setReservations(normalized);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error('Erreur fetch reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = getToken();
      const today = new Date().toISOString().split('T')[0];

      // RDV aujourd'hui
      const todayRes = await fetch(`/api/admin/reservations?date_debut=${today}&date_fin=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const todayData = await todayRes.json();

      // RDV cette semaine
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const weekRes = await fetch(`/api/admin/reservations?date_debut=${startOfWeek.toISOString().split('T')[0]}&date_fin=${endOfWeek.toISOString().split('T')[0]}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const weekData = await weekRes.json();

      // RDV en attente
      const waitingRes = await fetch(`/api/admin/reservations?statut=en_attente`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const waitingData = await waitingRes.json();

      setStats({
        aujourd_hui: todayData.pagination?.total || (todayData.reservations || []).length || 0,
        semaine: weekData.pagination?.total || (weekData.reservations || []).length || 0,
        en_attente: waitingData.pagination?.total || (waitingData.reservations || []).length || 0
      });
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/admin/services', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setServices(data.services || data || []);
    } catch (error) {
      console.error('Erreur services:', error);
    }
  };

  const fetchMembres = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/admin/rh/membres', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setMembres((data || []).filter((m: any) => m.statut === 'actif'));
    } catch (error) {
      console.error('Erreur membres:', error);
    }
  };

  const searchClients = async (query: string) => {
    if (!query || query.length < 2) {
      setClients([]);
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`/api/admin/clients?search=${encodeURIComponent(query)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setClients(data.clients || data || []);
    } catch (error) {
      console.error('Erreur recherche clients:', error);
    }
  };

  const handleClientSearch = (value: string) => {
    setClientSearch(value);
    setShowClientDropdown(true);
    searchClients(value);
  };

  // === FETCH MEMBRES DISPONIBLES ===
  const fetchMembresDisponibles = async (date: string, heure: string, duree: number) => {
    if (!date || !heure) {
      setMembresDisponibles(membres);
      setMembresOccupes([]);
      return;
    }

    setLoadingDisponibilites(true);
    try {
      const token = getToken();
      const response = await fetch(
        `/api/admin/rh/membres/disponibles?date=${date}&heure=${heure}&duree=${duree}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setMembresDisponibles(data.disponibles || []);
        setMembresOccupes([...(data.occupes || []), ...(data.non_travail || [])]);
      } else {
        // Fallback: tous les membres
        setMembresDisponibles(membres);
        setMembresOccupes([]);
      }
    } catch (error) {
      console.error('Erreur fetch disponibilités:', error);
      setMembresDisponibles(membres);
      setMembresOccupes([]);
    } finally {
      setLoadingDisponibilites(false);
    }
  };

  // Effet pour charger les disponibilités quand date/heure/durée changent
  const handleDateHeureChange = (field: 'date_rdv' | 'heure_rdv', value: string) => {
    const newForm = { ...newRdvForm, [field]: value };
    setNewRdvForm(newForm);

    // Calculer la durée totale des services
    const dureeTotale = serviceLignes.reduce(
      (sum, sl) => sum + sl.duree_minutes * sl.quantite,
      60 // Durée par défaut si pas de service
    );

    // Fetch disponibilités avec les nouvelles valeurs
    const date = field === 'date_rdv' ? value : newRdvForm.date_rdv;
    const heure = field === 'heure_rdv' ? value : newRdvForm.heure_rdv;

    if (date && heure) {
      fetchMembresDisponibles(date, heure, dureeTotale);
    }
  };

  // === GESTION MULTI-SERVICES ===
  const addServiceLigne = (serviceId: number) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    // Déterminer le mode de tarification (service > profil > fixed)
    const pricingMode = service.pricing_mode || profile?.pricing?.mode || 'fixed';

    let newLignes: ServiceLigne[];

    // Vérifier si déjà ajouté
    if (serviceLignes.some(sl => sl.service_id === serviceId)) {
      // Incrémenter la quantité et ajouter une affectation
      newLignes = serviceLignes.map(sl => {
        if (sl.service_id === serviceId) {
          const newQuantite = sl.quantite + 1;
          const newAffectations = [...sl.affectations, { index: newQuantite - 1 }];
          return { ...sl, quantite: newQuantite, affectations: newAffectations };
        }
        return sl;
      });
    } else {
      // Ajouter nouvelle ligne avec info pricing et une affectation initiale
      newLignes = [
        ...serviceLignes,
        {
          service_id: service.id,
          service_nom: service.nom,
          quantite: 1,
          prix_unitaire: service.prix,
          duree_minutes: service.duree_minutes,
          pricing_mode: pricingMode as 'fixed' | 'hourly' | 'daily' | 'package',
          taux_horaire: service.taux_horaire,
          affectations: [{ index: 0 }]
        }
      ];
    }

    setServiceLignes(newLignes);

    // Recalculer les disponibilités avec la nouvelle durée
    if (newRdvForm.date_rdv && newRdvForm.heure_rdv) {
      const dureeTotale = newLignes.reduce((sum, sl) => sum + sl.duree_minutes * sl.quantite, 0);
      fetchMembresDisponibles(newRdvForm.date_rdv, newRdvForm.heure_rdv, dureeTotale);
    }
  };

  const removeServiceLigne = (serviceId: number) => {
    const newLignes = serviceLignes.filter(sl => sl.service_id !== serviceId);
    setServiceLignes(newLignes);

    // Recalculer les disponibilités
    if (newRdvForm.date_rdv && newRdvForm.heure_rdv) {
      const dureeTotale = newLignes.reduce((sum, sl) => sum + sl.duree_minutes * sl.quantite, 60);
      fetchMembresDisponibles(newRdvForm.date_rdv, newRdvForm.heure_rdv, dureeTotale);
    }
  };

  const updateServiceQuantite = (serviceId: number, quantite: number) => {
    if (quantite < 1) {
      removeServiceLigne(serviceId);
      return;
    }

    const newLignes = serviceLignes.map(sl => {
      if (sl.service_id !== serviceId) return sl;

      // Ajuster le nombre d'affectations selon la nouvelle quantité
      let newAffectations = [...(sl.affectations || [])];
      const currentCount = newAffectations.length;

      if (quantite > currentCount) {
        // Ajouter des affectations
        for (let i = currentCount; i < quantite; i++) {
          newAffectations.push({ index: i });
        }
      } else if (quantite < currentCount) {
        // Supprimer les dernières affectations
        newAffectations = newAffectations.slice(0, quantite);
      }

      return { ...sl, quantite, affectations: newAffectations };
    });
    setServiceLignes(newLignes);

    // Recalculer les disponibilités
    if (newRdvForm.date_rdv && newRdvForm.heure_rdv) {
      const dureeTotale = newLignes.reduce((sum, sl) => sum + sl.duree_minutes * sl.quantite, 0);
      fetchMembresDisponibles(newRdvForm.date_rdv, newRdvForm.heure_rdv, dureeTotale);
    }
  };

  // === HELPER: Calculer heure de fin depuis heure début + durée ===
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  // === ASSIGNATION MEMBRE PAR SERVICE (Multi-affectations) ===
  const updateAffectation = (
    serviceId: number,
    affectationIndex: number,
    field: keyof ServiceAffectation,
    value: number | string | undefined
  ) => {
    setServiceLignes(prev =>
      prev.map(sl => {
        if (sl.service_id !== serviceId) return sl;

        const newAffectations = sl.affectations.map((aff, idx) => {
          if (idx !== affectationIndex) return aff;

          if (field === 'membre_id') {
            const membreId = value ? Number(value) : undefined;
            const membre = membreId ? membres.find(m => m.id === membreId) : null;
            return {
              ...aff,
              membre_id: membreId,
              membre_nom: membre ? `${membre.prenom} ${membre.nom}` : undefined
            };
          }

          // Auto-calcul heure_fin quand heure_debut change
          if (field === 'heure_debut' && value) {
            const heureFin = calculateEndTime(value as string, sl.duree_minutes);
            return { ...aff, heure_debut: value as string, heure_fin: heureFin };
          }

          return { ...aff, [field]: value };
        });

        return { ...sl, affectations: newAffectations };
      })
    );
  };

  // Legacy - pour compatibilité arrière
  const assignMembreToService = (serviceId: number, membreId: number | null) => {
    const membre = membreId ? membres.find(m => m.id === membreId) : null;
    setServiceLignes(prev =>
      prev.map(sl =>
        sl.service_id === serviceId
          ? {
              ...sl,
              membre_id: membreId || undefined,
              membre_nom: membre ? `${membre.prenom} ${membre.nom}` : undefined
            }
          : sl
      )
    );
  };

  // === CALCULS ===
  // Helper: Calculer les heures entre deux horaires
  const calculateHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    // Nettoyer les heures (remplacer -- par 00)
    const cleanStart = startTime.replace('--', '00');
    const cleanEnd = endTime.replace('--', '00');
    const [startH, startM] = cleanStart.split(':').map(Number);
    const [endH, endM] = cleanEnd.split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) return 0;
    let startMinutes = startH * 60 + (startM || 0);
    let endMinutes = endH * 60 + (endM || 0);
    // Si fin < début, mission de nuit
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    return Math.round((endMinutes - startMinutes) / 60 * 100) / 100;
  };

  // Helper: Calculer les jours entre deux dates
  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate) return 1;
    if (!endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  };

  const calculateTotals = () => {
    const pricingMode = profile?.pricing?.mode || 'fixed';
    let sousTotalServices = 0;
    let dureeTotale = 0;

    // Calcul selon le mode de tarification du profil
    if (pricingMode === 'hourly') {
      // Mode horaire: calculer à partir des affectations (heures par agent)
      const nbJours = newRdvForm.date_fin && newRdvForm.date_rdv
        ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin)
        : 1;

      let totalHeures = 0;
      let nbAgentsTotal = 0;

      sousTotalServices = serviceLignes.reduce((sum, sl) => {
        const service = services.find(s => s.id === sl.service_id);
        const tauxHoraire = service?.taux_horaire || sl.taux_horaire || sl.prix_unitaire;

        // Calculer pour chaque affectation qui a des heures définies
        let serviceMontant = 0;
        sl.affectations.forEach(aff => {
          if (aff.heure_debut && aff.heure_fin) {
            const heuresAgent = calculateHours(aff.heure_debut, aff.heure_fin);
            serviceMontant += Math.round(tauxHoraire * heuresAgent * nbJours);
            totalHeures += heuresAgent;
            nbAgentsTotal++;
          }
        });

        return sum + serviceMontant;
      }, 0);

      dureeTotale = Math.round(totalHeures * 60 * nbJours);
    } else if (pricingMode === 'daily' && newRdvForm.date_rdv) {
      // Mode journalier: taux_journalier × jours × quantité
      const jours = newRdvForm.date_fin
        ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin)
        : 1;
      dureeTotale = jours * 8 * 60; // 8h par jour

      sousTotalServices = serviceLignes.reduce((sum, sl) => {
        const service = services.find(s => s.id === sl.service_id);
        const tauxJournalier = service?.taux_journalier || sl.prix_unitaire;
        return sum + Math.round(tauxJournalier * jours * sl.quantite);
      }, 0);
    } else {
      // Mode fixe (par défaut): prix × quantité
      sousTotalServices = serviceLignes.reduce(
        (sum, sl) => sum + sl.prix_unitaire * sl.quantite,
        0
      );
      dureeTotale = serviceLignes.reduce(
        (sum, sl) => sum + sl.duree_minutes * sl.quantite,
        0
      );
    }

    // Frais déplacement (en centimes)
    const fraisDeplacement = newRdvForm.lieu === 'domicile' ? newRdvForm.frais_deplacement * 100 : 0;

    // Montant avant remise
    const montantAvantRemise = sousTotalServices + fraisDeplacement;

    // Calcul de la remise
    let remise = 0;
    if (newRdvForm.remise_type === 'pourcentage' && newRdvForm.remise_valeur > 0) {
      remise = Math.round(montantAvantRemise * newRdvForm.remise_valeur / 100);
    } else if (newRdvForm.remise_type === 'montant' && newRdvForm.remise_valeur > 0) {
      remise = newRdvForm.remise_valeur * 100; // Convertir en centimes
    }

    // Montant HT après remise
    const montantHT = montantAvantRemise - remise;

    // TVA 20%
    const tva = Math.round(montantHT * 0.2);

    // Total TTC
    const totalTTC = montantHT + tva;

    // Calcul des valeurs pour l'affichage
    const nbJours = newRdvForm.date_fin && newRdvForm.date_rdv
      ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin)
      : 1;

    // Calculer le nombre d'agents et heures totales depuis les affectations
    let nbAgentsEffectif = 0;
    let heuresParAgentMoyenne = 0;
    if (pricingMode === 'hourly') {
      let totalHeuresAffectations = 0;
      serviceLignes.forEach(sl => {
        sl.affectations.forEach(aff => {
          if (aff.heure_debut && aff.heure_fin) {
            totalHeuresAffectations += calculateHours(aff.heure_debut, aff.heure_fin);
            nbAgentsEffectif++;
          }
        });
      });
      heuresParAgentMoyenne = nbAgentsEffectif > 0 ? totalHeuresAffectations / nbAgentsEffectif : 0;
    }

    return {
      sousTotalServices,
      dureeTotale,
      fraisDeplacement,
      remise,
      montantHT,
      tva,
      totalTTC,
      pricingMode,
      // Infos pour mode horaire
      heuresParJour: heuresParAgentMoyenne,
      nbJours,
      nbAgents: nbAgentsEffectif || newRdvForm.nb_agents
    };
  };

  const selectClient = (client: Client) => {
    // Construire l'adresse complète si disponible
    const adresseComplete = [
      client.adresse,
      client.code_postal,
      client.ville
    ].filter(Boolean).join(', ');

    setNewRdvForm({
      ...newRdvForm,
      client_id: client.id,
      // Auto-remplir l'adresse de prestation avec l'adresse du client
      adresse_prestation: adresseComplete || newRdvForm.adresse_prestation
    });
    const isPro = client.type_client === 'professionnel' || !!client.raison_sociale;
    const displayName = isPro && client.raison_sociale
      ? client.raison_sociale
      : `${client.prenom} ${client.nom}`;
    setClientSearch(`${displayName} - ${client.telephone}`);
    setShowClientDropdown(false);
  };

  const handleOpenDetail = async (rdv: Reservation) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/admin/reservations/${rdv.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setSelectedRdv(data.reservation || data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleChangeStatut = async (rdvId: number, newStatut: string, _modePaiement?: string, membreId?: number) => {
    // Note: Le mode de paiement n'est plus requis ici
    // Le paiement sera enregistré séparément via la facture (Comptabilité > Relances)

    try {
      const token = getToken();
      const body: { statut: string; membre_id?: number } = { statut: newStatut };

      // Ajouter membre_id si fourni
      if (membreId) {
        body.membre_id = membreId;
      }

      const response = await fetch(`/api/admin/reservations/${rdvId}/statut`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const data = await response.json();
        // Gérer le cas où le membre est requis
        if (data.code === 'MEMBRE_REQUIS') {
          // Trouver la réservation dans la liste
          const rdv = reservations.find(r => r.id === rdvId);
          if (rdv) {
            setPendingTermineRdv(rdv);
            setSelectedMembreId(0);
            setShowMembreModal(true);
          }
          return; // Ne pas lancer d'erreur
        }
        throw new Error(data.error || 'Erreur changement statut');
      }

      fetchReservations();
      fetchStats();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Erreur lors du changement de statut');
    }
  };

  // Confirmer terminer avec affectation du personnel
  const handleConfirmTermineWithMembre = async () => {
    if (!pendingTermineRdv || !selectedMembreId) return;

    setMembreLoading(true);
    try {
      await handleChangeStatut(pendingTermineRdv.id, 'termine', undefined, selectedMembreId);
      setShowMembreModal(false);
      setPendingTermineRdv(null);
      setSelectedMembreId(0);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setMembreLoading(false);
    }
  };

  const handleConfirmPaymentAndTermine = async () => {
    if (!pendingTermineRdvId) return;

    setPaymentLoading(true);
    try {
      await handleChangeStatut(pendingTermineRdvId, 'termine', selectedModePaiement);
      setShowPaymentModal(false);
      setPendingTermineRdvId(null);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleOpenEdit = (rdv: Reservation) => {
    setEditingRdv(rdv);
    setEditForm({
      service_nom: rdv.service_nom || (typeof rdv.service === 'object' ? rdv.service?.nom : rdv.service) || '',
      date: rdv.date || rdv.date_rdv || '',
      heure: rdv.heure || rdv.heure_rdv || '',
      statut: rdv.statut || '',
      notes: rdv.notes || '',
      membre_id: rdv.membre?.id || rdv.membre_id || 0,
    });

    // Initialiser les lignes de réservation pour édition des heures
    const lignes: EditLigne[] = (rdv.services || []).map((s: ReservationService & { heure_debut?: string; heure_fin?: string }) => ({
      id: s.id,
      service_nom: s.service_nom,
      quantite: s.quantite || 1,
      membre_id: s.membre?.id || null,
      membre: s.membre || null,
      heure_debut: s.heure_debut || rdv.heure || rdv.heure_rdv || '',
      heure_fin: s.heure_fin || '',
      duree_minutes: s.duree_minutes,
    }));
    setEditLignes(lignes);

    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRdv) return;
    setEditLoading(true);
    setEditError('');
    try {
      const token = getToken();
      const response = await fetch(`/api/admin/reservations/${editingRdv.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          service: editForm.service_nom,
          date_rdv: editForm.date,
          heure_rdv: editForm.heure,
          statut: editForm.statut,
          notes: editForm.notes,
          membre_id: editForm.membre_id || null,
          // Lignes avec heures effectives par salarié
          lignes: editLignes.length > 0 ? editLignes.map(l => ({
            id: l.id,
            heure_debut: l.heure_debut,
            heure_fin: l.heure_fin,
          })) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erreur modification');
      }
      setShowEditModal(false);
      setEditingRdv(null);
      setEditLignes([]);
      fetchReservations();
      fetchStats();
    } catch (error: any) {
      setEditError(error.message || 'Erreur');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (rdvId: number) => {
    if (!confirm(`Supprimer définitivement la prestation #${rdvId} ?`)) return;

    try {
      const token = getToken();
      const response = await fetch(`/api/admin/reservations/${rdvId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur suppression');
      }

      fetchReservations();
      fetchStats();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Impossible de supprimer');
    }
  };

  const handleCreateRdv = async () => {
    const missing: string[] = [];
    const pricingMode = profile?.pricing?.mode || 'fixed';

    if (createNewClient) {
      if (!newClientForm.prenom.trim()) missing.push('Prénom');
      if (!newClientForm.nom.trim()) missing.push('Nom');
      if (!newClientForm.telephone.trim()) missing.push('Téléphone');
    } else {
      if (!newRdvForm.client_id) missing.push(t('client', false));
    }

    // Validation multi-services
    if (serviceLignes.length === 0) missing.push(`Au moins ${t('service', false).toLowerCase()}`);
    if (!newRdvForm.date_rdv) missing.push('Date');

    // Validation selon le mode de tarification
    if (pricingMode === 'hourly') {
      // En mode horaire, les heures sont définies par affectation (agent)
      // Vérifier qu'au moins une affectation a des heures valides
      const hasValidAffectations = serviceLignes.some(sl =>
        sl.affectations.some(aff => aff.heure_debut && aff.heure_fin)
      );
      if (!hasValidAffectations) {
        missing.push('Heures des agents (définir heure début/fin pour au moins un agent)');
      }
    } else if (pricingMode !== 'daily') {
      if (!newRdvForm.heure_rdv) missing.push('Heure');
    }

    if (missing.length > 0) {
      setCreateError(`Champs manquants: ${missing.join(', ')}`);
      return;
    }

    setCreateLoading(true);
    setCreateError('');

    try {
      const token = getToken();
      let clientId = newRdvForm.client_id;

      // Si nouveau client, le créer d'abord
      if (createNewClient) {
        const clientResponse = await fetch('/api/admin/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(newClientForm)
        });

        if (!clientResponse.ok) {
          const data = await clientResponse.json();
          throw new Error(data.error || 'Erreur création client');
        }

        const clientData = await clientResponse.json();
        clientId = clientData.client?.id || clientData.id;
      }

      // Calculer les totaux
      const totals = calculateTotals();

      // Extraire les membre_ids uniques des services ET des affectations
      const membreIdsFromServices: number[] = [];
      serviceLignes.forEach(sl => {
        // Membre direct sur la ligne (mode classique)
        if (sl.membre_id) {
          membreIdsFromServices.push(sl.membre_id);
        }
        // Membres dans les affectations (mode horaire)
        sl.affectations.forEach(aff => {
          if (aff.membre_id) {
            membreIdsFromServices.push(aff.membre_id);
          }
        });
      });
      const uniqueMembreIds = [...new Set(membreIdsFromServices)];

      // Créer la réservation avec multi-services et membres assignés par service
      const response = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: clientId,
          // Premier service comme service principal (pour rétro-compatibilité)
          service: serviceLignes[0]?.service_nom || '',
          date_rdv: newRdvForm.date_rdv,
          heure_rdv: newRdvForm.heure_rdv,
          // Champs pour mode horaire/journalier
          heure_fin: newRdvForm.heure_fin || null,
          date_fin: newRdvForm.date_fin || null,
          nb_agents: newRdvForm.nb_agents || 1,
          pricing_mode: profile?.pricing?.mode || 'fixed',
          lieu: newRdvForm.adresse_prestation ? 'custom' : 'salon',
          adresse_client: newRdvForm.adresse_prestation,
          adresse_facturation: newRdvForm.adresse_facturation_identique
            ? newRdvForm.adresse_prestation
            : newRdvForm.adresse_facturation,
          notes: newRdvForm.notes,
          // Services avec membre assigné à chaque service
          services: serviceLignes.map(sl => ({
            service_id: sl.service_id,
            service_nom: sl.service_nom,
            quantite: sl.quantite,
            prix_unitaire: sl.prix_unitaire,
            duree_minutes: sl.duree_minutes,
            membre_id: sl.membre_id || null,
            taux_horaire: sl.taux_horaire || null,
            // Affectations avec heures (pour mode horaire)
            affectations: sl.affectations.map(aff => ({
              membre_id: aff.membre_id,
              heure_debut: aff.heure_debut,
              heure_fin: aff.heure_fin
            }))
          })),
          // Liste des membres uniques (pour reservation_membres)
          membre_ids: uniqueMembreIds,
          // Premier membre comme membre principal (rétro-compatibilité)
          membre_id: serviceLignes[0]?.membre_id || uniqueMembreIds[0] || null,
          // Geste commercial
          remise_type: newRdvForm.remise_type || null,
          remise_valeur: newRdvForm.remise_valeur || 0,
          remise_motif: newRdvForm.remise_motif || null,
          // Totaux calculés
          montant_ht: totals.montantHT,
          montant_tva: totals.tva,
          prix_total: totals.totalTTC,
          duree_totale_minutes: totals.dureeTotale,
          frais_deplacement: totals.fraisDeplacement
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur création');
      }

      setShowNewModal(false);
      resetNewRdvForm();
      fetchReservations();
      fetchStats();
    } catch (error: any) {
      setCreateError(error.message || 'Erreur création');
    } finally {
      setCreateLoading(false);
    }
  };

  const resetNewRdvForm = () => {
    setNewRdvForm({
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
      remise_motif: ''
    });
    setServiceLignes([]);
    setMembreIds([]);
    setMembresDisponibles([]);
    setMembresOccupes([]);
    setClientSearch('');
    setCreateNewClient(false);
    setNewClientForm({ prenom: '', nom: '', telephone: '', email: '' });
    setCreateError('');
  };

  const handleExportCSV = () => {
    const csvData = reservations.map(rdv => ({
      Date: formatDate(rdv.date || ''),
      Heure: rdv.heure || '',
      Client: rdv.client ? `${rdv.client.prenom} ${rdv.client.nom}` : 'Inconnu',
      Téléphone: rdv.client?.telephone || '',
      Service: rdv.service_nom || '',
      'Prix (€)': (rdv.prix || 0).toFixed(2),
      Statut: STATUS_CONFIG[rdv.statut]?.label || rdv.statut,
      Notes: rdv.notes || ''
    }));

    const headers = Object.keys(csvData[0] || {}).join(';');
    const rows = csvData.map(row => Object.values(row).join(';')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reservations_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const resetFilters = () => {
    setFilters({
      periode: 'a_venir',
      statut: 'tous',
      service: '',
      date_debut: '',
      date_fin: ''
    });
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    // Backend already converts centimes to euros
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <ServiceLayout
      title={t('reservation', true)}
      icon={Calendar}
      tabs={tabs}
      actions={
        <div className="flex gap-2">
          <Button
            onClick={fetchReservations}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowNewModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            {profile?.id === 'security' ? 'Nouvelle mission' : `Nouveau ${t('reservation', false).toLowerCase()}`}
          </Button>
        </div>
      }
    >
      {/* Contenu conditionnel selon l'onglet */}
      {currentTab === 'parametres' ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Paramètres des prestations</h2>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Durée minimale entre deux prestations (minutes)
                </label>
                <Input type="number" defaultValue={15} className="w-48" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Délai minimum de prise de prestation (heures)
                </label>
                <Input type="number" defaultValue={24} className="w-48" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Horaires d'ouverture
                </label>
                <div className="flex items-center gap-4">
                  <Input type="time" defaultValue="09:00" className="w-32" />
                  <span className="text-gray-500">à</span>
                  <Input type="time" defaultValue="19:00" className="w-32" />
                </div>
              </div>

              <div className="pt-4">
                <Button>Enregistrer les paramètres</Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="space-y-6">
        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Aujourd'hui</p>
            <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stats.aujourd_hui}</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Cette semaine</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.semaine}</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">En attente</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.en_attente}</p>
          </div>
        </div>

        {/* En-tête selon l'onglet */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {currentTab === 'historique' ? 'Historique des prestations' : 'Prestations à venir'}
          </h2>
        </div>

        {/* Filtres */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />

            {/* Période - seulement pour le planning */}
            {currentTab !== 'historique' && (
              <select
                value={filters.periode}
                onChange={(e) => { setFilters({ ...filters, periode: e.target.value }); setPage(1); }}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="tous">Toutes les prestations</option>
                <option value="aujourd_hui">Aujourd'hui</option>
                <option value="semaine">Cette semaine</option>
                <option value="mois">Ce mois</option>
                <option value="personnalise">Personnalisé</option>
              </select>
            )}

            {/* Statut */}
            <select
              value={filters.statut}
              onChange={(e) => { setFilters({ ...filters, statut: e.target.value }); setPage(1); }}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="tous">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="confirme">Confirmé</option>
              <option value="termine">Terminé</option>
              <option value="annule">Annulé</option>
            </select>

            {/* Service */}
            <Input
              type="text"
              placeholder="Filtrer par service..."
              value={filters.service}
              onChange={(e) => { setFilters({ ...filters, service: e.target.value }); setPage(1); }}
              className="w-48"
            />

            <Button onClick={resetFilters} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>

            <Button onClick={handleExportCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
          </div>

          {/* Dates personnalisées - seulement pour le planning */}
          {currentTab !== 'historique' && filters.periode === 'personnalise' && (
            <div className="flex items-center gap-2 mt-3">
              <Input
                type="date"
                value={filters.date_debut}
                onChange={(e) => setFilters({ ...filters, date_debut: e.target.value })}
                className="w-40"
              />
              <span className="text-gray-500">à</span>
              <Input
                type="date"
                value={filters.date_fin}
                onChange={(e) => setFilters({ ...filters, date_fin: e.target.value })}
                className="w-40"
              />
            </div>
          )}
        </div>

        {/* Liste des réservations */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-4 text-gray-500">Chargement...</p>
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
            <Calendar className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500">Aucune prestation trouvée</p>
            <Button onClick={() => setShowNewModal(true)} variant="ghost" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Créer une prestation
            </Button>
          </div>
        ) : (
          <>
            {/* Vue Desktop - Tableau */}
            <div className="hidden md:block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Heure</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {reservations.map((rdv) => {
                    const statusConfig = STATUS_CONFIG[rdv.statut] || STATUS_CONFIG.demande;
                    return (
                      <tr
                        key={rdv.id}
                        onClick={() => handleOpenDetail(rdv)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(rdv.date || '')}</div>
                              <div className="text-sm text-gray-500">{rdv.heure || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {rdv.client ? (() => {
                            const isPro = rdv.client.type_client === 'professionnel' || !!rdv.client.raison_sociale;
                            const displayName = isPro && rdv.client.raison_sociale
                              ? rdv.client.raison_sociale
                              : `${rdv.client.prenom} ${rdv.client.nom}`;
                            return (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <EntityLink
                                      type="client"
                                      entity={{
                                        id: rdv.client.id,
                                        nom: rdv.client.nom,
                                        prenom: rdv.client.prenom,
                                        telephone: rdv.client.telephone,
                                        email: rdv.client.email || undefined
                                      }}
                                      label={displayName}
                                      className="text-sm font-medium"
                                    />
                                    {isPro && (
                                      <span className="px-1 py-0.5 text-[9px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                                    )}
                                  </div>
                                  {isPro && rdv.client.raison_sociale && (
                                    <div className="text-xs text-gray-400">{rdv.client.prenom} {rdv.client.nom}</div>
                                  )}
                                  <div className="text-sm text-gray-500">{rdv.client.telephone}</div>
                                </div>
                              </div>
                            );
                          })() : (
                            <span className="text-sm text-gray-400">Client inconnu</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {/* Afficher tous les services avec leurs membres assignés */}
                          {rdv.services && rdv.services.length > 0 ? (
                            <div className="space-y-1">
                              {rdv.services.map((s: any, idx: number) => (
                                <div key={s.id || idx}>
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {s.service_nom}
                                    </span>
                                    {s.quantite > 1 && <span className="text-xs text-gray-500">x{s.quantite}</span>}
                                  </div>
                                  {s.membre && (
                                    <span className="text-xs text-cyan-600">
                                      → {s.membre.prenom} {s.membre.nom}
                                    </span>
                                  )}
                                </div>
                              ))}
                              <div className="text-xs text-gray-500 pt-1">{rdv.duree_totale || rdv.duree || 60} min</div>
                            </div>
                          ) : (
                            <>
                              {rdv.service_id ? (
                                <EntityLink
                                  type="service"
                                  entity={{
                                    id: rdv.service_id,
                                    nom: rdv.service_nom || '',
                                    prix: (rdv.prix || 0) * 100,
                                    duree: rdv.duree || 60
                                  }}
                                  label={rdv.service_nom || ''}
                                  className="text-sm"
                                />
                              ) : (
                                <span className="text-sm">{rdv.service_nom || '-'}</span>
                              )}
                              {rdv.duree && <div className="text-xs text-gray-500">{rdv.duree} min</div>}
                            </>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {/* Afficher tous les membres assignés */}
                          {rdv.membres && rdv.membres.length > 0 ? (
                            <div className="space-y-1">
                              {rdv.membres.map((m: any, idx: number) => (
                                <div key={m.id || idx} className="flex items-center gap-1">
                                  <span className="text-sm text-gray-900 dark:text-white">
                                    {m.prenom} {m.nom}
                                  </span>
                                  {m.assignment_role === 'principal' && (
                                    <span className="text-xs text-cyan-600">●</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : rdv.membre ? (
                            <EntityLink
                              type="employee"
                              entity={{
                                id: rdv.membre.id,
                                nom: rdv.membre.nom,
                                prenom: rdv.membre.prenom,
                                role: rdv.membre.role
                              }}
                              label={`${rdv.membre.prenom} ${rdv.membre.nom}`}
                              className="text-sm"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">Non assigné</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(rdv.prix || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(rdv)}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(rdv.id)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 hover:text-red-700"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {rdv.statut !== 'annule' && (
                              <select
                                value={rdv.statut}
                                onChange={(e) => handleChangeStatut(rdv.id, e.target.value)}
                                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none"
                              >
                                <option value="en_attente">En attente</option>
                                <option value="confirme">Confirmé</option>
                                <option value="termine">Terminé</option>
                                <option value="annule">Annulé</option>
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vue Mobile - Cartes */}
            <div className="md:hidden space-y-3">
              {reservations.map((rdv) => {
                const statusConfig = STATUS_CONFIG[rdv.statut] || STATUS_CONFIG.demande;
                return (
                  <div
                    key={rdv.id}
                    onClick={() => handleOpenDetail(rdv)}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 cursor-pointer hover:border-cyan-500"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-600" />
                        <span className="font-medium text-gray-900 dark:text-white">{formatDate(rdv.date || '')}</span>
                        <span className="text-gray-500">à {rdv.heure}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {rdv.client ? (() => {
                          const isPro = rdv.client.type_client === 'professionnel' || !!rdv.client.raison_sociale;
                          const displayName = isPro && rdv.client.raison_sociale
                            ? rdv.client.raison_sociale
                            : `${rdv.client.prenom} ${rdv.client.nom}`;
                          return (
                            <div className="flex items-center gap-1.5">
                              <EntityLink
                                type="client"
                                entity={{
                                  id: rdv.client.id,
                                  nom: rdv.client.nom,
                                  prenom: rdv.client.prenom,
                                  telephone: rdv.client.telephone,
                                  email: rdv.client.email || undefined
                                }}
                                label={displayName}
                              />
                              {isPro && (
                                <span className="px-1 py-0.5 text-[9px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                              )}
                            </div>
                          );
                        })() : (
                          <span className="text-gray-400">Client inconnu</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        {rdv.service_id ? (
                          <EntityLink
                            type="service"
                            entity={{
                              id: rdv.service_id,
                              nom: rdv.service_nom || '',
                              prix: (rdv.prix || 0) * 100,
                              duree: rdv.duree || 60
                            }}
                            label={rdv.service_nom || ''}
                            className="text-sm text-gray-600 dark:text-gray-400"
                          />
                        ) : (
                          <span className="text-sm text-gray-600 dark:text-gray-400">{rdv.service_nom || '-'}</span>
                        )}
                        <span className="font-medium text-green-600">{formatCurrency(rdv.prix || 0)}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => handleOpenEdit(rdv)}>
                        <Edit className="w-3 h-3 mr-1" />
                        Modifier
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(rdv.id)}>
                        <Trash2 className="w-3 h-3 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-500">Page {page} sur {totalPages}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Précédent
                  </Button>
                  <Button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Suivant
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Modal Détail */}
      {showDetailModal && selectedRdv && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Détails prestation #{selectedRdv.id}</h2>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Date/Heure + Statut */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-600" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDate(selectedRdv.date || selectedRdv.date_rdv || '')} à {selectedRdv.heure || selectedRdv.heure_rdv}
                  </span>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded ${STATUS_CONFIG[selectedRdv.statut]?.bgColor} ${STATUS_CONFIG[selectedRdv.statut]?.color}`}>
                  {STATUS_CONFIG[selectedRdv.statut]?.label || selectedRdv.statut}
                </span>
              </div>

              {/* Client */}
              {selectedRdv.client && (() => {
                const isPro = selectedRdv.client.type_client === 'professionnel' || !!selectedRdv.client.raison_sociale;
                const displayName = isPro && selectedRdv.client.raison_sociale
                  ? selectedRdv.client.raison_sociale
                  : `${selectedRdv.client.prenom} ${selectedRdv.client.nom}`;
                const initials = isPro && selectedRdv.client.raison_sociale
                  ? selectedRdv.client.raison_sociale.substring(0, 2).toUpperCase()
                  : `${selectedRdv.client.prenom?.[0] || ''}${selectedRdv.client.nom?.[0] || ''}`;
                return (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isPro ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <EntityLink
                            type="client"
                            entity={{
                              id: selectedRdv.client.id,
                              nom: selectedRdv.client.nom,
                              prenom: selectedRdv.client.prenom,
                              telephone: selectedRdv.client.telephone,
                              email: selectedRdv.client.email || undefined
                            }}
                            label={displayName}
                            className="font-medium"
                          />
                          {isPro && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                          )}
                        </div>
                        {isPro && selectedRdv.client.raison_sociale && (
                          <p className="text-xs text-gray-400">Contact: {selectedRdv.client.prenom} {selectedRdv.client.nom}</p>
                        )}
                        <p className="text-sm text-gray-500">{selectedRdv.client.telephone}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Services avec salariés assignés */}
              <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg space-y-2">
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mb-2">Services & Personnel</p>
                {selectedRdv.services && selectedRdv.services.length > 0 ? (
                  <>
                    {selectedRdv.services.map((s, idx) => (
                      <div key={s.id || idx} className="flex items-center justify-between py-1 border-b border-cyan-100 dark:border-cyan-800 last:border-0">
                        <div className="flex-1">
                          <span className="font-medium text-gray-900 dark:text-white">{s.service_nom}</span>
                          {s.quantite > 1 && <span className="text-xs text-gray-500 ml-1">x{s.quantite}</span>}
                          {s.membre && (
                            <p className="text-xs text-purple-600 dark:text-purple-400">
                              → {s.membre.prenom} {s.membre.nom}
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-medium text-green-600">{formatCurrency(s.prix_total || 0)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-cyan-200 dark:border-cyan-700">
                      <span className="text-sm text-gray-500">
                        Durée totale: {selectedRdv.duree_totale || selectedRdv.duree || 60} min
                      </span>
                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency(selectedRdv.prix || selectedRdv.prix_total || 0)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{selectedRdv.service_nom || '-'}</span>
                      {selectedRdv.duree && <p className="text-xs text-gray-500">{selectedRdv.duree} min</p>}
                    </div>
                    <span className="text-xl font-bold text-green-600">{formatCurrency(selectedRdv.prix || selectedRdv.prix_total || 0)}</span>
                  </div>
                )}
              </div>

              {/* Tous les employés assignés */}
              {selectedRdv.membres && selectedRdv.membres.length > 0 ? (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">Personnel assigné ({selectedRdv.membres.length})</p>
                  <div className="space-y-1">
                    {selectedRdv.membres.map((m, idx) => (
                      <div key={m.id || idx} className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {m.prenom} {m.nom}
                        </span>
                        <span className="text-sm text-gray-500">({m.role})</span>
                        {m.assignment_role === 'principal' && (
                          <span className="text-xs bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-1.5 rounded">Principal</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedRdv.membre && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Employé assigné</p>
                  <EntityLink
                    type="employee"
                    entity={{
                      id: selectedRdv.membre.id,
                      nom: selectedRdv.membre.nom,
                      prenom: selectedRdv.membre.prenom,
                      role: selectedRdv.membre.role
                    }}
                    label={`${selectedRdv.membre.prenom} ${selectedRdv.membre.nom}`}
                    className="font-medium"
                  />
                  <span className="text-sm text-gray-500 ml-2">({selectedRdv.membre.role})</span>
                </div>
              )}

              {/* Notes */}
              {selectedRdv.notes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Notes</p>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{selectedRdv.notes}</p>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                Créée via {selectedRdv.created_via || 'admin'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifier */}
      {showEditModal && editingRdv && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowEditModal(false); setEditLignes([]); }}>
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Modifier prestation #{editingRdv.id}</h2>
              <button onClick={() => { setShowEditModal(false); setEditLignes([]); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Client info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {editingRdv.client ? (() => {
                  const isPro = editingRdv.client.type_client === 'professionnel' || !!editingRdv.client.raison_sociale;
                  const displayName = isPro && editingRdv.client.raison_sociale
                    ? editingRdv.client.raison_sociale
                    : `${editingRdv.client.prenom} ${editingRdv.client.nom}`;
                  return (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {displayName} — {editingRdv.client.telephone}
                      </p>
                      {isPro && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                      )}
                    </div>
                  );
                })() : (
                  <p className="text-sm text-gray-400">Client inconnu</p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Date</label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                />
              </div>

              {/* Lignes de service avec heures par salarié */}
              {editLignes.length > 0 ? (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                    Heures effectives par salarié
                  </label>
                  {editLignes.map((ligne, idx) => (
                    <div key={ligne.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {ligne.service_nom}
                        </span>
                        {ligne.membre && (
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                            {ligne.membre.prenom} {ligne.membre.nom}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 mb-1 block">Début</label>
                          <Input
                            type="time"
                            value={ligne.heure_debut}
                            onChange={(e) => {
                              const newLignes = [...editLignes];
                              newLignes[idx] = { ...newLignes[idx], heure_debut: e.target.value };
                              setEditLignes(newLignes);
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 mb-1 block">Fin</label>
                          <Input
                            type="time"
                            value={ligne.heure_fin}
                            onChange={(e) => {
                              const newLignes = [...editLignes];
                              newLignes[idx] = { ...newLignes[idx], heure_fin: e.target.value };
                              setEditLignes(newLignes);
                            }}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      {ligne.heure_debut && ligne.heure_fin && (() => {
                        const [startH, startM] = ligne.heure_debut.split(':').map(Number);
                        const [endH, endM] = ligne.heure_fin.split(':').map(Number);
                        let dureeMins = (endH * 60 + endM) - (startH * 60 + startM);
                        if (dureeMins < 0) dureeMins += 24 * 60;
                        const heures = Math.floor(dureeMins / 60);
                        const mins = dureeMins % 60;
                        return (
                          <p className="text-xs text-gray-500">
                            Durée: {heures}h{mins > 0 ? mins.toString().padStart(2, '0') : ''}
                          </p>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Service (ancienne vue si pas de lignes) */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Service</label>
                    <select
                      value={editForm.service_nom}
                      onChange={(e) => setEditForm({ ...editForm, service_nom: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {services.filter(s => s.actif !== false).map((s) => (
                        <option key={s.id} value={s.nom}>
                          {s.nom} — {(s.prix / 100).toFixed(0)}€ ({s.duree_minutes}min)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Heure */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Heure</label>
                    <Input
                      type="time"
                      value={editForm.heure}
                      onChange={(e) => setEditForm({ ...editForm, heure: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Statut */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Statut</label>
                <select
                  value={editForm.statut}
                  onChange={(e) => setEditForm({ ...editForm, statut: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="demande">Demande</option>
                  <option value="en_attente">En attente</option>
                  <option value="confirme">Confirmé</option>
                  <option value="termine">Terminé</option>
                  <option value="annule">Annulé</option>
                </select>
              </div>

              {/* Employé assigné */}
              {membres.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Employé assigné</label>
                  <select
                    value={editForm.membre_id}
                    onChange={(e) => setEditForm({ ...editForm, membre_id: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value={0}>Non assigné</option>
                    {membres.map((membre) => (
                      <option key={membre.id} value={membre.id}>
                        {membre.prenom} {membre.nom} ({membre.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {editError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={() => { setShowEditModal(false); setEditLignes([]); }} variant="outline" className="flex-1">
                  Annuler
                </Button>
                <Button onClick={handleSaveEdit} disabled={editLoading} className="flex-1">
                  {editLoading ? 'Sauvegarde...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nouvelle Réservation */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowNewModal(false); resetNewRdvForm(); }}>
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {profile?.id === 'security' ? 'Nouvelle mission' : `Nouveau ${t('reservation', false).toLowerCase()}`}
              </h2>
              <button onClick={() => { setShowNewModal(false); resetNewRdvForm(); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Toggle Client existant / Nouveau */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateNewClient(false)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    !createNewClient
                      ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {t('client', false)} existant
                </button>
                <button
                  type="button"
                  onClick={() => setCreateNewClient(true)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    createNewClient
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  + Nouveau {t('client', false).toLowerCase()}
                </button>
              </div>

              {/* Client existant - Recherche */}
              {!createNewClient && (
                <div className="relative" ref={dropdownRef}>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Rechercher {t('client', false).toLowerCase()} *
                  </label>
                  <Input
                    type="text"
                    placeholder="Nom, prénom ou téléphone..."
                    value={clientSearch}
                    onChange={(e) => handleClientSearch(e.target.value)}
                    onFocus={() => setShowClientDropdown(true)}
                  />
                  {showClientDropdown && clients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {clients.map((client) => {
                        const isPro = client.type_client === 'professionnel' || !!client.raison_sociale;
                        const displayName = isPro && client.raison_sociale
                          ? client.raison_sociale
                          : `${client.prenom} ${client.nom}`;
                        return (
                          <button
                            key={client.id}
                            onClick={() => selectClient(client)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {displayName}
                              </p>
                              {isPro && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                              )}
                            </div>
                            {isPro && client.raison_sociale && (
                              <p className="text-xs text-gray-400">Contact: {client.prenom} {client.nom}</p>
                            )}
                            <p className="text-sm text-gray-500">{client.telephone}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Nouveau client - Formulaire */}
              {createNewClient && (
                <div className="space-y-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">Nouveau {t('client', false).toLowerCase()}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Prénom *</label>
                      <Input
                        type="text"
                        placeholder="Marie"
                        value={newClientForm.prenom}
                        onChange={(e) => setNewClientForm({ ...newClientForm, prenom: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nom *</label>
                      <Input
                        type="text"
                        placeholder="Dupont"
                        value={newClientForm.nom}
                        onChange={(e) => setNewClientForm({ ...newClientForm, nom: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Téléphone *</label>
                      <Input
                        type="tel"
                        placeholder="06 12 34 56 78"
                        value={newClientForm.telephone}
                        onChange={(e) => setNewClientForm({ ...newClientForm, telephone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Email</label>
                      <Input
                        type="email"
                        placeholder="email@exemple.fr"
                        value={newClientForm.email}
                        onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* === PÉRIODE (Mode Horaire - avant les services) === */}
              {isPricingMode('hourly') && (
                <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                    Période de la {t('reservation', false).toLowerCase()} *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Du *</label>
                      <Input
                        type="date"
                        value={newRdvForm.date_rdv}
                        onChange={(e) => handleDateHeureChange('date_rdv', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Au *</label>
                      <Input
                        type="date"
                        value={newRdvForm.date_fin || newRdvForm.date_rdv}
                        onChange={(e) => setNewRdvForm({ ...newRdvForm, date_fin: e.target.value })}
                        min={newRdvForm.date_rdv}
                      />
                    </div>
                  </div>
                  {newRdvForm.date_rdv && newRdvForm.date_fin && newRdvForm.date_fin !== newRdvForm.date_rdv && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin)} jour(s)
                    </p>
                  )}
                </div>
              )}

              {/* === MULTI-SERVICES === */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                  {t('service', true)} * <span className="text-gray-400 font-normal">(multi-sélection)</span>
                </label>

                {/* Liste des services ajoutés avec assignation salarié */}
                {serviceLignes.length > 0 && (
                  <div className="space-y-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    {serviceLignes.map((ligne) => {
                      // Calcul du prix affiché selon le mode
                      const pricingMode = profile?.pricing?.mode || 'fixed';
                      const tauxHoraire = ligne.taux_horaire || ligne.prix_unitaire;
                      const heures = pricingMode === 'hourly' && newRdvForm.heure_rdv && newRdvForm.heure_fin
                        ? calculateHours(newRdvForm.heure_rdv, newRdvForm.heure_fin)
                        : 0;
                      const prixLigne = pricingMode === 'hourly'
                        ? Math.round(tauxHoraire * heures * newRdvForm.nb_agents)
                        : ligne.prix_unitaire * ligne.quantite;

                      return (
                      <div key={ligne.service_id} className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                        {/* Ligne 1: Service + Info tarif */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ligne.service_nom}</p>
                            <p className="text-xs text-gray-500">
                              {pricingMode === 'hourly' ? (
                                <>{(tauxHoraire / 100).toFixed(2)}€/h</>
                              ) : (
                                <>{ligne.duree_minutes}min · {(ligne.prix_unitaire / 100).toFixed(2)}€/unité</>
                              )}
                            </p>
                          </div>
                          {/* Quantité uniquement en mode fixe */}
                          {pricingMode !== 'hourly' && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateServiceQuantite(ligne.service_id, ligne.quantite - 1)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                              >
                                <MinusCircle className="w-4 h-4 text-gray-500" />
                              </button>
                              <span className="w-6 text-center text-sm font-medium">{ligne.quantite}</span>
                              <button
                                type="button"
                                onClick={() => updateServiceQuantite(ligne.service_id, ligne.quantite + 1)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                              >
                                <PlusCircle className="w-4 h-4 text-cyan-500" />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeServiceLigne(ligne.service_id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded ml-2"
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </button>
                          <div className="text-right min-w-[80px]">
                            {pricingMode === 'hourly' && heures > 0 ? (
                              <div>
                                <p className="text-sm font-semibold text-green-600">
                                  {(prixLigne / 100).toFixed(2)}€
                                </p>
                                <p className="text-xs text-gray-400">
                                  {heures}h × {newRdvForm.nb_agents} {t('employee', newRdvForm.nb_agents > 1).toLowerCase()}
                                </p>
                              </div>
                            ) : pricingMode === 'hourly' ? (
                              <p className="text-xs text-amber-600">Saisir les heures</p>
                            ) : (
                              <p className="text-sm font-semibold text-green-600">
                                {(prixLigne / 100).toFixed(2)}€
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Affectations multiples (une par quantité) */}
                        {(ligne.affectations || []).map((affectation, affIdx) => (
                          <div key={affIdx} className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                            {/* Label si plusieurs affectations */}
                            {ligne.quantite > 1 && (
                              <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                                Affectation #{affIdx + 1}
                              </p>
                            )}

                            {/* Assignation salarié */}
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <select
                                value={affectation.membre_id || ''}
                                onChange={(e) => updateAffectation(
                                  ligne.service_id,
                                  affIdx,
                                  'membre_id',
                                  e.target.value ? parseInt(e.target.value) : undefined
                                )}
                                className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="">-- Assigner {t('employee', false).toLowerCase()} --</option>
                                {newRdvForm.date_rdv && newRdvForm.heure_rdv ? (
                                  <>
                                    {membresDisponibles.length > 0 && (
                                      <optgroup label="✓ Disponibles">
                                        {membresDisponibles.map((m) => (
                                          <option key={m.id} value={m.id}>
                                            {m.prenom} {m.nom} ({m.role})
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {membresOccupes.length > 0 && (
                                      <optgroup label="✗ Occupés">
                                        {membresOccupes.map((m) => (
                                          <option key={m.id} value={m.id} className="text-gray-400">
                                            {m.prenom} {m.nom} - {m.raison}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </>
                                ) : (
                                  membres.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.prenom} {m.nom} ({m.role})
                                    </option>
                                  ))
                                )}
                              </select>
                              {affectation.membre_id && (
                                <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                              )}
                            </div>

                            {/* Horaires pour cette affectation */}
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="time"
                                  value={affectation.heure_debut || ''}
                                  onChange={(e) => updateAffectation(
                                    ligne.service_id,
                                    affIdx,
                                    'heure_debut',
                                    e.target.value
                                  )}
                                  className="px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  placeholder="Début"
                                />
                                <span className="text-gray-400 text-sm">→</span>
                                <input
                                  type="time"
                                  value={affectation.heure_fin || ''}
                                  onChange={(e) => updateAffectation(
                                    ligne.service_id,
                                    affIdx,
                                    'heure_fin',
                                    e.target.value
                                  )}
                                  className="px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  placeholder="Fin"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                    })}
                  </div>
                )}

                {/* Dropdown pour ajouter un service */}
                <div className="flex gap-2">
                  <select
                    id="add-service-select"
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addServiceLigne(parseInt(e.target.value));
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">+ Ajouter un {t('service', false).toLowerCase()}...</option>
                    {services.filter(s => s.actif !== false).map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.nom} — {isPricingMode('hourly') && service.taux_horaire
                          ? `${(service.taux_horaire / 100).toFixed(2)}€/h`
                          : `${(service.prix / 100).toFixed(2)}€ — ${service.duree_minutes}min`
                        }
                      </option>
                    ))}
                  </select>
                </div>

                {serviceLignes.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Sélectionnez au moins un service
                  </p>
                )}
              </div>

              {/* === ADRESSE DE PRESTATION === */}
              <FeatureField feature="clientAddress">
                <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                    Adresse de prestation
                  </label>
                  <textarea
                    value={newRdvForm.adresse_prestation}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, adresse_prestation: e.target.value })}
                    rows={2}
                    placeholder={businessType === 'service_domicile'
                      ? "Adresse du client..."
                      : "Ex: 123 Rue de Paris, 75001 Paris"}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="text-xs text-gray-500">
                    {businessType === 'service_domicile'
                      ? "Indiquez l'adresse complète du client pour le déplacement"
                      : "Indiquez l'adresse où aura lieu la prestation"}
                  </p>
                </div>
              </FeatureField>

              {/* === ADRESSE DE FACTURATION === */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRdvForm.adresse_facturation_identique}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, adresse_facturation_identique: e.target.checked })}
                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Adresse de facturation identique à l'adresse de prestation
                  </span>
                </label>
                {!newRdvForm.adresse_facturation_identique && (
                  <textarea
                    value={newRdvForm.adresse_facturation}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, adresse_facturation: e.target.value })}
                    rows={2}
                    placeholder="Adresse de facturation..."
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                )}
              </div>

              {/* Info disponibilités */}
              {loadingDisponibilites && (
                <p className="text-xs text-gray-400 text-center">Vérification des disponibilités...</p>
              )}
              {newRdvForm.date_rdv && newRdvForm.heure_rdv && !loadingDisponibilites && serviceLignes.length > 0 && (
                <div className="flex gap-4 text-xs justify-center">
                  <span className="text-green-600 dark:text-green-400">
                    {membresDisponibles.length} salarié{membresDisponibles.length > 1 ? 's' : ''} disponible{membresDisponibles.length > 1 ? 's' : ''}
                  </span>
                  {membresOccupes.length > 0 && (
                    <span className="text-gray-400">
                      {membresOccupes.length} occupé{membresOccupes.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              {/* Période de la prestation (Mode NON-Horaire) */}
              {!isPricingMode('hourly') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                  Période de la prestation
                </label>

                {/* Mode Journalier: date_debut et date_fin */}
                {isPricingMode('daily') ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Date début *</label>
                      <Input
                        type="date"
                        value={newRdvForm.date_rdv}
                        onChange={(e) => handleDateHeureChange('date_rdv', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Date fin</label>
                      <Input
                        type="date"
                        value={newRdvForm.date_fin}
                        onChange={(e) => setNewRdvForm({ ...newRdvForm, date_fin: e.target.value })}
                        min={newRdvForm.date_rdv}
                      />
                    </div>
                  </div>
                ) : (
                  // Mode Fixe (par défaut): date/heure début + date/heure fin
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Date début *</label>
                        <Input
                          type="date"
                          value={newRdvForm.date_rdv}
                          onChange={(e) => handleDateHeureChange('date_rdv', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Heure début *</label>
                        <Input
                          type="time"
                          value={newRdvForm.heure_rdv}
                          onChange={(e) => handleDateHeureChange('heure_rdv', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Date fin</label>
                        <Input
                          type="date"
                          value={newRdvForm.date_fin || ''}
                          onChange={(e) => setNewRdvForm({ ...newRdvForm, date_fin: e.target.value })}
                          min={newRdvForm.date_rdv}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Heure fin</label>
                        <Input
                          type="time"
                          value={newRdvForm.heure_fin || ''}
                          onChange={(e) => setNewRdvForm({ ...newRdvForm, heure_fin: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Les disponibilités du personnel seront vérifiées automatiquement
                </p>
              </div>
              )}

              {/* === GESTE COMMERCIAL === */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                  Geste commercial
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newRdvForm.remise_type}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, remise_type: e.target.value })}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Aucune remise</option>
                    <option value="pourcentage">Remise %</option>
                    <option value="montant">Remise €</option>
                  </select>
                  {newRdvForm.remise_type && (
                    <>
                      <Input
                        type="number"
                        min="0"
                        placeholder={newRdvForm.remise_type === 'pourcentage' ? '10' : '20.00'}
                        value={newRdvForm.remise_valeur || ''}
                        onChange={(e) => setNewRdvForm({ ...newRdvForm, remise_valeur: parseFloat(e.target.value) || 0 })}
                      />
                      <select
                        value={newRdvForm.remise_motif}
                        onChange={(e) => setNewRdvForm({ ...newRdvForm, remise_motif: e.target.value })}
                        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Motif...</option>
                        <option value="bienvenue">Bienvenue</option>
                        <option value="fidelite">Fidélité</option>
                        <option value="promo">Promotion</option>
                        <option value="parrainage">Parrainage</option>
                        <option value="autre">Autre</option>
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes</label>
                <textarea
                  value={newRdvForm.notes}
                  onChange={(e) => setNewRdvForm({ ...newRdvForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Notes additionnelles..."
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* === RÉCAPITULATIF === */}
              {serviceLignes.length > 0 && (() => {
                const totals = calculateTotals();
                const heures = Math.floor(totals.dureeTotale / 60);
                const minutes = totals.dureeTotale % 60;
                const dureeStr = heures > 0 ? `${heures}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}` : `${minutes}min`;

                return (
                  <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-4 space-y-2 border border-cyan-200 dark:border-cyan-800">
                    {/* Mode horaire: afficher détail du calcul */}
                    {totals.pricingMode === 'hourly' && totals.nbAgents > 0 && (
                      <div className="text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30 rounded p-2 mb-2">
                        <span className="font-medium">Mode horaire:</span>{' '}
                        {totals.nbAgents} {t('employee', totals.nbAgents > 1).toLowerCase()} × {totals.nbJours} jour{totals.nbJours > 1 ? 's' : ''}
                        <span className="block mt-1 text-cyan-600 dark:text-cyan-500">
                          Total: {Math.round(totals.dureeTotale / 60)}h de vacation
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Sous-total {t('service', true).toLowerCase()}:
                      </span>
                      <span className="font-medium">{(totals.sousTotalServices / 100).toFixed(2)} EUR</span>
                    </div>
                    <FeatureField feature="travelFees">
                      {totals.fraisDeplacement > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Frais déplacement:</span>
                          <span className="font-medium">{(totals.fraisDeplacement / 100).toFixed(2)} EUR</span>
                        </div>
                      )}
                    </FeatureField>
                    {totals.remise > 0 && (
                      <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                        <span>Remise ({newRdvForm.remise_type === 'pourcentage' ? `${newRdvForm.remise_valeur}%` : 'fixe'}):</span>
                        <span className="font-medium">-{(totals.remise / 100).toFixed(2)} EUR</span>
                      </div>
                    )}
                    <div className="border-t border-cyan-200 dark:border-cyan-700 pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Montant HT:</span>
                        <span className="font-medium">{(totals.montantHT / 100).toFixed(2)} EUR</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">TVA (20%):</span>
                        <span className="font-medium">{(totals.tva / 100).toFixed(2)} EUR</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="font-semibold text-gray-900 dark:text-white">Total TTC:</span>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                          {(totals.totalTTC / 100).toFixed(2)} EUR
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-cyan-200 dark:border-cyan-700">
                      <span className="text-gray-600 dark:text-gray-400">{t('duration') || 'Durée totale'}:</span>
                      <span className="font-medium">{dureeStr}</span>
                    </div>
                    {membreIds.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {membreIds.length} {t('employee', membreIds.length > 1).toLowerCase()} assigné{membreIds.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })()}

              {createError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {createError}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex gap-3">
              <Button onClick={() => { setShowNewModal(false); resetNewRdvForm(); }} variant="outline" className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleCreateRdv} disabled={createLoading} className="flex-1">
                {createLoading ? 'Création...' : `Créer ${profile?.id === 'security' ? 'la mission' : t('reservation', false).toLowerCase()}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Paiement - Mode de paiement pour terminé */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowPaymentModal(false); setPendingTermineRdvId(null); }}>
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mode de paiement</h2>
              <button onClick={() => { setShowPaymentModal(false); setPendingTermineRdvId(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sélectionnez le mode de paiement pour marquer cette activité comme terminée.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {MODES_PAIEMENT.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setSelectedModePaiement(mode.value)}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      selectedModePaiement === mode.value
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{mode.icon}</span>
                    <span className={`text-sm font-medium ${
                      selectedModePaiement === mode.value
                        ? 'text-cyan-700 dark:text-cyan-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {mode.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => { setShowPaymentModal(false); setPendingTermineRdvId(null); }}
                  variant="outline"
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleConfirmPaymentAndTermine}
                  disabled={paymentLoading}
                  className="flex-1"
                >
                  {paymentLoading ? 'Validation...' : 'Confirmer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Affectation Personnel - Obligatoire pour terminer */}
      {showMembreModal && pendingTermineRdv && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowMembreModal(false); setPendingTermineRdv(null); }}>
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Affectation du personnel</h2>
              <button onClick={() => { setShowMembreModal(false); setPendingTermineRdv(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Vous devez affecter un membre de l'equipe avant de terminer cette prestation.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Service:</strong> {pendingTermineRdv.service_nom || pendingTermineRdv.service}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Client:</strong> {pendingTermineRdv.clients?.prenom} {pendingTermineRdv.clients?.nom}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Personnel assigne *
                </label>
                <select
                  value={selectedMembreId}
                  onChange={(e) => setSelectedMembreId(parseInt(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value={0}>-- Selectionnez un membre --</option>
                  {membres.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.prenom} {m.nom} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => { setShowMembreModal(false); setPendingTermineRdv(null); }}
                  variant="outline"
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleConfirmTermineWithMembre}
                  disabled={membreLoading || !selectedMembreId}
                  className="flex-1"
                >
                  {membreLoading ? 'Validation...' : 'Terminer la prestation'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ServiceLayout>
  );
}
