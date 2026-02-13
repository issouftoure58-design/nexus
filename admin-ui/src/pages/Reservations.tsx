import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { reservationsApi, type Reservation, type ReservationsResponse } from '@/lib/api';
import {
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  MoreVertical,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Filter,
  Euro
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  demande: { label: 'Demande', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock },
  en_attente: { label: 'En attente', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Clock },
  en_attente_paiement: { label: 'Attente paiement', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: Euro },
  confirme: { label: 'Confirmé', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Calendar },
  termine: { label: 'Terminé', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
  annule: { label: 'Annulé', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

export default function Reservations() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const { data, isLoading, error } = useQuery<ReservationsResponse>({
    queryKey: ['reservations', selectedDate, selectedStatus, page],
    queryFn: () => reservationsApi.list({
      date: selectedDate || undefined,
      statut: selectedStatus || undefined,
      page
    }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: string }) =>
      reservationsApi.updateStatus(id, statut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const formatTime = (heure: string) => heure?.slice(0, 5) || '--:--';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
  };

  // Navigate dates
  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Group reservations by time slot
  const groupedReservations = data?.reservations.reduce((acc, rdv) => {
    const hour = rdv.heure.split(':')[0];
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(rdv);
    return acc;
  }, {} as Record<string, Reservation[]>) || {};

  return (
    <Layout
      title="Réservations"
      subtitle={formatDate(selectedDate)}
    >
      <div className="space-y-6">
        {/* Header controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
            <Button variant="outline" size="sm" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Aujourd'hui
            </Button>
          </div>

          {/* Filters and actions */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm bg-white"
            >
              <option value="">Tous les statuts</option>
              <option value="demande">Demandes</option>
              <option value="confirme">Confirmés</option>
              <option value="en_attente">En attente</option>
              <option value="termine">Terminés</option>
              <option value="annule">Annulés</option>
            </select>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = data?.reservations.filter(r => r.statut === status).length || 0;
            const Icon = config.icon;
            return (
              <Card
                key={status}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  selectedStatus === status && 'ring-2 ring-cyan-500'
                )}
                onClick={() => setSelectedStatus(selectedStatus === status ? '' : status)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className={cn('p-2 rounded-lg', config.color.split(' ')[0])}>
                      <Icon className={cn('h-4 w-4', config.color.split(' ')[1])} />
                    </div>
                    <span className="text-2xl font-bold">{count}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{config.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

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
                <p className="text-sm text-red-700">Impossible de charger les réservations</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reservations timeline */}
        {!isLoading && !error && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-cyan-600" />
                Planning du jour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.keys(groupedReservations).length > 0 ? (
                  Object.entries(groupedReservations)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([hour, reservations]) => (
                      <div key={hour} className="flex gap-4">
                        {/* Time column */}
                        <div className="w-16 flex-shrink-0">
                          <p className="text-lg font-semibold text-gray-900">{hour}:00</p>
                        </div>

                        {/* Reservations column */}
                        <div className="flex-1 space-y-2">
                          {reservations.map((rdv) => {
                            const statusConfig = STATUS_CONFIG[rdv.statut] || STATUS_CONFIG.demande;
                            return (
                              <div
                                key={rdv.id}
                                className={cn(
                                  'p-4 rounded-lg border-l-4 bg-white shadow-sm',
                                  rdv.statut === 'confirme' && 'border-l-blue-500 bg-blue-50/30',
                                  rdv.statut === 'termine' && 'border-l-green-500 bg-green-50/30',
                                  rdv.statut === 'annule' && 'border-l-red-500 bg-red-50/30',
                                  rdv.statut === 'en_attente' && 'border-l-yellow-500 bg-yellow-50/30',
                                  rdv.statut === 'demande' && 'border-l-gray-400'
                                )}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className={statusConfig.color}>
                                        {statusConfig.label}
                                      </Badge>
                                      <span className="text-sm text-gray-500">
                                        {formatTime(rdv.heure)} • {rdv.duree} min
                                      </span>
                                    </div>
                                    <h4 className="font-medium text-gray-900">{rdv.service_nom}</h4>
                                    {rdv.clients && (
                                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                          <User className="h-3.5 w-3.5" />
                                          {rdv.clients.prenom} {rdv.clients.nom}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Phone className="h-3.5 w-3.5" />
                                          {rdv.clients.telephone}
                                        </span>
                                      </div>
                                    )}
                                    {rdv.notes && (
                                      <p className="mt-2 text-sm text-gray-500 italic">
                                        Note: {rdv.notes}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-col items-end gap-2">
                                    <span className="text-lg font-bold text-gray-900">
                                      {formatCurrency(rdv.prix_total)}
                                    </span>

                                    {/* Quick actions */}
                                    <div className="flex gap-1">
                                      {rdv.statut === 'demande' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                          onClick={() => updateStatusMutation.mutate({ id: rdv.id, statut: 'confirme' })}
                                          disabled={updateStatusMutation.isPending}
                                        >
                                          Confirmer
                                        </Button>
                                      )}
                                      {rdv.statut === 'confirme' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                          onClick={() => updateStatusMutation.mutate({ id: rdv.id, statut: 'termine' })}
                                          disabled={updateStatusMutation.isPending}
                                        >
                                          Terminer
                                        </Button>
                                      )}
                                      {['demande', 'confirme', 'en_attente'].includes(rdv.statut) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                                          onClick={() => {
                                            if (confirm('Annuler ce rendez-vous ?')) {
                                              updateStatusMutation.mutate({ id: rdv.id, statut: 'annule' });
                                            }
                                          }}
                                          disabled={updateStatusMutation.isPending}
                                        >
                                          Annuler
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Aucune réservation pour cette date</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
