/**
 * Cost Explainer - Analyse intelligente des coûts
 *
 * Affiche :
 * - Score de performance
 * - Métriques détaillées avec benchmarks
 * - Opportunités d'optimisation
 * - Actions recommandées
 */

import { useState, useEffect } from 'react';

interface Insight {
  type: string;
  title: string;
  value: string | number;
  interpretation: string;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

interface Opportunity {
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  title: string;
  description: string;
  action: string;
  saving: string | null;
  effort: string;
  impact: string;
}

interface Metrics {
  calls: {
    total: number;
    today: number;
    haiku: number;
    sonnet: number;
    distribution: { haiku: string; sonnet: string };
  };
  costs: {
    total: number;
    today: number;
    avgPerCall: string;
    saved: string;
  };
  tokens: {
    total: number;
    avgPerCall: number;
    saved: number;
  };
  cache: {
    hits: number;
    misses: number;
    size: number;
    hitRate: string;
  };
  performance: {
    avgResponseTime: number;
    rating: string;
  };
}

interface Trends {
  activity: {
    trend: string;
    lastHour: number;
    perHour: string;
  };
  errors: {
    status: string;
    last24h: number;
  };
}

interface Analysis {
  metrics: Metrics;
  trends: Trends;
  opportunities: Opportunity[];
  insights: Insight[];
}

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
});

export default function CostExplainer() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalysis();
    const interval = setInterval(fetchAnalysis, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalysis = async () => {
    try {
      const response = await fetch('/api/sentinel/explainer/analyze', {
        headers: authHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch analysis');
      const data = await response.json();
      setAnalysis(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
      setError('Impossible de charger l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <div className="text-red-800 font-medium">{error || 'Données non disponibles'}</div>
        <button
          onClick={fetchAnalysis}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const { metrics, trends, insights, opportunities } = analysis;

  const colorClasses: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900'
  };

  const priorityColors: Record<string, string> = {
    HIGH: 'bg-red-50 border-red-300 text-red-900',
    MEDIUM: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    LOW: 'bg-blue-50 border-blue-300 text-blue-900',
    INFO: 'bg-gray-50 border-gray-300 text-gray-900'
  };

  const priorityBadges: Record<string, string> = {
    HIGH: 'bg-red-600 text-white',
    MEDIUM: 'bg-yellow-500 text-white',
    LOW: 'bg-blue-500 text-white',
    INFO: 'bg-gray-500 text-white'
  };

  return (
    <div className="space-y-6">
      {/* Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`border-2 rounded-xl p-4 transition-all hover:shadow-md ${colorClasses[insight.color]}`}
          >
            <div className="text-xs font-medium opacity-70 mb-1">{insight.title}</div>
            <div className="text-3xl font-bold mb-1">
              {typeof insight.value === 'number'
                ? insight.value
                : insight.value}
              {(insight.type === 'performance' || insight.type === 'efficiency') && '%'}
              {insight.type === 'opportunity' && '€'}
            </div>
            <div className="text-xs opacity-75 leading-tight">{insight.interpretation}</div>
          </div>
        ))}
      </div>

      {/* Breakdown détaillé */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
          <h3 className="text-xl font-bold flex items-center gap-2">
            💰 D'où viennent les coûts ?
          </h3>
          <p className="text-purple-100 text-sm mt-1">
            Analyse détaillée avec benchmarks industrie
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Coût total */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-purple-600 font-medium">COÛT TOTAL DU MOIS</div>
                <div className="text-4xl font-bold text-purple-900 mt-1">
                  {metrics.costs.total.toFixed(2)}€
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Aujourd'hui</div>
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.costs.today.toFixed(4)}€
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 pt-4 border-t border-purple-200">
              <div>
                <div className="text-xs text-purple-600">Appels total</div>
                <div className="text-lg font-semibold text-purple-900">
                  {metrics.calls.total.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-purple-600">Aujourd'hui</div>
                <div className="text-lg font-semibold text-purple-900">
                  {metrics.calls.today}
                </div>
              </div>
              <div>
                <div className="text-xs text-purple-600">Coût/appel</div>
                <div className="text-lg font-semibold text-purple-900">
                  {metrics.costs.avgPerCall}€
                </div>
              </div>
              <div>
                <div className="text-xs text-green-600">Économisé</div>
                <div className="text-lg font-semibold text-green-700">
                  {metrics.costs.saved}€
                </div>
              </div>
            </div>
          </div>

          {/* Répartition par modèle */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              📊 Répartition par modèle IA
            </h4>

            <div className="space-y-4">
              {/* Haiku */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <span className="font-semibold text-green-800">Claude Haiku</span>
                      <span className="text-sm text-green-600 ml-2">
                        ({metrics.calls.haiku} appels)
                      </span>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-green-700">
                    {metrics.calls.distribution.haiku}%
                  </span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-700"
                    style={{ width: `${metrics.calls.distribution.haiku}%` }}
                  />
                </div>
                <div className="text-xs text-green-700">
                  Questions simples, FAQ, recherche • <strong>0.25€/1M tokens</strong> (88% moins cher)
                </div>
              </div>

              {/* Sonnet */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🧠</span>
                    <div>
                      <span className="font-semibold text-purple-800">Claude Sonnet</span>
                      <span className="text-sm text-purple-600 ml-2">
                        ({metrics.calls.sonnet} appels)
                      </span>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-purple-700">
                    {metrics.calls.distribution.sonnet}%
                  </span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-gradient-to-r from-purple-400 to-purple-600 h-3 rounded-full transition-all duration-700"
                    style={{ width: `${metrics.calls.distribution.sonnet}%` }}
                  />
                </div>
                <div className="text-xs text-purple-700">
                  RDV, commandes, support complexe • <strong>3€/1M tokens</strong> (précision max)
                </div>
              </div>
            </div>

            {/* Benchmark */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div className="flex-1">
                  <div className="font-semibold text-blue-900 text-sm">
                    Benchmark optimal : 70% Haiku / 30% Sonnet
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    {parseFloat(metrics.calls.distribution.haiku) >= 70
                      ? '✅ Excellent ! Vous êtes au-dessus de l\'optimal industrie.'
                      : `⚠️ Potentiel: ${(70 - parseFloat(metrics.calls.distribution.haiku)).toFixed(0)}% de conversations supplémentaires pourraient utiliser Haiku`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cache Performance */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              💾 Performance du Cache
            </h4>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-xs text-green-600 mb-1">Cache Hits</div>
                <div className="text-3xl font-bold text-green-700">{metrics.cache.hits}</div>
                <div className="text-xs text-green-600 mt-1">Appels économisés</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-xs text-blue-600 mb-1">En Cache</div>
                <div className="text-3xl font-bold text-blue-700">{metrics.cache.size}</div>
                <div className="text-xs text-blue-600 mt-1">Réponses mémorisées</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className="text-xs text-purple-600 mb-1">Hit Rate</div>
                <div className="text-3xl font-bold text-purple-700">{metrics.cache.hitRate}%</div>
                <div className="text-xs text-purple-600 mt-1">Taux de réussite</div>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 text-center">
                <div className="text-xs text-cyan-600 mb-1">Tokens Éco.</div>
                <div className="text-3xl font-bold text-cyan-700">{metrics.tokens.saved.toLocaleString()}</div>
                <div className="text-xs text-cyan-600 mt-1">Via optimisation</div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-xl">🎯</span>
                <div className="flex-1">
                  <div className="font-semibold text-yellow-900 text-sm">
                    Objectif cache : 30%+ hit rate
                  </div>
                  <div className="text-xs text-yellow-700 mt-1">
                    {parseFloat(metrics.cache.hitRate) >= 30
                      ? '✅ Excellent taux de cache ! Les FAQ sont bien couvertes.'
                      : `⚠️ ${(30 - parseFloat(metrics.cache.hitRate)).toFixed(0)}% de marge - Pré-cacher les questions fréquentes (horaires, prix, services)`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tendances */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              📈 Tendances d'Activité
            </h4>

            <div className="grid grid-cols-3 gap-4">
              <div className={`rounded-lg p-4 border ${
                trends.activity.trend === 'increasing'
                  ? 'bg-green-50 border-green-200'
                  : trends.activity.trend === 'decreasing'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="text-xs opacity-70 mb-1">Tendance</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {trends.activity.trend === 'increasing' ? '📈' :
                   trends.activity.trend === 'decreasing' ? '📉' : '➡️'}
                  {trends.activity.trend === 'increasing' ? 'Hausse' :
                   trends.activity.trend === 'decreasing' ? 'Baisse' : 'Stable'}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600 mb-1">Cette heure</div>
                <div className="text-2xl font-bold text-blue-700">
                  {trends.activity.lastHour} conv.
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-xs text-purple-600 mb-1">Moyenne/heure</div>
                <div className="text-2xl font-bold text-purple-700">
                  {trends.activity.perHour}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunités */}
      {opportunities.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
            <h3 className="text-xl font-bold flex items-center gap-2">
              🎯 Opportunités d'Optimisation
            </h3>
            <p className="text-amber-100 text-sm mt-1">
              {opportunities.filter(o => o.priority === 'HIGH').length} prioritaires,{' '}
              {opportunities.filter(o => o.saving).length} avec économies chiffrées
            </p>
          </div>

          <div className="p-6 space-y-4">
            {opportunities.map((opp, index) => (
              <div
                key={index}
                className={`border-2 rounded-xl p-5 transition-all hover:shadow-md ${priorityColors[opp.priority]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${priorityBadges[opp.priority]}`}>
                        {opp.priority}
                      </span>
                      <span className="text-xs opacity-60 px-2 py-1 bg-white/50 rounded">
                        {opp.category}
                      </span>
                    </div>
                    <div className="font-semibold text-lg mb-2">{opp.title}</div>
                    <div className="text-sm opacity-80 mb-3">{opp.description}</div>
                    <div className="text-sm font-medium bg-white/50 rounded-lg p-3">
                      💡 <strong>Action :</strong> {opp.action}
                    </div>
                  </div>
                  {opp.saving && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs opacity-60 mb-1">Économie potentielle</div>
                      <div className="text-3xl font-bold text-green-600">
                        {opp.saving}€
                      </div>
                      <div className="text-xs text-green-600">/mois</div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-current border-opacity-20 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="opacity-60">Effort :</span>
                    <span className={`font-semibold ${
                      opp.effort === 'Low' ? 'text-green-700' :
                      opp.effort === 'Medium' ? 'text-yellow-700' : 'text-red-700'
                    }`}>{opp.effort}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-60">Impact :</span>
                    <span className={`font-semibold ${
                      opp.impact === 'High' ? 'text-green-700' :
                      opp.impact === 'Medium' ? 'text-yellow-700' : 'text-blue-700'
                    }`}>{opp.impact}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Total économies */}
            <div className="mt-6 pt-6 border-t-2 border-dashed">
              <div className="flex items-center justify-between bg-green-50 border-2 border-green-300 rounded-xl p-6">
                <div>
                  <div className="text-lg font-semibold text-green-800">
                    💰 Économies Totales Potentielles
                  </div>
                  <div className="text-sm text-green-600 mt-1">
                    En appliquant toutes les optimisations recommandées
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-green-600">
                    {opportunities
                      .filter(o => o.saving)
                      .reduce((sum, o) => sum + parseFloat(o.saving || '0'), 0)
                      .toFixed(2)}€
                  </div>
                  <div className="text-sm text-green-600">/mois</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
