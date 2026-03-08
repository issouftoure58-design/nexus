import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TVAData } from '@/lib/api';
import { exportToCSV } from './constants';

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------
export interface ComptaTVAProps {
  tvaData: TVAData | undefined;
  isLoading: boolean;
  tvaPeriode: string;
  onPeriodeChange: (periode: string) => void;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
export default function ComptaTVA({
  tvaData,
  isLoading,
  tvaPeriode,
  onPeriodeChange,
}: ComptaTVAProps) {

  const exportTVAToExcel = () => {
    if (!tvaData?.tva) return;
    const tva = tvaData.tva;
    const tvaAPayer = (tva.collectee?.tva || 0) - (tva.deductible?.tva || 0);
    const data = [
      { type: 'TVA Collectée', base_ht: tva.collectee?.base_ht_euros || '0.00', montant: tva.collectee?.tva_euros || '0.00' },
      { type: 'TVA Déductible', base_ht: tva.deductible?.base_ht_euros || '0.00', montant: tva.deductible?.tva_euros || '0.00' },
      { type: 'TVA à Payer', base_ht: '-', montant: (tvaAPayer / 100).toFixed(2) }
    ];
    exportToCSV(data, 'tva', ['Type', 'Base HT', 'Montant']);
  };

  // Generate period options
  const periodOptions = (() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = -6; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  })();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">Période :</label>
          <select
            value={tvaPeriode}
            onChange={(e) => onPeriodeChange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {periodOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          onClick={exportTVAToExcel}
          className="gap-2"
          disabled={!tvaData}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
      ) : tvaData?.tva ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <ArrowUpRight className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">TVA Collectée</p>
                    <p className="text-xs text-gray-400">(sur ventes)</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-600">{tvaData.tva.collectee.tva_euros} €</p>
                <p className="text-sm text-gray-500 mt-1">Base HT: {tvaData.tva.collectee.base_ht_euros} €</p>
                <p className="text-xs text-gray-400">{tvaData.tva.collectee.nb_operations} opération(s)</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ArrowDownRight className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">TVA Déductible</p>
                    <p className="text-xs text-gray-400">(sur achats)</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-600">{tvaData.tva.deductible.tva_euros} €</p>
                <p className="text-sm text-gray-500 mt-1">Base HT: {tvaData.tva.deductible.base_ht_euros} €</p>
                <p className="text-xs text-gray-400">{tvaData.tva.deductible.nb_operations} opération(s)</p>
              </CardContent>
            </Card>

            <Card className={tvaData.tva.solde.a_payer ? 'border-orange-200' : 'border-green-200'}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("p-2 rounded-lg", tvaData.tva.solde.a_payer ? 'bg-orange-100' : 'bg-green-100')}>
                    <Calculator className={cn("h-5 w-5", tvaData.tva.solde.a_payer ? 'text-orange-600' : 'text-green-600')} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{tvaData.tva.solde.a_payer ? 'TVA à payer' : 'Crédit TVA'}</p>
                    <p className="text-xs text-gray-400">Solde du mois</p>
                  </div>
                </div>
                <p className={cn("text-2xl font-bold", tvaData.tva.solde.a_payer ? 'text-orange-600' : 'text-green-600')}>
                  {tvaData.tva.solde.montant_euros} €
                </p>
                <Badge className={cn("mt-2", tvaData.tva.solde.a_payer ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}>
                  {tvaData.tva.solde.a_payer ? 'À déclarer' : 'Report possible'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Détail TVA Collectée
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tvaData.tva.collectee.detail_par_taux.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-sm text-gray-600">Taux</th>
                        <th className="text-right py-2 text-sm text-gray-600">Base HT</th>
                        <th className="text-right py-2 text-sm text-gray-600">TVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tvaData.tva.collectee.detail_par_taux.map((item, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2"><Badge variant="outline">{item.taux}%</Badge></td>
                          <td className="py-2 text-right text-sm">{item.base_ht_euros} €</td>
                          <td className="py-2 text-right font-medium text-green-600">{item.tva_euros} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Aucune vente ce mois</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-blue-600" />
                  Détail TVA Déductible
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tvaData.tva.deductible.detail_par_taux.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-sm text-gray-600">Taux</th>
                        <th className="text-right py-2 text-sm text-gray-600">Base HT</th>
                        <th className="text-right py-2 text-sm text-gray-600">TVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tvaData.tva.deductible.detail_par_taux.map((item, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2"><Badge variant="outline">{item.taux}%</Badge></td>
                          <td className="py-2 text-right text-sm">{item.base_ht_euros} €</td>
                          <td className="py-2 text-right font-medium text-blue-600">{item.tva_euros} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Aucune dépense ce mois</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Aucune donnée TVA disponible</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
