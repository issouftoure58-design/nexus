/**
 * Sentinel - Dashboard Business Intelligence Unifié
 * Monitoring, prédictions et segmentation pour Business Plan
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Target,
  Users,
  Calendar,
  Lightbulb,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Zap,
  Clock,
  ChevronRight,
  Settings,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

// ============================================
// TYPES
// ============================================

interface DashboardData {
  today: {
    total_clients: number;
    new_clients: number;
    total_reservations: number;
    revenue_paid: number;
    no_show_rate: number;
  };
  trends: {
    total_revenue: number;
    total_reservations: number;
    total_new_clients: number;
    avg_daily_revenue: number;
    revenue_trend: string;
    revenue_change: number;
    reservations_trend: string;
    reservations_change: number;
  };
  insights: Insight[];
  performance: {
    revenue: { current: number; goal: number; projected: number; progress: number };
    new_clients: { current: number; goal: number; projected: number; progress: number };
    reservations: { current: number; goal: number; projected: number; progress: number };
  };
  period: {
    start: string;
    end: string;
    days: number;
  };
}

interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: number;
  status: string;
  created_at: string;
}

interface AnalyticsData {
  forecast: {
    historique: { month: string; ca: number }[];
    forecasts: { month: string; predicted_ca: string; confidence: number }[];
    growth_rate: string;
    avg_monthly: string;
  };
  trends: {
    nouveaux_30j: number;
    actifs: number;
    a_risque: number;
    perdus: number;
    vip: number;
    total: number;
    evolution: { month: string; nouveaux: number }[];
  };
  clusters: {
    segments: { name: string; count: number; percentage: string; avg_value: string }[];
    recommendations: { segment: string; action: string; description: string }[];
  };
  patterns: { type: string; title: string; description: string; recommendation: string }[];
}

// ============================================
// CONSTANTS
// ============================================

const SEGMENT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const SEGMENT_LABELS: Record<string, string> = {
  champions: 'Champions',
  loyaux: 'Loyaux',
  potentiel: 'Potentiel',
  a_risque: 'À risque',
  hibernants: 'Hibernants',
  nouveaux: 'Nouveaux'
};

const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
  { id: 'predictions', label: 'Prédictions', icon: TrendingUp },
  { id: 'segmentation', label: 'Segmentation', icon: PieChartIcon },
] as const;

type TabId = typeof TABS[number]['id'];

// ============================================
// HELPERS
// ============================================

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
};

const formatEuro = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function Sentinel() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [activityData, setActivityData] = useState<any>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [period]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardRes, analyticsRes] = await Promise.all([
        fetch('/api/sentinel/dashboard', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
        }),
        fetch('/api/admin/analytics/dashboard', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
        }).catch(() => null)
      ]);

      if (dashboardRes.status === 403) {
        setError('Cette fonctionnalité nécessite le plan Business');
        return;
      }

      if (!dashboardRes.ok) throw new Error('Erreur lors du chargement');

      const dashboardData = await dashboardRes.json();
      setData(dashboardData.data);

      if (analyticsRes?.ok) {
        const analytics = await analyticsRes.json();
        setAnalyticsData(analytics);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const response = await fetch(`/api/sentinel/activity/${period}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (response.ok) {
        const result = await response.json();
        setActivityData(result.data);
      }
    } catch (err) {
      console.error('Activity fetch error:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/sentinel/refresh', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      await fetchAllData();
      await fetchActivity();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDismissInsight = async (id: string) => {
    try {
      await fetch(`/api/sentinel/insights/${id}/dismiss`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'dismissed_by_user' })
      });
      await fetchAllData();
    } catch (err) {
      console.error('Dismiss error:', err);
    }
  };

  const handleImplementInsight = async (id: string) => {
    try {
      await fetch(`/api/sentinel/insights/${id}/implement`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: 'Implemented via dashboard' })
      });
      await fetchAllData();
    } catch (err) {
      console.error('Implement error:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sentinel - Business Intelligence</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchAllData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const chartData = activityData?.snapshots?.map((s: any) => ({
    date: new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    revenue: s.revenue_paid / 100,
    reservations: s.total_reservations,
    clients: s.new_clients
  })) || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sentinel</h1>
          <p className="text-gray-600 dark:text-gray-400">Business Intelligence & Analytics</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          data={data}
          chartData={chartData}
          period={period}
          setPeriod={setPeriod}
          onImplementInsight={handleImplementInsight}
          onDismissInsight={handleDismissInsight}
          onGoalsUpdated={fetchAllData}
        />
      )}

      {activeTab === 'predictions' && (
        <PredictionsTab analyticsData={analyticsData} />
      )}

      {activeTab === 'segmentation' && (
        <SegmentationTab analyticsData={analyticsData} />
      )}
    </div>
  );
}

// ============================================
// OVERVIEW TAB
// ============================================

function OverviewTab({
  data,
  chartData,
  period,
  setPeriod,
  onImplementInsight,
  onDismissInsight,
  onGoalsUpdated
}: {
  data: DashboardData;
  chartData: any[];
  period: '7d' | '30d' | '90d';
  setPeriod: (p: '7d' | '30d' | '90d') => void;
  onImplementInsight: (id: string) => void;
  onDismissInsight: (id: string) => void;
  onGoalsUpdated: () => void;
}) {
  const [showGoalsModal, setShowGoalsModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">CA Total ({data.period?.days || 30}j)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(data.trends?.total_revenue || 0)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${data.trends?.revenue_trend === 'up' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {data.trends?.revenue_trend === 'up' ? (
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
          <p className={`text-sm mt-2 ${(data.trends?.revenue_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(data.trends?.revenue_change || 0) >= 0 ? '+' : ''}{data.trends?.revenue_change || 0}% vs période précédente
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Réservations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.trends?.total_reservations || 0}
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className={`text-sm mt-2 ${(data.trends?.reservations_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(data.trends?.reservations_change || 0) >= 0 ? '+' : ''}{data.trends?.reservations_change || 0}% vs période précédente
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nouveaux Clients</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.trends?.total_new_clients || 0}
              </p>
            </div>
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Sur les {data.period?.days || 30} derniers jours
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Taux No-Show</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {(data.today?.no_show_rate || 0).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Sur les {data.period?.days || 30} derniers jours
          </p>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Évolution</h2>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  period === p
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : '90 jours'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                stroke="#06B6D4"
                tickFormatter={(v) => `${v}€`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke="#8B5CF6"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value: any, name?: string) => {
                  if (name === 'CA (€)') return [`${value}€`, name];
                  return [value, name || ''];
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" name="CA (€)" stroke="#06B6D4" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="reservations" name="Réservations" stroke="#8B5CF6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="clients" name="Nouveaux clients" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Goals + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Objectifs du Mois</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGoalsModal(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          {data.performance && !('no_goals' in data.performance) ? (
            <div className="space-y-4">
              <GoalProgress
                label="Chiffre d'affaires"
                current={data.performance.revenue?.current || 0}
                goal={data.performance.revenue?.goal || 0}
                progress={data.performance.revenue?.progress || 0}
                projected={data.performance.revenue?.projected || 0}
                color="cyan"
                isCurrency
              />
              <GoalProgress
                label="Nouveaux clients"
                current={data.performance.new_clients?.current || 0}
                goal={data.performance.new_clients?.goal || 0}
                progress={data.performance.new_clients?.progress || 0}
                color="purple"
              />
              <GoalProgress
                label="Réservations"
                current={data.performance.reservations?.current || 0}
                goal={data.performance.reservations?.goal || 0}
                progress={data.performance.reservations?.progress || 0}
                color="green"
              />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun objectif défini</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowGoalsModal(true)}>
                Définir des objectifs
              </Button>
            </div>
          )}
        </Card>

        {/* Goals Edit Modal */}
        {showGoalsModal && (
          <GoalsEditModal
            currentGoals={{
              revenue: data.performance?.revenue?.goal || 0,
              newClients: data.performance?.new_clients?.goal || 0,
              reservations: data.performance?.reservations?.goal || 0
            }}
            onClose={() => setShowGoalsModal(false)}
            onSave={() => {
              setShowGoalsModal(false);
              onGoalsUpdated();
            }}
          />
        )}

        {/* Insights */}
        <InsightsCard
          insights={data.insights}
          onImplementInsight={onImplementInsight}
          onDismissInsight={onDismissInsight}
          onInsightsGenerated={onGoalsUpdated}
        />
      </div>
    </div>
  );
}

// ============================================
// PREDICTIONS TAB
// ============================================

function PredictionsTab({ analyticsData }: { analyticsData: AnalyticsData | null }) {
  if (!analyticsData) {
    return (
      <Card className="p-8 text-center">
        <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">Données de prédiction non disponibles</p>
        <p className="text-sm text-gray-400 mt-1">Les prédictions nécessitent plus de données historiques</p>
      </Card>
    );
  }

  const growthPositive = parseFloat(analyticsData.forecast?.growth_rate || '0') > 0;

  const chartData = [
    ...(analyticsData.forecast?.historique || []).slice(-6).map(h => ({
      month: h.month,
      ca: h.ca,
      predicted_ca: null
    })),
    ...(analyticsData.forecast?.forecasts || []).map(f => ({
      month: f.month,
      ca: null,
      predicted_ca: parseFloat(f.predicted_ca || '0')
    }))
  ];

  const totalPredicted = (analyticsData.forecast?.forecasts || []).reduce(
    (sum, f) => sum + parseFloat(f.predicted_ca || '0'),
    0
  );

  return (
    <div className="space-y-6">
      {/* KPIs Prédictifs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">CA prévu (3 mois)</p>
              <p className="text-2xl font-bold">{formatEuro(totalPredicted)}</p>
              <p className={`text-xs flex items-center gap-1 ${growthPositive ? 'text-green-600' : 'text-red-600'}`}>
                {growthPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {growthPositive ? '+' : ''}{analyticsData.forecast?.growth_rate}% tendance
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Clients actifs</p>
              <p className="text-2xl font-bold">{analyticsData.trends?.actifs || 0}</p>
              <p className="text-xs text-gray-400">{analyticsData.trends?.nouveaux_30j || 0} nouveaux ce mois</p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Clients VIP</p>
              <p className="text-2xl font-bold">{analyticsData.trends?.vip || 0}</p>
              <p className="text-xs text-gray-400">
                {analyticsData.trends?.total ? ((analyticsData.trends.vip / analyticsData.trends.total) * 100).toFixed(1) : 0}% de la base
              </p>
            </div>
            <Target className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Clients à risque</p>
              <p className="text-2xl font-bold text-orange-600">{analyticsData.trends?.a_risque || 0}</p>
              <p className="text-xs text-gray-400">Nécessitent action</p>
            </div>
            <Zap className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Prévision CA */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Prévision Chiffre d'Affaires (3 mois)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(value) => value ? `${Number(value).toFixed(0)}€` : '-'} />
            <Legend />
            <Line type="monotone" dataKey="ca" stroke="#8884d8" strokeWidth={2} name="Historique" dot={{ r: 4 }} connectNulls={false} />
            <Line type="monotone" dataKey="predicted_ca" stroke="#82ca9d" strokeWidth={2} strokeDasharray="5 5" name="Prévision" dot={{ r: 4 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Moyenne mensuelle:</span>
            <span className="font-medium">{analyticsData.forecast?.avg_monthly || 0}€</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Tendance:</span>
            <Badge className={growthPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
              {growthPositive ? '+' : ''}{analyticsData.forecast?.growth_rate}% / mois
            </Badge>
          </div>
        </div>
      </Card>

      {/* Évolution Nouveaux Clients */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-green-500" />
          Évolution Nouveaux Clients (3 mois)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={analyticsData.trends?.evolution || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Bar dataKey="nouveaux" fill="#82ca9d" name="Nouveaux clients" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Patterns Détectés */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-500" />
          Patterns Détectés
        </h3>
        {(analyticsData.patterns?.length || 0) === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Pas assez de données pour détecter des patterns</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {analyticsData.patterns?.map((pattern, i) => (
              <div key={i} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{pattern.title}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{pattern.description}</div>
                    <div className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {pattern.recommendation}
                    </div>
                  </div>
                  <span className="text-2xl">
                    {pattern.type === 'temporal' ? '📅' : pattern.type === 'service' ? '⭐' : '💰'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================
// SEGMENTATION TAB
// ============================================

function SegmentationTab({ analyticsData }: { analyticsData: AnalyticsData | null }) {
  const navigate = useNavigate();

  if (!analyticsData) {
    return (
      <Card className="p-8 text-center">
        <PieChartIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">Données de segmentation non disponibles</p>
      </Card>
    );
  }

  const segments = analyticsData.clusters?.segments?.filter(s => s.count > 0) || [];

  const handleSegmentAction = (segmentType: string) => {
    navigate(`/segments?filter=${segmentType}`);
  };

  return (
    <div className="space-y-6">
      {/* Header avec bouton action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Segmentation Clients</h2>
          <p className="text-sm text-gray-500">Analyse de votre base clients</p>
        </div>
        <Button onClick={() => navigate('/segments')} variant="outline">
          <Users className="w-4 h-4 mr-2" />
          Gérer les segments
        </Button>
      </div>

      {/* Résumé Base Clients - avec boutons d'action */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <h3 className="font-semibold mb-4">Résumé de la Base Clients</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <button
            onClick={() => handleSegmentAction('all')}
            className="hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg p-2 transition-colors"
          >
            <div className="text-2xl font-bold text-blue-600">{analyticsData.trends?.total || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total clients</div>
          </button>
          <button
            onClick={() => handleSegmentAction('actifs')}
            className="hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg p-2 transition-colors"
          >
            <div className="text-2xl font-bold text-green-600">{analyticsData.trends?.actifs || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Actifs (&lt;60j)</div>
          </button>
          <button
            onClick={() => handleSegmentAction('vip')}
            className="hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg p-2 transition-colors"
          >
            <div className="text-2xl font-bold text-purple-600">{analyticsData.trends?.vip || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">VIP</div>
          </button>
          <button
            onClick={() => handleSegmentAction('a_risque')}
            className="hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg p-2 transition-colors group"
          >
            <div className="text-2xl font-bold text-orange-600">{analyticsData.trends?.a_risque || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">À risque</div>
            {(analyticsData.trends?.a_risque || 0) > 0 && (
              <div className="text-xs text-orange-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Cliquer pour agir →
              </div>
            )}
          </button>
          <button
            onClick={() => handleSegmentAction('perdus')}
            className="hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg p-2 transition-colors"
          >
            <div className="text-2xl font-bold text-gray-600">{analyticsData.trends?.perdus || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Perdus (&gt;120j)</div>
          </button>
        </div>
      </Card>

      {/* Clustering + Recommandations */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Segments Clients
            </h3>
          </div>
          {segments.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={segments}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${SEGMENT_LABELS[entry.name as string] || entry.name}`}
                    labelLine={false}
                  >
                    {segments.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} clients`, SEGMENT_LABELS[name as string] || name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {segments.map((seg, i) => (
                  <button
                    key={seg.name}
                    onClick={() => handleSegmentAction(seg.name)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                      <span className="text-sm">{SEGMENT_LABELS[seg.name] || seg.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{seg.count}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <PieChartIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Pas assez de clients pour segmenter</p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Recommandations IA
          </h3>
          {(analyticsData.clusters?.recommendations?.length || 0) === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Aucune recommandation pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-auto">
              {analyticsData.clusters?.recommendations?.map((reco, i) => (
                <div
                  key={i}
                  className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-r-lg transition-colors"
                >
                  <div className="font-medium text-sm">{reco.segment}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{reco.description}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-blue-100 text-blue-700 text-xs">{reco.action}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => handleSegmentAction(reco.segment.toLowerCase().replace(/\s+/g, '_'))}
                    >
                      Voir les clients →
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function GoalProgress({
  label,
  current,
  goal,
  progress,
  projected,
  color,
  isCurrency
}: {
  label: string;
  current: number;
  goal: number;
  progress: number;
  projected?: number;
  color: 'cyan' | 'purple' | 'green';
  isCurrency?: boolean;
}) {
  const colorClasses = {
    cyan: 'bg-cyan-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500'
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium">
          {isCurrency ? formatCurrency(current) : current} / {isCurrency ? formatCurrency(goal) : goal}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`${colorClasses[color]} h-2 rounded-full transition-all`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      {projected !== undefined && (
        <p className="text-xs text-gray-500 mt-1">
          Projection: {isCurrency ? formatCurrency(projected) : projected}
        </p>
      )}
    </div>
  );
}

function InsightsCard({
  insights,
  onImplementInsight,
  onDismissInsight,
  onInsightsGenerated
}: {
  insights: Insight[];
  onImplementInsight: (id: string) => void;
  onDismissInsight: (id: string) => void;
  onInsightsGenerated: () => void;
}) {
  const [generating, setGenerating] = useState(false);

  const handleGenerateInsights = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/sentinel/insights/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la génération');
      }

      // Rafraîchir les données
      onInsightsGenerated();
    } catch (err: any) {
      console.error('Generate insights error:', err);
      alert(err.message || 'Erreur lors de la génération des insights');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Insights IA</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateInsights}
          disabled={generating}
          className="text-xs"
        >
          {generating ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Analyse...
            </>
          ) : (
            <>
              <Zap className="w-3 h-3 mr-1" />
              Générer
            </>
          )}
        </Button>
      </div>

      {insights && insights.length > 0 ? (
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onImplement={() => onImplementInsight(insight.id)}
              onDismiss={() => onDismissInsight(insight.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun insight disponible</p>
          <p className="text-xs mt-1">Cliquez sur "Générer" pour obtenir des recommandations IA</p>
        </div>
      )}
    </Card>
  );
}

function InsightCard({
  insight,
  onImplement,
  onDismiss
}: {
  insight: Insight;
  onImplement: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={insight.priority > 7 ? 'destructive' : insight.priority > 4 ? 'default' : 'secondary'}>
              {insight.type}
            </Badge>
          </div>
          <h4 className="font-medium text-gray-900 dark:text-white text-sm">{insight.title}</h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{insight.description}</p>
        </div>
        <div className="flex gap-1 ml-2">
          <button
            onClick={onImplement}
            className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
            title="Marquer comme implémenté"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          <button
            onClick={onDismiss}
            className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Ignorer"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// GOALS EDIT MODAL
// ============================================

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

type GoalType = 'annual' | 'monthly' | 'custom';

interface MonthlyGoal {
  month: number;
  revenue: number;
  clients: number;
  reservations: number;
}

function GoalsEditModal({
  currentGoals,
  onClose,
  onSave
}: {
  currentGoals: { revenue: number; newClients: number; reservations: number; goalType?: string };
  onClose: () => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>((currentGoals.goalType as GoalType) || 'monthly');

  // Objectifs annuels
  const [annualGoals, setAnnualGoals] = useState({
    revenue: (currentGoals.revenue / 100) * 12,
    clients: currentGoals.newClients * 12,
    reservations: currentGoals.reservations * 12
  });

  // Objectifs mensuels simples
  const [monthlyGoals, setMonthlyGoals] = useState({
    revenue: currentGoals.revenue / 100,
    clients: currentGoals.newClients,
    reservations: currentGoals.reservations
  });

  // Objectifs personnalisés par mois
  const [customGoals, setCustomGoals] = useState<MonthlyGoal[]>(
    MONTHS.map((_, i) => ({
      month: i + 1,
      revenue: currentGoals.revenue / 100,
      clients: currentGoals.newClients,
      reservations: currentGoals.reservations
    }))
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      let body: any = { goal_type: goalType };

      if (goalType === 'annual') {
        body.goal_revenue_annual = annualGoals.revenue * 100;
        body.goal_new_clients_annual = annualGoals.clients;
        body.goal_reservations_annual = annualGoals.reservations;
      } else if (goalType === 'monthly') {
        body.goal_revenue_monthly = monthlyGoals.revenue * 100;
        body.goal_new_clients_monthly = monthlyGoals.clients;
        body.goal_reservations_monthly = monthlyGoals.reservations;
      } else if (goalType === 'custom') {
        body.monthly_goals = customGoals.map(g => ({
          month: g.month,
          revenue: g.revenue * 100,
          clients: g.clients,
          reservations: g.reservations
        }));
        // Utiliser le mois courant comme référence
        const currentMonth = new Date().getMonth();
        const currentMonthGoal = customGoals[currentMonth];
        body.goal_revenue_monthly = currentMonthGoal.revenue * 100;
        body.goal_new_clients_monthly = currentMonthGoal.clients;
        body.goal_reservations_monthly = currentMonthGoal.reservations;
      }

      const response = await fetch('/api/sentinel/goals', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Erreur lors de la sauvegarde');

      onSave();
    } catch (err) {
      console.error('Save goals error:', err);
      alert('Erreur lors de la sauvegarde des objectifs');
    } finally {
      setSaving(false);
    }
  };

  const updateCustomGoal = (monthIndex: number, field: keyof MonthlyGoal, value: number) => {
    setCustomGoals(prev => prev.map((g, i) =>
      i === monthIndex ? { ...g, [field]: value } : g
    ));
  };

  // Appliquer une valeur à tous les mois
  const applyToAllMonths = (field: 'revenue' | 'clients' | 'reservations', value: number) => {
    setCustomGoals(prev => prev.map(g => ({ ...g, [field]: value })));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Définir vos Objectifs</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Goal Type Selector */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {[
              { id: 'annual', label: 'Annuel', desc: 'Un objectif pour l\'année' },
              { id: 'monthly', label: 'Mensuel', desc: 'Même objectif chaque mois' },
              { id: 'custom', label: 'Personnalisé', desc: 'Différent par mois' }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setGoalType(type.id as GoalType)}
                className={`flex-1 p-3 rounded-lg border-2 transition-all text-left ${
                  goalType === type.id
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">{type.label}</div>
                <div className="text-xs text-gray-500">{type.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {goalType === 'annual' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Définissez vos objectifs annuels. Ils seront divisés par 12 pour le suivi mensuel.
              </p>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CA Annuel (€)
                  </label>
                  <Input
                    type="number"
                    value={annualGoals.revenue}
                    onChange={(e) => setAnnualGoals({ ...annualGoals, revenue: Number(e.target.value) })}
                    placeholder="Ex: 60000"
                    min={0}
                    step={1000}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    = {formatEuro(annualGoals.revenue / 12)} / mois
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nouveaux clients / an
                  </label>
                  <Input
                    type="number"
                    value={annualGoals.clients}
                    onChange={(e) => setAnnualGoals({ ...annualGoals, clients: Number(e.target.value) })}
                    placeholder="Ex: 120"
                    min={0}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    = {Math.round(annualGoals.clients / 12)} / mois
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Réservations / an
                  </label>
                  <Input
                    type="number"
                    value={annualGoals.reservations}
                    onChange={(e) => setAnnualGoals({ ...annualGoals, reservations: Number(e.target.value) })}
                    placeholder="Ex: 1200"
                    min={0}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    = {Math.round(annualGoals.reservations / 12)} / mois
                  </p>
                </div>
              </div>
            </div>
          )}

          {goalType === 'monthly' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Ces objectifs seront les mêmes chaque mois.
              </p>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CA Mensuel (€)
                  </label>
                  <Input
                    type="number"
                    value={monthlyGoals.revenue}
                    onChange={(e) => setMonthlyGoals({ ...monthlyGoals, revenue: Number(e.target.value) })}
                    placeholder="Ex: 5000"
                    min={0}
                    step={100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nouveaux clients / mois
                  </label>
                  <Input
                    type="number"
                    value={monthlyGoals.clients}
                    onChange={(e) => setMonthlyGoals({ ...monthlyGoals, clients: Number(e.target.value) })}
                    placeholder="Ex: 10"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Réservations / mois
                  </label>
                  <Input
                    type="number"
                    value={monthlyGoals.reservations}
                    onChange={(e) => setMonthlyGoals({ ...monthlyGoals, reservations: Number(e.target.value) })}
                    placeholder="Ex: 100"
                    min={0}
                  />
                </div>
              </div>
            </div>
          )}

          {goalType === 'custom' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Adaptez vos objectifs à la saisonnalité de votre activité.
              </p>

              {/* Table header */}
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 px-2">
                <div>Mois</div>
                <div>CA (€)</div>
                <div>Clients</div>
                <div>RDV</div>
              </div>

              {/* Monthly rows */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {customGoals.map((goal, index) => (
                  <div
                    key={goal.month}
                    className={`grid grid-cols-4 gap-2 items-center p-2 rounded-lg ${
                      index === new Date().getMonth()
                        ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="text-sm font-medium">
                      {MONTHS[index]}
                      {index === new Date().getMonth() && (
                        <span className="text-xs text-cyan-600 ml-1">(actuel)</span>
                      )}
                    </div>
                    <Input
                      type="number"
                      value={goal.revenue}
                      onChange={(e) => updateCustomGoal(index, 'revenue', Number(e.target.value))}
                      className="h-8 text-sm"
                      min={0}
                    />
                    <Input
                      type="number"
                      value={goal.clients}
                      onChange={(e) => updateCustomGoal(index, 'clients', Number(e.target.value))}
                      className="h-8 text-sm"
                      min={0}
                    />
                    <Input
                      type="number"
                      value={goal.reservations}
                      onChange={(e) => updateCustomGoal(index, 'reservations', Number(e.target.value))}
                      className="h-8 text-sm"
                      min={0}
                    />
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500">Appliquer à tous:</span>
                <button
                  onClick={() => {
                    const val = prompt('CA mensuel pour tous les mois (€):');
                    if (val) applyToAllMonths('revenue', Number(val));
                  }}
                  className="text-xs text-cyan-600 hover:underline"
                >
                  CA
                </button>
                <button
                  onClick={() => {
                    const val = prompt('Clients pour tous les mois:');
                    if (val) applyToAllMonths('clients', Number(val));
                  }}
                  className="text-xs text-cyan-600 hover:underline"
                >
                  Clients
                </button>
                <button
                  onClick={() => {
                    const val = prompt('RDV pour tous les mois:');
                    if (val) applyToAllMonths('reservations', Number(val));
                  }}
                  className="text-xs text-cyan-600 hover:underline"
                >
                  RDV
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
