import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Wallet,
  Download,
  Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BilanResponse } from '@/lib/api';
import { AVAILABLE_YEARS, formatCurrency, exportToCSV } from './constants';

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------
export interface ComptaBilanProps {
  data: BilanResponse | undefined;
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
export default function ComptaBilan({
  data: bilanData,
  isLoading: bilanLoading,
  statsPeriod,
  statsYear,
  statsMonth,
  statsDay,
  onStatsPeriodChange,
  onStatsYearChange,
  onStatsMonthChange,
  onStatsDayChange,
  onNotify,
}: ComptaBilanProps) {

  const exportBilan = () => {
    if (!bilanData) {
      onNotify('error', 'Données non disponibles');
      return;
    }

    const data: { categorie: string; poste: string; montant: string }[] = [
      { categorie: 'ACTIF', poste: '', montant: '' },
    ];

    if (bilanData.actif.immobilisations.length > 0) {
      bilanData.actif.immobilisations.forEach(c => {
        data.push({ categorie: 'Actif immobilisé', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.actif.stocks.length > 0) {
      bilanData.actif.stocks.forEach(c => {
        data.push({ categorie: 'Stocks', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.actif.creances.length > 0) {
      bilanData.actif.creances.forEach(c => {
        data.push({ categorie: 'Créances', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.actif.tresorerie.length > 0) {
      bilanData.actif.tresorerie.forEach(c => {
        data.push({ categorie: 'Trésorerie', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    data.push({ categorie: '', poste: 'TOTAL ACTIF', montant: formatCurrency(bilanData.totaux.actif) });
    data.push({ categorie: '', poste: '', montant: '' });
    data.push({ categorie: 'PASSIF', poste: '', montant: '' });

    if (bilanData.passif.capitaux.length > 0) {
      bilanData.passif.capitaux.forEach(c => {
        data.push({ categorie: 'Capitaux propres', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.passif.dettes.length > 0) {
      bilanData.passif.dettes.forEach(c => {
        data.push({ categorie: 'Dettes', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.passif.decouvertsBancaires && bilanData.passif.decouvertsBancaires.length > 0) {
      bilanData.passif.decouvertsBancaires.forEach(c => {
        data.push({ categorie: 'Dettes financières', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    data.push({ categorie: '', poste: 'TOTAL PASSIF', montant: formatCurrency(bilanData.totaux.passif) });

    exportToCSV(data, 'bilan', ['Categorie', 'Poste', 'Montant']);
    onNotify('success', 'Bilan exporté');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-500" />
              Bilan Comptable
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Au {statsPeriod === 'jour'
                ? `${statsDay}/${statsMonth}/${statsYear}`
                : statsPeriod === 'mois'
                  ? `fin ${new Date(statsYear, statsMonth - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
                  : `31/12/${statsYear}`}
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
            <Button variant="outline" size="sm" className="gap-1" onClick={exportBilan}>
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
          {bilanLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : bilanData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ACTIF */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-center bg-blue-100 py-2 rounded-t-lg">
                ACTIF
              </h3>
              <div className="border rounded-b-lg p-4 space-y-4">
                {/* Actif immobilisé */}
                {bilanData.actif.immobilisations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Actif immobilisé</h4>
                    <div className="space-y-1 text-sm pl-4">
                      {bilanData.actif.immobilisations.map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{c.numero} - {c.libelle}</span>
                          <span className="font-medium">{formatCurrency(c.solde)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stocks */}
                {bilanData.actif.stocks.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Stocks</h4>
                    <div className="space-y-1 text-sm pl-4">
                      {bilanData.actif.stocks.map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{c.numero} - {c.libelle}</span>
                          <span className="font-medium">{formatCurrency(c.solde)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Créances */}
                {bilanData.actif.creances.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Créances</h4>
                    <div className="space-y-1 text-sm pl-4">
                      {bilanData.actif.creances.map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{c.numero} - {c.libelle}</span>
                          <span className="font-medium text-blue-600">{formatCurrency(c.solde)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trésorerie */}
                {bilanData.actif.tresorerie.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Trésorerie</h4>
                    <div className="space-y-1 text-sm pl-4">
                      {bilanData.actif.tresorerie.map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{c.numero} - {c.libelle}</span>
                          <span className="font-medium text-green-600">{formatCurrency(c.solde)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message si aucun actif */}
                {bilanData.actif.immobilisations.length === 0 &&
                 bilanData.actif.stocks.length === 0 &&
                 bilanData.actif.creances.length === 0 &&
                 bilanData.actif.tresorerie.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-4">
                    Aucun actif comptabilisé
                  </div>
                )}

                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total Actif</span>
                  <span className="text-blue-700">{formatCurrency(bilanData.totaux.actif)}</span>
                </div>
              </div>
            </div>

            {/* PASSIF */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-center bg-green-100 py-2 rounded-t-lg">
                PASSIF
              </h3>
              <div className="border rounded-b-lg p-4 space-y-4">
                {/* Capitaux propres */}
                {bilanData.passif.capitaux.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Capitaux propres</h4>
                    <div className="space-y-1 text-sm pl-4">
                      {bilanData.passif.capitaux.map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{c.numero} - {c.libelle}</span>
                          <span className={cn(
                            "font-medium",
                            c.numero === '120' ? "text-green-600" : c.numero === '129' ? "text-red-600" : ""
                          )}>
                            {formatCurrency(c.solde)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dettes */}
                {bilanData.passif.dettes.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Dettes</h4>
                    <div className="space-y-1 text-sm pl-4">
                      {bilanData.passif.dettes.map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{c.numero} - {c.libelle}</span>
                          <span className="font-medium text-orange-600">{formatCurrency(c.solde)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Découverts bancaires */}
                {bilanData.passif.decouvertsBancaires && bilanData.passif.decouvertsBancaires.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Dettes financières</h4>
                    <div className="space-y-1 text-sm pl-4">
                      {bilanData.passif.decouvertsBancaires.map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{c.numero} - {c.libelle}</span>
                          <span className="font-medium text-red-600">{formatCurrency(c.solde)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message si aucun passif */}
                {bilanData.passif.capitaux.length === 0 &&
                 bilanData.passif.dettes.length === 0 &&
                 (!bilanData.passif.decouvertsBancaires || bilanData.passif.decouvertsBancaires.length === 0) && (
                  <div className="text-sm text-gray-400 text-center py-4">
                    Aucun passif comptabilisé
                  </div>
                )}

                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total Passif</span>
                  <span className="text-green-700">{formatCurrency(bilanData.totaux.passif)}</span>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Aucune donnée comptable pour cet exercice
            </div>
          )}

          {/* Indicateur d'équilibre */}
          {bilanData && (
            <div className={cn(
              "mt-4 p-3 rounded-lg text-center text-sm font-medium",
              bilanData.totaux.equilibre ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}>
              {bilanData.totaux.equilibre
                ? "Le bilan est équilibré"
                : `Déséquilibre de ${formatCurrency(Math.abs(bilanData.totaux.actif - bilanData.totaux.passif))}`
              }
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
