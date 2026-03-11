/**
 * Activités - Page orchestrateur des activités business NEXUS
 * Délègue le rendu aux sous-composants dans @/components/activites/
 * Conserve les queries, mutations et état partagé au niveau supérieur
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
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
  ReservationsResponse,
  ServicesResponse,
  MembresResponse,
  MembresDisponiblesResponse,
  ClientsResponse,
  ClientCreateResponse,
  ReservationDetailResponse,
} from '../components/activites/types';
import {
  STATUS_CONFIG,
  formatDate,
  calculateEndTime,
  calculateHours,
  calculateDays,
  DEFAULT_NEW_RDV_FORM,
  DEFAULT_NEW_CLIENT_FORM,
  DEFAULT_FILTERS,
} from '../components/activites/types';

// Tabs de navigation
const tabs = [
  { label: 'Prestations', path: '/activites' },
  { label: 'Historique', path: '/activites/historique' },
  { label: 'Paramètres', path: '/activites/parametres' },
];

export default function Activites() {
  const location = useLocation();
  const { profile, t, isPricingMode, isFieldVisible, hasFeature, businessType, isBusinessType } = useProfile();

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
  const [editForm, setEditForm] = useState<EditForm>({ service_nom: '', date: '', heure: '', statut: '', notes: '', membre_id: 0 });
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

  const dropdownRef = useRef<HTMLDivElement>(null);

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

      const data = await api.get<ReservationsResponse>(`/admin/reservations?${params}`);

      const normalized = (data.reservations || []).map((r: Reservation) => {
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
    } catch {
      setError('Impossible de charger les prestations');
    } finally {
      setLoading(false);
    }
  }, [filters, page, currentTab]);

  const fetchStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayData = await api.get<ReservationsResponse>(`/admin/reservations?date_debut=${today}&date_fin=${today}`);

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const weekData = await api.get<ReservationsResponse>(`/admin/reservations?date_debut=${startOfWeek.toISOString().split('T')[0]}&date_fin=${endOfWeek.toISOString().split('T')[0]}`);

      const waitingData = await api.get<ReservationsResponse>(`/admin/reservations?statut=en_attente`);

      setStats({
        aujourd_hui: todayData.pagination?.total || (todayData.reservations || []).length || 0,
        semaine: weekData.pagination?.total || (weekData.reservations || []).length || 0,
        en_attente: waitingData.pagination?.total || (waitingData.reservations || []).length || 0
      });
    } catch {
      setError('Impossible de charger les statistiques');
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const data = await api.get<any>('/admin/services');
      const services = data.services || (Array.isArray(data.data) ? data.data : []);
      setServices(services);
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

  const searchClients = async (query: string) => {
    if (!query || query.length < 2) {
      setClients([]);
      return;
    }
    try {
      const data = await api.get<ClientsResponse>(`/admin/clients?search=${encodeURIComponent(query)}&limit=10`);
      setClients(data.clients || []);
    } catch {
      setError('Impossible de rechercher les clients');
    }
  };

  const handleClientSearch = (value: string) => {
    setClientSearch(value);
    setShowClientDropdown(true);
    searchClients(value);
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

    setServiceLignes(newLignes);

    if (newRdvForm.date_rdv && newRdvForm.heure_rdv) {
      const dureeTotale = newLignes.reduce((sum, sl) => sum + sl.duree_minutes * sl.quantite, 0);
      fetchMembresDisponibles(newRdvForm.date_rdv, newRdvForm.heure_rdv, dureeTotale);
    }
  };

  const removeServiceLigne = (serviceId: number) => {
    const newLignes = serviceLignes.filter(sl => sl.service_id !== serviceId);
    setServiceLignes(newLignes);

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
    setServiceLignes(newLignes);

    if (newRdvForm.date_rdv && newRdvForm.heure_rdv) {
      const dureeTotale = newLignes.reduce((sum, sl) => sum + sl.duree_minutes * sl.quantite, 0);
      fetchMembresDisponibles(newRdvForm.date_rdv, newRdvForm.heure_rdv, dureeTotale);
    }
  };

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

    const montantHT = montantAvantRemise - remise;
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

  const handleChangeStatut = async (rdvId: number, newStatut: string, _modePaiement?: string, membreId?: number) => {
    try {
      const body: { statut: string; membre_id?: number } = { statut: newStatut };
      if (membreId) {
        body.membre_id = membreId;
      }
      await api.patch(`/admin/reservations/${rdvId}/statut`, body);
      fetchReservations();
      fetchStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.toLowerCase().includes('membre') && newStatut === 'termine') {
        const rdv = reservations.find(r => r.id === rdvId);
        if (rdv) {
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
      await handleChangeStatut(pendingTermineRdv.id, 'termine', undefined, selectedMembreId);
      setShowMembreModal(false);
      setPendingTermineRdv(null);
      setSelectedMembreId(0);
    } catch {
      setError('Impossible de terminer la prestation avec ce membre');
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
    } catch {
      setError('Impossible de valider le paiement');
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
      await api.put(`/admin/reservations/${editingRdv.id}`, {
        service: editForm.service_nom,
        date_rdv: editForm.date,
        heure_rdv: editForm.heure,
        statut: editForm.statut,
        notes: editForm.notes,
        membre_id: editForm.membre_id || null,
        lignes: editLignes.length > 0 ? editLignes.map(l => ({
          id: l.id,
          heure_debut: l.heure_debut,
          heure_fin: l.heure_fin,
        })) : undefined,
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
    } else {
      // Salon / Service domicile
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
        if (!newRdvForm.heure_rdv) missing.push('Heure');
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
        });
      } else if (isBusinessType('hotel')) {
        // Hotel: chambre + check-in/check-out + extras
        const selectedRoom = services.find(s => s.id === newRdvForm.chambre_id);
        await api.post('/admin/reservations', {
          client_id: clientId,
          service: selectedRoom?.nom || `Chambre #${newRdvForm.chambre_id}`,
          date_rdv: newRdvForm.date_rdv,
          heure_rdv: newRdvForm.heure_checkin || '14:00',
          date_fin: newRdvForm.date_checkout,
          heure_fin: newRdvForm.heure_checkout || '11:00',
          notes: newRdvForm.notes,
          services: [{
            service_id: newRdvForm.chambre_id,
            service_nom: selectedRoom?.nom || `Chambre #${newRdvForm.chambre_id}`,
            quantite: 1,
            prix_unitaire: selectedRoom?.prix || 0,
            duree_minutes: 0,
          }],
          nb_personnes: newRdvForm.nb_personnes || 2,
          extras: newRdvForm.extras || [],
          remise_type: newRdvForm.remise_type || null,
          remise_valeur: newRdvForm.remise_valeur || 0,
          remise_motif: newRdvForm.remise_motif || null,
          prix_total: selectedRoom ? (selectedRoom.prix || 0) : 0,
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
          heure_rdv: newRdvForm.heure_rdv,
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
          services: serviceLignes.map(sl => ({
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
          })),
          membre_ids: uniqueMembreIds,
          membre_id: serviceLignes[0]?.membre_id || uniqueMembreIds[0] || null,
          remise_type: newRdvForm.remise_type || null,
          remise_valeur: newRdvForm.remise_valeur || 0,
          remise_motif: newRdvForm.remise_motif || null,
          montant_ht: totals.montantHT,
          montant_tva: totals.tva,
          prix_total: totals.totalTTC,
          duree_totale_minutes: totals.dureeTotale,
          frais_deplacement: totals.fraisDeplacement
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
          <Button onClick={() => setShowNewModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            {profile?.id === 'security' ? 'Nouvelle mission' : `Nouveau ${t('reservation', false).toLowerCase()}`}
          </Button>
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
          onEditFormChange={setEditForm}
          onEditLignesChange={setEditLignes}
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
          onCalculateTotals={calculateTotals}
          onSubmit={handleCreateRdv}
          onClose={() => { setShowNewModal(false); resetNewRdvForm(); }}
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
