import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Users,
  Euro,
  BarChart3,
  Clock,
  Activity,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  Download,
  AlertTriangle,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';

interface Insight {
  type: string;
  icon: string;
  title: string;
  message: string;
}

interface Comparison {
  previous_period: { start: string; end: string; appointments: number; revenue: number };
  changes: {
    revenue: { value: number; direction: string };
    appointments: { value: number; direction: string };
  };
}

interface AnalyticsData {
  summary: {
    total_appointments: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    completed: number;
    total_revenue: number;
    average_per_appointment: number;
    new_clients: number;
    total_clients: number;
  };
  charts: {
    revenue_timeline: Array<{ date: string; revenue: number; rdv: number }>;
    appointments_by_status: Array<{ status: string; count: number; color: string }>;
    top_services: Array<{ service: string; count: number; revenue: number }>;
    peak_hours: Array<{ hour: string; count: number }>;
    rdv_by_day_of_week: Array<{ day: string; count: number }>;
  };
  comparison?: Comparison;
  insights?: Insight[];
}

interface PredictionsData {
  mois_en_cours?: {
    nom: string;
    jour_actuel: number;
    jours_total: number;
    ca_actuel_euros: string;
    ca_estime_mois_complet_euros: string;
    rdv_actuel: number;
    rdv_estime_mois_complet: number;
  };
  prediction_mois_prochain: {
    nom: string;
    ca_prevu_euros: string;
    nb_rdv_prevu: number;
    confiance: string;
    methode: string;
  };
  historique_mensuel: Array<{
    mois: string;
    mois_nom: string;
    ca_euros: string;
    nb_rdv: number;
  }>;
  tendance_globale: string;
  croissance_pourcent: string;
  services_en_hausse: Array<{ service: string; progression: number; pourcentage: string }>;
  recommandations: Array<{ type: string; message: string; action: string }>;
}

interface AnomaliesData {
  nb_anomalies: number;
  sante_globale: string;
  anomalies: Array<{
    type: string;
    severite: string;
    valeur: string;
    message: string;
    recommandation: string;
  }>;
}

const PERIODS = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '1y', label: '1 an' },
];

function VariationBadge({ change }: { change: { value: number; direction: string } }) {
  if (!change || change.value === 0) return null;
  const isUp = change.direction === 'up';
  const isDown = change.direction === 'down';
  return (
    <div className={`flex items-center gap-1 text-xs mt-1 ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white/40'}`}>
      {isUp && <TrendingUp className="w-3 h-3" />}
      {isDown && <TrendingDown className="w-3 h-3" />}
      {!isUp && !isDown && <Minus className="w-3 h-3" />}
      <span>{isUp ? '+' : ''}{change.value}% vs précédent</span>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [predictions, setPredictions] = useState<PredictionsData | null>(null);
  const [anomalies, setAnomalies] = useState<AnomaliesData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'predictions' | 'anomalies'>('overview');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    setLoading(true);

    // Charger les analytics de base
    const loadBase = fetch(`/api/admin/analytics?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());

    // Charger les prédictions IA
    const loadPredictions = fetch('/api/analytics/predictions', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).catch(() => null);

    // Charger les anomalies
    const loadAnomalies = fetch('/api/analytics/anomalies', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).catch(() => null);

    Promise.all([loadBase, loadPredictions, loadAnomalies])
      .then(([baseData, predData, anomData]) => {
        if (baseData.success) setData(baseData);
        if (predData?.success !== false) setPredictions(predData);
        if (anomData?.success !== false) setAnomalies(anomData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(format);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/analytics/export/${format}?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${period}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(null);
    }
  };

  const tooltipStyle = {
    contentStyle: { background: '#18181b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', color: '#fff' },
    itemStyle: { color: '#fbbf24' },
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-white/50 text-sm">Vue d'ensemble de vos performances</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  period === p.value
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}

            {/* Export buttons */}
            <div className="flex gap-2 sm:border-l sm:border-white/10 sm:pl-3 sm:ml-1">
              <button
                onClick={() => handleExport('excel')}
                disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-sm transition-all disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exporting === 'excel' ? '...' : 'Excel'}
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-sm transition-all disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {exporting === 'pdf' ? '...' : 'PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl w-fit">
          {[
            { id: 'overview', label: 'Vue générale', icon: BarChart3 },
            { id: 'predictions', label: 'Prédictions IA', icon: Sparkles },
            { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle, badge: anomalies?.nb_anomalies },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Alert Anomalies Banner */}
        {anomalies && anomalies.nb_anomalies > 0 && anomalies.sante_globale !== 'bonne' && activeTab !== 'anomalies' && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div className="flex-1">
                <p className="text-white font-medium">
                  {anomalies.nb_anomalies} anomalie{anomalies.nb_anomalies > 1 ? 's' : ''} détectée{anomalies.nb_anomalies > 1 ? 's' : ''}
                </p>
                <p className="text-white/60 text-sm">{anomalies.anomalies[0]?.message}</p>
              </div>
              <button
                onClick={() => setActiveTab('anomalies')}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-sm transition-all"
              >
                Voir détails
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : data && activeTab === 'overview' ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Chiffre d'affaires",
                  value: `${Math.round(data.summary.total_revenue / 100)}€`,
                  sub: `Moy. ${Math.round(data.summary.average_per_appointment / 100)}€/RDV`,
                  icon: Euro,
                  color: 'from-green-500 to-emerald-600',
                  change: data.comparison?.changes.revenue,
                },
                {
                  label: 'Rendez-vous',
                  value: data.summary.total_appointments,
                  sub: `${data.summary.confirmed} confirmés`,
                  icon: Calendar,
                  color: 'from-blue-500 to-cyan-600',
                  change: data.comparison?.changes.appointments,
                },
                {
                  label: 'Taux confirmation',
                  value: `${data.summary.total_appointments > 0 ? Math.round((data.summary.confirmed / data.summary.total_appointments) * 100) : 0}%`,
                  sub: `${data.summary.cancelled} annulés`,
                  icon: Activity,
                  color: 'from-purple-500 to-violet-600',
                },
                {
                  label: 'Nouveaux clients',
                  value: data.summary.new_clients,
                  sub: `${data.summary.total_clients} total`,
                  icon: Users,
                  color: 'from-amber-500 to-orange-600',
                },
              ].map((kpi, i) => (
                <div key={i} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/50 text-sm">{kpi.label}</span>
                    <div className={`w-10 h-10 bg-gradient-to-br ${kpi.color} rounded-xl flex items-center justify-center shadow-lg`}>
                      <kpi.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{kpi.value}</p>
                  <p className="text-xs text-white/40 mt-1">{kpi.sub}</p>
                  {kpi.change && <VariationBadge change={kpi.change} />}
                </div>
              ))}
            </div>

            {/* Insights */}
            {data.insights && data.insights.length > 0 && (
              <div className="bg-zinc-900/80 border border-amber-500/20 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.insights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border-l-4 ${
                        insight.type === 'success' ? 'bg-green-500/10 border-green-500' :
                        insight.type === 'warning' ? 'bg-amber-500/10 border-amber-500' :
                        'bg-blue-500/10 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-xl shrink-0">{insight.icon}</span>
                        <div>
                          <h4 className="font-medium text-white text-sm">{insight.title}</h4>
                          <p className="text-xs text-white/50 mt-0.5">{insight.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue Timeline */}
              <div className="lg:col-span-2 bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Evolution du CA
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.charts.revenue_timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                      tickFormatter={d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [`${Math.round(v / 100)}€`, 'CA']} labelFormatter={d => new Date(d).toLocaleDateString('fr-FR')} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  RDV par statut
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.charts.appointments_by_status.filter(s => s.count > 0)}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      dataKey="count"
                      label={({ status, count }) => `${status}: ${count}`}
                      labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}
                    >
                      {data.charts.appointments_by_status.filter(s => s.count > 0).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Services */}
              <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  Services populaires
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.charts.top_services} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <YAxis type="category" dataKey="service" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} width={140} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Peak Hours */}
              <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Heures de pointe
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.charts.peak_hours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Day of Week */}
            <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                RDV par jour de la semaine
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.charts.rdv_by_day_of_week}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : null}

        {/* TAB: Prédictions IA */}
        {activeTab === 'predictions' && predictions && (
          <div className="space-y-6">
            {/* Mois en cours */}
            {predictions.mois_en_cours && (
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-400" />
                  {predictions.mois_en_cours.nom} en cours
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-white/50 text-sm">Jour</p>
                    <p className="text-2xl font-bold text-white">{predictions.mois_en_cours.jour_actuel}/{predictions.mois_en_cours.jours_total}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-white/50 text-sm">CA actuel</p>
                    <p className="text-2xl font-bold text-green-400">{predictions.mois_en_cours.ca_actuel_euros}€</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-white/50 text-sm">CA estimé fin de mois</p>
                    <p className="text-2xl font-bold text-amber-400">{predictions.mois_en_cours.ca_estime_mois_complet_euros}€</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-white/50 text-sm">RDV estimés</p>
                    <p className="text-2xl font-bold text-purple-400">{predictions.mois_en_cours.rdv_estime_mois_complet}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Prédiction mois prochain */}
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Prédiction {predictions.prediction_mois_prochain.nom}
                  </h3>
                  <p className="text-white/50 text-sm mt-1">{predictions.prediction_mois_prochain.methode}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  predictions.prediction_mois_prochain.confiance === 'haute' ? 'bg-green-500/20 text-green-400' :
                  predictions.prediction_mois_prochain.confiance === 'moyenne' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-white/10 text-white/60'
                }`}>
                  Confiance {predictions.prediction_mois_prochain.confiance}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-white/50 text-sm mb-2">CA prévu</p>
                  <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                    {predictions.prediction_mois_prochain.ca_prevu_euros}€
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-sm mb-2">RDV prévus</p>
                  <p className="text-4xl font-bold text-white">{predictions.prediction_mois_prochain.nb_rdv_prevu}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-sm mb-2">Croissance</p>
                  <p className={`text-4xl font-bold ${
                    parseFloat(predictions.croissance_pourcent) > 0 ? 'text-green-400' :
                    parseFloat(predictions.croissance_pourcent) < 0 ? 'text-red-400' : 'text-white/60'
                  }`}>
                    {parseFloat(predictions.croissance_pourcent) > 0 ? '+' : ''}{predictions.croissance_pourcent}%
                  </p>
                </div>
              </div>
            </div>

            {/* Graphique historique + prédiction */}
            <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Historique & Projection
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  ...predictions.historique_mensuel.map(h => ({
                    mois: h.mois_nom.split(' ')[0],
                    CA: parseFloat(h.ca_euros),
                    type: 'historique' as const
                  })),
                  {
                    mois: predictions.prediction_mois_prochain.nom.split(' ')[0],
                    CA: parseFloat(predictions.prediction_mois_prochain.ca_prevu_euros),
                    type: 'prediction' as const
                  }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="mois" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}€`, 'CA']} />
                  <Bar dataKey="CA" radius={[6, 6, 0, 0]}>
                    {[
                      ...predictions.historique_mensuel.map(() => ({ type: 'historique' as const })),
                      { type: 'prediction' as const }
                    ].map((entry, index) => (
                      <Cell key={index} fill={entry.type === 'prediction' ? '#f59e0b' : '#4f46e5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4">
                <span className="flex items-center gap-2 text-sm text-white/60">
                  <span className="w-3 h-3 bg-indigo-600 rounded" /> Historique
                </span>
                <span className="flex items-center gap-2 text-sm text-white/60">
                  <span className="w-3 h-3 bg-amber-500 rounded" /> Prédiction IA
                </span>
              </div>
            </div>

            {/* Services en hausse + Recommandations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {predictions.services_en_hausse.length > 0 && (
                <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Services en hausse
                  </h3>
                  <div className="space-y-3">
                    {predictions.services_en_hausse.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <span className="text-white">{s.service}</span>
                        <span className="text-green-400 font-semibold">+{s.pourcentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {predictions.recommandations.length > 0 && (
                <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    Recommandations IA
                  </h3>
                  <div className="space-y-3">
                    {predictions.recommandations.map((r, i) => (
                      <div key={i} className={`p-3 rounded-xl border-l-4 ${
                        r.type === 'alerte' ? 'bg-red-500/10 border-red-500' :
                        'bg-amber-500/10 border-amber-500'
                      }`}>
                        <p className="text-white text-sm font-medium">{r.message}</p>
                        <p className="text-white/60 text-xs mt-1">💡 {r.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Anomalies */}
        {activeTab === 'anomalies' && (
          <div className="space-y-6">
            {/* Santé globale */}
            <div className={`rounded-2xl p-6 ${
              anomalies?.sante_globale === 'bonne' ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30' :
              anomalies?.sante_globale === 'critique' ? 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30' :
              'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  anomalies?.sante_globale === 'bonne' ? 'bg-green-500/20' :
                  anomalies?.sante_globale === 'critique' ? 'bg-red-500/20' : 'bg-amber-500/20'
                }`}>
                  {anomalies?.sante_globale === 'bonne' ? (
                    <Zap className="w-8 h-8 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Santé : {anomalies?.sante_globale === 'bonne' ? 'Excellente 🎉' :
                            anomalies?.sante_globale === 'critique' ? 'Critique ⚠️' : 'Attention requise'}
                  </h3>
                  <p className="text-white/60">
                    {(anomalies?.nb_anomalies ?? 0) === 0 ? 'Aucune anomalie détectée' :
                     `${anomalies?.nb_anomalies ?? 0} anomalie${(anomalies?.nb_anomalies ?? 0) > 1 ? 's' : ''} détectée${(anomalies?.nb_anomalies ?? 0) > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Liste des anomalies */}
            {anomalies?.anomalies && anomalies.anomalies.length > 0 ? (
              <div className="space-y-4">
                {anomalies.anomalies.map((anom, i) => (
                  <div key={i} className={`bg-zinc-900/80 border rounded-2xl p-5 ${
                    anom.severite === 'critique' ? 'border-red-500/50' :
                    anom.severite === 'haute' ? 'border-orange-500/50' :
                    anom.severite === 'moyenne' ? 'border-amber-500/50' : 'border-white/10'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          anom.severite === 'critique' ? 'bg-red-500/20' :
                          anom.severite === 'haute' ? 'bg-orange-500/20' :
                          anom.severite === 'moyenne' ? 'bg-amber-500/20' : 'bg-blue-500/20'
                        }`}>
                          <AlertTriangle className={`w-5 h-5 ${
                            anom.severite === 'critique' ? 'text-red-400' :
                            anom.severite === 'haute' ? 'text-orange-400' :
                            anom.severite === 'moyenne' ? 'text-amber-400' : 'text-blue-400'
                          }`} />
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{anom.message}</h4>
                          <p className="text-white/50 text-sm">Valeur: {anom.valeur}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${
                        anom.severite === 'critique' ? 'bg-red-500/20 text-red-400' :
                        anom.severite === 'haute' ? 'bg-orange-500/20 text-orange-400' :
                        anom.severite === 'moyenne' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {anom.severite}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 mt-3">
                      <p className="text-white/70 text-sm flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        {anom.recommandation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Tout va bien ! 🎉</h3>
                <p className="text-white/60">Aucune anomalie détectée sur les 30 derniers jours</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
