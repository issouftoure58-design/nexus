/**
 * Page Avis Clients — Moderation des avis
 * Stats, filtres, liste, actions approuver/rejeter, lightbox photo
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Star, Clock, CheckCircle2, XCircle, Loader2, Eye, X,
} from 'lucide-react';
import { reviewsApi } from '@/lib/api';

interface Review {
  id: string;
  client_prenom: string;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  service_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approuve', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejete', color: 'bg-red-100 text-red-700' },
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );
}

export default function AvisClients() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reviews-admin', statusFilter],
    queryFn: () => reviewsApi.list({ status: statusFilter || undefined }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      reviewsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews-admin'] });
    },
  });

  const reviews: Review[] = (data?.reviews || []) as Review[];
  const pagination = data?.pagination;
  const total = pagination?.total || 0;
  const pendingCount = data?.pendingCount || 0;
  const approvedCount = reviews.filter(r => r.status === 'approved').length;
  const rejectedCount = reviews.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-500" />
          Avis Clients
        </h1>
        <p className="text-gray-500 mt-1">Moderez les avis laisses par vos clients</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('')}>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('pending')}>
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            <p className="text-xs text-gray-500">En attente</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('approved')}>
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
            <p className="text-xs text-gray-500">Approuves</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('rejected')}>
          <CardContent className="pt-4 pb-4 text-center">
            <XCircle className="w-5 h-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
            <p className="text-xs text-gray-500">Rejetes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter indicator */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{STATUS_CONFIG[statusFilter]?.label || statusFilter}</Badge>
          <button onClick={() => setStatusFilter('')} className="text-sm text-cyan-600 hover:underline">Tout afficher</button>
        </div>
      )}

      {/* Liste des avis */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucun avis pour le moment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Note</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Commentaire</th>
                    <th className="py-3 px-4">Photo</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map(review => (
                    <tr key={review.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{review.client_prenom || '-'}</td>
                      <td className="py-3 px-4"><Stars rating={review.rating} /></td>
                      <td className="py-3 px-4 text-gray-500">{review.service_name || '-'}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{review.comment || '-'}</td>
                      <td className="py-3 px-4">
                        {review.photo_url ? (
                          <button
                            onClick={() => setLightboxUrl(review.photo_url)}
                            className="relative group"
                          >
                            <img
                              src={review.photo_url}
                              alt="Avis"
                              className="w-10 h-10 rounded object-cover border"
                            />
                            <div className="absolute inset-0 bg-black/30 rounded opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {new Date(review.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={STATUS_CONFIG[review.status]?.color || ''}>
                          {STATUS_CONFIG[review.status]?.label || review.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {review.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => updateMutation.mutate({ id: review.id, status: 'approved' })}
                              disabled={updateMutation.isPending}
                              className="text-green-600 hover:text-green-800 hover:bg-green-50"
                              title="Approuver"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => updateMutation.mutate({ id: review.id, status: 'rejected' })}
                              disabled={updateMutation.isPending}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Rejeter"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox photo */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="Photo avis"
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
