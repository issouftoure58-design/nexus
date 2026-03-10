import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { comptaApi, type BalanceAuxiliaireResponse } from '@/lib/api';
import {
  Loader2,
  Users,
  Building2,
  UserCheck,
} from 'lucide-react';
import { AuxiliaryLedgerModal } from '@/components/modals/AuxiliaryLedgerModal';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

export default function ComptesAuxiliaires({ embedded }: { embedded?: boolean } = {}) {
  const [selectedAuxiliary, setSelectedAuxiliary] = useState<{ type: 'client' | 'fournisseur' | 'personnel'; compte: string; nom: string } | null>(null);
  const [statsYear] = useState<number>(new Date().getFullYear());

  // Query pour la Balance Clients
  const { data: balanceClientsData, isLoading: balanceClientsLoading } = useQuery<BalanceAuxiliaireResponse>({
    queryKey: ['balance-clients', statsYear],
    queryFn: () => comptaApi.getBalanceClients(statsYear),
  });

  // Query pour la Balance Fournisseurs
  const { data: balanceFournisseursData, isLoading: balanceFournisseursLoading } = useQuery<BalanceAuxiliaireResponse>({
    queryKey: ['balance-fournisseurs', statsYear],
    queryFn: () => comptaApi.getBalanceFournisseurs(statsYear),
  });

  // Query pour la Balance Personnel
  const { data: balancePersonnelData, isLoading: balancePersonnelLoading } = useQuery<BalanceAuxiliaireResponse>({
    queryKey: ['balance-personnel', statsYear],
    queryFn: () => comptaApi.getBalancePersonnel(statsYear),
  });

  return (
    <div className={embedded ? '' : 'p-6'}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Comptes Auxiliaires</h1>
          <p className="text-sm text-gray-500">Balance clients, fournisseurs et personnel — Exercice {statsYear}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Balance Clients */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  Balance Clients (411)
                </CardTitle>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {balanceClientsData?.comptes?.length || 0} comptes
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {balanceClientsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : balanceClientsData?.comptes && balanceClientsData.comptes.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {balanceClientsData.comptes.map((compte) => (
                    <div
                      key={compte.compte}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedAuxiliary({
                        type: 'client',
                        compte: compte.compte,
                        nom: compte.nom
                      })}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold">
                          {compte.nom.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{compte.nom}</p>
                          <p className="text-xs text-gray-500 font-mono">{compte.compte}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${compte.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(compte.solde))}
                        </p>
                        <p className="text-xs text-gray-500">{compte.solde >= 0 ? 'Débiteur' : 'Créditeur'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">Aucun compte client auxiliaire</p>
              )}
              {balanceClientsData?.totaux && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="font-medium text-gray-600">Total Clients</span>
                  <span className={`font-bold ${balanceClientsData.totaux.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(balanceClientsData.totaux.solde))}
                    <span className="text-xs ml-1">{balanceClientsData.totaux.solde >= 0 ? 'D' : 'C'}</span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Balance Fournisseurs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Building2 className="h-5 w-5 text-orange-600" />
                  </div>
                  Balance Fournisseurs (401)
                </CardTitle>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {balanceFournisseursData?.comptes?.length || 0} comptes
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {balanceFournisseursLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                </div>
              ) : balanceFournisseursData?.comptes && balanceFournisseursData.comptes.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {balanceFournisseursData.comptes.map((compte) => (
                    <div
                      key={compte.compte}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedAuxiliary({
                        type: 'fournisseur',
                        compte: compte.compte,
                        nom: compte.nom
                      })}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-semibold">
                          {compte.nom.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{compte.nom}</p>
                          <p className="text-xs text-gray-500 font-mono">{compte.compte}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${compte.solde < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(compte.solde))}
                        </p>
                        <p className="text-xs text-gray-500">{compte.solde >= 0 ? 'Débiteur' : 'Créditeur'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">Aucun compte fournisseur auxiliaire</p>
              )}
              {balanceFournisseursData?.totaux && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="font-medium text-gray-600">Total Fournisseurs</span>
                  <span className={`font-bold ${balanceFournisseursData.totaux.solde < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(balanceFournisseursData.totaux.solde))}
                    <span className="text-xs ml-1">{balanceFournisseursData.totaux.solde >= 0 ? 'D' : 'C'}</span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Balance Personnel */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <UserCheck className="h-5 w-5 text-purple-600" />
                  </div>
                  Balance Personnel (421/431)
                </CardTitle>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  {balancePersonnelData?.comptes?.length || 0} comptes
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {balancePersonnelLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                </div>
              ) : balancePersonnelData?.comptes && balancePersonnelData.comptes.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {balancePersonnelData.comptes.map((compte) => (
                    <div
                      key={compte.compte}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-purple-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedAuxiliary({
                        type: 'personnel',
                        compte: compte.compte,
                        nom: compte.nom
                      })}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-semibold">
                          {compte.nom.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{compte.nom}</p>
                          <p className="text-xs text-gray-500 font-mono">{compte.compte}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${compte.solde < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(compte.solde))}
                        </p>
                        <p className="text-xs text-gray-500">{compte.solde >= 0 ? 'Débiteur' : 'Créditeur'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">Aucun compte personnel auxiliaire</p>
              )}
              {balancePersonnelData?.totaux && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="font-medium text-gray-600">Total Personnel</span>
                  <span className={`font-bold ${balancePersonnelData.totaux.solde < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(balancePersonnelData.totaux.solde))}
                    <span className="text-xs ml-1">{balancePersonnelData.totaux.solde >= 0 ? 'D' : 'C'}</span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-700">
          <p className="font-medium mb-1">Comptes Auxiliaires</p>
          <p className="text-purple-600">
            Cliquez sur un compte pour voir le grand livre détaillé avec toutes les écritures et le solde progressif.
            Les comptes 411 correspondent aux clients, 401 aux fournisseurs, et 421/431 au personnel.
          </p>
        </div>
      </div>

      {/* Auxiliary Ledger Modal */}
      {selectedAuxiliary && (
        <AuxiliaryLedgerModal
          type={selectedAuxiliary.type}
          compte={selectedAuxiliary.compte}
          nom={selectedAuxiliary.nom}
          onClose={() => setSelectedAuxiliary(null)}
        />
      )}
    </div>
  );
}
