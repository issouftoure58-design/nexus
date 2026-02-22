import { useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { clientsApi, type Client } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
}

export function ClientDetailModal({ client, onClose }: ClientDetailModalProps) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['client', client.id],
    queryFn: () => clientsApi.get(client.id),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
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
                <div className="space-y-2 max-h-64 overflow-y-auto">
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

export default ClientDetailModal;
