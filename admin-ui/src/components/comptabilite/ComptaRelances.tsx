import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  Bell,
  Clock,
  Scale,
  Gavel,
  Settings,
  Save,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { comptaApi, type RelanceFacture, type RelanceStats, type RelanceSettings } from '@/lib/api';
import { EntityLink } from '@/components/EntityLink';
import {
  AVAILABLE_YEARS,
  MODES_PAIEMENT,
  formatCurrency,
  matchesMontantRange,
} from './constants';

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------
export interface ComptaRelancesProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
export default function ComptaRelances({ onNotify }: ComptaRelancesProps) {
  const queryClient = useQueryClient();

  // Settings state
  const [showRelanceSettings, setShowRelanceSettings] = useState(false);
  const [relanceDelays, setRelanceDelays] = useState({
    r1: -7,
    r2: 0,
    r3: 7,
    r4: 15,
    r5: 21,
    contentieux: 30
  });

  // Period filters
  const [relancesPeriod, setRelancesPeriod] = useState<'jour' | 'mois' | 'annee' | 'all'>('all');
  const [relancesYear, setRelancesYear] = useState<number>(new Date().getFullYear());
  const [relancesMonth, setRelancesMonth] = useState<number>(new Date().getMonth() + 1);
  const [relancesDay, setRelancesDay] = useState<number>(new Date().getDate());

  // Column filters
  const [relanceNumeroFilter, setRelanceNumeroFilter] = useState<string>('all');
  const [relanceClientFilter, setRelanceClientFilter] = useState<string>('all');
  const [relanceMontantFilter, setRelanceMontantFilter] = useState<string>('all');
  const [relanceEcheanceFilter, setRelanceEcheanceFilter] = useState<string>('all');
  const [relanceRetardFilter, setRelanceRetardFilter] = useState<string>('all');
  const [relanceNiveauFilter, setRelanceNiveauFilter] = useState<string>('all');

  // Payment modal
  const [showInvoicePaymentModal, setShowInvoicePaymentModal] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<number | null>(null);
  const [invoicePaymentMode, setInvoicePaymentMode] = useState<'especes' | 'cb' | 'virement' | 'prelevement' | 'cheque'>('cb');

  // ----------------------------------------------------------------
  // Queries
  // ----------------------------------------------------------------
  const { data: relancesData, isLoading: relancesLoading } = useQuery<{ success: boolean; factures: RelanceFacture[]; stats: RelanceStats }>({
    queryKey: ['relances'],
    queryFn: () => comptaApi.getRelances(),
  });

  const { data: relanceSettingsData } = useQuery<{ success: boolean; settings: RelanceSettings }>({
    queryKey: ['relance-settings'],
    queryFn: () => comptaApi.getRelanceSettings(),
  });

  // Sync settings when loaded
  useEffect(() => {
    if (relanceSettingsData?.settings) {
      setRelanceDelays(relanceSettingsData.settings);
    }
  }, [relanceSettingsData]);

  // ----------------------------------------------------------------
  // Mutations
  // ----------------------------------------------------------------
  const envoyerRelanceMutation = useMutation({
    mutationFn: ({ factureId, niveau }: { factureId: number; niveau: number }) =>
      comptaApi.envoyerRelance(factureId, niveau),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['relances'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onNotify('success', data.message || 'Relance envoyée');
    },
    onError: (err: Error) => onNotify('error', err.message),
  });

  const enregistrerPaiementMutation = useMutation({
    mutationFn: ({ factureId, mode_paiement }: { factureId: number; mode_paiement: 'especes' | 'cb' | 'virement' | 'prelevement' | 'cheque' }) =>
      comptaApi.enregistrerPaiement(factureId, { mode_paiement }),
    onSuccess: (data: { success: boolean; facture: unknown; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ['relances'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onNotify('success', data.message || 'Paiement enregistré');
      setShowInvoicePaymentModal(false);
      setPendingInvoiceId(null);
    },
    onError: (err: Error) => onNotify('error', err.message),
  });

  const transmettreContentieuxMutation = useMutation({
    mutationFn: ({ factureId, service }: { factureId: number; service: 'interne' | 'huissier' }) =>
      comptaApi.transmettreContentieux(factureId, service),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['relances'] });
      onNotify('success', data.message || 'Dossier transmis au contentieux');
    },
    onError: (err: Error) => onNotify('error', err.message),
  });

  const saveRelanceSettingsMutation = useMutation({
    mutationFn: (settings: RelanceSettings) => comptaApi.saveRelanceSettings(settings),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['relance-settings'] });
      setShowRelanceSettings(false);
      onNotify('success', data.message || 'Délais de relance mis à jour');
    },
    onError: (err: Error) => onNotify('error', err.message),
  });

  // ----------------------------------------------------------------
  // Filtered relances
  // ----------------------------------------------------------------
  const filteredRelances = useMemo(() => {
    const relances = relancesData?.factures || [];

    const matchesRelancesPeriod = (dateStr: string | null | undefined) => {
      if (relancesPeriod === 'all') return true;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;

      if (relancesPeriod === 'jour') {
        return date.getFullYear() === relancesYear &&
               date.getMonth() + 1 === relancesMonth &&
               date.getDate() === relancesDay;
      } else if (relancesPeriod === 'mois') {
        return date.getFullYear() === relancesYear && date.getMonth() + 1 === relancesMonth;
      } else {
        return date.getFullYear() === relancesYear;
      }
    };

    const matchesRetard = (joursRetard: number, filter: string) => {
      switch (filter) {
        case 'all': return true;
        case 'avenir': return joursRetard < 0;
        case 'aujourdhui': return joursRetard === 0;
        case '1-7': return joursRetard >= 1 && joursRetard <= 7;
        case '8-15': return joursRetard >= 8 && joursRetard <= 15;
        case '16-30': return joursRetard >= 16 && joursRetard <= 30;
        case '30+': return joursRetard > 30;
        default: return true;
      }
    };

    return relances.filter(facture => {
      if (!matchesRelancesPeriod(facture.date_echeance)) return false;
      if (relanceNumeroFilter !== 'all' && facture.numero !== relanceNumeroFilter) return false;
      if (relanceClientFilter !== 'all' && facture.client_nom !== relanceClientFilter) return false;
      if (!matchesMontantRange(facture.montant_ttc || 0, relanceMontantFilter)) return false;
      if (relanceEcheanceFilter !== 'all' && facture.date_echeance?.slice(0, 7) !== relanceEcheanceFilter) return false;
      if (!matchesRetard(facture.jours_retard || 0, relanceRetardFilter)) return false;
      if (relanceNiveauFilter !== 'all' && String(facture.niveau_relance) !== relanceNiveauFilter) return false;
      return true;
    });
  }, [relancesData, relancesPeriod, relancesYear, relancesMonth, relancesDay, relanceNumeroFilter, relanceClientFilter, relanceMontantFilter, relanceEcheanceFilter, relanceRetardFilter, relanceNiveauFilter]);

  const filteredRelancesStats = useMemo(() => ({
    total: filteredRelances.length,
    montant: filteredRelances.reduce((sum, f) => sum + (f.montant_ttc || 0), 0) / 100
  }), [filteredRelances]);

  const hasActiveFilters = relancesPeriod !== 'all' || relanceNumeroFilter !== 'all' || relanceClientFilter !== 'all' || relanceMontantFilter !== 'all' || relanceEcheanceFilter !== 'all' || relanceRetardFilter !== 'all' || relanceNiveauFilter !== 'all';

  const clearFilters = () => {
    setRelancesPeriod('all');
    setRelanceNumeroFilter('all');
    setRelanceClientFilter('all');
    setRelanceMontantFilter('all');
    setRelanceEcheanceFilter('all');
    setRelanceRetardFilter('all');
    setRelanceNiveauFilter('all');
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: 'Total impayées', value: relancesData?.stats?.total_impayees || 0, color: 'gray', icon: FileText },
          { label: 'R1 Préventive', value: relancesData?.stats?.r1_preventive || 0, color: 'blue', icon: Bell },
          { label: 'R2 Échéance', value: relancesData?.stats?.r2_echeance || 0, color: 'cyan', icon: Clock },
          { label: 'R3 +7j', value: relancesData?.stats?.r3_plus7 || 0, color: 'yellow', icon: AlertTriangle },
          { label: 'R4 +15j', value: relancesData?.stats?.r4_plus15 || 0, color: 'orange', icon: AlertTriangle },
          { label: 'R5 Mise en demeure', value: relancesData?.stats?.r5_mise_demeure || 0, color: 'red', icon: Scale },
          { label: 'Contentieux', value: relancesData?.stats?.contentieux || 0, color: 'purple', icon: Gavel },
        ].map((stat, idx) => (
          <Card key={idx} className={cn(
            "relative overflow-hidden",
            stat.value > 0 && stat.color !== 'gray' && `ring-2 ring-${stat.color}-200`
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={cn("h-4 w-4", `text-${stat.color}-500`)} />
                <span className="text-xs text-gray-500">{stat.label}</span>
              </div>
              <p className={cn("text-2xl font-bold", stat.value > 0 ? `text-${stat.color}-600` : 'text-gray-400')}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Montant total impayé */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700">
                Montant impayé {hasActiveFilters ? '(filtré)' : ''}
              </p>
              <p className="text-3xl font-bold text-orange-600">
                {formatCurrency(filteredRelancesStats.montant)}
              </p>
              <p className="text-xs text-orange-500 mt-1">
                {filteredRelancesStats.total} facture{filteredRelancesStats.total > 1 ? 's' : ''}
              </p>
            </div>
            <AlertTriangle className="h-12 w-12 text-orange-400" />
          </div>
        </CardContent>
      </Card>

      {/* Paramètres des relances */}
      <Card className="border-2 border-dashed border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4 text-gray-500" />
            Paramètres de relance automatique
          </CardTitle>
          <Button
            variant={showRelanceSettings ? "default" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => setShowRelanceSettings(!showRelanceSettings)}
          >
            <Settings className="h-3 w-3" />
            {showRelanceSettings ? 'Masquer' : 'Modifier les délais'}
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {!showRelanceSettings ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span><strong>R1:</strong> {relanceDelays.r1}j {relanceDelays.r1 < 0 ? 'avant' : 'après'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                <span><strong>R2:</strong> Jour d'échéance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span><strong>R3:</strong> +{relanceDelays.r3}j</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span><strong>R4:</strong> +{relanceDelays.r4}j</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span><strong>R5:</strong> Mise en demeure +{relanceDelays.r5}j</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span><strong>Contentieux:</strong> +{relanceDelays.contentieux}j</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    R1 Préventive
                  </label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={Math.abs(relanceDelays.r1)}
                      onChange={(e) => setRelanceDelays(d => ({ ...d, r1: -Math.abs(parseInt(e.target.value) || 0) }))}
                      className="h-8 w-16 text-center bg-white"
                      min={1}
                      max={30}
                    />
                    <span className="text-xs text-gray-500">j avant</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                    R2 Échéance
                  </label>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-400">Jour J (fixe)</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    R3 1ère relance
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">+</span>
                    <Input
                      type="number"
                      value={relanceDelays.r3}
                      onChange={(e) => setRelanceDelays(d => ({ ...d, r3: parseInt(e.target.value) || 0 }))}
                      className="h-8 w-16 text-center bg-white"
                      min={1}
                      max={30}
                    />
                    <span className="text-xs text-gray-500">jours</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    R4 2ème relance
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">+</span>
                    <Input
                      type="number"
                      value={relanceDelays.r4}
                      onChange={(e) => setRelanceDelays(d => ({ ...d, r4: parseInt(e.target.value) || 0 }))}
                      className="h-8 w-16 text-center bg-white"
                      min={1}
                      max={60}
                    />
                    <span className="text-xs text-gray-500">jours</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    R5 Mise en demeure
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">+</span>
                    <Input
                      type="number"
                      value={relanceDelays.r5}
                      onChange={(e) => setRelanceDelays(d => ({ ...d, r5: parseInt(e.target.value) || 0 }))}
                      className="h-8 w-16 text-center bg-white"
                      min={1}
                      max={90}
                    />
                    <span className="text-xs text-gray-500">jours</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    Contentieux
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">+</span>
                    <Input
                      type="number"
                      value={relanceDelays.contentieux}
                      onChange={(e) => setRelanceDelays(d => ({ ...d, contentieux: parseInt(e.target.value) || 0 }))}
                      className="h-8 w-16 text-center bg-white"
                      min={1}
                      max={120}
                    />
                    <span className="text-xs text-gray-500">jours</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <Button variant="outline" size="sm" onClick={() => setShowRelanceSettings(false)}>
                  Annuler
                </Button>
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={saveRelanceSettingsMutation.isPending}
                  onClick={() => saveRelanceSettingsMutation.mutate(relanceDelays)}
                >
                  {saveRelanceSettingsMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liste des factures impayées */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-500" />
            Factures en relance
            <span className="text-sm font-normal text-gray-500">
              ({filteredRelancesStats.total} facture{filteredRelancesStats.total > 1 ? 's' : ''} - {formatCurrency(filteredRelancesStats.montant)})
            </span>
          </CardTitle>
          {/* Filtres période */}
          <div className="flex items-center gap-2">
            <select
              value={relancesPeriod}
              onChange={(e) => setRelancesPeriod(e.target.value as 'jour' | 'mois' | 'annee' | 'all')}
              className="text-sm border rounded-md px-2 py-1"
            >
              <option value="all">Toutes les échéances</option>
              <option value="jour">Jour</option>
              <option value="mois">Mois</option>
              <option value="annee">Année</option>
            </select>
            {relancesPeriod !== 'all' && (
              <>
                <select
                  value={relancesYear}
                  onChange={(e) => setRelancesYear(parseInt(e.target.value))}
                  className="text-sm border rounded-md px-2 py-1"
                >
                  {AVAILABLE_YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {(relancesPeriod === 'mois' || relancesPeriod === 'jour') && (
                  <select
                    value={relancesMonth}
                    onChange={(e) => setRelancesMonth(parseInt(e.target.value))}
                    className="text-sm border rounded-md px-2 py-1"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>
                        {new Date(2000, m - 1).toLocaleDateString('fr-FR', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                )}
                {relancesPeriod === 'jour' && (
                  <select
                    value={relancesDay}
                    onChange={(e) => setRelancesDay(parseInt(e.target.value))}
                    className="text-sm border rounded-md px-2 py-1"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}
              </>
            )}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-gray-500"
              >
                <X className="h-3 w-3 mr-1" />
                Effacer filtres
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {relancesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
            </div>
          ) : filteredRelances.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <p className="font-medium">
                {relancesData?.factures?.length === 0 ? 'Aucune facture impayée' : 'Aucune facture ne correspond aux filtres'}
              </p>
              <p className="text-sm">
                {relancesData?.factures?.length === 0 ? 'Toutes vos factures sont réglées' : 'Modifiez vos critères de recherche'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3">
                      <select
                        value={relanceNumeroFilter}
                        onChange={(e) => setRelanceNumeroFilter(e.target.value)}
                        className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                      >
                        <option value="all">Facture ▼</option>
                        {[...new Set((relancesData?.factures || []).map(f => f.numero))].sort().map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-left py-2 px-3">
                      <select
                        value={relanceClientFilter}
                        onChange={(e) => setRelanceClientFilter(e.target.value)}
                        className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                      >
                        <option value="all">Client ▼</option>
                        {[...new Set((relancesData?.factures || []).map(f => f.client_nom).filter(Boolean))].sort().map(nom => (
                          <option key={nom} value={nom}>{nom}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-right py-2 px-3">
                      <select
                        value={relanceMontantFilter}
                        onChange={(e) => setRelanceMontantFilter(e.target.value)}
                        className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-right"
                      >
                        <option value="all">Montant ▼</option>
                        <option value="0-50">0 - 50€</option>
                        <option value="50-100">50 - 100€</option>
                        <option value="100-200">100 - 200€</option>
                        <option value="200-500">200 - 500€</option>
                        <option value="500+">500€+</option>
                      </select>
                    </th>
                    <th className="text-center py-2 px-3">
                      <select
                        value={relanceEcheanceFilter}
                        onChange={(e) => setRelanceEcheanceFilter(e.target.value)}
                        className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-center"
                      >
                        <option value="all">Échéance ▼</option>
                        {[...new Set((relancesData?.factures || []).map(f => f.date_echeance?.slice(0, 7)).filter(Boolean))].sort().reverse().map(mois => (
                          <option key={mois} value={mois}>
                            {new Date(mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                          </option>
                        ))}
                      </select>
                    </th>
                    <th className="text-center py-2 px-3">
                      <select
                        value={relanceRetardFilter}
                        onChange={(e) => setRelanceRetardFilter(e.target.value)}
                        className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-center"
                      >
                        <option value="all">Retard ▼</option>
                        <option value="avenir">À venir</option>
                        <option value="aujourdhui">Aujourd'hui</option>
                        <option value="1-7">1-7 jours</option>
                        <option value="8-15">8-15 jours</option>
                        <option value="16-30">16-30 jours</option>
                        <option value="30+">+30 jours</option>
                      </select>
                    </th>
                    <th className="text-center py-2 px-3">
                      <select
                        value={relanceNiveauFilter}
                        onChange={(e) => setRelanceNiveauFilter(e.target.value)}
                        className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-center"
                      >
                        <option value="all">Niveau ▼</option>
                        <option value="0">À venir</option>
                        <option value="1">R1 Préventive</option>
                        <option value="2">R2 Échéance</option>
                        <option value="3">R3 +7j</option>
                        <option value="4">R4 +15j</option>
                        <option value="5">R5 Mise en demeure</option>
                        <option value="6">Contentieux</option>
                      </select>
                    </th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRelances.map((facture) => {
                    const niveauConfig: Record<number, { label: string; color: string; bg: string }> = {
                      0: { label: 'À venir', color: 'text-gray-600', bg: 'bg-gray-100' },
                      1: { label: 'R1 Préventive', color: 'text-blue-600', bg: 'bg-blue-100' },
                      2: { label: 'R2 Échéance', color: 'text-cyan-600', bg: 'bg-cyan-100' },
                      3: { label: 'R3 +7j', color: 'text-yellow-600', bg: 'bg-yellow-100' },
                      4: { label: 'R4 +15j', color: 'text-orange-600', bg: 'bg-orange-100' },
                      5: { label: 'R5 Mise en demeure', color: 'text-red-600', bg: 'bg-red-100' },
                      6: { label: 'Contentieux', color: 'text-purple-600', bg: 'bg-purple-100' },
                    };
                    const config = niveauConfig[facture.niveau_relance] || niveauConfig[0];

                    return (
                      <tr key={facture.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm">{facture.numero}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              <EntityLink
                                type="client"
                                entity={{
                                  id: facture.client_id,
                                  nom: facture.client_nom?.split(' ').slice(-1)[0] || '',
                                  prenom: facture.client_nom?.split(' ').slice(0, -1).join(' ') || '',
                                  telephone: facture.client_telephone || ''
                                }}
                                label={facture.client_nom || 'Client'}
                              />
                            </p>
                            <p className="text-xs text-gray-500">{facture.client_email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {formatCurrency(facture.montant_ttc / 100)}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          {facture.date_echeance ? new Date(facture.date_echeance).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            facture.jours_retard > 21 ? 'bg-red-100 text-red-700' :
                            facture.jours_retard > 7 ? 'bg-orange-100 text-orange-700' :
                            facture.jours_retard > 0 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          )}>
                            {facture.jours_retard > 0 ? `+${facture.jours_retard}j` : facture.jours_retard < 0 ? `${facture.jours_retard}j` : 'Jour J'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={cn(config.bg, config.color, 'border-0')}>
                            {config.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            {/* Bouton relance */}
                            {facture.niveau_relance < 5 && !facture.en_contentieux && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => envoyerRelanceMutation.mutate({
                                  factureId: facture.id,
                                  niveau: facture.niveau_relance + 1
                                })}
                                disabled={envoyerRelanceMutation.isPending}
                              >
                                <Send className="h-3 w-3" />
                                R{facture.niveau_relance + 1}
                              </Button>
                            )}

                            {/* Bouton mise en demeure */}
                            {facture.niveau_relance === 5 && !facture.en_contentieux && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm('Transmettre ce dossier au contentieux ?')) {
                                    transmettreContentieuxMutation.mutate({
                                      factureId: facture.id,
                                      service: 'interne'
                                    });
                                  }
                                }}
                                disabled={transmettreContentieuxMutation.isPending}
                              >
                                <Gavel className="h-3 w-3" />
                                Contentieux
                              </Button>
                            )}

                            {/* Bouton enregistrer paiement */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => {
                                setPendingInvoiceId(facture.id);
                                setInvoicePaymentMode('cb');
                                setShowInvoicePaymentModal(true);
                              }}
                              disabled={enregistrerPaiementMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" />
                              Enregistrer paiement
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Payment Modal */}
      {showInvoicePaymentModal && pendingInvoiceId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Enregistrer le paiement</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setShowInvoicePaymentModal(false); setPendingInvoiceId(null); }} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Sélectionnez le mode de paiement pour cette facture.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {MODES_PAIEMENT.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setInvoicePaymentMode(mode.value as 'especes' | 'cb' | 'virement' | 'prelevement' | 'cheque')}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      invoicePaymentMode === mode.value
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{mode.icon}</span>
                    <span className={`text-sm font-medium ${
                      invoicePaymentMode === mode.value ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      {mode.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => { setShowInvoicePaymentModal(false); setPendingInvoiceId(null); }}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => enregistrerPaiementMutation.mutate({ factureId: pendingInvoiceId, mode_paiement: invoicePaymentMode })}
                  disabled={enregistrerPaiementMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                >
                  {enregistrerPaiementMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Confirmer le paiement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
