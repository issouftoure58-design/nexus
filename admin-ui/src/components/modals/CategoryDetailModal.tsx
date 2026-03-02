import { useQuery } from '@tanstack/react-query';
import { X, Loader2, Euro, TrendingDown, CheckCircle, Clock, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { comptaApi, type CategorieDetailResponse } from '@/lib/api';

interface CategoryDetailModalProps {
  categorie: string;
  onClose: () => void;
}

export function CategoryDetailModal({ categorie, onClose }: CategoryDetailModalProps) {
  const { data, isLoading } = useQuery<CategorieDetailResponse>({
    queryKey: ['categorie-detail', categorie],
    queryFn: () => comptaApi.getCategorieDetail(categorie),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {data?.categorie?.label || categorie}
              </CardTitle>
              {data?.categorie?.compte && (
                <p className="text-sm text-gray-500">
                  Compte {data.categorie.compte.numero} - {data.categorie.compte.libelle}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : data ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-orange-600 mb-1">
                    <Euro className="h-4 w-4" />
                    <span className="text-xs font-medium">Total TTC</span>
                  </div>
                  <p className="text-lg font-bold text-orange-700">{data.stats.total_ttc_euros} €</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-xs font-medium">Nb dépenses</span>
                  </div>
                  <p className="text-lg font-bold text-gray-700">{data.stats.nb_depenses}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Payées</span>
                  </div>
                  <p className="text-lg font-bold text-green-700">{data.stats.nb_payees}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium">Non payées</span>
                  </div>
                  <p className="text-lg font-bold text-amber-700">{data.stats.nb_non_payees}</p>
                </div>
              </div>

              {/* Additional stats */}
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Moyenne:</span>
                  <span className="font-medium">{formatCurrency(data.stats.moyenne_ttc)}</span>
                </div>
                {data.stats.derniere_depense && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">Dernière:</span>
                    <span className="font-medium">{formatDate(data.stats.derniere_depense)}</span>
                  </div>
                )}
              </div>

              {/* Expenses list */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Historique des dépenses</h3>
                {data.depenses.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Aucune dépense dans cette catégorie</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.depenses.map((depense) => (
                      <div
                        key={depense.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{depense.libelle || 'Dépense'}</p>
                          <p className="text-xs text-gray-500">{formatDate(depense.date)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-red-600">
                            -{depense.montant_ttc_euros} €
                          </span>
                          <Badge
                            variant="outline"
                            className={depense.payee
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            }
                          >
                            {depense.payee ? 'Payée' : 'Non payée'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-gray-500">Erreur de chargement</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CategoryDetailModal;
