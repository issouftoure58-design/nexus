import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  CalendarCheck,
  Filter,
  Download,
  Plus,
  X,
  Eye,
  Edit,
  Trash2,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Home,
  Building,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { exportToCSV } from '@/utils/exportCsv';

interface Reservation {
  id: number;
  date_rdv: string;
  heure_rdv: string;
  statut: string;
  lieu: string;
  prix_total: number;
  frais_deplacement: number;
  notes: string | null;
  client: {
    id: number;
    nom: string;
    prenom: string;
    telephone: string;
    email: string | null;
  } | null;
  service: {
    nom: string;
    duree_minutes: number;
  };
  adresse_client: string | null;
  distance_km: number | null;
  duree_trajet_minutes: number | null;
}

interface ReservationDetail extends Reservation {
  created_at: string;
  updated_at: string;
  created_via: string;
}

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

// Mapping des services vers leurs images
const SERVICE_IMAGES: { [key: string]: string } = {
  // Locks
  'Création crochet locks': '/gallery/creation-locks.jpg',
  'Création microlocks crochet': '/gallery/creation-locks.jpg',
  'Création microlocks twist': '/gallery/creation-locks.jpg',
  'Reprise racines locks': '/gallery/entretien-locks.jpg',
  'Reprise racines microlocks': '/gallery/entretien-locks.jpg',
  'Décapage locks': '/gallery/entretien-locks.jpg',
  'Création Locks': '/gallery/creation-locks.jpg',
  'Microlocks': '/gallery/creation-locks.jpg',
  'Entretien Locks': '/gallery/entretien-locks.jpg',
  // Tresses
  'Braids (Box braids)': '/gallery/braids-service.jpg',
  'Box braids': '/gallery/braids-service.jpg',
  'Braids / Box braids': '/gallery/braids-service.jpg',
  'Nattes collées sans rajout': '/gallery/nattes-service.jpg',
  'Nattes collées avec rajout': '/gallery/nattes-service.jpg',
  'Nattes collées': '/gallery/nattes-service.jpg',
  // Soins
  'Soin complet': '/gallery/soin-complet.jpg',
  'Soin hydratant': '/gallery/soin-complet.jpg',
  'Shampoing': '/gallery/soin-complet.jpg',
  // Coloration
  'Brushing afro': '/gallery/brushing-01.jpg',
  'Brushing Afro': '/gallery/brushing-01.jpg',
  'Teinture sans ammoniaque': '/gallery/coloration-naturelle.jpg',
  'Coloration naturelle': '/gallery/coloration-naturelle.jpg',
  'Décoloration': '/gallery/coloration-naturelle.jpg',
};

// Fonction pour obtenir l'image d'un service
const getServiceImage = (serviceName: string | undefined | null): string => {
  if (!serviceName) {
    return '/gallery/creation-locks.jpg'; // Image par défaut
  }
  // Recherche exacte
  if (SERVICE_IMAGES[serviceName]) {
    return SERVICE_IMAGES[serviceName];
  }
  // Recherche partielle (si le nom contient un mot-clé)
  const lowerName = serviceName.toLowerCase();
  if (lowerName.includes('lock')) return '/gallery/creation-locks.jpg';
  if (lowerName.includes('braid') || lowerName.includes('tresse')) return '/gallery/braids-service.jpg';
  if (lowerName.includes('natte')) return '/gallery/nattes-service.jpg';
  if (lowerName.includes('soin')) return '/gallery/soin-complet.jpg';
  if (lowerName.includes('brush')) return '/gallery/brushing-01.jpg';
  if (lowerName.includes('color') || lowerName.includes('teint')) return '/gallery/coloration-naturelle.jpg';
  // Image par défaut
  return '/gallery/creation-locks.jpg';
};

const STATUT_COLORS = {
  en_attente: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  confirme: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  termine: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  annule: 'bg-red-500/20 text-red-400 border border-red-500/30',
  no_show: 'bg-white/10 text-white/50 border border-white/20'
};

const STATUT_LABELS = {
  en_attente: 'En attente',
  confirme: 'Confirmé',
  termine: 'Terminé',
  annule: 'Annulé',
  no_show: 'Absent'
};

export default function Reservations() {
  const { toast } = useToast();

  // États principaux
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filters, setFilters] = useState({
    periode: 'a_venir',  // Par défaut: affiche tous les RDV à venir (y compris futurs)
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

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRdv, setSelectedRdv] = useState<ReservationDetail | null>(null);
  const [editingRdv, setEditingRdv] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState({ service_nom: '', date: '', heure: '', statut: '', notes: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Données pour création
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Formulaire nouvelle réservation
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
    notes: ''
  });

  // Mode création nouveau client
  const [createNewClient, setCreateNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    email: ''
  });

  // Charger les données
  useEffect(() => {
    fetchReservations();
    fetchStats();
    fetchServices();
  }, [filters, page]);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
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

      // Filtres de période
      if (filters.periode === 'tous') {
        // Pas de filtre de date - affiche tout
      } else if (filters.periode === 'a_venir') {
        // Uniquement les RDV à partir d'aujourd'hui
        const today = new Date().toISOString().split('T')[0];
        params.append('date_debut', today);
      } else if (filters.periode === 'aujourd_hui') {
        const today = new Date().toISOString().split('T')[0];
        params.append('date_debut', today);
        params.append('date_fin', today);
      } else if (filters.periode === 'semaine') {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        params.append('date_debut', startOfWeek.toISOString().split('T')[0]);
        params.append('date_fin', endOfWeek.toISOString().split('T')[0]);
      } else if (filters.periode === 'mois') {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        params.append('date_debut', startOfMonth.toISOString().split('T')[0]);
        params.append('date_fin', endOfMonth.toISOString().split('T')[0]);
      } else if (filters.periode === 'personnalise' && filters.date_debut && filters.date_fin) {
        params.append('date_debut', filters.date_debut);
        params.append('date_fin', filters.date_fin);
      }

      const response = await fetch(`/api/admin/reservations?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement des réservations');

      const data = await response.json();
      setReservations(data.reservations || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les réservations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('admin_token');
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
        aujourd_hui: todayData.pagination?.total || 0,
        semaine: weekData.pagination?.total || 0,
        en_attente: waitingData.pagination?.total || 0
      });
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/services', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setServices(data.services || []);
    } catch (error) {
      console.error('Erreur services:', error);
    }
  };

  const searchClients = async (query: string) => {
    if (!query || query.length < 2) {
      setClients([]);
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/clients?search=${query}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setClients(data.clients || []);
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
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/reservations/${rdv.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setSelectedRdv(data.reservation);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les détails',
        variant: 'destructive'
      });
    }
  };

  const handleChangeStatut = async (rdvId: number, newStatut: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/reservations/${rdvId}/statut`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ statut: newStatut })
      });

      if (!response.ok) throw new Error('Erreur lors du changement de statut');

      toast({
        title: 'Succès',
        description: 'Statut modifié'
      });

      fetchReservations();
      fetchStats();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le statut',
        variant: 'destructive'
      });
    }
  };

  const handleOpenEdit = (rdv: Reservation) => {
    setEditingRdv(rdv);
    setEditForm({
      service_nom: rdv.service?.nom || '',
      date: rdv.date_rdv || '',
      heure: rdv.heure_rdv || '',
      statut: rdv.statut || '',
      notes: rdv.notes || '',
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRdv) return;
    setEditLoading(true);
    setEditError('');
    try {
      const token = localStorage.getItem('admin_token');
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
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erreur modification');
      }
      toast({ title: 'Succès', description: `RDV #${editingRdv.id} modifié` });
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

  // Supprimer une réservation
  const handleDelete = async (rdvId: number) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement le RDV #${rdvId} ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/reservations/${rdvId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      toast({ title: 'Succès', description: `RDV #${rdvId} supprimé` });
      fetchReservations();
      fetchStats();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer la réservation',
        variant: 'destructive'
      });
    }
  };

  const handleCreateRdv = async () => {
    const missing: string[] = [];

    // Valider client: soit existant, soit nouveau
    if (createNewClient) {
      if (!newClientForm.prenom.trim()) missing.push('Prénom du client');
      if (!newClientForm.nom.trim()) missing.push('Nom du client');
      if (!newClientForm.telephone.trim()) missing.push('Téléphone du client');
    } else {
      if (!newRdvForm.client_id) missing.push('Client (cliquez sur un résultat de recherche)');
    }

    if (!newRdvForm.service) missing.push('Service');
    if (!newRdvForm.date_rdv) missing.push('Date');
    if (!newRdvForm.heure_rdv) missing.push('Heure');
    if (missing.length > 0) {
      toast({
        title: 'Champs manquants',
        description: missing.join(', '),
        variant: 'destructive'
      });
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');

      // Si nouveau client, créer d'abord le client
      let clientId = newRdvForm.client_id;
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
          throw new Error(data.error || 'Erreur lors de la création du client');
        }

        const clientData = await clientResponse.json();
        clientId = clientData.client.id;
      }

      // Créer la réservation avec le client_id
      const response = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...newRdvForm, client_id: clientId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la création');
      }

      toast({
        title: 'Succès',
        description: createNewClient
          ? 'Client et réservation créés'
          : 'Réservation créée'
      });

      setShowNewModal(false);
      resetNewRdvForm();
      fetchReservations();
      fetchStats();
    } catch (error: any) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer la réservation',
        variant: 'destructive'
      });
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
      notes: ''
    });
    setClientSearch('');
    setCreateNewClient(false);
    setNewClientForm({ prenom: '', nom: '', telephone: '', email: '' });
  };

  const handleExportCSV = () => {
    const dataToExport = reservations.map(rdv => ({
      Date: formatDate(rdv.date_rdv),
      Heure: rdv.heure_rdv,
      Client: rdv.client ? `${rdv.client.prenom} ${rdv.client.nom}` : 'Inconnu',
      Téléphone: rdv.client?.telephone || '',
      Service: rdv.service.nom,
      'Durée (min)': rdv.service.duree_minutes,
      Lieu: rdv.lieu === 'salon' ? 'Chez Fatou' : 'Domicile',
      Adresse: rdv.adresse_client || '',
      'Distance (km)': rdv.distance_km || '',
      'Prix (€)': rdv.prix_total.toFixed(2),
      'Frais dépl. (€)': rdv.frais_deplacement.toFixed(2),
      Statut: STATUT_LABELS[rdv.statut as keyof typeof STATUT_LABELS] || rdv.statut,
      Notes: rdv.notes || ''
    }));
    exportToCSV(dataToExport, 'reservations');
  };

  const resetFilters = () => {
    setFilters({
      periode: 'a_venir',  // Par défaut: RDV à venir
      statut: 'tous',
      service: '',
      date_debut: '',
      date_fin: ''
    });
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatutBadge = (statut: string) => {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[statut as keyof typeof STATUT_COLORS] || 'bg-gray-100 text-gray-800'}`}>
        {STATUT_LABELS[statut as keyof typeof STATUT_LABELS] || statut}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        {/* En-tête */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/30">
                <CalendarCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Réservations</h1>
              </div>
            </div>
            <Button onClick={() => setShowNewModal(true)} className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle réservation
            </Button>
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:border-amber-500/30 transition-all">
              <p className="text-sm text-white/50 font-medium">Aujourd'hui</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{stats.aujourd_hui}</p>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:border-amber-500/30 transition-all">
              <p className="text-sm text-white/50 font-medium">Cette semaine</p>
              <p className="text-2xl font-bold text-violet-400 mt-1">{stats.semaine}</p>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:border-amber-500/30 transition-all">
              <p className="text-sm text-white/50 font-medium">En attente</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{stats.en_attente}</p>
            </div>
          </div>

          {/* Filtres */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 md:p-4 rounded-xl space-y-3 md:space-y-4">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <div className="col-span-2 flex items-center gap-2 mb-1 sm:mb-0">
                <Filter className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-white/50 sm:hidden">Filtres</span>
              </div>

              {/* Période */}
              <select
                value={filters.periode}
                onChange={(e) => {
                  setFilters({ ...filters, periode: e.target.value });
                  setPage(1);
                }}
                className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-white focus:border-amber-500/50 focus:outline-none"
              >
                <option value="tous" className="bg-zinc-900">Tous les RDV</option>
                <option value="a_venir" className="bg-zinc-900">À venir</option>
                <option value="aujourd_hui" className="bg-zinc-900">Aujourd'hui</option>
                <option value="semaine" className="bg-zinc-900">Cette semaine</option>
                <option value="mois" className="bg-zinc-900">Ce mois</option>
                <option value="personnalise" className="bg-zinc-900">Personnalisé</option>
              </select>

              {/* Statut */}
              <select
                value={filters.statut}
                onChange={(e) => {
                  setFilters({ ...filters, statut: e.target.value });
                  setPage(1);
                }}
                className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-white focus:border-amber-500/50 focus:outline-none"
              >
                <option value="tous" className="bg-zinc-900">Tous les statuts</option>
                <option value="en_attente" className="bg-zinc-900">En attente</option>
                <option value="confirme" className="bg-zinc-900">Confirmé</option>
                <option value="termine" className="bg-zinc-900">Terminé</option>
                <option value="annule" className="bg-zinc-900">Annulé</option>
                <option value="no_show" className="bg-zinc-900">Absent</option>
              </select>

              {/* Service */}
              <Input
                type="text"
                placeholder="Filtrer par service..."
                value={filters.service}
                onChange={(e) => {
                  setFilters({ ...filters, service: e.target.value });
                  setPage(1);
                }}
                className="col-span-2 sm:w-64 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-amber-500/50"
              />

              <Button onClick={resetFilters} variant="outline" size="sm" className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white">
                <RotateCcw className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Reset</span>
              </Button>

              <Button onClick={handleExportCSV} variant="outline" size="sm" className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white">
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            </div>

            {/* Dates personnalisées */}
            {filters.periode === 'personnalise' && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filters.date_debut}
                  onChange={(e) => setFilters({ ...filters, date_debut: e.target.value })}
                  className="w-48 bg-white/5 border-white/20 text-white focus:border-amber-500/50"
                />
                <span className="flex items-center text-white/50">à</span>
                <Input
                  type="date"
                  value={filters.date_fin}
                  onChange={(e) => setFilters({ ...filters, date_fin: e.target.value })}
                  className="w-48 bg-white/5 border-white/20 text-white focus:border-amber-500/50"
                />
              </div>
            )}
          </div>
        </div>

        {/* Liste des réservations */}
        {loading ? (
          <div className="text-center py-12">
            <div className="h-8 w-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-white/50">Chargement...</p>
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-12 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
            <CalendarCheck className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/50">Aucune réservation trouvée</p>
          </div>
        ) : (
          <>
            {/* Vue Desktop - Tableau */}
            <div className="hidden md:block bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                        Date & Heure
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                        Service
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                        Lieu
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                        Prix
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-amber-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reservations.map((rdv) => (
                      <tr
                        key={rdv.id}
                        onClick={() => handleOpenDetail(rdv)}
                        className="hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <div>
                              <div className="text-sm font-medium text-white">
                                {formatDate(rdv.date_rdv)}
                              </div>
                              <div className="text-sm text-white/50">{rdv.heure_rdv}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {rdv.client ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-amber-400" />
                              <div>
                                <div className="text-sm font-medium text-white">
                                  {rdv.client.prenom} {rdv.client.nom}
                                </div>
                                <div className="text-sm text-white/50">{rdv.client.telephone}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-white/30">Client inconnu</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-white">{rdv.service.nom}</div>
                          <div className="text-xs text-white/50">{rdv.service.duree_minutes} min</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {rdv.lieu === 'salon' ? (
                              <>
                                <Building className="w-4 h-4 text-amber-400" />
                                <span className="text-sm text-white">Chez Fatou</span>
                              </>
                            ) : (
                              <>
                                <Home className="w-4 h-4 text-orange-400" />
                                <span className="text-sm text-white">Domicile</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-emerald-400">
                            {rdv.prix_total.toFixed(2)} €
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {getStatutBadge(rdv.statut)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 justify-end items-center">
                            <button
                              onClick={() => handleOpenEdit(rdv)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-amber-400 hover:text-amber-300 transition-colors"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(rdv.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {rdv.statut !== 'termine' && rdv.statut !== 'annule' && (
                              <select
                                value={rdv.statut}
                                onChange={(e) => handleChangeStatut(rdv.id, e.target.value)}
                                className="px-2 py-1 text-xs bg-white/5 border border-white/20 text-white rounded focus:border-amber-500/50 focus:outline-none"
                              >
                                <option value="en_attente" className="bg-zinc-900">En attente</option>
                                <option value="confirme" className="bg-zinc-900">Confirmé</option>
                                <option value="termine" className="bg-zinc-900">Terminé</option>
                                <option value="annule" className="bg-zinc-900">Annulé</option>
                                <option value="no_show" className="bg-zinc-900">Absent</option>
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vue Mobile - Cartes */}
            <div className="md:hidden space-y-3">
              {reservations.map((rdv) => (
                <div
                  key={rdv.id}
                  onClick={() => handleOpenDetail(rdv)}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-white font-medium">{formatDate(rdv.date_rdv)}</span>
                      <span className="text-white/50">à</span>
                      <span className="text-white">{rdv.heure_rdv}</span>
                    </div>
                    {getStatutBadge(rdv.statut)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-amber-400" />
                      <span className="text-white">
                        {rdv.client ? `${rdv.client.prenom} ${rdv.client.nom}` : 'Client inconnu'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {rdv.lieu === 'salon' ? (
                          <Building className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Home className="w-4 h-4 text-orange-400" />
                        )}
                        <span className="text-white/70 text-sm">{rdv.service.nom}</span>
                      </div>
                      <span className="text-emerald-400 font-semibold">{rdv.prix_total.toFixed(2)} €</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenEdit(rdv)}
                      className="px-3 py-2 text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(rdv.id)}
                      className="px-3 py-2 text-sm bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                    {rdv.statut !== 'termine' && rdv.statut !== 'annule' && (
                      <select
                        value={rdv.statut}
                        onChange={(e) => handleChangeStatut(rdv.id, e.target.value)}
                        className="w-full sm:w-auto mt-2 sm:mt-0 px-3 py-2 text-sm bg-white/5 border border-white/20 text-white rounded-lg focus:border-amber-500/50 focus:outline-none"
                      >
                        <option value="en_attente" className="bg-zinc-900">En attente</option>
                        <option value="confirme" className="bg-zinc-900">Confirmé</option>
                        <option value="termine" className="bg-zinc-900">Terminé</option>
                        <option value="annule" className="bg-zinc-900">Annulé</option>
                        <option value="no_show" className="bg-zinc-900">Absent</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-white/50">
                  Page {page} sur {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Précédent
                  </Button>
                  <Button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
                  >
                    Suivant
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal Détail */}
        {/* Modal Modifier Réservation */}
        {showEditModal && editingRdv && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
            <div
              className="bg-zinc-900 border border-amber-500/30 rounded-2xl shadow-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3 border-b border-amber-500/20 flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-t-2xl">
                <h2 className="text-lg font-bold text-white">Modifier RDV #{editingRdv.id}</h2>
                <Button onClick={() => setShowEditModal(false)} variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Client info (lecture seule) */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-sm text-white/70">
                    {editingRdv.client ? `${editingRdv.client.prenom} ${editingRdv.client.nom} — ${editingRdv.client.telephone}` : 'Client inconnu'}
                  </p>
                </div>

                {/* Service */}
                <div>
                  <label className="text-sm font-medium text-white/70 mb-1 block">Service</label>
                  <select
                    value={editForm.service_nom}
                    onChange={(e) => setEditForm({ ...editForm, service_nom: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:border-amber-500/50 focus:outline-none"
                  >
                    {services.filter(s => (s as any).actif !== false).map((s) => (
                      <option key={s.id} value={s.nom} className="bg-zinc-900">
                        {s.nom} — {(s.prix / 100).toFixed(0)}€ ({s.duree_minutes}min)
                      </option>
                    ))}
                  </select>
                  {/* Preview prix/durée si changement */}
                  {editForm.service_nom !== (editingRdv.service?.nom || '') && (() => {
                    const sel = services.find(s => s.nom === editForm.service_nom);
                    return sel ? (
                      <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
                        Nouveau prix : {(sel.prix / 100).toFixed(0)}€ — Durée : {sel.duree_minutes}min
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Date */}
                <div>
                  <label className="text-sm font-medium text-white/70 mb-1 block">Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                {/* Heure */}
                <div>
                  <label className="text-sm font-medium text-white/70 mb-1 block">Heure</label>
                  <input
                    type="time"
                    value={editForm.heure}
                    onChange={(e) => setEditForm({ ...editForm, heure: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                {/* Statut */}
                <div>
                  <label className="text-sm font-medium text-white/70 mb-1 block">Statut</label>
                  <select
                    value={editForm.statut}
                    onChange={(e) => setEditForm({ ...editForm, statut: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:border-amber-500/50 focus:outline-none"
                  >
                    <option value="demande" className="bg-zinc-900">En attente</option>
                    <option value="en_attente" className="bg-zinc-900">En attente confirmation</option>
                    <option value="confirme" className="bg-zinc-900">Confirmé</option>
                    <option value="termine" className="bg-zinc-900">Terminé</option>
                    <option value="annule" className="bg-zinc-900">Annulé</option>
                    <option value="no_show" className="bg-zinc-900">Absent</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-white/70 mb-1 block">Notes</label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={2}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>

                {/* Error */}
                {editError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {editError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => setShowEditModal(false)}
                    variant="outline"
                    className="flex-1 border-white/20 text-white/70 hover:bg-white/10"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={editLoading}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
                  >
                    {editLoading ? 'Sauvegarde...' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDetailModal && selectedRdv && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
            <div
              className="bg-zinc-900 border border-amber-500/30 rounded-2xl shadow-2xl w-full max-w-md ml-24"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3 border-b border-amber-500/20 flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-t-2xl">
                <h2 className="text-lg font-bold text-white">Détails RDV</h2>
                <Button onClick={() => setShowDetailModal(false)} variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Image du service */}
                <div className="relative w-full h-40 rounded-xl overflow-hidden">
                  <img
                    src={getServiceImage(selectedRdv.service.nom)}
                    alt={selectedRdv.service.nom}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3">
                    <p className="text-white font-semibold text-lg drop-shadow-lg">{selectedRdv.service.nom}</p>
                  </div>
                </div>

                {/* Date/Heure + Statut */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-white font-medium">
                      {formatDate(selectedRdv.date_rdv)} à {selectedRdv.heure_rdv}
                    </span>
                  </div>
                  {getStatutBadge(selectedRdv.statut)}
                </div>

                {/* Client */}
                {selectedRdv.client && (
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                        {selectedRdv.client.prenom?.[0] || selectedRdv.client.nom?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {selectedRdv.client.prenom} {selectedRdv.client.nom}
                        </p>
                        <p className="text-sm text-white/50">{selectedRdv.client.telephone}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Service + Prix */}
                <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div>
                    <p className="text-white font-medium">{selectedRdv.service.nom}</p>
                    <p className="text-xs text-white/50">{selectedRdv.service.duree_minutes} min</p>
                  </div>
                  <span className="text-xl font-bold text-emerald-400">{selectedRdv.prix_total.toFixed(2)} €</span>
                </div>

                {/* Lieu */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-white/50">Lieu</span>
                  </div>
                  {selectedRdv.lieu === 'salon' ? (
                    <p className="text-white/80 text-sm">Chez Fatou - Franconville</p>
                  ) : (
                    <div>
                      <p className="text-white text-sm">Domicile</p>
                      {selectedRdv.adresse_client && (
                        <p className="text-xs text-white/50 mt-1">{selectedRdv.adresse_client}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Frais déplacement si applicable */}
                {selectedRdv.frais_deplacement > 0 && (
                  <p className="text-xs text-white/40 text-center">
                    Dont {selectedRdv.frais_deplacement.toFixed(2)} € de frais de déplacement
                  </p>
                )}

                {/* Notes */}
                {selectedRdv.notes && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <p className="text-xs text-yellow-400 mb-1">Notes</p>
                    <p className="text-white/80 text-sm">{selectedRdv.notes}</p>
                  </div>
                )}

                {/* Métadonnées */}
                <p className="text-xs text-white/30 text-center">
                  Créée via {selectedRdv.created_via || 'chatbot'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Modal Nouvelle Réservation */}
        {showNewModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowNewModal(false); resetNewRdvForm(); }}>
            <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-amber-500/20 flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                <h2 className="text-xl font-bold text-white">Nouvelle réservation</h2>
                <Button onClick={() => { setShowNewModal(false); resetNewRdvForm(); }} variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Toggle Client existant / Nouveau */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setCreateNewClient(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      !createNewClient
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Client existant
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateNewClient(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      createNewClient
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    + Nouveau client
                  </button>
                </div>

                {/* Client existant - Recherche */}
                {!createNewClient && (
                  <div className="relative">
                    <label className="block text-sm font-medium text-white/70 mb-1">
                      Rechercher un client *
                    </label>
                    <Input
                      type="text"
                      placeholder="Nom, prénom ou téléphone..."
                      value={clientSearch}
                      onChange={(e) => handleClientSearch(e.target.value)}
                      onFocus={() => setShowClientDropdown(true)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-amber-500/50"
                    />
                    {showClientDropdown && clients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-amber-500/20 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {clients.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => selectClient(client)}
                            className="w-full px-4 py-2 text-left hover:bg-white/10 border-b border-white/5 last:border-0"
                          >
                            <p className="font-medium text-white">
                              {client.prenom} {client.nom}
                            </p>
                            <p className="text-sm text-white/50">{client.telephone}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Nouveau client - Formulaire */}
                {createNewClient && (
                  <div className="space-y-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <p className="text-xs text-emerald-400 font-medium">Nouveau client</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">Prénom *</label>
                        <Input
                          type="text"
                          placeholder="Marie"
                          value={newClientForm.prenom}
                          onChange={(e) => setNewClientForm({ ...newClientForm, prenom: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">Nom *</label>
                        <Input
                          type="text"
                          placeholder="Dupont"
                          value={newClientForm.nom}
                          onChange={(e) => setNewClientForm({ ...newClientForm, nom: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">Téléphone *</label>
                        <Input
                          type="tel"
                          placeholder="06 12 34 56 78"
                          value={newClientForm.telephone}
                          onChange={(e) => setNewClientForm({ ...newClientForm, telephone: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">Email</label>
                        <Input
                          type="email"
                          placeholder="email@exemple.fr"
                          value={newClientForm.email}
                          onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Service */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Service *
                  </label>
                  <select
                    value={newRdvForm.service}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, service: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:border-amber-500/50 focus:outline-none"
                  >
                    <option value="" className="bg-zinc-900">Sélectionner un service</option>
                    {services.filter(s => s.actif !== false).map((service) => (
                      <option key={service.id} value={service.nom} className="bg-zinc-900">
                        {service.nom} - {(service.prix / 100).toFixed(2)}€ - {service.duree_minutes}min
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date et Heure */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">
                      Date *
                    </label>
                    <Input
                      type="date"
                      value={newRdvForm.date_rdv}
                      onChange={(e) => setNewRdvForm({ ...newRdvForm, date_rdv: e.target.value })}
                      className="bg-white/5 border-white/20 text-white focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">
                      Heure *
                    </label>
                    <Input
                      type="time"
                      value={newRdvForm.heure_rdv}
                      onChange={(e) => setNewRdvForm({ ...newRdvForm, heure_rdv: e.target.value })}
                      className="bg-white/5 border-white/20 text-white focus:border-amber-500/50"
                    />
                  </div>
                </div>

                {/* Lieu */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Lieu *
                  </label>
                  <select
                    value={newRdvForm.lieu}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, lieu: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:border-amber-500/50 focus:outline-none"
                  >
                    <option value="salon" className="bg-zinc-900">Chez Fatou</option>
                    <option value="domicile" className="bg-zinc-900">Domicile du client</option>
                  </select>
                </div>

                {/* Adresse si domicile */}
                {newRdvForm.lieu === 'domicile' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">
                        Adresse du client
                      </label>
                      <Input
                        type="text"
                        value={newRdvForm.adresse_client}
                        onChange={(e) => setNewRdvForm({ ...newRdvForm, adresse_client: e.target.value })}
                        placeholder="15 rue Victor Hugo, 95100 Argenteuil"
                        className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-amber-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">
                          Distance (km)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          value={newRdvForm.distance_km}
                          onChange={(e) => setNewRdvForm({ ...newRdvForm, distance_km: parseFloat(e.target.value) || 0 })}
                          className="bg-white/5 border-white/20 text-white focus:border-amber-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">
                          Durée trajet (min)
                        </label>
                        <Input
                          type="number"
                          value={newRdvForm.duree_trajet_minutes}
                          onChange={(e) => setNewRdvForm({ ...newRdvForm, duree_trajet_minutes: parseInt(e.target.value) || 0 })}
                          className="bg-white/5 border-white/20 text-white focus:border-amber-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">
                          Frais dépl. (€)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newRdvForm.frais_deplacement}
                          onChange={(e) => setNewRdvForm({ ...newRdvForm, frais_deplacement: parseFloat(e.target.value) || 0 })}
                          className="bg-white/5 border-white/20 text-white focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Notes
                  </label>
                  <Textarea
                    value={newRdvForm.notes}
                    onChange={(e) => setNewRdvForm({ ...newRdvForm, notes: e.target.value })}
                    rows={3}
                    placeholder="Notes additionnelles..."
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-amber-500/20 flex justify-end gap-2">
                <Button onClick={() => { setShowNewModal(false); resetNewRdvForm(); }} variant="outline" className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white">
                  Annuler
                </Button>
                <Button onClick={handleCreateRdv} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                  Créer la réservation
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
