/**
 * Activités - Page orchestrateur des activités business NEXUS
 * Délègue le rendu aux sous-composants dans @/components/activites/
 * Conserve les queries, mutations et état partagé au niveau supérieur
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Plus, RefreshCw, X } from 'lucide-react';
import { api } from '../lib/api';
import { ServiceLayout } from '../components/layout/ServiceLayout';
import { Button } from '../components/ui/button';
import { useProfile } from '../contexts/ProfileContext';
import {
  PrestationsListe,
  ParametresTab,
  DetailModal,
  EditModal,
  NewReservationModal,
  PaymentModal,
  MembreModal,
  CheckoutModal,
} from '../components/activites';
import type {
  Client,
  Service,
  Membre,
  Reservation,
  ReservationService,
  ServiceLigne,
  ServiceAffectation,
  EditLigne,
  Filters,
  Stats,
  EditForm,
  NewRdvForm,
  NewClientForm,
  Totals,
  CheckoutItem,
  MembresResponse,
  MembresDisponiblesResponse,
  ClientCreateResponse,
  ReservationDetailResponse,
} from '../components/activites/types';
import {
  STATUS_CONFIG,
  formatDate,
  calculateEndTime,
  calculateHours,
  calculateDays,
  calculateNights,
  DEFAULT_NEW_RDV_FORM,
  DEFAULT_NEW_CLIENT_FORM,
  DEFAULT_FILTERS,
} from '../components/activites/types';
import { detectMajoration } from '../lib/majorations';

// Tabs de navigation
const tabs = [
  { label: 'Prestations', path: '/activites' },
  { label: 'Historique', path: '/activites/historique' },
  { label: 'Paramètres', path: '/activites/parametres' },
];

export default function Activites() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, t, isPricingMode, isFieldVisible: _isFieldVisible, hasFeature: _hasFeature, businessType, isBusinessType } = useProfile();

  // Déterminer l'onglet actif
  const currentTab = location.pathname.includes('/historique')
    ? 'historique'
    : location.pathname.includes('/parametres')
      ? 'parametres'
      : 'planning';

  // === États principaux ===
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ aujourd_hui: 0, semaine: 0, en_attente: 0 });
  const [services, setServices] = useState<Service[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [error, setError] = useState('');

  // === Modals ===
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRdv, setSelectedRdv] = useState<Reservation | null>(null);
  const [editingRdv, setEditingRdv] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ service_nom: '', date: '', heure: '', statut: '', notes: '', membre_id: 0, table_id: 0, nb_couverts: 2, chambre_id: 0, nb_personnes: 2, date_checkout: '', heure_checkout: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editLignes, setEditLignes] = useState<EditLigne[]>([]);

  // Modal paiement
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingTermineRdvId, setPendingTermineRdvId] = useState<number | null>(null);
  const [selectedModePaiement, setSelectedModePaiement] = useState('cb');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Modal affectation personnel
  const [showMembreModal, setShowMembreModal] = useState(false);
  const [pendingTermineRdv, setPendingTermineRdv] = useState<Reservation | null>(null);
  const [selectedMembreId, setSelectedMembreId] = useState<number>(0);
  const [membreLoading, setMembreLoading] = useState(false);

  // Modal checkout restaurant
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [pendingCheckoutRdv, setPendingCheckoutRdv] = useState<Reservation | null>(null);
  const [_checkoutLoading, setCheckoutLoading] = useState(false);
  const [pendingCheckoutData, setPendingCheckoutData] = useState<{ items: CheckoutItem[]; total: number; mode_paiement: string } | null>(null);

  // === Création RDV ===
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [createNewClient, setCreateNewClient] = useState(false);
  const [serviceLignes, setServiceLignes] = useState<ServiceLigne[]>([]);
  const [membreIds, setMembreIds] = useState<number[]>([]);
  const [membresDisponibles, setMembresDisponibles] = useState<Membre[]>([]);
  const [membresOccupes, setMembresOccupes] = useState<(Membre & { raison?: string })[]>([]);
  const [loadingDisponibilites, setLoadingDisponibilites] = useState(false);
  const [newRdvForm, setNewRdvForm] = useState<NewRdvForm>({ ...DEFAULT_NEW_RDV_FORM });
  const [newClientForm, setNewClientForm] = useState<NewClientForm>({ ...DEFAULT_NEW_CLIENT_FORM });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [requireDeposit, setRequireDeposit] = useState(false);

  // Horaires d'ouverture du salon
  const [horairesOuverture, setHorairesOuverture] = useState<Array<{
    jour: number; heure_debut: string | null; heure_fin: string | null; is_active: boolean;
  }>>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // === Charger horaires d'ouverture ===
  useEffect(() => {
    api.get<{ horaires: Array<{ jour: number; heure_debut: string | null; heure_fin: string | null; is_active: boolean }> }>('/admin/disponibilites/horaires')
      .then(res => { if (res?.horaires) setHorairesOuverture(res.horaires); })
      .catch(() => {});
  }, []);

  // === Fermer dropdown au clic extérieur ===
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // === Charger config acompte ===
  useEffect(() => {
    api.get<{ enabled: boolean }>('/admin/profile/deposit-config')
      .then((res) => {
        const enabled = !!res?.enabled;
        setDepositEnabled(enabled);
        setRequireDeposit(enabled); // Défaut: acompte demandé si activé pour le tenant
      })
      .catch(() => {});
  }, []);

  // === FETCH DATA ===

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort: 'date',
        order: 'desc'
      });

      if (filters.statut !== 'tous') {
        params.append('statut', filters.statut);
      }
      if (filters.service) {
        params.append('service', filters.service);
      }

      const today = new Date().toISOString().split('T')[0];

      if (currentTab === 'historique') {
        params.append('date_fin', today);
        params.set('order', 'desc');
      } else {
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

      const { items: rawReservations, pagination } = await api.getPaginated<Reservation>(`/admin/reservations?${params}`);

      const normalized = rawReservations.map((r: Reservation) => {
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
          prix: (r.services && r.services.length > 0)
            ? r.services.reduce((sum: number, s: { prix_total?: number }) => sum + (s.prix_total || 0), 0)
            : (r.prix_total ?? r.montant ?? r.prix ?? 0),
        };
      });

      setReservations(normalized);
      setTotalPages(pagination.pages || 1);
    } catch {
      setError('Impossible de charger les prestations');
    } finally {
      setLoading(false);
    }
  }, [filters, page, currentTab]);

  const fetchStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayData = await api.getPaginated<Reservation>(`/admin/reservations?date_debut=${today}&date_fin=${today}`);

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const weekData = await api.getPaginated<Reservation>(`/admin/reservations?date_debut=${startOfWeek.toISOString().split('T')[0]}&date_fin=${endOfWeek.toISOString().split('T')[0]}`);

      const waitingData = await api.getPaginated<Reservation>(`/admin/reservations?statut=en_attente`);

      setStats({
        aujourd_hui: todayData.pagination.total || todayData.items.length,
        semaine: weekData.pagination.total || weekData.items.length,
        en_attente: waitingData.pagination.total || waitingData.items.length
      });
    } catch {
      setError('Impossible de charger les statistiques');
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const { items } = await api.getPaginated<Service>('/admin/services');
      setServices(items);
    } catch {
      setError('Impossible de charger les services');
    }
  }, []);

  const fetchMembres = useCallback(async () => {
    try {
      const raw = await api.get<MembresResponse[] | { data: MembresResponse[] }>('/admin/services/equipe');
      const list = Array.isArray(raw) ? raw : (raw as any).data || [];
      setMembres(list.filter((m: MembresResponse) => m.statut === 'actif'));
    } catch {
      setError('Impossible de charger les membres');
    }
  }, []);

  useEffect(() => {
    fetchReservations();
    fetchStats();
    fetchServices();
    fetchMembres();
  }, [fetchReservations, fetchStats, fetchServices, fetchMembres]);

  // === CLIENTS ===

  const handleClientSearch = (value: string) => {
    setClientSearch(value);
    setShowClientDropdown(true);

    // Debounce search API calls (300ms)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value || value.length < 2) {
      setClients([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const { items } = await api.getPaginated<Client>(`/admin/clients?search=${encodeURIComponent(value)}&limit=10`);
        setClients(items);
      } catch {
        setError('Impossible de rechercher les clients');
      }
    }, 300);
  };

  const selectClient = (client: Client) => {
    const adresseComplete = [client.adresse, client.code_postal, client.ville].filter(Boolean).join(', ');
    setNewRdvForm({
      ...newRdvForm,
      client_id: client.id,
      adresse_prestation: adresseComplete || newRdvForm.adresse_prestation
    });
    const isPro = client.type_client === 'professionnel' || !!client.raison_sociale;
    const displayName = isPro && client.raison_sociale
      ? client.raison_sociale
      : `${client.prenom} ${client.nom}`;
    setClientSearch(`${displayName} - ${client.telephone}`);
    setShowClientDropdown(false);
  };

  // === DISPONIBILITÉS ===

  const fetchMembresDisponibles = async (date: string, heure: string, duree: number) => {
    if (!date || !heure) {
      setMembresDisponibles(membres);
      setMembresOccupes([]);
      return;
    }
    setLoadingDisponibilites(true);
    try {
      const data = await api.get<MembresDisponiblesResponse>(
        `/admin/services/equipe/disponibles?date=${date}&heure=${heure}&duree=${duree}`
      );
      setMembresDisponibles(data.disponibles || []);
      setMembresOccupes([...(data.occupes || []), ...(data.non_travail || [])]);
    } catch {
      setMembresDisponibles(membres);
      setMembresOccupes([]);
    } finally {
      setLoadingDisponibilites(false);
    }
  };

  const handleDateHeureChange = (field: 'date_rdv' | 'heure_rdv', value: string) => {
    const newForm = { ...newRdvForm, [field]: value };
    setNewRdvForm(newForm);

    const dureeTotale = serviceLignes.reduce(
      (sum, sl) => sum + sl.duree_minutes * sl.quantite,
      60
    );

    const date = field === 'date_rdv' ? value : newRdvForm.date_rdv;
    const heure = field === 'heure_rdv' ? value : newRdvForm.heure_rdv;

    if (date && heure) {
      fetchMembresDisponibles(date, heure, dureeTotale);
    }
  };

  // === MULTI-SERVICES ===

  const addServiceLigne = (serviceId: number) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    const pricingMode = service.pricing_mode || profile?.pricing?.mode || 'fixed';
    let newLignes: ServiceLigne[];

    if (serviceLignes.some(sl => sl.service_id === serviceId)) {
      newLignes = serviceLignes.map(sl => {
        if (sl.service_id === serviceId) {
          const newQuantite = sl.quantite + 1;
          const newAffectations = [...sl.affectations, { index: newQuantite - 1 }];
          return { ...sl, quantite: newQuantite, affectations: newAffectations };
        }
        return sl;
      });
    } else {
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

    // Domicile solo : cascader les heures sur tous les services
    if (isBusinessType('service_domicile')) {
      const firstHeure = newLignes.flatMap(sl => sl.affectations).find(a => a.heure_debut)?.heure_debut;
      if (firstHeure) {
        newLignes = cascadeAllTimes(newLignes, firstHeure);
      }
    }

    setServiceLignes(newLignes);

    const heureRef = newRdvForm.heure_rdv || newLignes.flatMap(sl => sl.affectations).find(a => a.heure_debut)?.heure_debut;
    if (newRdvForm.date_rdv && heureRef) {
      const dureeTotale = newLignes.reduce((sum, sl) => sum + sl.duree_minutes * sl.quantite, 0);
      fetchMembresDisponibles(newRdvForm.date_rdv, heureRef, dureeTotale);
    }
  };

  const removeServiceLigne = (serviceId: number) => {
    let newLignes = serviceLignes.filter(sl => sl.service_id !== serviceId);

    // Domicile solo : recascader les heures
    if (isBusinessType('service_domicile')) {
      const firstHeure = newLignes.flatMap(sl => sl.affectations).find(a => a.heure_debut)?.heure_debut;
      if (firstHeure) {
        newLignes = cascadeAllTimes(newLignes, firstHeure);
      }
    }

    setServiceLignes(newLignes);

    const heureRef = newRdvForm.heure_rdv || newLignes.flatMap(sl => sl.affectations).find(a => a.heure_debut)?.heure_debut;
    if (newRdvForm.date_rdv && heureRef) {
      const dureeTotale = newLignes.reduce((sum, sl) => sum + sl.duree_minutes * sl.quantite, 60);
      fetchMembresDisponibles(newRdvForm.date_rdv, heureRef, dureeTotale);
    }
  };

  const updateServiceQuantite = (serviceId: number, quantite: number) => {
    if (quantite < 1) {
      removeServiceLigne(serviceId);
      return;
    }

    const newLignes = serviceLignes.map(sl => {
      if (sl.service_id !== serviceId) return sl;

      let newAffectations = [...(sl.affectations || [])];
      const currentCount = newAffectations.length;

      if (quantite > currentCount) {
        for (let i = currentCount; i < quantite; i++) {
          newAffectations.push({ index: i });
        }
      } else if (quantite < currentCount) {
        newAffectations = newAffectations.slice(0, quantite);
      }

      return { ...sl, quantite, affectations: newAffectations };
    });

    // Domicile solo : recascader les heures
    let finalLignes = newLignes;
    if (isBusinessType('service_domicile')) {
      const firstHeure = newLignes.flatMap(sl => sl.affectations).find(a => a.heure_debut)?.heure_debut;
      if (firstHeure) {
        finalLignes = cascadeAllTimes(newLignes, firstHeure);
      }
    }
    setServiceLignes(finalLignes);

    const heureRef = newRdvForm.heure_rdv || finalLignes.flatMap(sl => sl.affectations).find(a => a.heure_debut)?.heure_debut;
    if (newRdvForm.date_rdv && heureRef) {
      const dureeTotale = finalLignes.reduce((sum, sl) => sum + sl.duree_minutes * sl.quantite, 0);
      fetchMembresDisponibles(newRdvForm.date_rdv, heureRef, dureeTotale);
    }
  };

  /**
   * Calcule le planning multi-jours quand la durée dépasse les heures d'ouverture.
   * Retourne les jours avec heures de travail et la date de fin.
   */
  const calculateMultiDaySchedule = useCallback((
    startDate: string,
    startTime: string,
    totalMinutes: number
  ): { jours: Array<{ date: string; debut: string; fin: string; minutes: number }>; dateFin: string } => {
    const jours: Array<{ date: string; debut: string; fin: string; minutes: number }> = [];
    let remaining = totalMinutes;
    let currentDate = new Date(startDate + 'T12:00:00'); // noon to avoid timezone issues

    const getHoraires = (date: Date) => {
      const dow = date.getDay(); // 0=dim
      const h = horairesOuverture.find(ho => ho.jour === dow);
      if (!h || !h.is_active || !h.heure_debut || !h.heure_fin) return null;
      return { open: h.heure_debut, close: h.heure_fin };
    };

    // Premier jour : commence à startTime
    const firstH = getHoraires(currentDate);
    if (firstH) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [ch, cm] = firstH.close.split(':').map(Number);
      const startMin = sh * 60 + (sm || 0);
      const closeMin = ch * 60 + (cm || 0);
      const availableMin = Math.max(closeMin - startMin, 0);
      const workMin = Math.min(remaining, availableMin);
      if (workMin > 0) {
        const finMin = startMin + workMin;
        jours.push({
          date: currentDate.toISOString().slice(0, 10),
          debut: startTime,
          fin: `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`,
          minutes: workMin,
        });
        remaining -= workMin;
      }
    }

    // Jours suivants
    let safety = 0;
    while (remaining > 0 && safety < 60) {
      safety++;
      currentDate.setDate(currentDate.getDate() + 1);
      const h = getHoraires(currentDate);
      if (!h) continue; // jour fermé, on saute

      const [oh, om] = h.open.split(':').map(Number);
      const [ch2, cm2] = h.close.split(':').map(Number);
      const openMin = oh * 60 + (om || 0);
      const closeMin2 = ch2 * 60 + (cm2 || 0);
      const availableMin = closeMin2 - openMin;
      const workMin = Math.min(remaining, availableMin);

      if (workMin > 0) {
        const finMin = openMin + workMin;
        jours.push({
          date: currentDate.toISOString().slice(0, 10),
          debut: h.open,
          fin: `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`,
          minutes: workMin,
        });
        remaining -= workMin;
      }
    }

    const dateFin = jours.length > 0 ? jours[jours.length - 1].date : startDate;
    return { jours, dateFin };
  }, [horairesOuverture]);

  /**
   * Cappe l'heure de fin à la fermeture du salon pour le jour donné.
   * Si la prestation dépasse, heure_fin = fermeture et date_fin auto-calculée.
   */
  const capEndTimeToClose = useCallback((startTime: string, dureeMinutes: number, date: string) => {
    if (!date || !startTime || horairesOuverture.length === 0) {
      return { heureFin: calculateEndTime(startTime, dureeMinutes), multiJour: false };
    }
    const dow = new Date(date + 'T12:00:00').getDay();
    const h = horairesOuverture.find(ho => ho.jour === dow);
    if (!h || !h.is_active || !h.heure_fin) {
      return { heureFin: calculateEndTime(startTime, dureeMinutes), multiJour: false };
    }
    const [sh, sm] = startTime.split(':').map(Number);
    const [ch, cm] = h.heure_fin.split(':').map(Number);
    const startMin = sh * 60 + (sm || 0);
    const closeMin = ch * 60 + (cm || 0);
    const endMin = startMin + dureeMinutes;

    if (endMin <= closeMin) {
      return { heureFin: calculateEndTime(startTime, dureeMinutes), multiJour: false };
    }

    // La prestation dépasse la fermeture → capper et marquer multi-jour
    return { heureFin: h.heure_fin, multiJour: true };
  }, [horairesOuverture]);

  /**
   * Recalcule toutes les heures en cascade pour domicile (coiffeur solo).
   * Parcourt TOUS les services et affectations séquentiellement.
   */
  const cascadeAllTimes = (lignes: ServiceLigne[], startTime: string): ServiceLigne[] => {
    let currentStart = startTime;
    return lignes.map(sl => {
      const newAffectations = sl.affectations.map(aff => {
        const heureFin = calculateEndTime(currentStart, sl.duree_minutes);
        const updated = { ...aff, heure_debut: currentStart, heure_fin: heureFin };
        currentStart = heureFin;
        return updated;
      });
      return { ...sl, affectations: newAffectations };
    });
  };

  const updateAffectation = (
    serviceId: number,
    affectationIndex: number,
    field: keyof ServiceAffectation,
    value: number | string | undefined
  ) => {
    setServiceLignes(prev => {
      // Mode domicile (solo) : cascade globale sur TOUS les services
      if (isBusinessType('service_domicile') && field === 'heure_debut' && value) {
        // Trouver la position absolue de cette affectation
        let foundStart = value as string;
        let absoluteIndex = 0;
        let targetAbsolute = 0;
        for (const sl of prev) {
          for (let i = 0; i < sl.affectations.length; i++) {
            if (sl.service_id === serviceId && i === affectationIndex) {
              targetAbsolute = absoluteIndex;
            }
            absoluteIndex++;
          }
        }
        // Recalculer depuis la 1ère affectation en gardant l'heure saisie
        // Si c'est la 1ère affectation globale, cascade tout depuis cette heure
        if (targetAbsolute === 0) {
          return cascadeAllTimes(prev, foundStart);
        }
        // Sinon, garder les heures avant et cascader à partir de celle modifiée
        let currentStart = foundStart;
        let idx = 0;
        return prev.map(sl => {
          const newAffectations = sl.affectations.map(aff => {
            if (idx < targetAbsolute) {
              idx++;
              return aff;
            }
            const heureFin = calculateEndTime(currentStart, sl.duree_minutes);
            const updated = { ...aff, heure_debut: currentStart, heure_fin: heureFin };
            currentStart = heureFin;
            idx++;
            return updated;
          });
          return { ...sl, affectations: newAffectations };
        });
      }

      // Mode salon ou autre champ : cascade locale au service
      return prev.map(sl => {
        if (sl.service_id !== serviceId) return sl;

        const newAffectations = [...sl.affectations];

        if (field === 'membre_id') {
          const membreId = value ? Number(value) : undefined;
          const membre = membreId ? membres.find(m => m.id === membreId) : null;

          newAffectations[affectationIndex] = {
            ...newAffectations[affectationIndex],
            membre_id: membreId,
            membre_nom: membre ? `${membre.prenom} ${membre.nom}` : undefined
          };

          // Auto-cascade synchrone : si le même employé a déjà un créneau dans cette résa,
          // placer ce service juste après + gap entre services + respect pause déjeuner
          if (membreId && !newAffectations[affectationIndex].heure_debut) {
            let latestEnd = '';
            // Chercher la dernière heure_fin de cet employé dans les AUTRES services du formulaire
            for (const otherSl of prev) {
              for (let i = 0; i < otherSl.affectations.length; i++) {
                const aff = otherSl.affectations[i];
                if (aff.membre_id === membreId && aff.heure_fin) {
                  if (otherSl.service_id === serviceId && i === affectationIndex) continue;
                  if (aff.heure_fin > latestEnd) latestEnd = aff.heure_fin;
                }
              }
            }

            if (latestEnd) {
              // Gap entre services (10min par défaut, configurable par employé)
              const gap = membre?.gap_entre_services_minutes ?? 10;
              let startTime = calculateEndTime(latestEnd, gap);

              // Si le créneau chevauche la pause déjeuner de l'employé, décaler après
              const pauseDebut = membre?.pause_debut || '12:00';
              const pauseFin = membre?.pause_fin || '13:00';
              const endTime = calculateEndTime(startTime, sl.duree_minutes);
              if (startTime < pauseFin && endTime > pauseDebut) {
                startTime = pauseFin;
              }

              // Capper l'heure de fin à la fermeture du salon
              const { heureFin, multiJour } = capEndTimeToClose(startTime, sl.duree_minutes, newRdvForm.date_rdv);
              newAffectations[affectationIndex] = {
                ...newAffectations[affectationIndex],
                heure_debut: startTime,
                heure_fin: heureFin
              };
              // Auto-renseigner date_fin si multi-jours
              if (multiJour && newRdvForm.date_rdv) {
                const schedule = calculateMultiDaySchedule(newRdvForm.date_rdv, startTime, sl.duree_minutes);
                setNewRdvForm(f => ({ ...f, date_fin: schedule.dateFin }));
              }
            } else if (newRdvForm.date_rdv) {
              // Aucun créneau existant dans le form → chercher en DB (async)
              const currentDuree = sl.duree_minutes;
              api.get<any>(`/admin/services/equipe/${membreId}/prochaine-dispo?date=${newRdvForm.date_rdv}`)
                .then(res => {
                  const dbDispo = res?.prochaine_dispo || null;
                  if (!dbDispo) return;
                  setServiceLignes(current => {
                    return current.map(s => {
                      if (s.service_id !== serviceId) return s;
                      const affs = [...s.affectations];
                      if (affs[affectationIndex]?.heure_debut) return s;
                      const { heureFin: cappedFin, multiJour: isMulti } = capEndTimeToClose(dbDispo, currentDuree, newRdvForm.date_rdv);
                      affs[affectationIndex] = {
                        ...affs[affectationIndex],
                        heure_debut: dbDispo,
                        heure_fin: cappedFin
                      };
                      if (isMulti && newRdvForm.date_rdv) {
                        const schedule = calculateMultiDaySchedule(newRdvForm.date_rdv, dbDispo, currentDuree);
                        setNewRdvForm(f => ({ ...f, date_fin: schedule.dateFin }));
                      }
                      return { ...s, affectations: affs };
                    });
                  });
                })
                .catch(() => {});
            }
          }
        } else if (field === 'heure_debut' && value) {
          let currentStart = value as string;
          for (let i = affectationIndex; i < newAffectations.length; i++) {
            const { heureFin, multiJour } = capEndTimeToClose(currentStart, sl.duree_minutes, newRdvForm.date_rdv);
            newAffectations[i] = {
              ...newAffectations[i],
              heure_debut: currentStart,
              heure_fin: heureFin
            };
            if (multiJour && newRdvForm.date_rdv) {
              const schedule = calculateMultiDaySchedule(newRdvForm.date_rdv, currentStart, sl.duree_minutes);
              setNewRdvForm(f => ({ ...f, date_fin: schedule.dateFin }));
            }
            currentStart = heureFin;
          }
        } else {
          newAffectations[affectationIndex] = {
            ...newAffectations[affectationIndex],
            [field]: value
          };
        }

        return { ...sl, affectations: newAffectations };
      });
    });
  };

  const updateServiceLigneField = (serviceId: number, field: keyof ServiceLigne, value: string | number) => {
    setServiceLignes(prev => prev.map(sl =>
      sl.service_id === serviceId ? { ...sl, [field]: value } : sl
    ));
  };

  // === CALCULS ===

  const calculateTotals = (): Totals => {
    const pricingMode = profile?.pricing?.mode || 'fixed';
    let sousTotalServices = 0;
    let dureeTotale = 0;

    if (pricingMode === 'hourly') {
      const nbJours = newRdvForm.date_fin && newRdvForm.date_rdv
        ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin)
        : 1;

      let totalHeures = 0;
      let nbAgentsTotal = 0;

      sousTotalServices = serviceLignes.reduce((sum, sl) => {
        const service = services.find(s => s.id === sl.service_id);
        const tauxHoraire = service?.taux_horaire || sl.taux_horaire || sl.prix_unitaire;

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
      const jours = newRdvForm.date_fin
        ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin)
        : 1;
      dureeTotale = jours * 8 * 60;

      sousTotalServices = serviceLignes.reduce((sum, sl) => {
        const service = services.find(s => s.id === sl.service_id);
        const tauxJournalier = service?.taux_journalier || sl.prix_unitaire;
        return sum + Math.round(tauxJournalier * jours * sl.quantite);
      }, 0);
    } else {
      sousTotalServices = serviceLignes.reduce(
        (sum, sl) => sum + sl.prix_unitaire * sl.quantite,
        0
      );
      dureeTotale = serviceLignes.reduce(
        (sum, sl) => sum + sl.duree_minutes * sl.quantite,
        0
      );
    }

    const fraisDeplacement = newRdvForm.lieu === 'domicile' ? newRdvForm.frais_deplacement * 100 : 0;
    const montantAvantRemise = sousTotalServices + fraisDeplacement;

    let remise = 0;
    if (newRdvForm.remise_type === 'pourcentage' && newRdvForm.remise_valeur > 0) {
      remise = Math.round(montantAvantRemise * newRdvForm.remise_valeur / 100);
    } else if (newRdvForm.remise_type === 'montant' && newRdvForm.remise_valeur > 0) {
      remise = newRdvForm.remise_valeur * 100;
    }

    // Majorations auto (security only): nuit/dimanche/férié
    let montantMajorations = 0;
    if (isBusinessType('security')) {
      serviceLignes.forEach(sl => {
        const service = services.find(s => s.id === sl.service_id);
        const tauxHoraire = service?.taux_horaire || sl.taux_horaire || sl.prix_unitaire;
        // Date de référence: date_debut de la ligne ou date globale
        const dateRef = sl.date_debut || newRdvForm.date_rdv;
        if (!dateRef) return;

        if (pricingMode === 'hourly') {
          sl.affectations.forEach(aff => {
            if (!aff.heure_debut || !aff.heure_fin) return;
            const maj = detectMajoration(dateRef, aff.heure_debut, aff.heure_fin);
            if (maj.pourcentage > 0) {
              const heures = calculateHours(aff.heure_debut, aff.heure_fin);
              const nbJ = (sl.date_debut && sl.date_fin)
                ? calculateDays(sl.date_debut, sl.date_fin)
                : (newRdvForm.date_fin && newRdvForm.date_rdv ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin) : 1);
              montantMajorations += Math.round(tauxHoraire * heures * nbJ * maj.pourcentage / 100);
            }
          });
        } else if (pricingMode === 'daily') {
          const tauxJ = service?.taux_journalier || sl.prix_unitaire;
          const nbJ = (sl.date_debut && sl.date_fin)
            ? calculateDays(sl.date_debut, sl.date_fin)
            : (newRdvForm.date_fin && newRdvForm.date_rdv ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin) : 1);
          // Estimate: use 08:00-18:00 as default hours for daily pricing
          const maj = detectMajoration(dateRef, '08:00', '18:00');
          if (maj.pourcentage > 0) {
            montantMajorations += Math.round(tauxJ * nbJ * sl.quantite * maj.pourcentage / 100);
          }
        }
      });
    }

    const montantAvantCnaps = montantAvantRemise - remise + montantMajorations;

    // Calculer CNAPS: s'applique sur le HT de base des services avec taxe_cnaps=true
    let montantCnaps = 0;
    serviceLignes.forEach(sl => {
      const service = services.find(s => s.id === sl.service_id);
      if (service?.taxe_cnaps && (service.taux_cnaps ?? 0) > 0) {
        // CNAPS sur le montant HT de cette ligne
        let ligneHT = 0;
        if (pricingMode === 'hourly') {
          const nbJ = newRdvForm.date_fin && newRdvForm.date_rdv
            ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin) : 1;
          const tauxH = service.taux_horaire || sl.taux_horaire || sl.prix_unitaire;
          sl.affectations.forEach(aff => {
            if (aff.heure_debut && aff.heure_fin) {
              ligneHT += Math.round(tauxH * calculateHours(aff.heure_debut, aff.heure_fin) * nbJ);
            }
          });
        } else if (pricingMode === 'daily') {
          const jours = newRdvForm.date_fin && newRdvForm.date_rdv
            ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin) : 1;
          ligneHT = Math.round((service.taux_journalier || sl.prix_unitaire) * jours * sl.quantite);
        } else {
          ligneHT = sl.prix_unitaire * sl.quantite;
        }
        montantCnaps += Math.round(ligneHT * (service.taux_cnaps ?? 0) / 100);
      }
    });

    const montantHT = montantAvantCnaps + montantCnaps;
    const tva = Math.round(montantHT * 0.2);
    const totalTTC = montantHT + tva;

    const nbJours = newRdvForm.date_fin && newRdvForm.date_rdv
      ? calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin)
      : 1;

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
      montantMajorations,
      montantCnaps,
      montantHT,
      tva,
      totalTTC,
      pricingMode,
      heuresParJour: heuresParAgentMoyenne,
      nbJours,
      nbAgents: nbAgentsEffectif || newRdvForm.nb_agents
    };
  };

  // === HANDLERS ===

  const handleOpenDetail = async (rdv: Reservation) => {
    try {
      const data = await api.get<ReservationDetailResponse>(`/admin/reservations/${rdv.id}`);
      setSelectedRdv(data.reservation || data as unknown as Reservation);
      setShowDetailModal(true);
    } catch {
      setError('Impossible de charger les détails de la prestation');
    }
  };

  const handleChangeStatut = async (rdvId: number, newStatut: string, modePaiement?: string, membreId?: number) => {
    // Restaurant checkout: intercepter "termine" pour ouvrir le modal d'encaissement
    if (newStatut === 'termine' && isBusinessType('restaurant')) {
      const rdv = reservations.find(r => r.id === rdvId);
      if (rdv) {
        setPendingCheckoutRdv(rdv);
        setShowCheckoutModal(true);
      }
      return;
    }

    // Non-restaurant: intercepter "termine" pour ouvrir le modal de paiement
    // Permet d'enregistrer le paiement au niveau prestation (pas via relances)
    if (newStatut === 'termine' && !isBusinessType('restaurant') && !modePaiement) {
      setPendingTermineRdvId(rdvId);
      setShowPaymentModal(true);
      return;
    }

    try {
      const body: { statut: string; membre_id?: number; mode_paiement?: string } = { statut: newStatut };
      if (membreId) {
        body.membre_id = membreId;
      }
      if (modePaiement) {
        body.mode_paiement = modePaiement;
      }
      await api.patch(`/admin/reservations/${rdvId}/statut`, body);
      fetchReservations();
      fetchStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.toLowerCase().includes('membre') && newStatut === 'termine') {
        const rdv = reservations.find(r => r.id === rdvId);
        if (rdv) {
          // Fermer PaymentModal si ouvert (mode_paiement deja sauvegarde dans selectedModePaiement)
          setShowPaymentModal(false);
          setPendingTermineRdvId(null);
          setPendingTermineRdv(rdv);
          setSelectedMembreId(0);
          setShowMembreModal(true);
        }
        return;
      }
      setError(msg || 'Erreur lors du changement de statut');
    }
  };

  const handleConfirmTermineWithMembre = async () => {
    if (!pendingTermineRdv || !selectedMembreId) return;
    setMembreLoading(true);
    try {
      // Si checkout restaurant en attente, envoyer les donnees checkout avec le membre
      if (pendingCheckoutData && isBusinessType('restaurant')) {
        await api.patch(`/admin/reservations/${pendingTermineRdv.id}/statut`, {
          statut: 'termine',
          membre_id: selectedMembreId,
          checkout: {
            items: pendingCheckoutData.items,
            total: pendingCheckoutData.total,
            mode_paiement: pendingCheckoutData.mode_paiement,
          }
        });
        setPendingCheckoutData(null);
        setPendingCheckoutRdv(null);
        setShowMembreModal(false);
        setPendingTermineRdv(null);
        setSelectedMembreId(0);
        fetchReservations();
        fetchStats();
      } else {
        // Passer le mode de paiement selectionne (pour tous les types de business)
        await handleChangeStatut(pendingTermineRdv.id, 'termine', selectedModePaiement || undefined, selectedMembreId);
        setShowMembreModal(false);
        setPendingTermineRdv(null);
        setSelectedMembreId(0);
      }
    } catch {
      setError('Impossible de terminer la prestation avec ce membre');
    } finally {
      setMembreLoading(false);
    }
  };

  const handleCheckoutConfirm = async (data: { items: CheckoutItem[]; total: number; mode_paiement: string }) => {
    if (!pendingCheckoutRdv) return;
    setCheckoutLoading(true);
    try {
      await api.patch(`/admin/reservations/${pendingCheckoutRdv.id}/statut`, {
        statut: 'termine',
        checkout: {
          items: data.items,
          total: data.total,           // en centimes
          mode_paiement: data.mode_paiement,
        }
      });
      setShowCheckoutModal(false);
      setPendingCheckoutRdv(null);
      setPendingCheckoutData(null);
      fetchReservations();
      fetchStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.toLowerCase().includes('membre')) {
        // Membre requis: garder checkout data et ouvrir MembreModal
        setPendingCheckoutData(data);
        setPendingTermineRdv(pendingCheckoutRdv);
        setSelectedMembreId(0);
        setShowMembreModal(true);
        setShowCheckoutModal(false);
      } else {
        setError(msg || 'Erreur lors de l\'encaissement');
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleConfirmPaymentAndTermine = async () => {
    if (!pendingTermineRdvId) return;
    setPaymentLoading(true);
    try {
      await handleChangeStatut(pendingTermineRdvId, 'termine', selectedModePaiement);
      setShowPaymentModal(false);
      setPendingTermineRdvId(null);
    } catch {
      setError('Impossible de valider le paiement');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleOpenEdit = async (rdv: Reservation) => {
    setEditingRdv(rdv);

    // Charger les champs restaurant/hotel via RPC (bypass PostgREST schema cache)
    // api.get unwrappe { data: {...} } → retourne directement le record
    let extraRaw: any = {};
    if (isBusinessType('restaurant') || isBusinessType('hotel')) {
      try {
        extraRaw = await api.get<any>(`/admin/reservations/${rdv.id}/extra`) || {};
      } catch { /* fallback aux donnees rdv */ }
    }
    // Gestion des 2 formats possibles : { data: {...} } ou {...} direct
    const extra: Record<string, any> = extraRaw?.data && typeof extraRaw.data === 'object' ? extraRaw.data : extraRaw;

    setEditForm({
      service_nom: rdv.service_nom || (typeof rdv.service === 'object' ? rdv.service?.nom : rdv.service) || '',
      date: rdv.date || rdv.date_rdv || '',
      heure: rdv.heure || rdv.heure_rdv || '',
      statut: rdv.statut || '',
      notes: rdv.notes || '',
      membre_id: rdv.membre?.id || rdv.membre_id || 0,
      prix_total: Math.round((rdv.prix_total || 0) * 100),
      // Restaurant: extra (RPC) > rdv > service_id > 0
      table_id: extra.table_id || rdv.table_id || extra.service_id || rdv.service_id || 0,
      nb_couverts: extra.nb_couverts || rdv.nb_couverts || 2,
      // Hotel
      chambre_id: extra.chambre_id || rdv.chambre_id || extra.service_id || rdv.service_id || 0,
      nb_personnes: extra.nb_personnes || rdv.nb_personnes || 2,
      date_checkout: extra.date_depart || rdv.date_depart || '',
      // Fix: heure_fin = heure de depart (check-out), pas heure_arrivee
      heure_checkout: extra.heure_fin || rdv.heure_fin || '',
    });

    const lignes: EditLigne[] = (rdv.services || []).map((s: ReservationService & { heure_debut?: string; heure_fin?: string }) => ({
      id: s.id,
      service_nom: s.service_nom,
      quantite: s.quantite || 1,
      membre_id: s.membre?.id || null,
      membre: s.membre || null,
      heure_debut: s.heure_debut || rdv.heure || rdv.heure_rdv || '',
      heure_fin: s.heure_fin || '',
      duree_minutes: s.duree_minutes,
      prix_unitaire: Math.round((s.prix_unitaire || 0) * 100),
      prix_total: Math.round((s.prix_total || 0) * 100),
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
      await api.put(`/admin/reservations/${editingRdv.id}`, {
        service: editForm.service_nom,
        date_rdv: editForm.date,
        heure_rdv: editForm.heure,
        statut: editForm.statut,
        notes: editForm.notes,
        membre_id: editForm.membre_id || null,
        prix_total: editForm.prix_total || undefined,
        lignes: editLignes.length > 0 ? editLignes.map(l => ({
          id: l.id,
          service_nom: l.service_nom,
          heure_debut: l.heure_debut,
          heure_fin: l.heure_fin,
          membre_id: l.membre_id || null,
          prix_total: l.prix_total,
        })) : undefined,
        // Restaurant
        ...(isBusinessType('restaurant') ? {
          nb_couverts: editForm.nb_couverts || null,
          table_id: editForm.table_id || null,
        } : {}),
        // Hotel
        ...(isBusinessType('hotel') ? {
          nb_personnes: editForm.nb_personnes || null,
          chambre_id: editForm.chambre_id || null,
          date_depart: editForm.date_checkout || null,
          heure_fin: editForm.heure_checkout || null,
        } : {}),
      });
      setShowEditModal(false);
      setEditingRdv(null);
      setEditLignes([]);
      fetchReservations();
      fetchStats();
    } catch (error: unknown) {
      setEditError(error instanceof Error ? error.message : 'Erreur lors de la modification');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (rdvId: number) => {
    if (!confirm(`Supprimer définitivement la prestation #${rdvId} ?`)) return;
    try {
      await api.delete(`/admin/reservations/${rdvId}`);
      fetchReservations();
      fetchStats();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Impossible de supprimer la prestation');
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

    // Validation spécifique au type de business
    if (isBusinessType('restaurant')) {
      if (!newRdvForm.table_id) missing.push('Table');
      if (!newRdvForm.date_rdv) missing.push('Date');
      if (!newRdvForm.heure_rdv) missing.push('Heure');
    } else if (isBusinessType('hotel')) {
      if (!newRdvForm.chambre_id) missing.push('Chambre');
      if (!newRdvForm.date_rdv) missing.push('Date d\'arrivée');
      if (!newRdvForm.date_checkout) missing.push('Date de départ');
    } else if (isBusinessType('commerce')) {
      // Commerce ne devrait pas arriver ici (bouton masqué)
      missing.push('Utilisez la page Commandes pour créer une commande');
    } else {
      // Salon / Service domicile / Security
      if (serviceLignes.length === 0) missing.push(`Au moins un ${String(t('service', false)).toLowerCase()}`);
      if (!newRdvForm.date_rdv) missing.push('Date');

      if (pricingMode === 'hourly') {
        const hasValidAffectations = serviceLignes.some(sl =>
          sl.affectations.some(aff => aff.heure_debut && aff.heure_fin)
        );
        if (!hasValidAffectations) {
          missing.push('Heures des agents (définir heure début/fin pour au moins un agent)');
        }
      } else if (pricingMode !== 'daily') {
        if (isBusinessType('service_domicile') || isBusinessType('salon')) {
          // Domicile & Salon : l'heure vient des affectations, pas du champ global
          const hasAffectationHeures = serviceLignes.some(sl =>
            sl.affectations.some(aff => aff.heure_debut && aff.heure_fin)
          );
          if (!hasAffectationHeures) {
            missing.push('Heure de début (saisir dans la 1ère affectation)');
          }
        } else {
          if (!newRdvForm.heure_rdv) missing.push('Heure');
        }
      }
    }

    // Bloquer les créneaux passés (marge 1h)
    if (newRdvForm.date_rdv) {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (newRdvForm.date_rdv === today) {
        const margeMin = (now.getHours() + 1) * 60 + now.getMinutes();
        // Trouver l'heure la plus tôt de la résa
        let earliestStart = newRdvForm.heure_rdv || '';
        for (const sl of serviceLignes) {
          for (const aff of sl.affectations) {
            if (aff.heure_debut && (!earliestStart || aff.heure_debut < earliestStart)) {
              earliestStart = aff.heure_debut;
            }
          }
        }
        if (earliestStart) {
          const [h, m] = earliestStart.split(':').map(Number);
          if (h * 60 + m < margeMin) {
            const minStr = `${String(Math.floor(margeMin / 60)).padStart(2, '0')}:${String(margeMin % 60).padStart(2, '0')}`;
            setCreateError(`Créneau passé — le prochain créneau disponible aujourd'hui est à partir de ${minStr}`);
            return;
          }
        }
      }
    }

    if (missing.length > 0) {
      setCreateError(`Champs manquants: ${missing.join(', ')}`);
      return;
    }

    setCreateLoading(true);
    setCreateError('');

    try {
      let clientId = newRdvForm.client_id;

      if (createNewClient) {
        const clientData = await api.post<ClientCreateResponse>('/admin/clients', newClientForm);
        clientId = clientData.client?.id ?? clientData.id ?? 0;
      }

      // Construire le payload selon le type de business
      if (isBusinessType('restaurant')) {
        // Restaurant: table + couverts + date/heure
        const selectedTable = services.find(s => s.id === newRdvForm.table_id);
        await api.post('/admin/reservations', {
          client_id: clientId,
          service: selectedTable?.nom || `Table #${newRdvForm.table_id}`,
          date_rdv: newRdvForm.date_rdv,
          heure_rdv: newRdvForm.heure_rdv,
          notes: newRdvForm.notes,
          services: [{
            service_id: newRdvForm.table_id,
            service_nom: selectedTable?.nom || `Table #${newRdvForm.table_id}`,
            quantite: 1,
            prix_unitaire: 0,
            duree_minutes: 90,
          }],
          nb_couverts: newRdvForm.nb_couverts || 2,
          remise_type: newRdvForm.remise_type || null,
          remise_valeur: newRdvForm.remise_valeur || 0,
          remise_motif: newRdvForm.remise_motif || null,
          prix_total: 0,
          require_deposit: requireDeposit && depositEnabled,
        });
      } else if (isBusinessType('hotel')) {
        // Hotel: chambre (type_chambre != null) + check-in/check-out + extras (annexes)
        const selectedRoom = services.find(s => s.id === newRdvForm.chambre_id);
        // Calcul nuits (checkout - checkin, min 1 pour eviter prix 0 si dates identiques)
        const nbNuits = Math.max(1, calculateNights(newRdvForm.date_rdv, newRdvForm.date_checkout));
        // Extras = services annexes dont le nom est dans form.extras
        // Quantite : nb_nuits si facturation=par_nuit, sinon 1
        const selectedExtras = (newRdvForm.extras || [])
          .map(nom => services.find(s => s.nom === nom && !s.type_chambre))
          .filter((s): s is typeof services[0] => !!s)
          .map(s => ({
            ...s,
            quantite: s.facturation === 'par_nuit' ? nbNuits : 1,
          }));
        const extrasTotal = selectedExtras.reduce(
          (sum, s) => sum + (s.prix || 0) * s.quantite,
          0
        );
        const prixTotal = (selectedRoom?.prix || 0) * nbNuits + extrasTotal;

        await api.post('/admin/reservations', {
          client_id: clientId,
          service: selectedRoom?.nom || `Chambre #${newRdvForm.chambre_id}`,
          date_rdv: newRdvForm.date_rdv,
          heure_rdv: newRdvForm.heure_checkin || '14:00',
          date_fin: newRdvForm.date_checkout,
          heure_fin: newRdvForm.heure_checkout || '11:00',
          notes: newRdvForm.notes,
          services: [
            {
              service_id: newRdvForm.chambre_id,
              service_nom: selectedRoom?.nom || `Chambre #${newRdvForm.chambre_id}`,
              quantite: nbNuits,
              prix_unitaire: selectedRoom?.prix || 0,
              duree_minutes: 0,
            },
            ...selectedExtras.map(extra => ({
              service_id: extra.id,
              service_nom: extra.nom,
              quantite: extra.quantite,
              prix_unitaire: extra.prix || 0,
              duree_minutes: 0,
            })),
          ],
          nb_personnes: newRdvForm.nb_personnes || 2,
          extras: newRdvForm.extras || [],
          remise_type: newRdvForm.remise_type || null,
          remise_valeur: newRdvForm.remise_valeur || 0,
          remise_motif: newRdvForm.remise_motif || null,
          prix_total: prixTotal,
          require_deposit: requireDeposit && depositEnabled,
        });
      } else {
        // Salon / Service domicile: multi-services + multi-membres
        const totals = calculateTotals();

        const membreIdsFromServices: number[] = [];
        serviceLignes.forEach(sl => {
          if (sl.membre_id) {
            membreIdsFromServices.push(sl.membre_id);
          }
          sl.affectations.forEach(aff => {
            if (aff.membre_id) {
              membreIdsFromServices.push(aff.membre_id);
            }
          });
        });
        const uniqueMembreIds = [...new Set(membreIdsFromServices)];

        await api.post('/admin/reservations', {
          client_id: clientId,
          service: serviceLignes[0]?.service_nom || '',
          date_rdv: newRdvForm.date_rdv,
          heure_rdv: newRdvForm.heure_rdv || serviceLignes[0]?.affectations[0]?.heure_debut || null,
          heure_fin: newRdvForm.heure_fin || null,
          date_fin: newRdvForm.date_fin || null,
          nb_agents: newRdvForm.nb_agents || 1,
          pricing_mode: profile?.pricing?.mode || 'fixed',
          lieu: isBusinessType('service_domicile') ? 'domicile' : (newRdvForm.adresse_prestation ? 'custom' : 'salon'),
          adresse_client: newRdvForm.adresse_prestation,
          adresse_facturation: newRdvForm.adresse_facturation_identique
            ? newRdvForm.adresse_prestation
            : newRdvForm.adresse_facturation,
          notes: newRdvForm.notes,
          services: serviceLignes.flatMap(sl => {
            const baseService: Record<string, any> = {
              service_id: sl.service_id,
              service_nom: sl.service_nom,
              quantite: sl.quantite,
              prix_unitaire: sl.prix_unitaire,
              duree_minutes: sl.duree_minutes,
              membre_id: sl.membre_id || null,
              taux_horaire: sl.taux_horaire || null,
              affectations: sl.affectations.map(aff => ({
                membre_id: aff.membre_id,
                heure_debut: aff.heure_debut,
                heure_fin: aff.heure_fin
              }))
            };
            // Plage de dates par ligne (security / multi-day)
            if (sl.date_debut) baseService.date_debut = sl.date_debut;
            if (sl.date_fin) baseService.date_fin = sl.date_fin;

            // Multi-jours : ajouter les lignes des jours suivants
            if (newRdvForm.date_fin && newRdvForm.date_rdv && newRdvForm.date_fin > newRdvForm.date_rdv) {
              const firstAff = sl.affectations.find(a => a.heure_debut);
              if (firstAff?.heure_debut && sl.duree_minutes > 480) {
                const schedule = calculateMultiDaySchedule(newRdvForm.date_rdv, firstAff.heure_debut, sl.duree_minutes);
                if (schedule.jours.length > 1) {
                  // Jour 1 : heures déjà dans baseService, juste capper la durée
                  const jour1 = schedule.jours[0];
                  baseService.affectations = sl.affectations.map(aff => ({
                    membre_id: aff.membre_id,
                    heure_debut: jour1.debut,
                    heure_fin: jour1.fin,
                  }));
                  baseService.duree_minutes = jour1.minutes;

                  // Jours suivants : lignes supplémentaires avec date
                  const extraDays = schedule.jours.slice(1).map(j => ({
                    service_id: sl.service_id,
                    service_nom: sl.service_nom,
                    quantite: 1,
                    prix_unitaire: 0, // prix déjà compté sur jour 1
                    duree_minutes: j.minutes,
                    membre_id: sl.membre_id || null,
                    taux_horaire: sl.taux_horaire || null,
                    date: j.date, // date spécifique pour cette ligne
                    affectations: sl.affectations.map(aff => ({
                      membre_id: aff.membre_id,
                      heure_debut: j.debut,
                      heure_fin: j.fin,
                    }))
                  }));

                  return [baseService, ...extraDays];
                }
              }
            }
            return [baseService];
          }),
          membre_ids: uniqueMembreIds,
          membre_id: serviceLignes[0]?.membre_id || uniqueMembreIds[0] || null,
          remise_type: newRdvForm.remise_type || null,
          remise_valeur: newRdvForm.remise_valeur || 0,
          remise_motif: newRdvForm.remise_motif || null,
          montant_ht: totals.montantHT,
          montant_tva: totals.tva,
          prix_total: totals.totalTTC,
          duree_totale_minutes: totals.dureeTotale,
          frais_deplacement: totals.fraisDeplacement,
          require_deposit: requireDeposit && depositEnabled,
        });
      }

      setShowNewModal(false);
      resetNewRdvForm();
      fetchReservations();
      fetchStats();
    } catch (error: unknown) {
      setCreateError(error instanceof Error ? error.message : 'Erreur lors de la création');
    } finally {
      setCreateLoading(false);
    }
  };

  const resetNewRdvForm = () => {
    setNewRdvForm({ ...DEFAULT_NEW_RDV_FORM });
    setServiceLignes([]);
    setMembreIds([]);
    setMembresDisponibles([]);
    setMembresOccupes([]);
    setClientSearch('');
    setCreateNewClient(false);
    setNewClientForm({ ...DEFAULT_NEW_CLIENT_FORM });
    setCreateError('');
    setRequireDeposit(false);
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

  // === RENDER ===

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
          {isBusinessType('commerce') ? (
            <Button onClick={() => navigate('/commandes')} size="sm" variant="outline">
              Gérer les commandes
            </Button>
          ) : (
            <Button onClick={() => setShowNewModal(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {isBusinessType('security') ? 'Nouvelle mission' : `Nouvelle ${t('reservation', false).toLowerCase()}`}
            </Button>
          )}
        </div>
      }
    >
      {/* Erreur globale */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Contenu conditionnel selon l'onglet */}
      {currentTab === 'parametres' ? (
        <ParametresTab />
      ) : (
        <PrestationsListe
          reservations={reservations}
          filters={filters}
          stats={stats}
          page={page}
          totalPages={totalPages}
          loading={loading}
          currentTab={currentTab}
          onFiltersChange={setFilters}
          onPageChange={setPage}
          onOpenDetail={handleOpenDetail}
          onOpenEdit={handleOpenEdit}
          onDelete={handleDelete}
          onChangeStatut={(rdvId, statut) => handleChangeStatut(rdvId, statut)}
          onExportCSV={handleExportCSV}
          onOpenNew={() => setShowNewModal(true)}
        />
      )}

      {/* Modal Détail */}
      {showDetailModal && selectedRdv && (
        <DetailModal
          reservation={selectedRdv}
          onClose={() => setShowDetailModal(false)}
        />
      )}

      {/* Modal Modifier */}
      {showEditModal && editingRdv && (
        <EditModal
          reservation={editingRdv}
          editForm={editForm}
          editLignes={editLignes}
          services={services}
          membres={membres}
          editLoading={editLoading}
          editError={editError}
          businessType={businessType}
          isBusinessType={isBusinessType}
          onEditFormChange={setEditForm}
          onEditLignesChange={(newLignes) => {
            setEditLignes(newLignes);
            // Recalculer le prix total depuis les lignes
            const total = newLignes.reduce((sum, l) => sum + (l.prix_total || 0), 0);
            if (total > 0) setEditForm(prev => ({ ...prev, prix_total: total }));
          }}
          onSave={handleSaveEdit}
          onClose={() => { setShowEditModal(false); setEditLignes([]); }}
        />
      )}

      {/* Modal Nouvelle Réservation */}
      {showNewModal && (
        <NewReservationModal
          newRdvForm={newRdvForm}
          newClientForm={newClientForm}
          services={services}
          membres={membres}
          clients={clients}
          serviceLignes={serviceLignes}
          membreIds={membreIds}
          membresDisponibles={membresDisponibles}
          membresOccupes={membresOccupes}
          loadingDisponibilites={loadingDisponibilites}
          clientSearch={clientSearch}
          showClientDropdown={showClientDropdown}
          createNewClient={createNewClient}
          createLoading={createLoading}
          createError={createError}
          dropdownRef={dropdownRef}
          profile={profile}
          businessType={businessType}
          t={t}
          isPricingMode={isPricingMode}
          isBusinessType={isBusinessType}
          onNewRdvFormChange={setNewRdvForm}
          onNewClientFormChange={setNewClientForm}
          onClientSearch={handleClientSearch}
          onSelectClient={selectClient}
          onSetCreateNewClient={setCreateNewClient}
          onSetShowClientDropdown={setShowClientDropdown}
          onDateHeureChange={handleDateHeureChange}
          onAddServiceLigne={addServiceLigne}
          onRemoveServiceLigne={removeServiceLigne}
          onUpdateServiceQuantite={updateServiceQuantite}
          onUpdateAffectation={updateAffectation}
          onUpdateServiceLigneField={updateServiceLigneField}
          onCalculateTotals={calculateTotals}
          depositEnabled={depositEnabled}
          requireDeposit={requireDeposit}
          onRequireDepositChange={setRequireDeposit}
          onSubmit={handleCreateRdv}
          onClose={() => { setShowNewModal(false); resetNewRdvForm(); }}
          calculateMultiDaySchedule={calculateMultiDaySchedule}
        />
      )}

      {/* Modal Checkout Restaurant */}
      {showCheckoutModal && pendingCheckoutRdv && (
        <CheckoutModal
          reservation={pendingCheckoutRdv}
          onConfirm={handleCheckoutConfirm}
          onClose={() => { setShowCheckoutModal(false); setPendingCheckoutRdv(null); }}
        />
      )}

      {/* Modal Paiement */}
      {showPaymentModal && (
        <PaymentModal
          selectedModePaiement={selectedModePaiement}
          paymentLoading={paymentLoading}
          onSelectMode={setSelectedModePaiement}
          onConfirm={handleConfirmPaymentAndTermine}
          onClose={() => { setShowPaymentModal(false); setPendingTermineRdvId(null); }}
        />
      )}

      {/* Modal Affectation Personnel */}
      {showMembreModal && pendingTermineRdv && (
        <MembreModal
          reservation={pendingTermineRdv}
          membres={membres}
          selectedMembreId={selectedMembreId}
          membreLoading={membreLoading}
          onSelectMembre={setSelectedMembreId}
          onConfirm={handleConfirmTermineWithMembre}
          onClose={() => { setShowMembreModal(false); setPendingTermineRdv(null); }}
        />
      )}
    </ServiceLayout>
  );
}
