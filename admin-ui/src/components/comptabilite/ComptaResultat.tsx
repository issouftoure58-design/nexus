import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Download,
  Printer,
  GitCompareArrows,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { comptaApi, type CompteResultatResponse, type CompteResultatCompareResponse } from '@/lib/api';
import { AVAILABLE_YEARS, formatCurrency, exportToCSV } from './constants';

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------
export interface ComptaResultatProps {
  data: CompteResultatResponse | undefined;
  isLoading: boolean;
  statsPeriod: 'jour' | 'mois' | 'annee';
  statsYear: number;
  statsMonth: number;
  statsDay: number;
  onStatsPeriodChange: (period: 'jour' | 'mois' | 'annee') => void;
  onStatsYearChange: (year: number) => void;
  onStatsMonthChange: (month: number) => void;
  onStatsDayChange: (day: number) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
export default function ComptaResultat({
  data: compteResultatData,
  isLoading: compteResultatLoading,
  statsPeriod,
  statsYear,
  statsMonth,
  statsDay,
  onStatsPeriodChange,
  onStatsYearChange,
  onStatsMonthChange,
  onStatsDayChange,
  onNotify,
}: ComptaResultatProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [compareYear, setCompareYear] = useState(statsYear - 1);
  const [compareMonth, setCompareMonth] = useState(statsMonth);

  const comparePeriode1 = statsPeriod === 'annee' ? undefined : `${statsYear}-${String(statsMonth).padStart(2, '0')}`;
  const comparePeriode2 = statsPeriod === 'annee' ? undefined : `${compareYear}-${String(compareMonth).padStart(2, '0')}`;

  const { data: compareData, isLoading: compareLoading } = useQuery<CompteResultatCompareResponse>({
    queryKey: ['compte-resultat-compare', statsYear, comparePeriode1, compareYear, comparePeriode2],
    queryFn: () => comptaApi.getCompteResultatCompare({
      exercice1: statsYear,
      periode1: comparePeriode1,
      exercice2: compareYear,
      periode2: comparePeriode2,
    }),
    enabled: compareMode,
  });

  const exportCompteResultat = () => {
    if (!compteResultatData) {
      onNotify('error', 'Données non disponibles');
      return;
    }

    const data: { poste: string; montant: string }[] = [
      { poste: 'PRODUITS D\'EXPLOITATION', montant: '' },
      ...compteResultatData.produits.exploitation.map(c => ({
        poste: `${c.numero} - ${c.libelle}`,
        montant: formatCurrency(c.montant)
      })),
      { poste: 'Total Produits d\'exploitation', montant: formatCurrency(compteResultatData.totaux.produits.exploitation) },
      { poste: '', montant: '' },
      { poste: 'CHARGES D\'EXPLOITATION', montant: '' },
      ...compteResultatData.charges.exploitation.map(c => ({
        poste: `${c.numero} - ${c.libelle}`,
        montant: formatCurrency(c.montant)
      })),
      { poste: 'Total Charges d\'exploitation', montant: formatCurrency(compteResultatData.totaux.charges.exploitation) },
    ];

    if (compteResultatData.charges.financieres.length > 0) {
      data.push({ poste: '', montant: '' });
      data.push({ poste: 'CHARGES FINANCIERES', montant: '' });
      compteResultatData.charges.financieres.forEach(c => {
        data.push({ poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.montant) });
      });
      data.push({ poste: 'Total Charges financières', montant: formatCurrency(compteResultatData.totaux.charges.financieres) });
    }

    data.push({ poste: '', montant: '' });
    data.push({ poste: 'RÉSULTAT D\'EXPLOITATION', montant: formatCurrency(compteResultatData.totaux.resultats.exploitation) });
    data.push({ poste: 'RÉSULTAT NET', montant: formatCurrency(compteResultatData.totaux.resultats.net) });

    exportToCSV(data, 'compte_resultat', ['Poste', 'Montant']);
    onNotify('success', 'Compte de résultat exporté');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Compte de Résultat
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Période : {statsPeriod === 'jour'
                ? `${statsDay}/${statsMonth}/${statsYear}`
                : statsPeriod === 'mois'
                  ? `${new Date(statsYear, statsMonth - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
                  : statsYear}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Sélecteur de période */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
              <select
                value={statsPeriod}
                onChange={(e) => onStatsPeriodChange(e.target.value as 'jour' | 'mois' | 'annee')}
                className="px-2 py-1 border-0 bg-white rounded text-xs"
              >
                <option value="jour">Jour</option>
                <option value="mois">Mois</option>
                <option value="annee">Année</option>
              </select>
              <select
                value={statsYear}
                onChange={(e) => onStatsYearChange(Number(e.target.value))}
                className="px-2 py-1 border-0 bg-white rounded text-xs"
              >
                {AVAILABLE_YEARS.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {statsPeriod !== 'annee' && (
                <select
                  value={statsMonth}
                  onChange={(e) => onStatsMonthChange(Number(e.target.value))}
                  className="px-2 py-1 border-0 bg-white rounded text-xs"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleDateString('fr-FR', { month: 'short' })}
                    </option>
                  ))}
                </select>
              )}
              {statsPeriod === 'jour' && (
                <select
                  value={statsDay}
                  onChange={(e) => onStatsDayChange(Number(e.target.value))}
                  className="px-2 py-1 border-0 bg-white rounded text-xs"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              )}
            </div>
            <Button
              variant={compareMode ? 'default' : 'outline'}
              size="sm"
              className="gap-1"
              onClick={() => setCompareMode(!compareMode)}
            >
              <GitCompareArrows className="h-4 w-4" />
              Comparer
            </Button>
            {compareMode && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-500">vs</span>
                <select
                  value={compareYear}
                  onChange={(e) => setCompareYear(Number(e.target.value))}
                  className="px-2 py-1 border-0 bg-white rounded text-xs"
                >
                  {AVAILABLE_YEARS.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                {statsPeriod !== 'annee' && (
                  <select
                    value={compareMonth}
                    onChange={(e) => setCompareMonth(Number(e.target.value))}
                    className="px-2 py-1 border-0 bg-white rounded text-xs"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>
                        {new Date(2000, month - 1).toLocaleDateString('fr-FR', { month: 'short' })}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <Button variant="outline" size="sm" className="gap-1" onClick={exportCompteResultat}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mode comparaison */}
          {compareMode && (
            <div className="mb-6">
              {compareLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                </div>
              ) : compareData ? (
                <CompareView data={compareData} />
              ) : (
                <div className="text-center py-4 text-gray-500">Aucune donnée de comparaison</div>
              )}
            </div>
          )}

          {/* Vue classique */}
          {!compareMode && compteResultatLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : !compareMode && compteResultatData ? (
          <div className="space-y-6">
            {/* Produits d'exploitation */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Produits d'exploitation
              </h3>
              <div className="bg-green-50 rounded-lg p-4 space-y-2">
                {compteResultatData.produits.exploitation.length > 0 ? (
                  compteResultatData.produits.exploitation.map((compte, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{compte.numero} - {compte.libelle}</span>
                      <span className="font-medium">{formatCurrency(compte.montant)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Aucun produit</span>
                    <span>0,00 €</span>
                  </div>
                )}
                <div className="border-t border-green-200 pt-2 mt-2 flex justify-between font-semibold">
                  <span>Total Produits d'exploitation</span>
                  <span className="text-green-700">{formatCurrency(compteResultatData.totaux.produits.exploitation)}</span>
                </div>
              </div>
            </div>

            {/* Charges d'exploitation */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Charges d'exploitation
              </h3>
              <div className="bg-red-50 rounded-lg p-4 space-y-2">
                {compteResultatData.charges.exploitation.length > 0 ? (
                  compteResultatData.charges.exploitation.map((compte, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{compte.numero} - {compte.libelle}</span>
                      <span className="font-medium">{formatCurrency(compte.montant)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Aucune charge</span>
                    <span>0,00 €</span>
                  </div>
                )}
                <div className="border-t border-red-200 pt-2 mt-2 flex justify-between font-semibold">
                  <span>Total Charges d'exploitation</span>
                  <span className="text-red-700">{formatCurrency(compteResultatData.totaux.charges.exploitation)}</span>
                </div>
              </div>
            </div>

            {/* Charges financières (si présentes) */}
            {compteResultatData.charges.financieres.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-orange-500" />
                  Charges financières
                </h3>
                <div className="bg-orange-50 rounded-lg p-4 space-y-2">
                  {compteResultatData.charges.financieres.map((compte, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{compte.numero} - {compte.libelle}</span>
                      <span className="font-medium">{formatCurrency(compte.montant)}</span>
                    </div>
                  ))}
                  <div className="border-t border-orange-200 pt-2 mt-2 flex justify-between font-semibold">
                    <span>Total Charges financières</span>
                    <span className="text-orange-700">{formatCurrency(compteResultatData.totaux.charges.financieres)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Résultat */}
            <div className={cn(
              "rounded-lg p-4",
              compteResultatData.totaux.resultats.net >= 0 ? "bg-emerald-100" : "bg-red-100"
            )}>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Résultat d'exploitation</span>
                <span className={cn(
                  "text-2xl font-bold",
                  compteResultatData.totaux.resultats.exploitation >= 0 ? "text-emerald-700" : "text-red-700"
                )}>
                  {formatCurrency(compteResultatData.totaux.resultats.exploitation)}
                </span>
              </div>
              {compteResultatData.totaux.charges.financieres !== 0 && (
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span>Résultat financier</span>
                  <span className={cn(
                    "font-medium",
                    compteResultatData.totaux.resultats.financier >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {formatCurrency(compteResultatData.totaux.resultats.financier)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between items-center">
                <span className="text-lg font-semibold">Résultat Net</span>
                <span className={cn(
                  "text-2xl font-bold",
                  compteResultatData.totaux.resultats.net >= 0 ? "text-emerald-700" : "text-red-700"
                )}>
                  {formatCurrency(compteResultatData.totaux.resultats.net)}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Marge : {compteResultatData.totaux.produits.total > 0
                  ? ((compteResultatData.totaux.resultats.net / compteResultatData.totaux.produits.total) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
          </div>
          ) : !compareMode ? (
            <div className="text-center py-8 text-gray-500">
              Aucune donnée comptable pour cette période
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Compare View ───────────────────────────────────────────────────────────

function VariationBadge({ value }: { value: { montant: number; pct: number } }) {
  const isPos = value.montant >= 0;
  return (
    <span className={cn(
      'text-xs font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5',
      isPos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    )}>
      {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPos ? '+' : ''}{value.pct}%
    </span>
  );
}

function CompareView({ data }: { data: CompteResultatCompareResponse }) {
  const { periode1: p1, periode2: p2, variations } = data;
  const label1 = p1.periode !== 'annuel' ? p1.periode : String(p1.exercice);
  const label2 = p2.periode !== 'annuel' ? p2.periode : String(p2.exercice);

  const rows = [
    { label: "Produits d'exploitation", v1: p1.totaux.produits.exploitation, v2: p2.totaux.produits.exploitation, var: variations.produits_exploitation },
    { label: "Charges d'exploitation", v1: p1.totaux.charges.exploitation, v2: p2.totaux.charges.exploitation, var: variations.charges_exploitation },
    { label: "Résultat d'exploitation", v1: p1.totaux.resultats.exploitation, v2: p2.totaux.resultats.exploitation, var: variations.resultat_exploitation, bold: true },
    { label: 'Charges financières', v1: p1.totaux.charges.financieres, v2: p2.totaux.charges.financieres, var: variations.charges_financieres },
    { label: 'Résultat Net', v1: p1.totaux.resultats.net, v2: p2.totaux.resultats.net, var: variations.resultat_net, bold: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="pb-2 text-left font-medium">Poste</th>
            <th className="pb-2 text-right font-medium">{label1}</th>
            <th className="pb-2 text-right font-medium">{label2}</th>
            <th className="pb-2 text-right font-medium">Variation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className={cn('border-b last:border-0', r.bold && 'bg-gray-50')}>
              <td className={cn('py-2', r.bold && 'font-semibold')}>{r.label}</td>
              <td className={cn('py-2 text-right', r.bold && 'font-semibold', r.v1 >= 0 ? 'text-green-700' : 'text-red-700')}>
                {formatCurrency(r.v1)}
              </td>
              <td className={cn('py-2 text-right', r.bold && 'font-semibold', r.v2 >= 0 ? 'text-green-700' : 'text-red-700')}>
                {formatCurrency(r.v2)}
              </td>
              <td className="py-2 text-right">
                <VariationBadge value={r.var} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
