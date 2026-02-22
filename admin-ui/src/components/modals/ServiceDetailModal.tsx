import { useQuery } from '@tanstack/react-query';
import { X, Loader2, Briefcase, Edit, Calendar, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { servicesApi, type Service } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ServiceDetailResponse {
  service: Service;
  stats: {
    ca_total: number;
    nb_rdv_total: number;
    nb_rdv_termines: number;
    nb_clients_uniques: number;
    derniere_reservation: string | null;
  };
  top_clients: Array<{
    id: number;
    prenom: string;
    nom: string;
    nb_rdv: number;
  }>;
  historique_rdv: Array<{
    id: number;
    date: string;
    heure: string;
    statut: string;
    prix_total: number;
    client_nom: string;
  }>;
}

interface ServiceDetailModalProps {
  service: Service;
  onClose: () => void;
  onEdit?: () => void;
}

export function ServiceDetailModal({ service, onClose, onEdit }: ServiceDetailModalProps) {
  const { data, isLoading } = useQuery<ServiceDetailResponse>({
    queryKey: ['service-detail', service.id],
    queryFn: () => servicesApi.get(service.id),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>{service.nom}</CardTitle>
              <p className="text-sm text-gray-500">
                {formatCurrency(service.prix / 100)} • {formatDuration(service.duree)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Modifier
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(data.stats.ca_total)}</p>
                  <p className="text-xs text-green-600">CA Total</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{data.stats.nb_rdv_total}</p>
                  <p className="text-xs text-blue-600">RDV Total</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-700">{data.stats.nb_rdv_termines}</p>
                  <p className="text-xs text-purple-600">RDV Terminés</p>
                </div>
                <div className="bg-cyan-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-cyan-700">{data.stats.nb_clients_uniques}</p>
                  <p className="text-xs text-cyan-600">Clients Uniques</p>
                </div>
              </div>

              {/* Dernière réservation */}
              {data.stats.derniere_reservation && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <Calendar className="h-4 w-4 inline mr-2 text-gray-500" />
                    <span className="font-medium">Dernière réservation :</span> {formatDate(data.stats.derniere_reservation)}
                  </p>
                </div>
              )}

              {/* Top clients */}
              {data.top_clients && data.top_clients.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Clients les plus fidèles
                  </h3>
                  <div className="space-y-2">
                    {data.top_clients.map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                            {client.prenom[0]}{client.nom[0]}
                          </div>
                          <p className="font-medium text-sm">{client.prenom} {client.nom}</p>
                        </div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {client.nb_rdv} RDV
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historique RDV */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Dernières réservations
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.historique_rdv.map((rdv) => (
                    <div key={rdv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{rdv.client_nom}</p>
                        <p className="text-xs text-gray-500">{formatDate(rdv.date)} à {rdv.heure}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                          {formatCurrency(rdv.prix_total / 100)}
                        </span>
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
                    </div>
                  ))}
                  {data.historique_rdv.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune réservation</p>
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

export default ServiceDetailModal;
