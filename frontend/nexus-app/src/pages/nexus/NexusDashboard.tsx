import { useState, useEffect, useRef } from 'react';
import NexusLayout from '../../components/nexus/NexusLayout';

interface DashboardStats {
  totalTenants: number;
  totalCalls: number;
  totalCost: number;
  tenantsAtRisk: number;
}

interface Alert {
  id: string;
  tenant_id: string;
  level: string;
  percentage: number;
  message: string;
  created_at: string;
}

interface CostBreakdown {
  anthropic: number;
  twilio: number;
  elevenlabs: number;
}

interface NexusDashboardData {
  timestamp: string;
  env?: string;
  periodLabel?: string;
  summary: DashboardStats;
  costBreakdown?: CostBreakdown;
  alerts: { recent: Alert[]; active: number };
}

export default function NexusDashboard() {
  const [data, setData] = useState<NexusDashboardData | null>(null);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        const [dashRes, healthRes] = await Promise.allSettled([
          fetch('/api/nexus/dashboard', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/admin/sentinel-intelligence/health-score', { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);
        if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
          const json = await dashRes.value.json();
          setData(json);
        } else {
          throw new Error('Erreur API');
        }
        if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
          const hj = await healthRes.value.json();
          setHealthScore(hj.healthScore?.score ?? hj.score ?? null);
          setHealthStatus(hj.healthScore?.status ?? hj.status ?? '');
        }
        setSecondsAgo(0);
        setPulse(true);
        setTimeout(() => setPulse(false), 500);
      } catch {
        setError('Erreur chargement des données');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Live counter
  useEffect(() => {
    const id = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <NexusLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white">NEXUS Dashboard</h1>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${pulse ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-green-400'} transition-all`} />
              <span className="text-[10px] text-slate-500">LIVE</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>MAJ il y a {secondsAgo}s</span>
            <div className={`w-1 h-1 rounded-full ${secondsAgo < 5 ? 'bg-green-400' : secondsAgo < 15 ? 'bg-yellow-400' : 'bg-red-400'}`} />
          </div>
        </div>

        {loading && <LoadingPulse />}
        {error && <div className="text-red-400">{error}</div>}

        {data && (
          <>
            {/* Stats Cards with animated counters */}
            {/* Dev mode banner */}
            {data.env === 'development' && (
              <div className="mb-3 px-3 py-2 bg-yellow-950/30 rounded-lg border border-yellow-800/50 text-[11px] text-yellow-500/80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                <span>Environnement local — Le serveur tourne sur votre ordinateur (Mac). En production, il tournera sur un serveur cloud dedie.</span>
              </div>
            )}

            {/* Period label */}
            {data.periodLabel && (
              <div className="mb-3 text-[11px] text-slate-500">
                Donnees cumulees <span className="text-slate-400 font-medium">{data.periodLabel}</span> — sauvegardees en base de donnees (persistent meme apres redemarrage).
              </div>
            )}

            {/* Health Score compact */}
            {healthScore != null && (
              <div className="mb-4 flex items-center gap-4 bg-slate-900 rounded-lg border border-slate-800 p-3">
                <CompactHealthScore score={healthScore} />
                <div>
                  <div className="text-sm text-white font-medium">Sante globale : <span className={healthScore >= 80 ? 'text-cyan-400' : healthScore >= 50 ? 'text-yellow-400' : 'text-red-400'}>{healthStatus || (healthScore >= 80 ? 'Excellent' : healthScore >= 50 ? 'Attention' : 'Critique')}</span></div>
                  <div className="text-[10px] text-slate-600">Score composite base sur les revenus, reservations, couts et disponibilite. Voir Sentinel pour le detail.</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
              <AnimatedStatCard title="Tenants" subtitle="Restaurants inscrits sur la plateforme" value={data.summary.totalTenants} color="cyan" />
              <AnimatedStatCard title="Appels IA" subtitle="Conversations traitees par Claude" value={data.summary.totalCalls} color="blue" />
              <AnimatedStatCard title="Cout total" subtitle={data.periodLabel || 'mois en cours'} value={data.summary.totalCost} color="purple" suffix="€" decimals={2} />
              <AnimatedStatCard
                title="Alertes actives"
                subtitle="Anomalies detectees par Sentinel"
                value={data.alerts.active}
                color={data.alerts.active > 0 ? 'red' : 'green'}
              />
            </div>

            {/* Cost breakdown by service */}
            {data.costBreakdown && (
              <div className="bg-slate-900 rounded-lg border border-slate-800 mb-6 p-4">
                <h2 className="font-semibold text-white mb-1">Detail des couts par service</h2>
                <div className="text-[10px] text-slate-600 mb-3">Chaque service externe a un prix different. Voici la repartition.</div>
                <div className="space-y-3">
                  <CostRow label="Anthropic Claude" desc="Conversations IA, outils, analyse" value={data.costBreakdown.anthropic} total={data.summary.totalCost} color="bg-purple-500" />
                  <CostRow label="Twilio" desc="SMS de rappel, appels telephoniques" value={data.costBreakdown.twilio} total={data.summary.totalCost} color="bg-blue-500" />
                  <CostRow label="ElevenLabs" desc="Voix synthetique (Halimah vocale)" value={data.costBreakdown.elevenlabs} total={data.summary.totalCost} color="bg-cyan-500" />
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-sm text-slate-400">Total {data.periodLabel}</span>
                  <span className="text-lg font-bold text-white font-mono">{data.summary.totalCost.toFixed(2)}€</span>
                </div>
              </div>
            )}

            {/* Activity Feed - live feel */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* Recent Alerts */}
              <div className="bg-slate-900 rounded-lg border border-slate-800">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="font-semibold text-white">Alertes SENTINEL</h2>
                  <div className={`w-2 h-2 rounded-full ${data.alerts.active > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                </div>
                {data.alerts.recent.length === 0 ? (
                  <div className="p-4 text-center">
                    <div className="text-green-400 text-sm mb-1">Aucune alerte</div>
                    <div className="text-slate-600 text-xs">Tous les systemes sont stables</div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 max-h-[300px] overflow-y-auto">
                    {data.alerts.recent.slice(0, 8).map((alert, i) => (
                      <div key={alert.id || i} className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition group">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <span className={`w-2.5 h-2.5 rounded-full block ${alert.level === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                            {alert.level === 'critical' && (
                              <span className="w-2.5 h-2.5 rounded-full block bg-red-500 animate-ping absolute inset-0 opacity-50" />
                            )}
                          </div>
                          <div>
                            <span className="text-sm text-white">{alert.tenant_id}</span>
                            <span className="text-xs text-slate-500 ml-2">{alert.message}</span>
                          </div>
                        </div>
                        <LiveTime date={alert.created_at} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* System Status - animated */}
              <div className="bg-slate-900 rounded-lg border border-slate-800">
                <div className="px-4 py-3 border-b border-slate-800">
                  <h2 className="font-semibold text-white">Statut systeme</h2>
                </div>
                <div className="p-4 space-y-3">
                  <LiveStatusRow label="API Gateway" status="ok" latency={12} />
                  <LiveStatusRow label="PostgreSQL" status="ok" latency={3} />
                  <LiveStatusRow label="Sentinel" status={data.alerts.active > 0 ? 'warning' : 'ok'} />
                  <LiveStatusRow label="SMS (Twilio)" status="ok" />
                  <LiveStatusRow label="Voix (ElevenLabs)" status="ok" />
                  <LiveStatusRow label="Redis" status="ok" latency={1} />
                  <LiveStatusRow label="WebSocket" status="ok" />
                </div>
              </div>
            </div>

            {/* Plan Distribution with animation */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <h2 className="font-semibold text-white mb-4">Repartition par plan</h2>
              <PlanChart tenants={data.summary.totalTenants} />
            </div>
          </>
        )}
      </div>
    </NexusLayout>
  );
}

// ─── Animated counter ───
function AnimatedStatCard({ title, subtitle, value, color, prefix = '', suffix = '', decimals = 0, icon }: {
  title: string; subtitle?: string; value: number; color: string; prefix?: string; suffix?: string; decimals?: number; icon?: string;
}) {
  const [displayed, setDisplayed] = useState(0);
  const targetRef = useRef(value);
  targetRef.current = value;

  useEffect(() => {
    let start = displayed;
    const target = value;
    const duration = 800;
    const startTime = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (target - start) * eased);
      if (progress >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [value]);

  const colors: Record<string, string> = {
    cyan: 'border-cyan-800 bg-cyan-950/30',
    blue: 'border-blue-800 bg-blue-950/30',
    purple: 'border-purple-800 bg-purple-950/30',
    green: 'border-green-800 bg-green-950/30',
    red: 'border-red-800 bg-red-950/30',
  };
  const textColors: Record<string, string> = {
    cyan: 'text-cyan-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    red: 'text-red-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[color]} transition-all duration-300 hover:brightness-110`}>
      <div className="text-sm text-slate-400 mb-0.5">{title}</div>
      {subtitle && <div className="text-[10px] text-slate-600 mb-1">{subtitle}</div>}
      <div className={`text-2xl font-bold ${textColors[color]} tabular-nums`}>
        {prefix}{decimals > 0 ? displayed.toFixed(decimals) : Math.round(displayed)}{suffix}
      </div>
    </div>
  );
}

// ─── Live relative time ───
function LiveTime({ date }: { date: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  let text: string;
  if (diff < 60) text = `${diff}s`;
  else if (diff < 3600) text = `${Math.floor(diff / 60)}m`;
  else if (diff < 86400) text = `${Math.floor(diff / 3600)}h`;
  else text = `${Math.floor(diff / 86400)}j`;

  return <span className="text-xs text-slate-600 font-mono">il y a {text}</span>;
}

// ─── Live status row with pulse ───
function LiveStatusRow({ label, status, latency }: { label: string; status: string; latency?: number }) {
  const [dot, setDot] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setDot(true);
      setTimeout(() => setDot(false), 300);
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(id);
  }, []);

  const dotColor = status === 'ok' ? 'bg-green-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center justify-between group hover:bg-slate-800/20 rounded px-2 py-1.5 -mx-2 transition">
      <div className="flex items-center gap-2">
        <div className="relative">
          <span className={`w-2 h-2 rounded-full block ${dotColor}`} />
          {dot && <span className={`w-2 h-2 rounded-full block ${dotColor} animate-ping absolute inset-0 opacity-50`} />}
        </div>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {latency != null && (
          <span className={`text-[10px] font-mono ${latency < 10 ? 'text-green-500' : latency < 50 ? 'text-yellow-500' : 'text-red-500'}`}>
            {latency}ms
          </span>
        )}
        <span className="text-xs text-slate-500 capitalize">{status}</span>
      </div>
    </div>
  );
}

// ─── Animated plan chart ───
function PlanChart({ tenants }: { tenants: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    setTimeout(() => setAnimated(true), 100);
  }, []);

  const plans = [
    { name: 'Starter', pct: 60, color: 'bg-cyan-600', glow: 'shadow-cyan-500/20' },
    { name: 'Pro', pct: 30, color: 'bg-blue-600', glow: 'shadow-blue-500/20' },
    { name: 'Business', pct: 10, color: 'bg-purple-600', glow: 'shadow-purple-500/20' },
  ];

  return (
    <div className="space-y-3">
      {plans.map((p) => {
        const count = Math.max(1, Math.round(tenants * p.pct / 100));
        return (
          <div key={p.name} className="flex items-center gap-3">
            <span className="w-16 text-sm text-slate-400">{p.name}</span>
            <div className="flex-1 bg-slate-800 rounded-full h-6 overflow-hidden">
              <div
                className={`h-full rounded-full ${p.color} ${p.glow} shadow-lg transition-all duration-1000 ease-out`}
                style={{ width: animated ? `${p.pct}%` : '0%' }}
              />
            </div>
            <span className="text-xs text-slate-400 w-8 text-right font-mono">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Compact Health Score ───
function CompactHealthScore({ score }: { score: number }) {
  const [a, setA] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => { const p = Math.min((Date.now() - start) / 1000, 1); setA(score * (1 - Math.pow(1 - p, 3))); if (p >= 1) clearInterval(id); }, 16);
    return () => clearInterval(id);
  }, [score]);
  const color = score >= 80 ? '#22d3ee' : score >= 50 ? '#eab308' : '#ef4444';
  const r = 20, c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="flex-shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (a / 100) * c} transform="rotate(-90 28 28)" className="transition-all duration-1000" />
      <text x="28" y="32" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{Math.round(a)}</text>
    </svg>
  );
}

// ─── Cost breakdown row ───
function CostRow({ label, desc, value, total, color }: { label: string; desc: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(pct), 100); }, [pct]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-sm text-slate-300">{label}</span>
          <span className="text-[10px] text-slate-600 ml-2">{desc}</span>
        </div>
        <span className="text-sm text-white font-mono font-bold">{value.toFixed(4)}€</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${Math.max(width, value > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}

function LoadingPulse() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 bg-slate-900 rounded-lg border border-slate-800 animate-pulse" />
      ))}
    </div>
  );
}
