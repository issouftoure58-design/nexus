import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  TrendingUp,
  FileText,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Save,
  Download
} from 'lucide-react';
import { exportToCSV } from '@/utils/exportCsv';

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  nb_rdv: number;
  dernier_rdv: {
    date: string;
    heure: string;
    service: string;
    statut: string;
  } | null;
}

interface ClientDetail {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  derniere_visite: string | null;
  tags: string[] | null;
}

interface ClientStats {
  ca_total: number;
  nb_rdv_total: number;
  nb_rdv_honores: number;
  nb_rdv_annules: number;
  service_favori: string | null;
  frequence_jours: number | null;
}

interface Note {
  id: number;
  note: string;
  created_at: string;
}

interface HistoriqueRdv {
  id: number;
  date: string;
  heure: string;
  service: string;
  statut: string;
}

type TabType = 'infos' | 'historique' | 'notes' | 'stats';

export default function Clients() {
  const { toast } = useToast();

  // États principaux
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('infos');

  // États pour les données détaillées
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [historique, setHistorique] = useState<HistoriqueRdv[]>([]);
  const [newNote, setNewNote] = useState('');

  // États pour l'édition
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse: ''
  });

  // Charger la liste des clients
  useEffect(() => {
    fetchClients();
  }, [search, page]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort: 'created_at',
        order: 'desc'
      });

      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/admin/clients?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement des clients');

      const data = await response.json();
      setClients(data.clients || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalClients(data.pagination?.total || 0);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les clients',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Charger les détails d'un client
  const fetchClientDetails = async (clientId: number) => {
    try {
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`/api/admin/clients/${clientId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement des détails');

      const data = await response.json();
      setSelectedClient(data.client);
      setStats(data.stats);
      setNotes(data.notes || []);
      setHistorique(data.historique_rdv || []);

      // Initialiser le formulaire d'édition
      setEditForm({
        nom: data.client.nom || '',
        prenom: data.client.prenom || '',
        telephone: data.client.telephone || '',
        email: data.client.email || '',
        adresse: data.client.adresse || ''
      });
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les détails du client',
        variant: 'destructive'
      });
    }
  };

  // Ouvrir le modal d'un client
  const handleOpenClient = async (client: Client) => {
    setShowModal(true);
    setActiveTab('infos');
    setIsEditing(false);
    await fetchClientDetails(client.id);
  };

  // Fermer le modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedClient(null);
    setStats(null);
    setNotes([]);
    setHistorique([]);
    setNewNote('');
    setIsEditing(false);
  };

  // Enregistrer les modifications du client
  const handleSaveClient = async () => {
    if (!selectedClient) return;

    try {
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`/api/admin/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) throw new Error('Erreur lors de la modification');

      const data = await response.json();
      setSelectedClient(data.client);
      setIsEditing(false);

      toast({
        title: 'Succès',
        description: 'Client modifié avec succès'
      });

      // Recharger la liste
      fetchClients();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le client',
        variant: 'destructive'
      });
    }
  };

  // Ajouter une note
  const handleAddNote = async () => {
    if (!selectedClient || !newNote.trim()) return;

    try {
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`/api/admin/clients/${selectedClient.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note: newNote.trim() })
      });

      if (!response.ok) throw new Error('Erreur lors de l\'ajout de la note');

      const data = await response.json();
      setNotes([data.note, ...notes]);
      setNewNote('');

      toast({
        title: 'Succès',
        description: 'Note ajoutée'
      });
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter la note',
        variant: 'destructive'
      });
    }
  };

  // Supprimer une note
  const handleDeleteNote = async (noteId: number) => {
    if (!selectedClient) return;
    if (!confirm('Supprimer cette note ?')) return;

    try {
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`/api/admin/clients/${selectedClient.id}/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors de la suppression');

      setNotes(notes.filter(n => n.id !== noteId));

      toast({
        title: 'Succès',
        description: 'Note supprimée'
      });
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la note',
        variant: 'destructive'
      });
    }
  };

  // Formater la date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Badge de statut
  const getStatutBadge = (statut: string) => {
    const styles = {
      confirme: 'bg-blue-100 text-blue-800',
      termine: 'bg-green-100 text-green-800',
      annule: 'bg-red-100 text-red-800',
      en_attente: 'bg-yellow-100 text-yellow-800',
      no_show: 'bg-gray-100 text-gray-800'
    };

    const labels = {
      confirme: 'Confirmé',
      termine: 'Terminé',
      annule: 'Annulé',
      en_attente: 'En attente',
      no_show: 'Absent'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[statut as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {labels[statut as keyof typeof labels] || statut}
      </span>
    );
  };

  // Export CSV
  const handleExportClients = () => {
    const dataToExport = clients.map(c => ({
      Prénom: c.prenom,
      Nom: c.nom,
      Téléphone: c.telephone,
      Email: c.email || '',
      'Nb RDV': c.nb_rdv,
      'Dernier RDV': c.dernier_rdv ? formatDate(c.dernier_rdv.date) : 'Aucun'
    }));
    exportToCSV(dataToExport, 'clients');
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {/* En-tête */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
                <p className="text-gray-600">{totalClients} client{totalClients > 1 ? 's' : ''}</p>
              </div>
            </div>
            <Button
              onClick={handleExportClients}
              disabled={clients.length === 0}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter CSV
            </Button>
          </div>

          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Rechercher par nom, téléphone ou email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
        </div>

        {/* Liste des clients */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">
              {search ? 'Aucun client trouvé' : 'Aucun client pour le moment'}
            </p>
          </div>
        ) : (
          <>
            {/* Tableau */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Nb RDV
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Dernier RDV
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {client.prenom?.[0]}{client.nom?.[0]}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {client.prenom} {client.nom}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center gap-1">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {client.telephone}
                        </div>
                        {client.email && (
                          <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {client.email}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-purple-600">
                          {client.nb_rdv}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {client.dernier_rdv ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {formatDate(client.dernier_rdv.date)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {client.dernier_rdv.service}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Aucun RDV</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          onClick={() => handleOpenClient(client)}
                          variant="ghost"
                          size="sm"
                          className="text-purple-600 hover:text-purple-900"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Voir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Page {page} sur {totalPages}
                </p>
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

        {/* Modal Détail Client */}
        {showModal && selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col ml-56">
              {/* Header Modal */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">
                      {selectedClient.prenom?.[0]}{selectedClient.nom?.[0]}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedClient.prenom} {selectedClient.nom}
                      </h2>
                      {/* Tags du client */}
                      {selectedClient.tags && selectedClient.tags.length > 0 && (
                        <div className="flex gap-1">
                          {selectedClient.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                tag === 'VIP'
                                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {tag === 'VIP' ? '⭐ VIP' : tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{selectedClient.telephone}</p>
                  </div>
                </div>
                <Button onClick={handleCloseModal} variant="ghost" size="sm">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 px-6">
                <div className="flex gap-4">
                  {[
                    { id: 'infos', label: 'Informations', icon: FileText },
                    { id: 'historique', label: 'Historique', icon: Calendar },
                    { id: 'notes', label: 'Notes', icon: FileText },
                    { id: 'stats', label: 'Statistiques', icon: TrendingUp }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-purple-600 text-purple-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contenu des tabs */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Tab Informations */}
                {activeTab === 'infos' && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Button onClick={handleSaveClient} size="sm">
                            <Save className="w-4 h-4 mr-2" />
                            Enregistrer
                          </Button>
                          <Button onClick={() => setIsEditing(false)} variant="outline" size="sm">
                            Annuler
                          </Button>
                        </div>
                      ) : (
                        <Button onClick={() => setIsEditing(true)} size="sm">
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Prénom
                        </label>
                        <Input
                          value={editForm.prenom}
                          onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nom
                        </label>
                        <Input
                          value={editForm.nom}
                          onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Téléphone
                        </label>
                        <Input
                          value={editForm.telephone}
                          onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <Input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Adresse
                        </label>
                        <Input
                          value={editForm.adresse}
                          onChange={(e) => setEditForm({ ...editForm, adresse: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {selectedClient.derniere_visite && (
                      <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          Dernière visite : {formatDate(selectedClient.derniere_visite)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab Historique */}
                {activeTab === 'historique' && (
                  <div className="space-y-4">
                    {historique.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Aucun rendez-vous</p>
                    ) : (
                      historique.map((rdv) => (
                        <div key={rdv.id} className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{rdv.service}</p>
                              <p className="text-sm text-gray-600">
                                {formatDate(rdv.date)} à {rdv.heure}
                              </p>
                            </div>
                            {getStatutBadge(rdv.statut)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab Notes */}
                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    {/* Formulaire ajout note */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <Textarea
                        placeholder="Ajouter une note privée..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        rows={3}
                        className="mb-2"
                      />
                      <Button
                        onClick={handleAddNote}
                        disabled={!newNote.trim()}
                        size="sm"
                      >
                        Ajouter la note
                      </Button>
                    </div>

                    {/* Liste des notes */}
                    {notes.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Aucune note</p>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.note}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                {formatDate(note.created_at)} à{' '}
                                {new Date(note.created_at).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <Button
                              onClick={() => handleDeleteNote(note.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab Stats */}
                {activeTab === 'stats' && stats && (
                  <div className="space-y-6">
                    {/* Cards stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                        <p className="text-sm text-green-700 font-medium">Chiffre d'affaires</p>
                        <p className="text-2xl font-bold text-green-900 mt-1">
                          {stats.ca_total.toFixed(2)} €
                        </p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                        <p className="text-sm text-blue-700 font-medium">Total RDV</p>
                        <p className="text-2xl font-bold text-blue-900 mt-1">
                          {stats.nb_rdv_total}
                        </p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                        <p className="text-sm text-purple-700 font-medium">RDV Honorés</p>
                        <p className="text-2xl font-bold text-purple-900 mt-1">
                          {stats.nb_rdv_honores}
                        </p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
                        <p className="text-sm text-red-700 font-medium">RDV Annulés</p>
                        <p className="text-2xl font-bold text-red-900 mt-1">
                          {stats.nb_rdv_annules}
                        </p>
                      </div>
                    </div>

                    {/* Service favori */}
                    {stats.service_favori && (
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-sm text-yellow-700 font-medium">Service favori</p>
                        <p className="text-lg font-semibold text-yellow-900 mt-1">
                          {stats.service_favori}
                        </p>
                      </div>
                    )}

                    {/* Fréquence */}
                    {stats.frequence_jours && (
                      <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <p className="text-sm text-indigo-700 font-medium">Fréquence moyenne</p>
                        <p className="text-lg font-semibold text-indigo-900 mt-1">
                          Tous les {stats.frequence_jours} jours
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
