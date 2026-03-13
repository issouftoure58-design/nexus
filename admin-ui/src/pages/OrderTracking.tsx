import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface TrackingData {
  order: {
    order_number: string;
    status: string;
    order_type: string;
    customer_name: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    delivery_fee: number;
    pickup_date: string | null;
    pickup_time: string | null;
    customer_notes: string | null;
    created_at: string;
    updated_at: string;
    items: OrderItem[];
  };
  tenant_name: string;
}

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmee',
  preparing: 'En preparation',
  ready: 'Prete',
  completed: 'Terminee',
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  click_collect: 'Click & Collect',
  delivery: 'Livraison',
  online: 'Sur place',
};

export default function OrderTracking() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTracking = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/orders/track/${token}`);
      if (!res.ok) {
        setError(true);
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 30000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Commande introuvable</h1>
          <p className="text-gray-500">Ce lien de suivi est invalide ou a expire.</p>
        </div>
      </div>
    );
  }

  const { order, tenant_name } = data;
  const currentIdx = STATUSES.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const isDelivery = order.order_type === 'delivery';
  const typeLabel = isDelivery ? 'livraison' : 'retrait';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <p className="text-sm text-gray-500 mb-1">{tenant_name}</p>
          <h1 className="text-xl font-bold text-gray-900">
            Commande {order.order_number}
          </h1>
          <span className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700">
            {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Timeline */}
        {isCancelled ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700 font-semibold">Commande annulee</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Suivi</h2>
            {/* Desktop: horizontal */}
            <div className="hidden sm:flex items-center justify-between">
              {STATUSES.map((s, i) => {
                const isPast = i < currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center relative">
                    {/* Connector line */}
                    {i > 0 && (
                      <div
                        className={`absolute top-3 right-1/2 w-full h-0.5 -z-0 ${
                          isPast || isCurrent ? 'bg-cyan-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                    {/* Circle */}
                    <div
                      className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isPast
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-cyan-500 text-white ring-4 ring-cyan-100'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isPast ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`mt-2 text-xs text-center ${
                        isCurrent ? 'font-bold text-cyan-700' : isPast ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Mobile: vertical */}
            <div className="sm:hidden space-y-3">
              {STATUSES.map((s, i) => {
                const isPast = i < currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isPast
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-cyan-500 text-white ring-4 ring-cyan-100'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isPast ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`text-sm ${
                        isCurrent ? 'font-bold text-cyan-700' : isPast ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Date/heure de retrait ou livraison */}
        {order.pickup_date && (
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Date de {typeLabel}
            </h2>
            <p className="text-gray-900 font-medium">
              {new Date(order.pickup_date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              {order.pickup_time && ` a ${order.pickup_time}`}
            </p>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Articles</h2>
          <div className="divide-y">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between py-2.5">
                <span className="text-gray-800">
                  {item.quantity}x {item.product_name}
                </span>
                <span className="text-gray-600 font-medium">
                  {((item.unit_price * item.quantity) / 100).toFixed(2)} €
                </span>
              </div>
            ))}
          </div>
          <div className="border-t-2 border-gray-900 mt-2 pt-3 flex justify-between font-bold text-gray-900">
            <span>Total</span>
            <span>{(order.total / 100).toFixed(2)} €</span>
          </div>
        </div>

        {/* Notes client */}
        {order.customer_notes && (
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Notes</h2>
            <p className="text-gray-600 text-sm">{order.customer_notes}</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pt-4">
          Cette page se rafraichit automatiquement toutes les 30 secondes.
        </p>
      </div>
    </div>
  );
}
