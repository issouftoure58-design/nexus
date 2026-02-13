/**
 * Analytics Prédictifs - Business Plan
 * Dashboard complet avec prévisions, clustering, patterns
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Zap,
  RefreshCw,
  AlertCircle,
  Calendar,
  DollarSign,
  Clock
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

interface Forecast {
  historique: { month: string; ca: number }[];
  forecasts: { month: string; predicted_ca: string; confidence: number }[];
  growth_rate: string;
  avg_monthly: string;
}

interface Trends {
  nouveaux_30j: number;
  actifs: number;
  a_risque: number;
  perdus: number;
  vip: number;
  total: number;
  evolution: { month: string; nouveaux: number }[];
}

interface Clusters {
  segments: { name: string; count: number; percentage: string; avg_value: string }[];
  recommendations: { segment: string; action: string; description: string }[];
}

interface Pattern {
  type: string;
  title: string;
  description: string;
  recommendation: string;
}

interface AnalyticsData {
  forecast: Forecast;
  trends: Trends;
  clusters: Clusters;
  patterns: Pattern[];
}

const SEGMENT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const SEGMENT_LABELS: Record<string, string> = {
  champions: 'Champions',
  loyaux: 'Loyaux',
  potentiel: 'Potentiel',
  a_risque: 'A risque',
  hibernants: 'Hibernants',
  nouveaux: 'Nouveaux'
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/analytics/dashboard', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) throw new Error('Erreur chargement analytics');
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Erreur analytics:', err);
      setError('Erreur lors du chargement des analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-gray-600">{error || 'Erreur chargement données'}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  const growthPositive = parseFloat(data?.forecast?.growth_rate || '0') > 0;

  // Préparer données graphique CA
  const chartData = [
    ...(data?.forecast?.historique || []).slice(-6).map(h => ({
      month: h.month,
      ca: h.ca,
      predicted_ca: null
    })),
    ...(data?.forecast?.forecasts || []).map(f => ({
      month: f.month,
      ca: null,
      predicted_ca: parseFloat(f.predicted_ca || '0')
    }))
  ];

  // Total CA prévu
  const totalPredicted = (data?.forecast?.forecasts || []).reduce(
    (sum, f) => sum + parseFloat(f.predicted_ca || '0'),
    0
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Analytics Prédictifs</h1>
          <p className="text-gray-500">
            Anticipez les tendances de votre activité
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* KPIs Prédictifs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">CA prévu (3 mois)</p>
              <p className="text-2xl font-bold">
                {totalPredicted.toFixed(0)}€
              </p>
              <p className={`text-xs flex items-center gap-1 ${growthPositive ? 'text-green-600' : 'text-red-600'}`}>
                {growthPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {growthPositive ? '+' : ''}{data.forecast.growth_rate}% tendance
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Clients actifs</p>
              <p className="text-2xl font-bold">{data.trends.actifs}</p>
              <p className="text-xs text-gray-400">
                {data.trends.nouveaux_30j} nouveaux ce mois
              </p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Clients VIP</p>
              <p className="text-2xl font-bold">{data.trends.vip}</p>
              <p className="text-xs text-gray-400">
                {data.trends.total > 0 ? ((data.trends.vip / data.trends.total) * 100).toFixed(1) : 0}% de la base
              </p>
            </div>
            <Target className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Clients à risque</p>
              <p className="text-2xl font-bold text-orange-600">{data.trends.a_risque}</p>
              <p className="text-xs text-gray-400">
                Nécessitent action
              </p>
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
            <Tooltip
              formatter={(value) => value ? `${Number(value).toFixed(0)}€` : '-'}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="ca"
              stroke="#8884d8"
              strokeWidth={2}
              name="Historique"
              dot={{ r: 4 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="predicted_ca"
              stroke="#82ca9d"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Prévision"
              dot={{ r: 4 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Moyenne mensuelle:</span>
            <span className="font-medium">{data.forecast.avg_monthly}€</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Tendance:</span>
            <Badge className={growthPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
              {growthPositive ? '+' : ''}{data.forecast.growth_rate}% / mois
            </Badge>
          </div>
        </div>
      </Card>

      {/* Clustering Clients + Recommandations */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Segments Clients
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.clusters.segments.filter(s => s.count > 0)}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry) => `${SEGMENT_LABELS[entry.name as string] || entry.name} (${((entry.percent || 0) * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {data.clusters.segments.filter(s => s.count > 0).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${value} clients`,
                  SEGMENT_LABELS[name as string] || name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {data.clusters.segments.filter(s => s.count > 0).map((seg, i) => (
              <div key={seg.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                />
                <span>{SEGMENT_LABELS[seg.name] || seg.name}: {seg.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Recommandations par Segment
          </h3>
          {data.clusters.recommendations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Aucune recommandation pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-auto">
              {data.clusters.recommendations.map((reco, i) => (
                <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="font-medium text-sm">{reco.segment}</div>
                  <div className="text-sm text-gray-600">{reco.description}</div>
                  <Badge className="mt-1 bg-blue-100 text-blue-700 text-xs">
                    {reco.action}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Évolution Nouveaux Clients */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-green-500" />
          Évolution Nouveaux Clients (3 mois)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.trends.evolution}>
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
        {data.patterns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Pas assez de données pour détecter des patterns</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {data.patterns.map((pattern, i) => (
              <div key={i} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{pattern.title}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {pattern.description}
                    </div>
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

      {/* Résumé Tendances */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
        <h3 className="font-semibold mb-4">Résumé de la Base Clients</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{data.trends.total}</div>
            <div className="text-xs text-gray-600">Total clients</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{data.trends.actifs}</div>
            <div className="text-xs text-gray-600">Actifs (&lt;60j)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{data.trends.vip}</div>
            <div className="text-xs text-gray-600">VIP</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{data.trends.a_risque}</div>
            <div className="text-xs text-gray-600">À risque</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">{data.trends.perdus}</div>
            <div className="text-xs text-gray-600">Perdus (&gt;120j)</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
