/**
 * Sentinel - Dashboard Business Intelligence
 * Monitoring et insights pour Business Plan
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  DollarSign,
  Target,
  Users,
  Calendar,
  Lightbulb,
  CheckCircle,
  XCircle,
  ChevronRight
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

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
  costs: {
    total: number;
    avg_daily: number;
    estimated_monthly: number;
    breakdown: {
      ai: number;
      sms: number;
      voice: number;
      email: number;
    };
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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
};

const formatCurrencyEur = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};

export default function Sentinel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [activityData, setActivityData] = useState<any>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [period]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sentinel/dashboard', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });

      if (response.status === 403) {
        setError('Cette fonctionnalite necessite le plan Business');
        return;
      }

      if (!response.ok) throw new Error('Erreur lors du chargement');

      const result = await response.json();
      setData(result.data);
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
      await fetchDashboard();
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
      await fetchDashboard();
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
      await fetchDashboard();
    } catch (err) {
      console.error('Implement error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sentinel - Business Intelligence</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchDashboard}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reessayer
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
          <p className="text-gray-600 dark:text-gray-400">Business Intelligence & Monitoring</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">CA Total ({data.period.days}j)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(data.trends.total_revenue)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${data.trends.revenue_trend === 'up' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {data.trends.revenue_trend === 'up' ? (
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
          <p className={`text-sm mt-2 ${data.trends.revenue_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.trends.revenue_change >= 0 ? '+' : ''}{data.trends.revenue_change}% vs periode precedente
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Reservations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.trends.total_reservations}
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className={`text-sm mt-2 ${data.trends.reservations_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.trends.reservations_change >= 0 ? '+' : ''}{data.trends.reservations_change}% vs periode precedente
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nouveaux Clients</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.trends.total_new_clients}
              </p>
            </div>
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Sur les {data.period.days} derniers jours
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Couts IA</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyEur(data.costs.total)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <DollarSign className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            ~{formatCurrencyEur(data.costs.avg_daily)}/jour
          </p>
        </Card>
      </div>

      {/* Period Selector + Chart */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Evolution</h2>
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

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Line type="monotone" dataKey="revenue" name="CA (EUR)" stroke="#06B6D4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="reservations" name="RDV" stroke="#8B5CF6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Goals Progress + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-cyan-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Objectifs du Mois</h2>
          </div>

          {data.performance && !('no_goals' in data.performance) ? (
            <div className="space-y-4">
              {/* Revenue Goal */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Chiffre d'affaires</span>
                  <span className="font-medium">
                    {formatCurrency(data.performance.revenue.current)} / {formatCurrency(data.performance.revenue.goal)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-cyan-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(data.performance.revenue.progress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Projection: {formatCurrency(data.performance.revenue.projected)}
                </p>
              </div>

              {/* Clients Goal */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Nouveaux clients</span>
                  <span className="font-medium">
                    {data.performance.new_clients.current} / {data.performance.new_clients.goal}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(data.performance.new_clients.progress, 100)}%` }}
                  />
                </div>
              </div>

              {/* Reservations Goal */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Reservations</span>
                  <span className="font-medium">
                    {data.performance.reservations.current} / {data.performance.reservations.goal}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(data.performance.reservations.progress, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun objectif defini</p>
              <Button variant="outline" size="sm" className="mt-2">
                Definir des objectifs
              </Button>
            </div>
          )}
        </Card>

        {/* Insights */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Insights</h2>
          </div>

          {data.insights && data.insights.length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {data.insights.map((insight) => (
                <div
                  key={insight.id}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                >
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
                        onClick={() => handleImplementInsight(insight.id)}
                        className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                        title="Marquer comme implemente"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDismissInsight(insight.id)}
                        className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Ignorer"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun insight disponible</p>
              <p className="text-xs mt-1">Les insights seront generes automatiquement</p>
            </div>
          )}
        </Card>
      </div>

      {/* Costs Breakdown */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Repartition des Couts</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrencyEur(data.costs.breakdown.ai)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">IA / LLM</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrencyEur(data.costs.breakdown.sms)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">SMS</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrencyEur(data.costs.breakdown.voice)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Voix</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrencyEur(data.costs.breakdown.email)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Estimation mensuelle</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {formatCurrencyEur(data.costs.estimated_monthly)}
          </span>
        </div>
      </Card>
    </div>
  );
}
