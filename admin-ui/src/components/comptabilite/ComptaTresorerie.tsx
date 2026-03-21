import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { comptaApi, type TresorerieResponse } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from './constants';
import {
  Loader2,
  Landmark,
  Banknote,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  exercice: number;
}

export default function ComptaTresorerie({ exercice }: Props) {
  const { data, isLoading } = useQuery<TresorerieResponse>({
    queryKey: ['compta-tresorerie', exercice],
    queryFn: () => comptaApi.getTresorerie(exercice),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-400 py-8">Aucune donnée disponible</div>;
  }

  const { soldes, flux_12mois, previsions } = data;

  return (
    <div className="space-y-6">
      {/* Soldes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Solde Banque</p>
              <p className={cn('text-xl font-bold', soldes.banque >= 0 ? 'text-green-700' : 'text-red-700')}>
                {formatCurrency(soldes.banque)}
              </p>
            </div>
            <Landmark className="h-5 w-5 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Solde Caisse</p>
              <p className={cn('text-xl font-bold', soldes.caisse >= 0 ? 'text-green-700' : 'text-red-700')}>
                {formatCurrency(soldes.caisse)}
              </p>
            </div>
            <Banknote className="h-5 w-5 text-emerald-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Trésorerie totale</p>
              <p className={cn('text-xl font-bold', soldes.total >= 0 ? 'text-green-700' : 'text-red-700')}>
                {formatCurrency(soldes.total)}
              </p>
            </div>
            {soldes.total >= 0
              ? <TrendingUp className="h-5 w-5 text-green-500" />
              : <TrendingDown className="h-5 w-5 text-red-500" />}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Prévisionnel 30j</p>
              <p className={cn('text-xl font-bold', previsions.solde_previsionnel_30j >= 0 ? 'text-green-700' : 'text-red-700')}>
                {formatCurrency(previsions.solde_previsionnel_30j)}
              </p>
            </div>
            <Badge className={cn(
              'text-xs',
              previsions.solde_previsionnel_30j >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              {previsions.solde_previsionnel_30j >= 0 ? 'OK' : 'Alerte'}
            </Badge>
          </div>
        </Card>
      </div>

      {/* Flux mensuels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flux de trésorerie mensuels</CardTitle>
        </CardHeader>
        <CardContent>
          {flux_12mois.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={flux_12mois}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" fontSize={11} tickFormatter={m => m.substring(5)} />
                <YAxis fontSize={12} tickFormatter={v => `${v}€`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="encaissements" name="Encaissements" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="decaissements" name="Décaissements" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tables prévisions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Factures à encaisser */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Factures à encaisser
              <Badge variant="outline" className="text-xs">{previsions.factures_a_encaisser.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previsions.factures_a_encaisser.length === 0 ? (
              <p className="text-center text-gray-400 py-4">Aucune facture en attente</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 font-medium">Facture</th>
                      <th className="pb-2 font-medium">Client</th>
                      <th className="pb-2 font-medium text-right">Montant</th>
                      <th className="pb-2 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previsions.factures_a_encaisser.map((f) => (
                      <tr key={f.numero} className="border-b last:border-0">
                        <td className="py-1.5 font-mono text-xs">{f.numero}</td>
                        <td className="py-1.5 truncate max-w-[120px]">{f.client}</td>
                        <td className="py-1.5 text-right font-medium text-green-700">{formatCurrency(f.montant)}</td>
                        <td className="py-1.5 text-right text-gray-500">{formatDate(f.date_facture)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={2} className="pt-2">Total</td>
                      <td className="pt-2 text-right text-green-700">
                        {formatCurrency(previsions.factures_a_encaisser.reduce((s, f) => s + f.montant, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dépenses à payer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Dépenses à payer
              <Badge variant="outline" className="text-xs">{previsions.depenses_a_payer.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previsions.depenses_a_payer.length === 0 ? (
              <p className="text-center text-gray-400 py-4">Aucune dépense en attente</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 font-medium">Libellé</th>
                      <th className="pb-2 font-medium text-right">Montant</th>
                      <th className="pb-2 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previsions.depenses_a_payer.map((d, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 truncate max-w-[180px]">{d.libelle}</td>
                        <td className="py-1.5 text-right font-medium text-red-700">{formatCurrency(d.montant)}</td>
                        <td className="py-1.5 text-right text-gray-500">{formatDate(d.date_depense)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="pt-2">Total</td>
                      <td className="pt-2 text-right text-red-700">
                        {formatCurrency(previsions.depenses_a_payer.reduce((s, d) => s + d.montant, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
