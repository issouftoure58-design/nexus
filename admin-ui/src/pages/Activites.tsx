/**
 * Activités - Page complète des activités business NEXUS
 * CRUD complet avec filtres, modals, export CSV
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar, Plus, ChevronLeft, ChevronRight, Clock, User, Phone,
  Filter, MoreHorizontal, RefreshCw, X, Eye, Edit, Trash2,
  Download, RotateCcw, Mail, MapPin, Building, Home
} from 'lucide-react';
import { ServiceLayout } from '../components/layout/ServiceLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EntityLink } from '../components/EntityLink';

// Tabs de navigation
const tabs = [
  { label: 'Planning', path: '/activites' },
  { label: 'Historique', path: '/activites/historique' },
  { label: 'Paramètres', path: '/activites/parametres' },
];

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
}

interface Service {
  id: number;
  nom: string;
  prix: number;
  duree_minutes: number;
  actif?: boolean;
}

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  role: string;
}

interface Reservation {
  id: number;
  date?: string;
  date_rdv?: string;
  heure?: string;
  heure_rdv?: string;
  duree?: number;
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

  // Modal paiement (pour marquer terminé)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingTermineRdvId, setPendingTermineRdvId] = useState<number | null>(null);
  const [selectedModePaiement, setSelectedModePaiement] = useState('cb');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Création RDV
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [createNewClient, setCreateNewClient] = useState(false);
  const [newRdvForm, setNewRdvForm] = useState({
    client_id: 0,
    service: '',
    date_rdv: '',
    heure_rdv: '',
    lieu: 'salon',
    adresse_client: '',
    distance_km: 0,
    duree_trajet_minutes: 0,
    frais_deplacement: 0,
    notes: '',
    membre_id: 0
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

  const selectClient = (client: Client) => {
    setNewRdvForm({ ...newRdvForm, client_id: client.id });
    setClientSearch(`${client.prenom} ${client.nom} - ${client.telephone}`);
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

  const handleChangeStatut = async (rdvId: number, newStatut: string, modePaiement?: string) => {
    // Si on passe en terminé, demander le mode de paiement
    if (newStatut === 'termine' && !modePaiement) {
      setPendingTermineRdvId(rdvId);
      setSelectedModePaiement('cb');
      setShowPaymentModal(true);
      return;
    }

    try {
      const token = getToken();
      const body: { statut: string; mode_paiement?: string } = { statut: newStatut };
      if (newStatut === 'termine' && modePaiement) {
        body.mode_paiement = modePaiement;
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
        throw new Error(data.error || 'Erreur changement statut');
      }

      fetchReservations();
      fetchStats();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Erreur lors du changement de statut');
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
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erreur modification');
      }
      setShowEditModal(false);
      setEditingRdv(null);
      fetchReservations();
      fetchStats();
    } catch (error: any) {
      setEditError(error.message || 'Erreur');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (rdvId: number) => {
    if (!confirm(`Supprimer définitivement le RDV #${rdvId} ?`)) return;

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

    if (createNewClient) {
      if (!newClientForm.prenom.trim()) missing.push('Prénom');
      if (!newClientForm.nom.trim()) missing.push('Nom');
      if (!newClientForm.telephone.trim()) missing.push('Téléphone');
    } else {
      if (!newRdvForm.client_id) missing.push('Client');
    }

    if (!newRdvForm.service) missing.push('Service');
    if (!newRdvForm.date_rdv) missing.push('Date');
    if (!newRdvForm.heure_rdv) missing.push('Heure');

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

      // Créer la réservation
      const response = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...newRdvForm, client_id: clientId, membre_id: newRdvForm.membre_id || null })
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
      lieu: 'salon',
      adresse_client: '',
      distance_km: 0,
      duree_trajet_minutes: 0,
      frais_deplacement: 0,
      notes: '',
      membre_id: 0
    });
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
      title="Réservations"
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
            Nouveau RDV
          </Button>
        </div>
      }
    >
      {/* Contenu conditionnel selon l'onglet */}
      {currentTab === 'parametres' ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Paramètres des réservations</h2>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Durée minimale entre deux RDV (minutes)
                </label>
                <Input type="number" defaultValue={15} className="w-48" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Délai minimum de réservation (heures)
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
            {currentTab === 'historique' ? 'Historique des RDV passés' : 'Planning des RDV à venir'}
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
                <option value="tous">Tous les RDV à venir</option>
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
            <p className="text-gray-500">Aucune réservation trouvée</p>
            <Button onClick={() => setShowNewModal(true)} variant="ghost" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Créer un RDV
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
                          {rdv.client ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <div>
                                <EntityLink
                                  type="client"
                                  entity={{
                                    id: rdv.client.id,
                                    nom: rdv.client.nom,
                                    prenom: rdv.client.prenom,
                                    telephone: rdv.client.telephone,
                                    email: rdv.client.email || undefined
                                  }}
                                  label={`${rdv.client.prenom} ${rdv.client.nom}`}
                                  className="text-sm font-medium"
                                />
                                <div className="text-sm text-gray-500">{rdv.client.telephone}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Client inconnu</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <EntityLink
                            type="service"
                            entity={{
                              id: typeof rdv.service === 'object' && rdv.service?.id ? rdv.service.id : 0,
                              nom: rdv.service_nom || '',
                              prix: typeof rdv.service === 'object' && rdv.service?.prix ? rdv.service.prix : (rdv.prix || 0) * 100,
                              duree: rdv.duree || 60
                            }}
                            label={rdv.service_nom || ''}
                            className="text-sm"
                          />
                          {rdv.duree && <div className="text-xs text-gray-500">{rdv.duree} min</div>}
                        </td>
                        <td className="px-4 py-4">
                          {rdv.membre ? (
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
                        {rdv.client ? (
                          <EntityLink
                            type="client"
                            entity={{
                              id: rdv.client.id,
                              nom: rdv.client.nom,
                              prenom: rdv.client.prenom,
                              telephone: rdv.client.telephone,
                              email: rdv.client.email || undefined
                            }}
                            label={`${rdv.client.prenom} ${rdv.client.nom}`}
                          />
                        ) : (
                          <span className="text-gray-400">Client inconnu</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <EntityLink
                          type="service"
                          entity={{
                            id: typeof rdv.service === 'object' && rdv.service?.id ? rdv.service.id : 0,
                            nom: rdv.service_nom || '',
                            prix: typeof rdv.service === 'object' && rdv.service?.prix ? rdv.service.prix : (rdv.prix || 0) * 100,
                            duree: rdv.duree || 60
                          }}
                          label={rdv.service_nom || ''}
                          className="text-sm text-gray-600 dark:text-gray-400"
                        />
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Détails RDV #{selectedRdv.id}</h2>
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
              {selectedRdv.client && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-bold">
                      {selectedRdv.client.prenom?.[0] || selectedRdv.client.nom?.[0]}
                    </div>
                    <div>
                      <EntityLink
                        type="client"
                        entity={{
                          id: selectedRdv.client.id,
                          nom: selectedRdv.client.nom,
                          prenom: selectedRdv.client.prenom,
                          telephone: selectedRdv.client.telephone,
                          email: selectedRdv.client.email || undefined
                        }}
                        label={`${selectedRdv.client.prenom} ${selectedRdv.client.nom}`}
                        className="font-medium"
                      />
                      <p className="text-sm text-gray-500">{selectedRdv.client.telephone}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Service + Prix */}
              <div className="flex items-center justify-between p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                <div>
                  <EntityLink
                    type="service"
                    entity={{
                      id: typeof selectedRdv.service === 'object' && selectedRdv.service?.id ? selectedRdv.service.id : 0,
                      nom: selectedRdv.service_nom || '',
                      prix: typeof selectedRdv.service === 'object' && selectedRdv.service?.prix ? selectedRdv.service.prix : (selectedRdv.prix || 0) * 100,
                      duree: selectedRdv.duree || 60
                    }}
                    label={selectedRdv.service_nom || ''}
                    className="font-medium"
                  />
                  {selectedRdv.duree && <p className="text-xs text-gray-500">{selectedRdv.duree} min</p>}
                </div>
                <span className="text-xl font-bold text-green-600">{formatCurrency(selectedRdv.prix || selectedRdv.prix_total || 0)}</span>
              </div>

              {/* Employé assigné */}
              {selectedRdv.membre && (
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Modifier RDV #{editingRdv.id}</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Client info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {editingRdv.client ? `${editingRdv.client.prenom} ${editingRdv.client.nom} — ${editingRdv.client.telephone}` : 'Client inconnu'}
                </p>
              </div>

              {/* Service */}
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

              {/* Date */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Date</label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                />
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
                <Button onClick={() => setShowEditModal(false)} variant="outline" className="flex-1">
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouvelle réservation</h2>
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
                  Client existant
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
                  + Nouveau client
                </button>
              </div>

              {/* Client existant - Recherche */}
              {!createNewClient && (
                <div className="relative" ref={dropdownRef}>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Rechercher un client *
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
                      {clients.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => selectClient(client)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <p className="font-medium text-gray-900 dark:text-white">
                            {client.prenom} {client.nom}
                          </p>
                          <p className="text-sm text-gray-500">{client.telephone}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Nouveau client - Formulaire */}
              {createNewClient && (
                <div className="space-y-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">Nouveau client</p>
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

              {/* Service */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Service *</label>
                <select
                  value={newRdvForm.service}
                  onChange={(e) => setNewRdvForm({ ...newRdvForm, service: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Sélectionner un service</option>
                  {services.filter(s => s.actif !== false).map((service) => (
                    <option key={service.id} value={service.nom}>
                      {service.nom} - {(service.prix / 100).toFixed(2)}€ - {service.duree_minutes}min
                    </option>
                  ))}
                </select>
              </div>

              {/* Employé assigné */}
              {membres.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Employé assigné</label>
                  <select
                    value={newRdvForm.membre_id}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, membre_id: parseInt(e.target.value) || 0 })}
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

              {/* Date et Heure */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Date *</label>
                  <Input
                    type="date"
                    value={newRdvForm.date_rdv}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, date_rdv: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Heure *</label>
                  <Input
                    type="time"
                    value={newRdvForm.heure_rdv}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, heure_rdv: e.target.value })}
                  />
                </div>
              </div>

              {/* Lieu */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Lieu *</label>
                <select
                  value={newRdvForm.lieu}
                  onChange={(e) => setNewRdvForm({ ...newRdvForm, lieu: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="salon">Au salon</option>
                  <option value="domicile">Domicile du client</option>
                </select>
              </div>

              {/* Adresse si domicile */}
              {newRdvForm.lieu === 'domicile' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Adresse du client</label>
                  <Input
                    type="text"
                    value={newRdvForm.adresse_client}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, adresse_client: e.target.value })}
                    placeholder="15 rue Victor Hugo, 95100 Argenteuil"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes</label>
                <textarea
                  value={newRdvForm.notes}
                  onChange={(e) => setNewRdvForm({ ...newRdvForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Notes additionnelles..."
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

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
                {createLoading ? 'Création...' : 'Créer la réservation'}
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
    </ServiceLayout>
  );
}
