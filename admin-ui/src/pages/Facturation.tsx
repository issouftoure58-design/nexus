import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { comptaApi, type TVAData } from '@/lib/api';
import {
  Euro,
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AVAILABLE_YEARS, formatCurrency } from '@/components/comptabilite/constants';

import ComptaOverview from '@/components/comptabilite/ComptaOverview';
import ComptaInvoices from '@/components/comptabilite/ComptaInvoices';
import ComptaExpenses from '@/components/comptabilite/ComptaExpenses';
import ComptaTVA from '@/components/comptabilite/ComptaTVA';
import ComptaRelances from '@/components/comptabilite/ComptaRelances';

type TabKey = 'overview' | 'invoices' | 'expenses' | 'tva' | 'relances';

export default function Facturation() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Période globale
  const [statsPeriod, setStatsPeriod] = useState<'jour' | 'mois' | 'annee'>('mois');
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState<number>(new Date().getMonth() + 1);
  const [statsDay, setStatsDay] = useState<number>(new Date().getDate());

  // TVA période
  const [tvaPeriode, setTvaPeriode] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Queries
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => comptaApi.getFactures(),
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: comptaApi.getDepenses,
  });

  const { data: tvaData, isLoading: tvaLoading } = useQuery<TVAData>({
    queryKey: ['tva', tvaPeriode],
    queryFn: () => comptaApi.getTVA(tvaPeriode),
    enabled: activeTab === 'tva',
  });

  // KPIs
  const matchesPeriod = useCallback((dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    if (statsPeriod === 'jour') {
      return date.getFullYear() === statsYear && date.getMonth() + 1 === statsMonth && date.getDate() === statsDay;
    } else if (statsPeriod === 'mois') {
      return date.getFullYear() === statsYear && date.getMonth() + 1 === statsMonth;
    }
    return date.getFullYear() === statsYear;
  }, [statsPeriod, statsYear, statsMonth, statsDay]);

  const kpis = useMemo(() => {
    const factures = invoicesData?.factures || [];
    const depenses = expensesData?.depenses || [];
    const facturesPeriode = factures.filter(f => matchesPeriod(f.date_facture) && f.statut !== 'annulee');
    const ca = facturesPeriode.reduce((sum, f) => sum + (f.montant_ht || 0), 0) / 100;
    const depensesPeriode = depenses.filter(d => matchesPeriod(d.date_depense));
    const totalDepenses = depensesPeriode.reduce((sum, d) => sum + (d.montant || 0), 0) / 100;
    const benefice = ca - totalDepenses;
    const impayees = facturesPeriode.filter(f => f.statut !== 'payee' && f.statut !== 'annulee' && f.statut !== 'brouillon');
    const montantImpaye = impayees.reduce((sum, f) => sum + (f.montant_ttc || 0), 0) / 100;
    return { ca, totalDepenses, benefice, montantImpaye, nbImpayees: impayees.length };
  }, [invoicesData, expensesData, matchesPeriod]);

  const periodLabel = statsPeriod === 'jour'
    ? `${statsDay}/${statsMonth}/${statsYear}`
    : statsPeriod === 'mois'
      ? `${String(statsMonth).padStart(2, '0')}/${statsYear}`
      : String(statsYear);

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
          <p className="text-sm text-gray-500">Factures, dépenses et relances</p>
        </div>

        {/* Sélecteur de période */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-2">
          <select
            value={statsPeriod}
            onChange={(e) => setStatsPeriod(e.target.value as 'jour' | 'mois' | 'annee')}
            className="px-2 py-1 border-0 bg-white rounded text-sm"
          >
            <option value="jour">Jour</option>
            <option value="mois">Mois</option>
            <option value="annee">Année</option>
          </select>
          <select
            value={statsYear}
            onChange={(e) => setStatsYear(Number(e.target.value))}
            className="px-2 py-1 border-0 bg-white rounded text-sm"
          >
            {AVAILABLE_YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          {statsPeriod !== 'annee' && (
            <select
              value={statsMonth}
              onChange={(e) => setStatsMonth(Number(e.target.value))}
              className="px-2 py-1 border-0 bg-white rounded text-sm"
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
              onChange={(e) => setStatsDay(Number(e.target.value))}
              className="px-2 py-1 border-0 bg-white rounded text-sm"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">CA ({periodLabel})</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {invoicesLoading ? '...' : formatCurrency(kpis.ca)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl"><TrendingUp className="h-6 w-6 text-green-600" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Dépenses ({periodLabel})</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {expensesLoading ? '...' : formatCurrency(kpis.totalDepenses)}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl"><TrendingDown className="h-6 w-6 text-red-600" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Bénéfice ({periodLabel})</p>
                  <p className={cn("text-2xl font-bold mt-1", kpis.benefice >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {invoicesLoading || expensesLoading ? '...' : formatCurrency(kpis.benefice)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl"><Euro className="h-6 w-6 text-blue-600" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('invoices')}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Impayées ({periodLabel})</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {invoicesLoading ? '...' : formatCurrency(kpis.montantImpaye)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {kpis.nbImpayees} facture{kpis.nbImpayees > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl"><FileText className="h-6 w-6 text-orange-600" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {(['overview', 'invoices', 'expenses', 'tva', 'relances'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tab ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-500 hover:text-gray-700',
                tab === 'relances' && kpis.nbImpayees > 0 && 'relative'
              )}
            >
              {tab === 'overview' && 'Vue d\'ensemble'}
              {tab === 'invoices' && 'Factures'}
              {tab === 'expenses' && 'Dépenses'}
              {tab === 'tva' && 'Calcul TVA'}
              {tab === 'relances' && (
                <>
                  Relances
                  {kpis.nbImpayees > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded-full">
                      {kpis.nbImpayees}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Notification */}
        {notification && (
          <div className={cn(
            "p-3 rounded-lg flex items-center gap-2",
            notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          )}>
            {notification.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {notification.message}
            <Button variant="ghost" size="sm" onClick={() => setNotification(null)} className="ml-auto h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'overview' && (
          <ComptaOverview
            invoices={invoicesData?.factures || []}
            expenses={expensesData?.depenses || []}
            onNavigateInvoices={() => setActiveTab('invoices')}
            onNewExpense={() => setActiveTab('expenses')}
          />
        )}

        {activeTab === 'invoices' && (
          <ComptaInvoices
            invoices={invoicesData?.factures || []}
            isLoading={invoicesLoading}
            onNotify={notify}
          />
        )}

        {activeTab === 'expenses' && (
          <ComptaExpenses
            expenses={expensesData?.depenses || []}
            isLoading={expensesLoading}
            onNotify={notify}
          />
        )}

        {activeTab === 'tva' && (
          <ComptaTVA
            tvaData={tvaData}
            isLoading={tvaLoading}
            tvaPeriode={tvaPeriode}
            onPeriodeChange={setTvaPeriode}
          />
        )}

        {activeTab === 'relances' && (
          <ComptaRelances onNotify={notify} />
        )}
      </div>
    </div>
  );
}
