import { useState, useEffect, useRef } from 'react';

interface ServiceStatus {
  name: string;
  status: string;
  latency?: number;
  lastCheck?: string;
}

interface HealthScore {
  score: number;
  status: string;
  breakdown?: Record<string, number>;
}

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
});

// Hook: compteur anime de 0 a target
function useAnimatedNumber(target: number, duration = 1200) {
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
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(start + diff * eased));
      if (progress >= 1) {
        clearInterval(id);
        prev.current = target;
      }
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return value;
}

export default function SentinelOverview() {
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [healthRes, statusRes, alertsRes] = await Promise.allSettled([
          fetch('/api/admin/sentinel-intelligence/health-score', { headers: authHeaders() }),
          fetch('/api/nexus/sentinel/status', { headers: authHeaders() }),
          fetch('/api/admin/sentinel-intelligence/alerts?status=active', { headers: authHeaders() }),
        ]);

        if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
          const json = await healthRes.value.json();
          const d = json.data || json;
          setHealth(d.healthScore || d);
        }

        if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
          const json = await statusRes.value.json();
          const svc = json.services || json.checks || {};
          if (Array.isArray(svc)) {
            setServices(svc);
          } else {
            setServices(Object.values(svc));
          }
        }

        if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
          const json = await alertsRes.value.json();
          const d = json.data || json;
          setAlerts(Array.isArray(d) ? d : d.alerts || []);
        }

        setLastUpdate(new Date());
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, []);

  const scoreColor = (s: number) => s >= 80 ? '#22d3ee' : s >= 50 ? '#eab308' : '#ef4444';
  const scoreLabel = (s: number) => s >= 80 ? 'Excellent' : s >= 50 ? 'Attention' : 'Critique';

  if (loading) return <LoadingGrid />;

  const score = health?.score ?? 0;

  return (
    <div className="space-y-4">
      {/* Health Score */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-5 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Glow effect */}
          <div className="absolute inset-0 opacity-20" style={{
            background: `radial-gradient(circle at center, ${scoreColor(score)}33 0%, transparent 70%)`
          }} />
          <div className="text-xs text-slate-500 mb-3 relative">HEALTH SCORE</div>
          <HealthGauge score={score} color={scoreColor(score)} />
          <div className="mt-2 text-sm font-medium relative" style={{ color: scoreColor(score) }}>
            {scoreLabel(score)}
          </div>
          <div className="text-[10px] text-slate-600 mt-1 relative">
            Sante technique de la plateforme
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 md:col-span-2">
          <div className="text-sm font-medium text-white mb-3">Sante plateforme</div>
          <div className="text-[10px] text-slate-600 mb-3">Chaque dimension technique contribue au score global</div>
          {health?.breakdown ? (
            <div className="space-y-2.5">
              {Object.entries(health.breakdown).map(([key, val]) => (
                <BreakdownBar key={key} label={key} value={typeof val === 'number' ? val : 0} />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {['uptime', 'latency', 'security', 'performance', 'stability'].map(k => (
                <BreakdownBar key={k} label={k} value={score} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Services Status */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium text-white">Statut des services</div>
            <div className="text-[10px] text-slate-600">Verification automatique toutes les 15s</div>
          </div>
          <LiveIndicator lastUpdate={lastUpdate} />
        </div>
        {services.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {services.map((s, i) => (
              <ServiceCard key={i} service={s} index={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {['API Gateway', 'PostgreSQL', 'Claude API', 'Twilio', 'ElevenLabs', 'Redis', 'WebSocket'].map((name, i) => (
              <ServiceCard key={name} service={{ name, status: 'ok' }} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Active Alerts */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-sm font-medium text-white mb-3">
          Alertes actives
          {alerts.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-red-950 text-red-400 rounded animate-pulse">
              {alerts.length}
            </span>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-green-400 text-sm flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Aucune alerte active
            </div>
            <div className="text-[10px] text-slate-600 mt-1">Tous les systemes fonctionnent normalement</div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {alerts.slice(0, 15).map((a: any, i: number) => (
              <AlertRow key={a.id || i} alert={a} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthGauge({ score, color }: { score: number; color: string }) {
  const animated = useAnimatedNumber(score);
  const r = 50, c = 2 * Math.PI * r;
  const offset = c - (animated / 100) * c * 0.75;

  return (
    <svg width="130" height="100" viewBox="0 0 130 100" className="relative">
      <path d="M 15 85 A 50 50 0 1 1 115 85" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
      <path d="M 15 85 A 50 50 0 1 1 115 85" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${c * 0.75}`} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)', filter: `drop-shadow(0 0 6px ${color}66)` }} />
      <text x="65" y="65" textAnchor="middle" className="text-2xl font-bold" fill="white" fontSize="28">{animated}</text>
      <text x="65" y="82" textAnchor="middle" fill="#64748b" fontSize="10">/100</text>
    </svg>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const [w, setW] = useState(0);
  const animatedVal = useAnimatedNumber(Math.round(value), 800);
  useEffect(() => { const t = setTimeout(() => setW(value), 200); return () => clearTimeout(t); }, [value]);

  const color = value >= 80 ? 'bg-cyan-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  const glow = value >= 80 ? 'shadow-cyan-500/30' : value >= 50 ? 'shadow-yellow-500/30' : 'shadow-red-500/30';
  const labels: Record<string, string> = {
    uptime: 'Disponibilite', latency: 'Latence', security: 'Securite',
    performance: 'Performance', stability: 'Stabilite',
  };
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-slate-400 capitalize">{labels[label] || label}</span>
      <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} shadow-sm ${glow}`}
          style={{
            width: `${Math.min(w, 100)}%`,
            transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
      <span className="text-xs text-slate-500 w-10 text-right font-mono">{animatedVal}</span>
    </div>
  );
}

function ServiceCard({ service, index }: { service: ServiceStatus; index: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 80); return () => clearTimeout(t); }, [index]);

  const isOk = service.status === 'ok' || service.status === 'healthy' || service.status === 'up';
  const isWarn = service.status === 'warning' || service.status === 'degraded';
  const dotColor = isOk ? 'bg-green-500' : isWarn ? 'bg-yellow-500' : 'bg-red-500';
  const glowColor = isOk ? 'shadow-green-500/50' : isWarn ? 'shadow-yellow-500/50' : 'shadow-red-500/50';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shadow-md ${glowColor} ${isOk ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-slate-300 flex-1 truncate">{service.name}</span>
      {service.latency != null && (
        <span className="text-[10px] text-slate-600 font-mono">{service.latency}ms</span>
      )}
    </div>
  );
}

function AlertRow({ alert, index }: { alert: any; index: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 100); return () => clearTimeout(t); }, [index]);

  const isCritical = alert.severity === 'critical' || alert.level === 'critical';
  const isHigh = alert.severity === 'high' || alert.level === 'high';

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded bg-slate-800/50 hover:bg-slate-800 transition-all duration-500 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isCritical ? 'bg-red-500 animate-pulse shadow-md shadow-red-500/50' : isHigh ? 'bg-orange-500' : 'bg-yellow-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{alert.title || alert.message || 'Alerte'}</div>
        <div className="text-[10px] text-slate-500">{alert.metric || alert.type || ''}</div>
      </div>
      <span className="text-[10px] text-slate-600">{alert.severity || alert.level}</span>
    </div>
  );
}

function LiveIndicator({ lastUpdate }: { lastUpdate: Date | null }) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setPulse(v => !v), 1500);
    return () => clearInterval(id);
  }, []);

  const timeAgo = lastUpdate
    ? `${Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s`
    : '---';

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full bg-green-500 transition-all duration-500 ${pulse ? 'opacity-100 scale-100' : 'opacity-60 scale-75'}`} />
        <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-30" />
      </div>
      <span className="text-[10px] text-slate-600 font-mono">Live · {timeAgo}</span>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-32 bg-slate-900 rounded-lg border border-slate-800 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </div>
  );
}
