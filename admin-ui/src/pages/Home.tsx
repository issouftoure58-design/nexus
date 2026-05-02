/**
 * Home — Dashboard KPIs NEXUS Admin
 * CA, réservations, clients, graphiques tendances — style Stripe/Shopify
 * Sentinel Live Feed bar en haut (conservée)
 */

import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Calendar, Users, DollarSign,
  Activity, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Clock, Shield, Zap, Target, Cpu, Lock, Crown
} from 'lucide-react';
import { api, analyticsApi, statsApi } from '../lib/api';
import type { AnalyticsOverview, DashboardStats } from '../lib/api';
import { useTenant } from '@/hooks/useTenant';

// ── Types ──

interface ChurnData {
  total_clients: number;
  at_risk: number;
  high_risk: number;
  medium_risk: number;
}

interface SentinelEvent {
  id: string;
  type: 'success' | 'warning' | 'info' | 'action' | 'money' | 'seo' | 'marketing' | 'anomaly' | 'roi';
  category: 'activity' | 'finance' | 'seo' | 'marketing' | 'recommendation' | 'cost' | 'anomaly';
  message: string;
  detail?: string;
  value?: number;
  timestamp: Date;
}

interface SentinelStats {
  ca_mois: number;
  depenses_mois: number;
  resultat_net: number;
  marge_nette: string;
  anomalies: number;
  workflows_actifs: number;
  executions_mois: number;
  notifications_mois: number;
  taches_completees: number;
  clients_risque: number;
}

interface PnlResponse {
  revenus?: { total: string };
  depenses?: { total: string };
  resultat?: { net: string; margeNette: string };
}

interface AutomationResponse {
  workflows?: { actifs: number; executions_mois: number };
  notifications?: { total_mois: number };
  taches?: { completees_mois: number };
}

// ── Helpers ──

function formatCurrency(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k€`;
  return `${Math.round(value)}€`;
}

function formatVariation(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Math.round(value)}%`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ── Sentinel Live Bar (conservée) ──

const SentinelBar = memo(function SentinelBar() {
  const [events, setEvents] = useState<SentinelEvent[]>([]);
  const [stats, setStats] = useState<SentinelStats | null>(null);

  const fetchSentinel = useCallback(async () => {
    try {
      const [pnlRes, autoRes] = await Promise.allSettled([
        api.get<PnlResponse>('/admin/compta/pnl'),
        api.get<AutomationResponse>('/admin/stats/automation'),
      ]);

      const pnl = pnlRes.status === 'fulfilled' ? pnlRes.value : null;
      const auto = autoRes.status === 'fulfilled' ? autoRes.value : null;

      const revenus = parseFloat(pnl?.revenus?.total || '0');
      const depenses = parseFloat(pnl?.depenses?.total || '0');
      const resultat = parseFloat(pnl?.resultat?.net || '0');
      const marge = pnl?.resultat?.margeNette || '0%';

      setStats({
        ca_mois: revenus,
        depenses_mois: depenses,
        resultat_net: resultat,
        marge_nette: marge,
        anomalies: 0,
        workflows_actifs: auto?.workflows?.actifs || 0,
        executions_mois: auto?.workflows?.executions_mois || 0,
        notifications_mois: auto?.notifications?.total_mois || 0,
        taches_completees: auto?.taches?.completees_mois || 0,
        clients_risque: 0,
      });

      // Générer les événements sentinel
      const newEvents: SentinelEvent[] = [];
      if (revenus > 0) {
        newEvents.push({
          id: 'rev-1',
          type: 'money',
          category: 'finance',
          message: `CA mois: ${Math.round(revenus)}€`,
          timestamp: new Date(),
        });
      }
      if (auto?.workflows?.actifs) {
        newEvents.push({
          id: 'auto-1',
          type: 'info',
          category: 'activity',
          message: `${auto.workflows.actifs} workflows actifs`,
          timestamp: new Date(),
        });
      }
      setEvents(newEvents);
    } catch {
      // Silencieux
    }
  }, []);

  useEffect(() => {
    fetchSentinel();
    const interval = setInterval(fetchSentinel, 60000);
    return () => clearInterval(interval);
  }, [fetchSentinel]);

  if (!stats) return null;

  return (
    <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-xs rounded-t-lg">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium">Sentinel</span>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-orange-400" />
          <span>CA {Math.round(stats.ca_mois)}€</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-3 h-3 text-cyan-400" />
          <span>Résultat {stats.resultat_net >= 0 ? '+' : ''}{Math.round(stats.resultat_net)}€</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {stats.workflows_actifs > 0 && (
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>{stats.workflows_actifs} workflows</span>
          </div>
        )}
        {events.length > 0 && (
          <div className="flex items-center gap-1 text-gray-400">
            <Zap className="w-3 h-3" />
            <span>{events.length} événements</span>
          </div>
        )}
      </div>
    </div>
  );
});

// ── KPI Card ──

interface KpiCardProps {
  title: string;
  value: string;
  variation?: number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

function KpiCard({ title, value, variation, icon, color, onClick }: KpiCardProps) {
  const isPositive = (variation ?? 0) >= 0;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 transition-all hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
        {variation !== undefined && (
          <span className={`flex items-center text-xs font-medium mb-1 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {formatVariation(variation)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── RDV du jour ──

interface TodayRdvProps {
  dashboard: DashboardStats | undefined;
  isLoading: boolean;
}

function TodayRdv({ dashboard, isLoading }: TodayRdvProps) {
  const navigate = useNavigate();

  // Build today's RDV list from dashboard data
  const rdvConfirmes = dashboard?.rdv?.confirmes ?? 0;
  const rdvEnAttente = dashboard?.rdv?.en_attente ?? 0;
  const prochainRdv = dashboard?.prochainRdv;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          Réservations du jour
        </h3>
        <button
          onClick={() => navigate('/activites')}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium"
        >
          Voir tout
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-300">Confirmés</span>
            <span className="text-sm font-bold text-emerald-600">{rdvConfirmes}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-300">En attente</span>
            <span className="text-sm font-bold text-amber-600">{rdvEnAttente}</span>
          </div>

          {prochainRdv ? (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Prochain</div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {prochainRdv.heure}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {prochainRdv.clients?.prenom} {prochainRdv.clients?.nom}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {prochainRdv.service_nom}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-center py-4">
              <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Aucune réservation aujourd'hui</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Services Populaires ──

interface ServicesPopulairesProps {
  services: Array<{ service: string; count: number }> | undefined;
  isLoading: boolean;
}

function ServicesPopulaires({ services, isLoading }: ServicesPopulairesProps) {
  const top5 = (services || []).slice(0, 5);
  const maxCount = top5.length > 0 ? Math.max(...top5.map(s => s.count)) : 1;

  const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-indigo-500" />
        Services populaires
      </h3>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : top5.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Aucune donnée</p>
      ) : (
        <div className="space-y-3">
          {top5.map((s, i) => (
            <div key={s.service}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[70%]">
                  {s.service}
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">{s.count}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${(s.count / maxCount) * 100}%`,
                    backgroundColor: COLORS[i] || COLORS[4],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Clients à risque ──

interface ClientsRisqueProps {
  churn: ChurnData | undefined;
  isLoading: boolean;
}

function ClientsRisque({ churn, isLoading }: ClientsRisqueProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Clients à risque
        </h3>
        <button
          onClick={() => navigate('/churn')}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium"
        >
          Détails
        </button>
      </div>

      {isLoading ? (
        <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : !churn || churn.at_risk === 0 ? (
        <div className="text-center py-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
            <Shield className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucun client à risque</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-center mb-3">
            <span className="text-3xl font-bold text-amber-600">{churn.at_risk}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">clients à risque</span>
          </div>
          <div className="flex gap-2">
            {churn.high_risk > 0 && (
              <div className="flex-1 text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
                <div className="text-lg font-bold text-red-600">{churn.high_risk}</div>
                <div className="text-[10px] text-red-500 uppercase font-medium">Élevé</div>
              </div>
            )}
            {churn.medium_risk > 0 && (
              <div className="flex-1 text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                <div className="text-lg font-bold text-amber-600">{churn.medium_risk}</div>
                <div className="text-[10px] text-amber-500 uppercase font-medium">Moyen</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CA Chart ──

interface CaChartProps {
  chartData: Array<{ date: string; ca: number }> | undefined;
  isLoading: boolean;
}

function CaChart({ chartData, isLoading }: CaChartProps) {
  const data = (chartData || []).map(d => ({
    ...d,
    label: formatDate(d.date),
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 h-full">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        CA sur 30 jours
      </h3>

      {isLoading ? (
        <div className="h-[250px] bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Aucune donnée de CA</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={Math.max(0, Math.floor(data.length / 7) - 1)}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}€`}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
              }}
              formatter={(value: number | undefined) => [`${Math.round(value ?? 0)}€`, 'CA']}
              labelFormatter={(label) => `${label}`}
            />
            <Line
              type="monotone"
              dataKey="ca"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Locked Widget (plan teaser) ──

interface LockedWidgetProps {
  title: string;
  icon: React.ReactNode;
  planRequired: string;
  description: string;
}

function LockedWidget({ title, icon, planRequired, description }: LockedWidgetProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-3">
          <Lock className="w-6 h-6 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{description}</p>
        <Link
          to="/subscription"
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
        >
          <Crown className="w-3.5 h-3.5" />
          Passer en {planRequired}
        </Link>
      </div>
      {/* Blurred placeholder content */}
      <div className="opacity-30">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          {icon}
          {title}
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Home Component ──

export function Home() {
  const navigate = useNavigate();
  const { hasPlan } = useTenant();

  const canSeeSentinel = hasPlan('enterprise');
  const canSeeChurn = hasPlan('pro');
  const canSeeCompta = hasPlan('business');

  // Fetch KPI overview
  const { data: overview } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics-overview'],
    queryFn: () => analyticsApi.getOverview(),
    refetchInterval: 120000,
  });

  // Revenue 30d — utilise graphiqueCa du dashboard (accessible à tous les plans)

  // Fetch dashboard stats (RDV, services populaires)
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => statsApi.getDashboard(),
    refetchInterval: 120000,
  });

  // Fetch churn (only if plan allows)
  const { data: churn, isLoading: churnLoading } = useQuery<ChurnData>({
    queryKey: ['analytics-churn'],
    queryFn: () => api.get<ChurnData>('/admin/analytics/churn'),
    refetchInterval: 300000,
    enabled: canSeeChurn,
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sentinel Bar — Enterprise only */}
      {canSeeSentinel && <SentinelBar />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* 4 KPI Cards — source: statsApi.getDashboard (fonctionne pour tous les plans/business types) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="CA ce mois"
            value={dashboardLoading ? '...' : formatCurrency(dashboard?.ca?.mois ?? 0)}
            variation={overview?.ca_variation}
            icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
            color="bg-emerald-100 dark:bg-emerald-900/30"
            onClick={canSeeCompta ? () => navigate('/comptabilite') : undefined}
          />
          <KpiCard
            title="Réservations"
            value={dashboardLoading ? '...' : `${(dashboard?.rdv?.confirmes ?? 0) + (dashboard?.rdv?.en_attente ?? 0) + (dashboard?.rdv?.termines ?? 0)}`}
            variation={overview?.rdv_variation}
            icon={<Calendar className="w-4 h-4 text-blue-600" />}
            color="bg-blue-100 dark:bg-blue-900/30"
            onClick={() => navigate('/activites')}
          />
          <KpiCard
            title="Clients actifs"
            value={dashboardLoading ? '...' : `${dashboard?.nbClients ?? 0}`}
            variation={overview?.clients_variation}
            icon={<Users className="w-4 h-4 text-violet-600" />}
            color="bg-violet-100 dark:bg-violet-900/30"
            onClick={() => navigate('/clients')}
          />
          <KpiCard
            title="Taux conversion"
            value={dashboardLoading ? '...' : `${dashboard?.rdv ? Math.round(((dashboard.rdv.confirmes + dashboard.rdv.termines) / Math.max(1, dashboard.rdv.confirmes + dashboard.rdv.en_attente + dashboard.rdv.annules + dashboard.rdv.termines)) * 100) : 0}%`}
            icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
            color="bg-amber-100 dark:bg-amber-900/30"
          />
        </div>

        {/* Graphique CA + RDV du jour */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <CaChart chartData={dashboard?.graphiqueCa} isLoading={dashboardLoading} />
          </div>
          <div>
            <TodayRdv dashboard={dashboard} isLoading={dashboardLoading} />
          </div>
        </div>

        {/* Services populaires + Clients à risque */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ServicesPopulaires
            services={dashboard?.servicesPopulaires}
            isLoading={dashboardLoading}
          />
          {canSeeChurn ? (
            <ClientsRisque churn={churn} isLoading={churnLoading} />
          ) : (
            <LockedWidget
              title="Clients à risque"
              icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
              planRequired="Pro"
              description="Détectez vos clients à risque de départ"
            />
          )}
        </div>
      </div>
    </div>
  );
}
