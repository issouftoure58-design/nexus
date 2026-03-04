import { useState, useEffect, useCallback, useRef } from 'react';

interface AutopilotAction {
  id: string;
  type: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description: string;
  estimatedSaving: string;
  estimatedImpact: string;
  autoExecutable: boolean;
  status: 'proposed' | 'executed' | 'failed' | 'rejected';
  createdAt: string;
  executedAt?: string;
  result?: any;
}

interface AutopilotStatus {
  enabled: boolean;
  autoScanEnabled: boolean;
  stats: {
    totalScans: number;
    totalActionsProposed: number;
    totalActionsExecuted: number;
    lastScanAt: string | null;
  };
  summary: {
    pending: number;
    executed: number;
    failed: number;
  };
  recentActions: AutopilotAction[];
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

export default function SentinelAutopilot() {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanPulse, setScanPulse] = useState(false);

  const getToken = () => localStorage.getItem('nexus_token') || localStorage.getItem('admin_token');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sentinel/autopilot/status', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setStatus(data);
      }
    } catch (err) {
      console.error('Autopilot fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Poll toutes les 10s
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Pulse animation quand un scan se produit
  useEffect(() => {
    if (status?.stats.lastScanAt) {
      setScanPulse(true);
      const t = setTimeout(() => setScanPulse(false), 2000);
      return () => clearTimeout(t);
    }
  }, [status?.stats.lastScanAt]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PRELOAD_CACHE': return '📦';
      case 'CLEANUP_CACHE': return '🧹';
      case 'ADJUST_ROUTER': return '🔀';
      case 'BUDGET_ALERT': return '💰';
      case 'OPPORTUNITY': return '💡';
      default: return '⚙️';
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'executed': return { text: 'Execute', class: 'bg-green-950/50 text-green-400 border-green-800/50' };
      case 'proposed': return { text: 'En attente', class: 'bg-cyan-950/50 text-cyan-400 border-cyan-800/50' };
      case 'failed': return { text: 'Echoue', class: 'bg-red-950/50 text-red-400 border-red-800/50' };
      case 'rejected': return { text: 'Rejete', class: 'bg-slate-800/50 text-slate-400 border-slate-700/50' };
      default: return { text: s, class: 'bg-slate-800/50 text-slate-400 border-slate-700/50' };
    }
  };

  const scans = useAnimatedNumber(status?.stats.totalScans || 0);
  const proposed = useAnimatedNumber(status?.stats.totalActionsProposed || 0);
  const executed = useAnimatedNumber(status?.stats.totalActionsExecuted || 0);
  const pending = status?.recentActions.filter(a => a.status === 'proposed').length || 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-slate-900 rounded-lg border border-slate-800 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    );
  }

  const allActions = [...(status?.recentActions || [])].sort((a, b) =>
    new Date(b.executedAt || b.createdAt).getTime() - new Date(a.executedAt || a.createdAt).getTime()
  );

  return (
    <div className="space-y-4">
      {/* Header - Toujours actif */}
      <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 relative overflow-hidden">
        {/* Scanning animation */}
        {scanPulse && (
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-cyan-500/10 to-transparent animate-pulse" />
        )}
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-3xl">🤖</span>
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">NEXUS AUTOPILOT</h2>
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Mode autonome actif — scan toutes les 30 min
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-green-950/50 border border-green-800/50 text-green-400 text-xs font-mono flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              ACTIF
            </div>
          </div>
        </div>
      </div>

      {/* Stats animees */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Scans', value: scans, color: 'cyan', icon: '🔍' },
          { label: 'Proposees', value: proposed, color: 'purple', icon: '📋' },
          { label: 'Executees', value: executed, color: 'green', icon: '✅' },
          { label: 'En attente', value: pending, color: 'orange', icon: '⏳' },
        ].map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>

      {/* Dernier scan */}
      {status?.stats.lastScanAt && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900/30 rounded-lg border border-slate-800/50">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${scanPulse ? 'bg-cyan-400 animate-ping' : 'bg-cyan-500'}`} />
            <span className="text-[11px] text-slate-400">Dernier scan</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {new Date(status.stats.lastScanAt).toLocaleTimeString('fr-FR')}
          </span>
        </div>
      )}

      {/* Flux d'activite */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-white">Flux d'activite</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">{allActions.length} actions</span>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {allActions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-2xl mb-2 animate-bounce">🔍</div>
              <p className="text-xs text-slate-500">Premier scan en cours...</p>
              <div className="mt-3 flex justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {allActions.map((action, i) => (
                <ActionRow key={action.id} action={action} index={i} getTypeIcon={getTypeIcon} getStatusBadge={getStatusBadge} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ stat, index }: { stat: { label: string; value: number; color: string; icon: string }; index: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 100); return () => clearTimeout(t); }, [index]);

  const textColors: Record<string, string> = {
    cyan: 'text-cyan-400', purple: 'text-purple-400', green: 'text-green-400', orange: 'text-orange-400',
  };

  return (
    <div className={`bg-slate-900/30 rounded-lg border border-slate-800 p-3 text-center transition-all duration-500 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
      <div className="text-lg mb-0.5">{stat.icon}</div>
      <div className={`text-xl font-bold font-mono ${textColors[stat.color]}`}>{stat.value}</div>
      <div className="text-[10px] text-slate-500">{stat.label}</div>
    </div>
  );
}

function ActionRow({ action, index, getTypeIcon, getStatusBadge }: {
  action: AutopilotAction;
  index: number;
  getTypeIcon: (type: string) => string;
  getStatusBadge: (status: string) => { text: string; class: string };
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), Math.min(index * 60, 600)); return () => clearTimeout(t); }, [index]);

  const badge = getStatusBadge(action.status);
  const time = action.executedAt || action.createdAt;

  return (
    <div className={`px-4 py-3 hover:bg-slate-800/30 transition-all duration-500 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{getTypeIcon(action.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white font-medium">{action.title}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] border ${badge.class}`}>
              {badge.text}
            </span>
            {action.autoExecutable && action.status === 'executed' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-950/30 text-green-500 border border-green-800/30">
                Auto
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{action.description}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-slate-600 font-mono">
              {time ? new Date(time).toLocaleTimeString('fr-FR') : ''}
            </span>
            {action.estimatedSaving && (
              <span className="text-[10px] text-slate-600">💰 {action.estimatedSaving}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
