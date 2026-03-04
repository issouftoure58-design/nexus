import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingBag,
  Filter,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Package,
  Euro,
  Home,
  Building,
  Trash2,
  Pencil
} from 'lucide-react';

interface OrderItem {
  id: number;
  service_nom: string;
  service_description: string;
  duree_minutes: number;
  prix: number;
  ordre: number;
}

interface Order {
  id: number;
  client_id: number;
  statut: string;
  sous_total: number;
  frais_deplacement: number;
  total: number;
  paiement_methode: string;
  paiement_statut: string;
  lieu: string;
  adresse_client: string | null;
  distance_km: number | null;
  date_rdv: string;
  heure_debut: string;
  client_nom: string;
  client_prenom: string | null;
  client_telephone: string;
  client_email: string | null;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
}

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  confirme: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  paye: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  termine: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  annule: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  confirme: 'Confirmée',
  paye: 'Payée',
  termine: 'Terminée',
  annule: 'Annulée',
};

const PAIEMENT_LABELS: Record<string, string> = {
  sur_place: 'Sur place',
  stripe: 'Carte bancaire',
  paypal: 'PayPal',
};

export default function Commandes() {
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filters, setFilters] = useState({
    periode: 'semaine',
    statut: 'tous',
    paiement: 'tous',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    total: 0,
    en_attente: 0,
    confirme: 0,
    ca_total: 0,
  });

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [filters, page]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(filters.statut !== 'tous' && { statut: filters.statut }),
        ...(filters.paiement !== 'tous' && { paiement: filters.paiement }),
        periode: filters.periode,
      });

      const response = await fetch(`/api/admin/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erreur chargement commandes');

      const data = await response.json();
      setOrders(data.orders || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les commandes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/orders/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const updateOrderStatus = async (orderId: number, newStatut: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statut: newStatut }),
      });

      if (!response.ok) throw new Error('Erreur mise à jour');

      toast({
        title: 'Statut mis à jour',
        description: `Commande #${orderId} : ${STATUT_LABELS[newStatut]}`,
      });

      fetchOrders();
      fetchStats();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le statut',
        variant: 'destructive',
      });
    }
  };

  const viewOrder = async (orderId: number) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erreur');

      const data = await response.json();
      setSelectedOrder(data.order);
      setShowDetailModal(true);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger la commande',
        variant: 'destructive',
      });
    }
  };

  const deleteOrder = async (orderId: number) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la commande #${orderId} ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erreur suppression');

      toast({
        title: 'Commande supprimée',
        description: `La commande #${orderId} a été supprimée`,
      });

      fetchOrders();
      fetchStats();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la commande',
        variant: 'destructive',
      });
    }
  };

  const formatPrice = (centimes: number) => {
    return (centimes / 100).toFixed(2) + ' €';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            Commandes
          </h1>
          <p className="text-white/60 mt-1">
            Gérez les commandes passées via le panier
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Package className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-white/60 text-sm">En attente</p>
              <p className="text-2xl font-bold text-white">{stats.en_attente}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Confirmées</p>
              <p className="text-2xl font-bold text-white">{stats.confirme}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
              <Euro className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-sm">CA Total</p>
              <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                {formatPrice(stats.ca_total)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-white/60" />
            <span className="text-white/60 text-sm">Filtres:</span>
          </div>

          <select
            value={filters.periode}
            onChange={(e) => setFilters({ ...filters, periode: e.target.value })}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
          >
            <option value="aujourd_hui">Aujourd'hui</option>
            <option value="semaine">Cette semaine</option>
            <option value="mois">Ce mois</option>
            <option value="tous">Tous</option>
          </select>

          <select
            value={filters.statut}
            onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
          >
            <option value="tous">Tous statuts</option>
            <option value="en_attente">En attente</option>
            <option value="confirme">Confirmée</option>
            <option value="termine">Terminée</option>
            <option value="annule">Annulée</option>
          </select>

          <select
            value={filters.paiement}
            onChange={(e) => setFilters({ ...filters, paiement: e.target.value })}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
          >
            <option value="tous">Tous paiements</option>
            <option value="sur_place">Sur place</option>
            <option value="stripe">Carte bancaire</option>
            <option value="paypal">PayPal</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
            <p className="text-white/60 mt-4">Chargement...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">Aucune commande trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-white/60 font-medium text-sm">#</th>
                  <th className="text-left p-4 text-white/60 font-medium text-sm">Date RDV</th>
                  <th className="text-left p-4 text-white/60 font-medium text-sm">Client</th>
                  <th className="text-left p-4 text-white/60 font-medium text-sm">Services</th>
                  <th className="text-left p-4 text-white/60 font-medium text-sm">Lieu</th>
                  <th className="text-left p-4 text-white/60 font-medium text-sm">Total</th>
                  <th className="text-left p-4 text-white/60 font-medium text-sm">Paiement</th>
                  <th className="text-left p-4 text-white/60 font-medium text-sm">Statut</th>
                  <th className="text-left p-4 text-white/60 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4">
                      <span className="text-white font-medium">#{order.id}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-amber-400" />
                        <div>
                          <p className="text-white text-sm">{formatDate(order.date_rdv)}</p>
                          <p className="text-white/50 text-xs">{order.heure_debut}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-white text-sm">
                          {order.client_prenom} {order.client_nom}
                        </p>
                        <p className="text-white/50 text-xs">{order.client_telephone}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="max-w-[200px]">
                        {order.order_items?.slice(0, 2).map((item, idx) => (
                          <p key={idx} className="text-white/80 text-sm truncate">
                            {item.service_nom}
                          </p>
                        ))}
                        {order.order_items?.length > 2 && (
                          <p className="text-white/50 text-xs">
                            +{order.order_items.length - 2} autre(s)
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {order.lieu === 'chez_fatou' ? (
                          <Building className="h-4 w-4 text-blue-400" />
                        ) : (
                          <Home className="h-4 w-4 text-amber-400" />
                        )}
                        <span className="text-white/80 text-sm">
                          {order.lieu === 'chez_fatou' ? 'Chez Fatou' : 'Domicile'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-white font-semibold">
                        {formatPrice(order.total)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-4 w-4 text-white/40" />
                        <span className="text-white/80 text-sm">
                          {PAIEMENT_LABELS[order.paiement_methode] || order.paiement_methode}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          STATUT_COLORS[order.statut] || 'bg-white/10 text-white/60'
                        }`}
                      >
                        {STATUT_LABELS[order.statut] || order.statut}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                          onClick={() => viewOrder(order.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.statut === 'en_attente' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                              onClick={() => updateOrderStatus(order.id, 'confirme')}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              onClick={() => updateOrderStatus(order.id, 'annule')}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {order.statut === 'confirme' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                            onClick={() => updateOrderStatus(order.id, 'termine')}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          onClick={() => deleteOrder(order.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/10">
            <p className="text-white/60 text-sm">
              Page {page} sur {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-amber-400" />
                Commande #{selectedOrder.id}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDetailModal(false)}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Statut & Date */}
              <div className="flex flex-wrap gap-4">
                <span
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    STATUT_COLORS[selectedOrder.statut]
                  }`}
                >
                  {STATUT_LABELS[selectedOrder.statut]}
                </span>
                <span className="text-white/60 text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Créée le {formatDateTime(selectedOrder.created_at)}
                </span>
              </div>

              {/* Client */}
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-400" />
                  Client
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/60">Nom</p>
                    <p className="text-white">
                      {selectedOrder.client_prenom} {selectedOrder.client_nom}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/60">Téléphone</p>
                    <p className="text-white flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedOrder.client_telephone}
                    </p>
                  </div>
                  {selectedOrder.client_email && (
                    <div className="col-span-2">
                      <p className="text-white/60">Email</p>
                      <p className="text-white flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {selectedOrder.client_email}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Rendez-vous */}
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-400" />
                  Rendez-vous
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/60">Date</p>
                    <p className="text-white">{formatDate(selectedOrder.date_rdv)}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Heure</p>
                    <p className="text-white">{selectedOrder.heure_debut}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-white/60">Lieu</p>
                    <p className="text-white flex items-center gap-1">
                      {selectedOrder.lieu === 'chez_fatou' ? (
                        <>
                          <Building className="h-3 w-3 text-blue-400" />
                          Chez Fatou - 8 rue des Monts Rouges, Franconville
                        </>
                      ) : (
                        <>
                          <Home className="h-3 w-3 text-amber-400" />
                          {selectedOrder.adresse_client}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-400" />
                  Services
                </h3>
                <div className="space-y-2">
                  {selectedOrder.order_items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center py-2 border-b border-white/5 last:border-0"
                    >
                      <div>
                        <p className="text-white">{item.service_nom}</p>
                        <p className="text-white/50 text-xs">{item.duree_minutes} min</p>
                      </div>
                      <p className="text-white font-medium">{formatPrice(item.prix)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Sous-total</span>
                    <span className="text-white">{formatPrice(selectedOrder.sous_total)}</span>
                  </div>
                  {selectedOrder.frais_deplacement > 0 && (
                    <div className="flex justify-between">
                      <span className="text-white/60">Frais de déplacement</span>
                      <span className="text-white">
                        {formatPrice(selectedOrder.frais_deplacement)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                      {formatPrice(selectedOrder.total)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-white/60" />
                  <span className="text-white/80 text-sm">
                    {PAIEMENT_LABELS[selectedOrder.paiement_methode]} -{' '}
                    {selectedOrder.paiement_statut === 'en_attente' ? 'En attente' : 'Payé'}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-white/5 rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-2">Notes</h3>
                  <p className="text-white/80 text-sm">{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 p-6 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => setShowDetailModal(false)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Fermer
              </Button>
              {selectedOrder.statut === 'en_attente' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'annule');
                      setShowDetailModal(false);
                    }}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/20"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                  <Button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'confirme');
                      setShowDetailModal(false);
                    }}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmer
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
