import React, { useState, useMemo, Suspense, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { comptaApi, type CompteResultatResponse, type BilanResponse } from '@/lib/api';
import {
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  BarChart3,
  Wallet,
  Landmark,
  Users,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AVAILABLE_YEARS } from '@/components/comptabilite/constants';

// Lazy-load heavy tabs
const ComptaResultat = React.lazy(() => import('@/components/comptabilite/ComptaResultat'));
const ComptaBilan = React.lazy(() => import('@/components/comptabilite/ComptaBilan'));
const Rapprochement = React.lazy(() => import('@/pages/Rapprochement'));
const ComptesAuxiliaires = React.lazy(() => import('@/pages/ComptesAuxiliaires'));
const ExpertComptable = React.lazy(() => import('@/pages/ExpertComptable'));

type TabKey = 'resultat' | 'bilan' | 'rapprochement' | 'auxiliaires' | 'expert';

export default function Comptabilite() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'resultat';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'resultat') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  // Période globale
  const [statsPeriod, setStatsPeriod] = useState<'jour' | 'mois' | 'annee'>('mois');
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState<number>(new Date().getMonth() + 1);
  const [statsDay, setStatsDay] = useState<number>(new Date().getDate());

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Paramètres de période pour les requêtes comptables
  const comptaPeriodeParams = useMemo(() => {
    if (statsPeriod === 'jour') {
      const date_fin = `${statsYear}-${String(statsMonth).padStart(2, '0')}-${String(statsDay).padStart(2, '0')}`;
      return { exercice: statsYear, date_fin };
    } else if (statsPeriod === 'mois') {
      const periode = `${statsYear}-${String(statsMonth).padStart(2, '0')}`;
      return { exercice: statsYear, periode };
    } else {
      return { exercice: statsYear };
    }
  }, [statsPeriod, statsYear, statsMonth, statsDay]);

  const { data: compteResultatData, isLoading: compteResultatLoading } = useQuery<CompteResultatResponse>({
    queryKey: ['compte-resultat', comptaPeriodeParams],
    queryFn: () => comptaApi.getCompteResultat(comptaPeriodeParams),
    enabled: activeTab === 'resultat',
  });

  const { data: bilanData, isLoading: bilanLoading } = useQuery<BilanResponse>({
    queryKey: ['bilan', comptaPeriodeParams],
    queryFn: () => comptaApi.getBilan(comptaPeriodeParams),
    enabled: activeTab === 'bilan',
  });

  const lazyFallback = (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-sm text-gray-500">Résultat, bilan, rapprochement, auxiliaires et exports</p>
        </div>

        {/* Sélecteur de période (résultat/bilan uniquement) */}
        {(activeTab === 'resultat' || activeTab === 'bilan') && <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-2">
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
        </div>}
      </div>

      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {([
            { key: 'resultat' as TabKey, icon: BarChart3, label: 'Compte de résultat' },
            { key: 'bilan' as TabKey, icon: Wallet, label: 'Bilan' },
            { key: 'rapprochement' as TabKey, icon: Landmark, label: 'Rapprochement' },
            { key: 'auxiliaires' as TabKey, icon: Users, label: 'Comptes Auxiliaires' },
            { key: 'expert' as TabKey, icon: UserCheck, label: 'Expert-comptable' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5',
                activeTab === key ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
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
        {activeTab === 'resultat' && (
          <Suspense fallback={lazyFallback}>
            <ComptaResultat
              data={compteResultatData}
              isLoading={compteResultatLoading}
              statsPeriod={statsPeriod}
              statsYear={statsYear}
              statsMonth={statsMonth}
              statsDay={statsDay}
              onStatsPeriodChange={setStatsPeriod}
              onStatsYearChange={setStatsYear}
              onStatsMonthChange={setStatsMonth}
              onStatsDayChange={setStatsDay}
              onNotify={notify}
            />
          </Suspense>
        )}

        {activeTab === 'bilan' && (
          <Suspense fallback={lazyFallback}>
            <ComptaBilan
              data={bilanData}
              isLoading={bilanLoading}
              statsPeriod={statsPeriod}
              statsYear={statsYear}
              statsMonth={statsMonth}
              statsDay={statsDay}
              onStatsPeriodChange={setStatsPeriod}
              onStatsYearChange={setStatsYear}
              onStatsMonthChange={setStatsMonth}
              onStatsDayChange={setStatsDay}
              onNotify={notify}
            />
          </Suspense>
        )}

        {activeTab === 'rapprochement' && (
          <Suspense fallback={lazyFallback}>
            <Rapprochement embedded />
          </Suspense>
        )}

        {activeTab === 'auxiliaires' && (
          <Suspense fallback={lazyFallback}>
            <ComptesAuxiliaires embedded />
          </Suspense>
        )}

        {activeTab === 'expert' && (
          <Suspense fallback={lazyFallback}>
            <ExpertComptable embedded />
          </Suspense>
        )}
      </div>
    </div>
  );
}
