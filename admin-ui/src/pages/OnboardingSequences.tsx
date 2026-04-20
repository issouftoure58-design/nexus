/**
 * OnboardingSequences — Suivi des enrollments d'onboarding post-paiement
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Ban,
  ChevronRight,
  X,
  CreditCard,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Enrollment {
  id: string;
  client_email: string;
  client_name: string | null;
  status: 'active' | 'completed' | 'cancelled' | 'failed';
  current_step: number;
  total_steps: number;
  steps_completed: Array<{ step: number; completed_at: string; [key: string]: unknown }>;
  metadata: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

interface EnrollmentStats {
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
  completed_this_month: number;
  total: number;
  completion_rate: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  active: { label: 'En cours', color: 'bg-blue-100 text-blue-700', icon: Clock },
  completed: { label: 'Termine', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  failed: { label: 'Echoue', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: 'Annule', color: 'bg-gray-100 text-gray-700', icon: Ban },
};

export default function OnboardingSequences() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ client_email: '', client_name: '', amount: '', notes: '' });

  const { data: stats } = useQuery({
    queryKey: ['onboarding-stats'],
    queryFn: () => api.get<EnrollmentStats>('/api/admin/onboarding-sequences/stats'),
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['onboarding-enrollments', statusFilter, page],
    queryFn: () =>
      api.get<{ data: Enrollment[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
        `/api/admin/onboarding-sequences?page=${page}&limit=20${statusFilter ? `&status=${statusFilter}` : ''}`
      ),
  });

  const { data: detail } = useQuery({
    queryKey: ['onboarding-detail', selectedId],
    queryFn: () => api.get<Enrollment>(`/api/admin/onboarding-sequences/${selectedId}`),
    enabled: !!selectedId,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/onboarding-sequences/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-stats'] });
      setSelectedId(null);
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/onboarding-sequences/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-stats'] });
      setSelectedId(null);
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (data: { client_email: string; client_name?: string; amount?: number; notes?: string }) =>
      api.post('/api/admin/onboarding-sequences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-stats'] });
      setShowPaymentModal(false);
      setPaymentForm({ client_email: '', client_name: '', amount: '', notes: '' });
    },
  });

  const handlePaymentSubmit = () => {
    if (!paymentForm.client_email) return;
    paymentMutation.mutate({
      client_email: paymentForm.client_email,
      client_name: paymentForm.client_name || undefined,
      amount: paymentForm.amount ? parseFloat(paymentForm.amount) : undefined,
      notes: paymentForm.notes || undefined,
    });
  };

  const enrollments = listData?.data || [];
  const pagination = listData?.pagination;

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 p-3 sm:p-6">
      {/* Header + Bouton Paiement recu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Onboarding Sequences</h2>
          <p className="text-sm text-muted-foreground">Suivi des enrollments post-paiement</p>
        </div>
        <Button onClick={() => setShowPaymentModal(true)} className="gap-2">
          <CreditCard className="h-4 w-4" />
          Paiement recu
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.active ?? 0}</p>
                <p className="text-sm text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.completed_this_month ?? 0}</p>
                <p className="text-sm text-muted-foreground">Completes ce mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.failed ?? 0}</p>
                <p className="text-sm text-muted-foreground">Echoues</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UserCheck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.completion_rate ?? 0}%</p>
                <p className="text-sm text-muted-foreground">Taux reussite</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: '', label: 'Tous' },
          { value: 'active', label: 'En cours' },
          { value: 'completed', label: 'Completes' },
          { value: 'failed', label: 'Echoues' },
          { value: 'cancelled', label: 'Annules' },
        ].map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Enrollments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : enrollments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucun enrollment d'onboarding</p>
              <p className="text-sm mt-1">Les enrollments apparaitront ici apres le premier paiement Stripe</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Etape</th>
                    <th className="pb-3 font-medium">Date debut</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => {
                    const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.active;
                    const Icon = sc.icon;
                    return (
                      <tr
                        key={e.id}
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedId(e.id)}
                      >
                        <td className="py-3 font-medium">{e.client_name || '—'}</td>
                        <td className="py-3 text-sm text-muted-foreground">{e.client_email}</td>
                        <td className="py-3">
                          <Badge variant="secondary" className={sc.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {sc.label}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm">
                          {e.current_step}/{e.total_steps}
                        </td>
                        <td className="py-3 text-sm text-muted-foreground">{formatDate(e.started_at)}</td>
                        <td className="py-3">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {pagination.total} enrollment{pagination.total > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Precedent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage(page + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Paiement recu */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowPaymentModal(false)} />
          <div className="relative w-full max-w-md bg-background rounded-xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Paiement recu</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowPaymentModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Declencher manuellement le processus d'onboarding pour un client ayant paye.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input
                  type="email"
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                  placeholder="client@email.com"
                  value={paymentForm.client_email}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, client_email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nom du client</label>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                  placeholder="Jean Dupont"
                  value={paymentForm.client_name}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, client_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Montant</label>
                <input
                  type="number"
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                  rows={2}
                  placeholder="Notes internes..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            {paymentMutation.isError && (
              <p className="text-sm text-red-500 mt-3">
                {(paymentMutation.error as Error)?.message || 'Erreur lors du declenchement'}
              </p>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={handlePaymentSubmit}
                disabled={!paymentForm.client_email || paymentMutation.isPending}
              >
                {paymentMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Slide-over */}
      {selectedId && detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedId(null)} />
          <div className="relative w-full max-w-md bg-background shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Detail Enrollment</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{detail.client_name || '—'}</p>
                <p className="text-sm">{detail.client_email}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="secondary" className={STATUS_CONFIG[detail.status]?.color}>
                  {STATUS_CONFIG[detail.status]?.label}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Progression</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-muted rounded-full">
                    <div
                      className="h-2 bg-primary rounded-full transition-all"
                      style={{ width: `${detail.total_steps > 0 ? (detail.current_step / detail.total_steps) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{detail.current_step}/{detail.total_steps}</span>
                </div>
              </div>

              {/* Timeline des etapes */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Etapes completees</p>
                {detail.steps_completed && detail.steps_completed.length > 0 ? (
                  <div className="space-y-3">
                    {detail.steps_completed.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Etape {step.step}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(step.completed_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune etape completee</p>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Date debut</p>
                <p className="text-sm">{formatDate(detail.started_at)}</p>
              </div>

              {detail.completed_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Date fin</p>
                  <p className="text-sm">{formatDate(detail.completed_at)}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {detail.status === 'active' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => cancelMutation.mutate(detail.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Annuler
                  </Button>
                )}
                {(detail.status === 'failed' || detail.status === 'cancelled') && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => retryMutation.mutate(detail.id)}
                    disabled={retryMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Relancer
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
