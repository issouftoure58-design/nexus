import { useState, useEffect } from 'react';

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
  'Content-Type': 'application/json',
});

interface Anomaly {
  id: string;
  metric?: string;
  type?: string;
  description?: string;
  severity?: string;
  status?: string;
  detected_at?: string;
  created_at?: string;
}

interface Prediction {
  id: string;
  metric?: string;
  predicted_value?: number;
  target_date?: string;
  accuracy?: number;
  created_at?: string;
}

interface Recommendation {
  id?: string;
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  action?: string;
}

export default function SentinelIntelligence() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const [aRes, pRes, rRes] = await Promise.allSettled([
        fetch('/api/admin/sentinel-intelligence/anomalies', { headers: authHeaders() }),
        fetch('/api/admin/sentinel-intelligence/predictions', { headers: authHeaders() }),
        fetch('/api/admin/sentinel-intelligence/recommendations', { headers: authHeaders() }),
      ]);

      if (aRes.status === 'fulfilled' && aRes.value.ok) {
        const json = await aRes.value.json();
        const d = json.data ?? json;
        setAnomalies(Array.isArray(d) ? d : d.anomalies || []);
      }
      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        const json = await pRes.value.json();
        const d = json.data ?? json;
        setPredictions(Array.isArray(d) ? d : d.predictions || []);
      }
      if (rRes.status === 'fulfilled' && rRes.value.ok) {
        const json = await rRes.value.json();
        const d = json.data ?? json;
        setRecommendations(Array.isArray(d) ? d : d.recommendations || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const runDetection = async () => {
    setActionLoading('detect');
    try {
      await fetch('/api/admin/sentinel-intelligence/anomalies/detect', { method: 'POST', headers: authHeaders() });
      await fetchAll();
    } catch {} finally { setActionLoading(null); }
  };

  const runPredictions = async () => {
    setActionLoading('predict');
    try {
      await fetch('/api/admin/sentinel-intelligence/predictions/generate', { method: 'POST', headers: authHeaders() });
      await fetchAll();
    } catch {} finally { setActionLoading(null); }
  };

  const investigateAnomaly = async (id: string) => {
    setActionLoading(`inv-${id}`);
    try {
      await fetch(`/api/admin/sentinel-intelligence/anomalies/${id}/investigate`, { method: 'POST', headers: authHeaders() });
      await fetchAll();
    } catch {} finally { setActionLoading(null); }
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-28 bg-slate-900 rounded-lg animate-pulse" />)}</div>;

  const sevColors: Record<string, string> = { critical: 'text-red-400 bg-red-950', high: 'text-orange-400 bg-orange-950', medium: 'text-yellow-400 bg-yellow-950', low: 'text-blue-400 bg-blue-950' };
  const prioColors: Record<string, string> = { high: 'text-red-400', medium: 'text-yellow-400', low: 'text-blue-400' };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={runDetection} disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs bg-cyan-900/50 text-cyan-400 border border-cyan-800 rounded-lg hover:bg-cyan-900 transition disabled:opacity-50">
          {actionLoading === 'detect' ? 'Analyse...' : 'Detecter anomalies'}
        </button>
        <button onClick={runPredictions} disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs bg-purple-900/50 text-purple-400 border border-purple-800 rounded-lg hover:bg-purple-900 transition disabled:opacity-50">
          {actionLoading === 'predict' ? 'Generation...' : 'Generer predictions'}
        </button>
      </div>

      {/* Anomalies */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium text-white">Anomalies detectees</div>
            <div className="text-[10px] text-slate-600">Comportements inhabituels identifies par l'IA</div>
          </div>
          {anomalies.length > 0 && <span className="px-1.5 py-0.5 text-[10px] bg-red-950 text-red-400 rounded">{anomalies.length}</span>}
        </div>

        {anomalies.length === 0 ? (
          <EmptyState text="Aucune anomalie detectee" sub="Cliquez sur 'Detecter anomalies' pour lancer une analyse" />
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {anomalies.map((a) => (
              <div key={a.id} className="bg-slate-800/50 rounded-lg p-3 hover:bg-slate-800 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${sevColors[a.severity || 'medium']}`}>{a.severity || 'medium'}</span>
                      <span className="text-xs text-white">{a.metric || a.type || 'Anomalie'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{a.description || 'Comportement anormal detecte'}</div>
                    <div className="text-[10px] text-slate-600 mt-1">{formatDate(a.detected_at || a.created_at)}</div>
                  </div>
                  <button onClick={() => investigateAnomaly(a.id)} disabled={!!actionLoading}
                    className="text-[10px] px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition whitespace-nowrap disabled:opacity-50">
                    {actionLoading === `inv-${a.id}` ? '...' : 'Investiguer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Predictions */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-sm font-medium text-white mb-1">Predictions</div>
        <div className="text-[10px] text-slate-600 mb-3">Projections basees sur l'historique des metriques</div>

        {predictions.length === 0 ? (
          <EmptyState text="Aucune prediction" sub="Cliquez sur 'Generer predictions' pour creer des projections" />
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
            {predictions.map((p) => (
              <div key={p.id} className="bg-slate-800/40 rounded-lg p-3">
                <div className="text-xs text-slate-300 mb-1">{p.metric || 'Metrique'}</div>
                <div className="text-lg font-bold text-white font-mono">{p.predicted_value?.toFixed(2) ?? '---'}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-600">{formatDate(p.target_date)}</span>
                  {p.accuracy != null && (
                    <span className={`text-[10px] font-mono ${p.accuracy > 80 ? 'text-green-400' : p.accuracy > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {p.accuracy}% fiable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-sm font-medium text-white mb-1">Recommandations</div>
        <div className="text-[10px] text-slate-600 mb-3">Actions suggerees pour ameliorer votre activite</div>

        {recommendations.length === 0 ? (
          <EmptyState text="Aucune recommandation" sub="Les recommandations apparaissent quand Sentinel detecte des opportunites d'amelioration" />
        ) : (
          <div className="space-y-2">
            {recommendations.map((r, i) => (
              <div key={r.id || i} className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  {r.priority && <span className={`text-[10px] font-medium ${prioColors[r.priority] || 'text-slate-400'}`}>{r.priority}</span>}
                  {r.category && <span className="text-[10px] text-slate-600">{r.category}</span>}
                </div>
                <div className="text-sm text-white">{r.title || r.description}</div>
                {r.title && r.description && <div className="text-[11px] text-slate-400 mt-1">{r.description}</div>}
                {r.action && <div className="text-[10px] text-cyan-400 mt-1.5">Action : {r.action}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="text-center py-5">
      <div className="text-slate-400 text-sm">{text}</div>
      <div className="text-[10px] text-slate-600 mt-1">{sub}</div>
    </div>
  );
}

function formatDate(ts?: string) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return ts; }
}
