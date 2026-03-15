/**
 * Page Commandes Commerce
 * Gestion des commandes pour les tenants de type commerce
 * Vue Kanban (defaut) + Vue Liste
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ShoppingBag, RefreshCw, List, LayoutGrid, ChevronRight,
  Clock, CheckCircle, Package, Truck, XCircle, Search,
  Plus, X, MinusCircle, PlusCircle, User, Phone, Mail,
  CreditCard, Banknote, FileText
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  order_type: 'online' | 'click_collect' | 'delivery';
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  total: number;
  pickup_date?: string;
  pickup_time?: string;
  customer_notes?: string;
  admin_notes?: string;
  created_at: string;
  confirmed_at?: string;
  ready_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  items?: OrderItem[];
  payment_method?: string;
}

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

interface OrderStats {
  total: number;
  byStatus: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'En attente', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: Clock },
  confirmed: { label: 'Confirmee', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: CheckCircle },
  preparing: { label: 'En preparation', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', icon: Package },
  ready: { label: 'Prete', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: Truck },
  completed: { label: 'Terminee', color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200', icon: CheckCircle },
  cancelled: { label: 'Annulee', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: XCircle },
};

const KANBAN_COLUMNS: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

const NEXT_STATUS: Record<string, OrderStatus> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

const ORDER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  online: { label: 'En ligne', color: 'bg-cyan-100 text-cyan-800' },
  click_collect: { label: 'Click & Collect', color: 'bg-indigo-100 text-indigo-800' },
  delivery: { label: 'Livraison', color: 'bg-orange-100 text-orange-800' },
};

// ═══════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════

const commerceApi = {
  getOrders: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<{ orders: Order[]; count: number }>(`/admin/commerce/orders${qs}`);
  },
  getOrderStats: () => api.get<OrderStats>('/admin/commerce/orders/stats'),
  getOrder: (id: number) => api.get<Order>(`/admin/commerce/orders/${id}`),
  updateStatus: (id: number, status: string, adminNotes?: string, mode_paiement?: string) =>
    api.patch<Order>(`/admin/commerce/orders/${id}/status`, { status, adminNotes, mode_paiement }),
  cancelOrder: (id: number, reason?: string) =>
    api.delete<{ success: boolean }>(`/admin/commerce/orders/${id}`, { body: JSON.stringify({ reason }) }),
  createOrder: (data: CreateOrderPayload) =>
    api.post<{ success: boolean; order: Order }>('/admin/commerce/orders', data),
  getServices: () =>
    api.get<{ data: ServiceItem[] }>('/admin/services'),
};

interface ServiceItem {
  id: number;
  nom: string;
  prix: number;
  taux_tva: number;
  categorie?: string;
  actif: boolean;
}

interface OrderLineItem {
  serviceId: number;
  nom: string;
  prix: number;
  quantity: number;
}

interface CreateOrderPayload {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: string;
  items: { serviceId: number; quantity: number }[];
  pickupDate?: string;
  pickupTime?: string;
  customerNotes?: string;
  paymentMethod?: string;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Commandes() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [pendingCheckoutOrder, setPendingCheckoutOrder] = useState<Order | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const queryClient = useQueryClient();

  // Fetch orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['commerce-orders', statusFilter, typeFilter],
    queryFn: () => {
      const params: Record<string, string> = { limit: '200' };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.orderType = typeFilter;
      return commerceApi.getOrders(params);
    },
    refetchInterval: 30000, // Auto-refresh toutes les 30s
  });

  // Fetch stats
  const { data: _stats } = useQuery({
    queryKey: ['commerce-orders-stats'],
    queryFn: commerceApi.getOrderStats,
    refetchInterval: 30000,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, mode_paiement }: { id: number; status: string; mode_paiement?: string }) =>
      commerceApi.updateStatus(id, status, undefined, mode_paiement),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['commerce-orders'] });
      queryClient.invalidateQueries({ queryKey: ['commerce-orders-stats'] });
      // Invalidate invoices cache when checkout creates a facture
      if (variables.status === 'completed' && variables.mode_paiement) {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }
    },
  });

  // Intercept status click: open checkout modal for 'completed'
  const handleStatusClick = (order: Order, nextStatus: string) => {
    if (nextStatus === 'completed') {
      setPendingCheckoutOrder(order);
    } else {
      updateStatusMutation.mutate({ id: order.id, status: nextStatus });
    }
  };

  const orders = ordersData?.orders || [];

  // Filter by search
  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q)
    );
  });

  // Stats calculations — filtrage par période
  const getPeriodStart = (period: 'day' | 'week' | 'month' | 'year') => {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week': {
        const day = now.getDay() || 7; // lundi = 1
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      }
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
    }
  };

  const periodStart = getPeriodStart(statsPeriod);
  const periodOrders = orders.filter(o => new Date(o.created_at) >= periodStart);
  const periodRevenue = periodOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);
  const validOrders = periodOrders.filter(o => o.status !== 'cancelled');
  const avgBasket = validOrders.length > 0 ? periodRevenue / validOrders.length : 0;

  // Répartition par moyen de paiement
  const paymentBreakdown = validOrders.reduce<Record<string, number>>((acc, o) => {
    const method = o.payment_method || 'non_renseigne';
    acc[method] = (acc[method] || 0) + o.total;
    return acc;
  }, {});

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  // ═══════════════════════════════════════════════════════════════
  // ORDER CARD (Kanban)
  // ═══════════════════════════════════════════════════════════════

  const OrderCard = ({ order }: { order: Order }) => {
    const typeInfo = ORDER_TYPE_LABELS[order.order_type] || ORDER_TYPE_LABELS.online;
    const nextStatus = NEXT_STATUS[order.status];

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs font-semibold text-gray-900">{order.order_number}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
        </div>

        {/* Client */}
        <p className="text-sm font-medium text-gray-800 truncate">{order.customer_name}</p>
        <p className="text-xs text-gray-500">{formatTime(order.created_at)}</p>

        {/* Items summary */}
        {order.items && order.items.length > 0 && (
          <div className="mt-2 text-xs text-gray-600">
            {order.items.slice(0, 3).map((item, i) => (
              <div key={i} className="truncate">{item.quantity}x {item.product_name}</div>
            ))}
            {order.items.length > 3 && (
              <div className="text-gray-400">+{order.items.length - 3} autres</div>
            )}
          </div>
        )}

        {/* Total + Action */}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-semibold text-sm text-gray-900">{formatPrice(order.total)}</span>
          {nextStatus && (
            <button
              onClick={() => handleStatusClick(order, nextStatus)}
              disabled={updateStatusMutation.isPending}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-cyan-50 text-cyan-700 rounded-md hover:bg-cyan-100 transition-colors font-medium"
            >
              <ChevronRight className="w-3 h-3" />
              {STATUS_CONFIG[nextStatus]?.label}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
            <p className="text-sm text-gray-500">Gestion des commandes en temps reel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('kanban')}
              className={`p-2 rounded-md transition-colors ${view === 'kanban' ? 'bg-white shadow-sm text-cyan-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-cyan-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNewOrderModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nouvelle commande
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="space-y-3">
        <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
          {([
            { value: 'day', label: 'Jour' },
            { value: 'week', label: 'Semaine' },
            { value: 'month', label: 'Mois' },
            { value: 'year', label: 'Année' },
          ] as const).map(p => (
            <button
              key={p.value}
              onClick={() => setStatsPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statsPeriod === p.value
                  ? 'bg-white shadow-sm text-cyan-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Commandes</p>
            <p className="text-2xl font-bold text-gray-900">{periodOrders.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Chiffre d'affaires</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(periodRevenue)}</p>
            {periodRevenue > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(paymentBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([method, amount]) => {
                    const label: Record<string, string> = { cb: 'CB', especes: 'Especes', cheque: 'Cheque', virement: 'Virement', prelevement: 'Prelevement', non_renseigne: 'Non renseigne' };
                    const pct = Math.round((amount / periodRevenue) * 100);
                    return (
                      <div key={method} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{label[method] || method}</span>
                        <span className="font-medium text-gray-700">{formatPrice(amount)} <span className="text-gray-400">({pct}%)</span></span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Panier moyen</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(avgBasket || 0)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Tous les types</option>
          {Object.entries(ORDER_TYPE_LABELS).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Kanban View */}
      {!isLoading && view === 'kanban' && (
        <div className="grid grid-cols-5 gap-4 min-h-[400px]">
          {KANBAN_COLUMNS.map((status) => {
            const config = STATUS_CONFIG[status];
            const columnOrders = filteredOrders.filter(o => o.status === status);
            const Icon = config.icon;

            return (
              <div key={status} className={`rounded-xl border p-3 ${config.bgColor}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <h3 className={`text-sm font-semibold ${config.color}`}>{config.label}</h3>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${config.color} bg-white/60`}>
                    {columnOrders.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {columnOrders.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-8">Aucune commande</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!isLoading && view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const statusCfg = STATUS_CONFIG[order.status];
                const typeInfo = ORDER_TYPE_LABELS[order.order_type] || ORDER_TYPE_LABELS.online;
                const nextStatus = NEXT_STATUS[order.status];

                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{order.order_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{order.customer_name}</div>
                      <div className="text-xs text-gray-500">{order.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatPrice(order.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(order.created_at)} {formatTime(order.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {nextStatus && (
                        <button
                          onClick={() => handleStatusClick(order, nextStatus)}
                          disabled={updateStatusMutation.isPending}
                          className="text-xs px-3 py-1 bg-cyan-50 text-cyan-700 rounded-md hover:bg-cyan-100 transition-colors font-medium"
                        >
                          {STATUS_CONFIG[nextStatus]?.label}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    Aucune commande trouvee
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* New Order Modal */}
      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onCreated={() => {
            setShowNewOrderModal(false);
            queryClient.invalidateQueries({ queryKey: ['commerce-orders'] });
            queryClient.invalidateQueries({ queryKey: ['commerce-orders-stats'] });
          }}
        />
      )}

      {/* Checkout Modal */}
      {pendingCheckoutOrder && (
        <CommerceCheckoutModal
          order={pendingCheckoutOrder}
          onClose={() => setPendingCheckoutOrder(null)}
          onConfirm={(modePaiement) => {
            updateStatusMutation.mutate(
              { id: pendingCheckoutOrder.id, status: 'completed', mode_paiement: modePaiement },
              { onSuccess: () => setPendingCheckoutOrder(null) }
            );
          }}
          isPending={updateStatusMutation.isPending}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMMERCE CHECKOUT MODAL
// ═══════════════════════════════════════════════════════════════

function CommerceCheckoutModal({
  order,
  onClose,
  onConfirm,
  isPending,
}: {
  order: Order;
  onClose: () => void;
  onConfirm: (modePaiement: string) => void;
  isPending: boolean;
}) {
  const [modePaiement, setModePaiement] = useState('cb');

  // Fetch full order detail (with items) on mount
  const { data: fullOrder, isLoading: loadingDetail } = useQuery({
    queryKey: ['commerce-order-detail', order.id],
    queryFn: () => commerceApi.getOrder(order.id),
  });

  const items = fullOrder?.items || order.items || [];

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  const paymentMethods = [
    { value: 'cb', label: 'Carte bancaire', icon: CreditCard },
    { value: 'especes', label: 'Espèces', icon: Banknote },
    { value: 'cheque', label: 'Chèque', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Encaissement</h2>
            <p className="text-xs text-gray-500">Commande {order.order_number}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/60 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Recap items */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Récapitulatif</h3>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
              {loadingDetail && (
                <div className="flex justify-center py-3">
                  <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loadingDetail && items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.quantity}x {item.product_name}</span>
                  <span className="font-medium text-gray-900">{formatPrice(item.line_total)}</span>
                </div>
              ))}
              {!loadingDetail && items.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">Aucun article</p>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-3 py-2 bg-cyan-50 rounded-lg">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-cyan-700">{formatPrice(order.total)}</span>
          </div>

          {/* Client */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">{order.customer_name}</span>
            {order.customer_email && <span className="text-gray-400 ml-2">({order.customer_email})</span>}
          </div>

          {/* Mode de paiement */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Mode de paiement</h3>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(pm => {
                const Icon = pm.icon;
                return (
                  <button
                    key={pm.value}
                    type="button"
                    onClick={() => setModePaiement(pm.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                      modePaiement === pm.value
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{pm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(modePaiement)}
            disabled={isPending}
            className="px-5 py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-semibold"
          >
            {isPending ? 'Encaissement...' : `Encaisser ${formatPrice(order.total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEW ORDER MODAL
// ═══════════════════════════════════════════════════════════════

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [orderType, setOrderType] = useState('click_collect');
  const today = new Date().toISOString().split('T')[0];
  const [pickupDate, setPickupDate] = useState(today);
  const [pickupTime, setPickupTime] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [lines, setLines] = useState<OrderLineItem[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load prep time from tenant config
  const { data: configData } = useQuery({
    queryKey: ['profile-config'],
    queryFn: () => api.get<{ config: Record<string, unknown> }>('/admin/profile/config'),
  });
  const prepTimeMinutes = (configData?.config?.commerce_prep_time as number) || 30;

  // Auto-set pickup time = now + prep time
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + prepTimeMinutes);
    const m = Math.ceil(now.getMinutes() / 5) * 5;
    const h = now.getHours() + Math.floor(m / 60);
    const finalM = m % 60;
    setPickupTime(`${String(h).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`);
  }, [prepTimeMinutes]);

  // Load services (products)
  const { data: servicesData } = useQuery({
    queryKey: ['commerce-services'],
    queryFn: commerceApi.getServices,
  });
  const services = (servicesData?.data || []).filter(s => s.actif !== false);

  // Add product line
  const addLine = (serviceId: number) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    const existing = lines.find(l => l.serviceId === serviceId);
    if (existing) {
      setLines(lines.map(l => l.serviceId === serviceId ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      setLines([...lines, { serviceId, nom: service.nom, prix: service.prix, quantity: 1 }]);
    }
  };

  const updateQty = (serviceId: number, qty: number) => {
    if (qty <= 0) {
      setLines(lines.filter(l => l.serviceId !== serviceId));
    } else {
      setLines(lines.map(l => l.serviceId === serviceId ? { ...l, quantity: qty } : l));
    }
  };

  const removeLine = (serviceId: number) => {
    setLines(lines.filter(l => l.serviceId !== serviceId));
  };

  const total = lines.reduce((sum, l) => sum + l.prix * l.quantity, 0);

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  const handleSubmit = async () => {
    setError('');
    if (!customerName.trim()) return setError('Nom du client requis');
    if (!customerPhone.trim()) return setError('Téléphone requis');
    if (lines.length === 0) return setError('Ajoutez au moins un produit');
    if ((orderType === 'click_collect' || orderType === 'delivery') && !pickupDate)
      return setError(orderType === 'delivery' ? 'Date de livraison requise' : 'Date de retrait requise');

    setSubmitting(true);
    try {
      await commerceApi.createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        orderType,
        items: lines.map(l => ({ serviceId: l.serviceId, quantity: l.quantity })),
        pickupDate: pickupDate || undefined,
        pickupTime: pickupTime || undefined,
        customerNotes: customerNotes.trim() || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nouvelle commande</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Client */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Client</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nom *"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  placeholder="Téléphone *"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="Email (optionnel)"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Order type */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Type de commande</h3>
            <div className="flex gap-2">
              {[
                { value: 'click_collect', label: 'Click & Collect' },
                { value: 'online', label: 'Sur place' },
                { value: 'delivery', label: 'Livraison' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOrderType(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    orderType === opt.value
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pickup/delivery date/time */}
          {(orderType === 'click_collect' || orderType === 'delivery') && (
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {orderType === 'delivery' ? 'Date de livraison *' : 'Date de retrait *'}
                  </label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={e => setPickupDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {orderType === 'delivery' ? 'Heure de livraison estimée' : 'Heure de retrait estimée'}
                  </label>
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={e => setPickupTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Temps de préparation estimé : {prepTimeMinutes} min
              </p>
            </div>
          )}

          {/* Products */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Produits</h3>

            {/* Added lines */}
            {lines.length > 0 && (
              <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                {lines.map(line => (
                  <div key={line.serviceId} className="flex items-center justify-between gap-2 bg-white rounded-lg p-2 border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{line.nom}</p>
                      <p className="text-xs text-gray-500">{formatPrice(line.prix)} / unité</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateQty(line.serviceId, line.quantity - 1)} className="p-1 hover:bg-gray-100 rounded">
                        <MinusCircle className="w-4 h-4 text-gray-500" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
                      <button type="button" onClick={() => updateQty(line.serviceId, line.quantity + 1)} className="p-1 hover:bg-gray-100 rounded">
                        <PlusCircle className="w-4 h-4 text-cyan-500" />
                      </button>
                    </div>
                    <button type="button" onClick={() => removeLine(line.serviceId)} className="p-1 hover:bg-red-100 rounded">
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                    <span className="text-sm font-semibold text-green-600 min-w-[70px] text-right">
                      {formatPrice(line.prix * line.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Add product dropdown */}
            <select
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              defaultValue=""
              onChange={e => { if (e.target.value) { addLine(parseInt(e.target.value)); e.target.value = ''; } }}
            >
              <option value="">+ Ajouter un produit...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nom} — {formatPrice(s.prix)}
                </option>
              ))}
            </select>

            {lines.length === 0 && (
              <p className="text-xs text-amber-600">Sélectionnez au moins un produit</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
            <textarea
              value={customerNotes}
              onChange={e => setCustomerNotes(e.target.value)}
              rows={2}
              placeholder="Instructions spéciales..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <div>
            {lines.length > 0 && (
              <p className="text-lg font-bold text-gray-900">Total : {formatPrice(total)}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || lines.length === 0}
              className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50 font-medium"
            >
              {submitting ? 'Création...' : 'Créer la commande'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
