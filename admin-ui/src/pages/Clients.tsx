import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientsApi, type Client, type ClientsResponse } from '@/lib/api';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Calendar,
  MoreVertical,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Eye,
  X,
  Filter,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Clients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // Additional filters
  const [filters, setFilters] = useState({
    nbRdv: 'all', // all, zero, low (1-5), high (5+)
    inscriptionDate: 'all', // all, 30days, 90days, year
  });

  // Debounce search input for suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.length >= 1) {
        setDebouncedSearch(searchInput);
      } else {
        setDebouncedSearch('');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data, isLoading, error } = useQuery<ClientsResponse>({
    queryKey: ['clients', search, page],
    queryFn: () => clientsApi.list({ search, page, limit: 20 }),
  });

  // Query for suggestions
  const { data: suggestions } = useQuery<ClientsResponse>({
    queryKey: ['clients-suggestions', debouncedSearch],
    queryFn: () => clientsApi.list({ search: debouncedSearch, page: 1, limit: 5 }),
    enabled: debouncedSearch.length >= 1,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // Filter clients locally
  const filteredClients = useMemo(() => {
    if (!data?.clients) return [];

    return data.clients.filter(client => {
      // RDV count filter
      const nbRdv = client.nb_rdv || 0;
      if (filters.nbRdv === 'zero' && nbRdv > 0) return false;
      if (filters.nbRdv === 'low' && (nbRdv < 1 || nbRdv > 5)) return false;
      if (filters.nbRdv === 'high' && nbRdv <= 5) return false;

      // Inscription date filter
      if (filters.inscriptionDate !== 'all') {
        const inscriptionDate = new Date(client.created_at);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - inscriptionDate.getTime()) / (1000 * 60 * 60 * 24));

        if (filters.inscriptionDate === '30days' && daysDiff > 30) return false;
        if (filters.inscriptionDate === '90days' && daysDiff > 90) return false;
        if (filters.inscriptionDate === 'year' && daysDiff > 365) return false;
      }

      return true;
    });
  }, [data?.clients, filters]);

  const resetFilters = () => {
    setFilters({ nbRdv: 'all', inscriptionDate: 'all' });
  };

  const hasActiveFilters = filters.nbRdv !== 'all' || filters.inscriptionDate !== 'all';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setShowSuggestions(false);
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-500">{data?.pagination.total || 0} clients au total</p>
      </div>
      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <Input
                type="search"
                placeholder="Rechercher par nom, téléphone, email..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="pl-10"
              />
              {/* Suggestions dropdown */}
              {showSuggestions && debouncedSearch && suggestions?.clients && suggestions.clients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  {suggestions.clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setSearchInput(`${client.prenom} ${client.nom}`);
                        setSearch(`${client.prenom} ${client.nom}`);
                        setShowSuggestions(false);
                        setPage(1);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                        {(client.prenom?.[0] || '')}{(client.nom?.[0] || '')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {client.prenom} {client.nom}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {client.telephone} {client.email && `• ${client.email}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" variant="outline">Rechercher</Button>
          </form>
          <Button onClick={() => setShowNewClientModal(true)} className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700">
            <Plus className="h-4 w-4" />
            Nouveau client
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />

            {/* Number of RDV filter */}
            <select
              value={filters.nbRdv}
              onChange={(e) => setFilters({ ...filters, nbRdv: e.target.value })}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">Tous les clients</option>
              <option value="zero">Jamais venu (0 RDV)</option>
              <option value="low">Occasionnel (1-5 RDV)</option>
              <option value="high">Fidèle (5+ RDV)</option>
            </select>

            {/* Registration date filter */}
            <select
              value={filters.inscriptionDate}
              onChange={(e) => setFilters({ ...filters, inscriptionDate: e.target.value })}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">Toutes les dates</option>
              <option value="30days">Inscrit ces 30 derniers jours</option>
              <option value="90days">Inscrit ces 3 derniers mois</option>
              <option value="year">Inscrit cette année</option>
            </select>

            {hasActiveFilters && (
              <Button onClick={resetFilters} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            )}

            {hasActiveFilters && (
              <span className="text-sm text-gray-500">
                {filteredClients.length} / {data?.clients?.length || 0} clients
              </span>
            )}
          </div>
        </Card>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Erreur de chargement</p>
                <p className="text-sm text-red-700">Impossible de charger les clients</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clients list */}
        {!isLoading && !error && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Contact</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">RDV</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Dernier RDV</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Inscrit le</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                              {(client.prenom?.[0] || '')}{(client.nom?.[0] || '')}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{client.prenom} {client.nom}</p>
                              <p className="text-sm text-gray-500">ID: {client.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-3.5 w-3.5" />
                              {client.telephone}
                            </div>
                            {client.email && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Mail className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[150px]">{client.email}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {client.nb_rdv || 0} réservations
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          {client.dernier_rdv ? (
                            <div className="space-y-1">
                              <p className="text-sm text-gray-900">{formatDate(client.dernier_rdv.date)}</p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  client.dernier_rdv.statut === 'termine' && 'bg-green-50 text-green-700 border-green-200',
                                  client.dernier_rdv.statut === 'confirme' && 'bg-blue-50 text-blue-700 border-blue-200',
                                  client.dernier_rdv.statut === 'annule' && 'bg-red-50 text-red-700 border-red-200'
                                )}
                              >
                                {client.dernier_rdv.statut}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600">
                          {formatDate(client.created_at)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedClient(client)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (confirm('Supprimer ce client ?')) {
                                  deleteMutation.mutate(client.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredClients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500">
                          <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                          <p>Aucun client trouvé</p>
                          {(search || hasActiveFilters) && (
                            <Button
                              variant="link"
                              onClick={() => {
                                setSearch('');
                                setSearchInput('');
                                resetFilters();
                              }}
                              className="mt-2"
                            >
                              Effacer les filtres
                            </Button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-gray-600">
                    Page {data.pagination.page} sur {data.pagination.pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.pagination.pages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Suivant
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Client Modal */}
      {showNewClientModal && (
        <NewClientModal onClose={() => setShowNewClientModal(false)} />
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}
    </div>
  );
}

// New Client Modal Component
function NewClientModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    email: ''
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => clientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Nouveau client</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <Input
                  value={formData.prenom}
                  onChange={(e) => setFormData(d => ({ ...d, prenom: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <Input
                  value={formData.nom}
                  onChange={(e) => setFormData(d => ({ ...d, nom: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
              <Input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData(d => ({ ...d, telephone: e.target.value }))}
                placeholder="0612345678"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(d => ({ ...d, email: e.target.value }))}
                placeholder="client@email.com"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Créer le client'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Client Detail Modal Component
function ClientDetailModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['client', client.id],
    queryFn: () => clientsApi.get(client.id),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
              {(client.prenom?.[0] || '')}{(client.nom?.[0] || '')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{client.prenom} {client.nom}</CardTitle>
                {client.tags && client.tags.length > 0 && client.tags.map((tag, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className={tag === 'VIP' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : ''}
                  >
                    {tag === 'VIP' ? '⭐ VIP' : tag}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-gray-500">{client.telephone}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          ) : detail ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(detail.stats.ca_total)}</p>
                  <p className="text-xs text-green-600">CA Total</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{detail.stats.nb_rdv_total}</p>
                  <p className="text-xs text-blue-600">RDV Total</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-700">{detail.stats.nb_rdv_honores}</p>
                  <p className="text-xs text-purple-600">RDV Honorés</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-orange-700">
                    {detail.stats.frequence_jours ? `${detail.stats.frequence_jours}j` : '-'}
                  </p>
                  <p className="text-xs text-orange-600">Fréquence</p>
                </div>
              </div>

              {/* Service favori */}
              {detail.stats.service_favori && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-700">
                    <span className="font-medium">Service favori :</span> {detail.stats.service_favori}
                  </p>
                </div>
              )}

              {/* Historique RDV */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Historique des rendez-vous</h3>
                <div className="space-y-2">
                  {detail.historique_rdv.map((rdv) => (
                    <div key={rdv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{rdv.service_nom}</p>
                        <p className="text-xs text-gray-500">{rdv.date} à {rdv.heure}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          rdv.statut === 'termine' && 'bg-green-50 text-green-700 border-green-200',
                          rdv.statut === 'confirme' && 'bg-blue-50 text-blue-700 border-blue-200',
                          rdv.statut === 'annule' && 'bg-red-50 text-red-700 border-red-200'
                        )}
                      >
                        {rdv.statut}
                      </Badge>
                    </div>
                  ))}
                  {detail.historique_rdv.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Aucun rendez-vous</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
