import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Star, Check, X, Clock, MessageSquare } from 'lucide-react';

interface Review {
  id: number;
  client_prenom: string;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
}

type Tab = 'pending' | 'approved' | 'rejected';

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/reviews/admin?status=${tab}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReviews(data.reviews || []);
      setPendingCount(data.pendingCount || 0);
    } catch {
      console.error('Erreur chargement avis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [tab]);

  const handleAction = async (id: number, status: 'approved' | 'rejected') => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/reviews/admin/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchReviews();
      }
    } catch {
      console.error('Erreur action avis');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-4 h-4 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'}`}
        />
      ))}
    </div>
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: `En attente${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { key: 'approved', label: 'Approuvés' },
    { key: 'rejected', label: 'Rejetés' },
  ];

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Avis Clients</h1>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.key
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="text-center py-12 text-zinc-400">Chargement...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            {tab === 'pending' && 'Aucun avis en attente de modération'}
            {tab === 'approved' && 'Aucun avis approuvé'}
            {tab === 'rejected' && 'Aucun avis rejeté'}
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-white">
                        {review.client_prenom}
                      </span>
                      {renderStars(review.rating)}
                      <span className="text-xs text-zinc-500">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-zinc-300 text-sm">{review.comment}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {tab === 'pending' && (
                    <div className="flex gap-2 ml-4 shrink-0">
                      <button
                        onClick={() => handleAction(review.id, 'approved')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-900/30 text-green-400 border border-green-800 rounded-lg text-sm hover:bg-green-900/50 transition"
                      >
                        <Check className="w-4 h-4" />
                        Approuver
                      </button>
                      <button
                        onClick={() => handleAction(review.id, 'rejected')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-800 rounded-lg text-sm hover:bg-red-900/50 transition"
                      >
                        <X className="w-4 h-4" />
                        Rejeter
                      </button>
                    </div>
                  )}

                  {tab === 'approved' && (
                    <div className="flex items-center gap-1 text-green-400 text-xs ml-4">
                      <Check className="w-3 h-3" />
                      Publié
                    </div>
                  )}

                  {tab === 'rejected' && (
                    <div className="flex items-center gap-1 text-red-400 text-xs ml-4">
                      <X className="w-3 h-3" />
                      Rejeté
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
