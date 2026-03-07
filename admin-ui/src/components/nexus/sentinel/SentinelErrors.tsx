import { useState, useEffect, useRef } from 'react';
import { nexusApi } from '@/lib/nexusApi';

interface ErrorLog {
  id: number;
  tenant_id: string | null;
  level: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown>;
  source: string;
  fingerprint: string | null;
  created_at: string;
}

interface ErrorStats {
  total_24h: number;
  last_hour: number;
  by_level: { error: number; warning: number; info: number; fatal: number };
  by_source: { backend: number; frontend: number };
  top_errors: Array<{ fingerprint: string; message: string; source: string; count: number }>;
}

function useAnimatedNumber(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;
    const startTime = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + diff * eased));
      if (progress >= 1) { clearInterval(id); prev.current = target; }
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return value;
}

const LEVEL_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  fatal: { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
  error: { bg: 'bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500' },
  warning: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  info: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
};

function LevelBadge({ level }: { level: string }) {
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.error;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {level.toUpperCase()}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isBackend = source === 'backend';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
      isBackend ? 'bg-cyan-500/15 text-cyan-400' : 'bg-purple-500/15 text-purple-400'
    }`}>
      {source}
    </span>
  );
}

export default function SentinelErrors() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterLevel, setFilterLevel] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('24h');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const animTotal = useAnimatedNumber(stats?.total_24h ?? 0);
  const animLastHour = useAnimatedNumber(stats?.last_hour ?? 0);
  const animFatal = useAnimatedNumber(stats?.by_level?.fatal ?? 0);
  const animErrors = useAnimatedNumber(stats?.by_level?.error ?? 0);

  const getFromDate = () => {
    const now = new Date();
    switch (filterPeriod) {
      case '1h': return new Date(now.getTime() - 3600000).toISOString();
      case '24h': return new Date(now.getTime() - 86400000).toISOString();
      case '7d': return new Date(now.getTime() - 7 * 86400000).toISOString();
      case '30d': return new Date(now.getTime() - 30 * 86400000).toISOString();
      default: return new Date(now.getTime() - 86400000).toISOString();
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '50');
        params.set('from', getFromDate());
        if (filterLevel) params.set('level', filterLevel);
        if (filterSource) params.set('source', filterSource);

        const [errorsRes, statsRes] = await Promise.allSettled([
          nexusApi.get<{ errors: ErrorLog[]; total: number }>(`/nexus/errors?${params}`),
          nexusApi.get<ErrorStats>('/nexus/errors/stats'),
        ]);

        if (errorsRes.status === 'fulfilled') {
          setErrors(errorsRes.value.errors || []);
          setTotal(errorsRes.value.total || 0);
        }
        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value);
        }
        setLastUpdate(new Date());
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, 20000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterLevel, filterSource, filterPeriod]);

  const totalPages = Math.ceil(total / 50);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-sm">Chargement erreurs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Erreurs 24h" value={animTotal} color="cyan" />
        <StatCard label="Derniere heure" value={animLastHour} color={stats?.last_hour && stats.last_hour > 10 ? 'red' : 'green'} />
        <StatCard label="Fatal" value={animFatal} color={stats?.by_level?.fatal ? 'red' : 'slate'} />
        <StatCard label="Errors" value={animErrors} color={stats?.by_level?.error && stats.by_level.error > 5 ? 'orange' : 'slate'} />
      </div>

      {/* Source breakdown */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 mb-1">Backend</div>
            <div className="text-2xl font-bold text-cyan-400">{stats.by_source.backend}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 mb-1">Frontend</div>
            <div className="text-2xl font-bold text-purple-400">{stats.by_source.frontend}</div>
          </div>
        </div>
      )}

      {/* Top recurring errors */}
      {stats?.top_errors && stats.top_errors.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Top erreurs recurrentes (24h)</h3>
          <div className="space-y-2">
            {stats.top_errors.slice(0, 5).map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800 last:border-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <SourceBadge source={e.source} />
                  <span className="text-sm text-slate-300 truncate">{e.message}</span>
                </div>
                <span className="text-sm font-mono text-orange-400 flex-shrink-0">{e.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
        <select
          value={filterLevel}
          onChange={e => { setFilterLevel(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5"
        >
          <option value="">Tous niveaux</option>
          <option value="fatal">Fatal</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <select
          value={filterSource}
          onChange={e => { setFilterSource(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5"
        >
          <option value="">Toutes sources</option>
          <option value="backend">Backend</option>
          <option value="frontend">Frontend</option>
        </select>

        <select
          value={filterPeriod}
          onChange={e => { setFilterPeriod(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5"
        >
          <option value="1h">1 heure</option>
          <option value="24h">24 heures</option>
          <option value="7d">7 jours</option>
          <option value="30d">30 jours</option>
        </select>

        <div className="ml-auto text-xs text-slate-600">
          {lastUpdate && `MAJ ${lastUpdate.toLocaleTimeString()}`} · {total} resultats
        </div>
      </div>

      {/* Error table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {errors.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Aucune erreur pour cette periode
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {errors.map(err => (
              <div key={err.id}>
                <button
                  onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition text-left"
                >
                  <div className="text-xs text-slate-600 font-mono w-36 flex-shrink-0">
                    {new Date(err.created_at).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </div>
                  <LevelBadge level={err.level} />
                  <SourceBadge source={err.source} />
                  <span className="text-sm text-slate-300 truncate flex-1 min-w-0">
                    {err.message}
                  </span>
                  {err.tenant_id && (
                    <span className="text-xs text-slate-600 font-mono flex-shrink-0">
                      {err.tenant_id}
                    </span>
                  )}
                </button>

                {expandedId === err.id && (
                  <div className="px-4 pb-4 bg-slate-950/50 border-t border-slate-800">
                    {err.stack && (
                      <div className="mt-3">
                        <div className="text-xs text-slate-500 mb-1 font-semibold">Stack Trace</div>
                        <pre className="text-xs text-red-400/80 bg-slate-900 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">
                          {err.stack}
                        </pre>
                      </div>
                    )}
                    {err.context && Object.keys(err.context).length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-slate-500 mb-1 font-semibold">Context</div>
                        <pre className="text-xs text-cyan-400/70 bg-slate-900 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">
                          {JSON.stringify(err.context, null, 2)}
                        </pre>
                      </div>
                    )}
                    {err.fingerprint && (
                      <div className="mt-2 text-xs text-slate-600">
                        Fingerprint: <span className="font-mono">{err.fingerprint}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm bg-slate-800 text-slate-300 rounded-lg disabled:opacity-30 hover:bg-slate-700 transition"
          >
            Precedent
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm bg-slate-800 text-slate-300 rounded-lg disabled:opacity-30 hover:bg-slate-700 transition"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    cyan: 'text-cyan-400',
    green: 'text-green-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
    slate: 'text-slate-400',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorMap[color] || colorMap.slate}`}>{value}</div>
    </div>
  );
}
