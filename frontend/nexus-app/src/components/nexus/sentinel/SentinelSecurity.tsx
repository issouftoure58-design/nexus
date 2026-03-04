import { useState, useEffect, useRef } from 'react';

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
});

interface SecurityEvent {
  id?: string;
  type?: string;
  event_type?: string;
  severity: string;
  ip?: string;
  ip_address?: string;
  message?: string;
  details?: any;
  timestamp?: string;
  created_at?: string;
  user_agent?: string;
  path?: string;
}

interface SecurityStats {
  total?: number;
  bySeverity?: Record<string, number>;
  byType?: Record<string, number>;
  blockedIps?: number;
  rateLimited?: number;
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

export default function SentinelSecurity() {
  const [logs, setLogs] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [logsRes, statsRes] = await Promise.allSettled([
          fetch('/api/nexus/sentinel/security/logs', { headers: authHeaders() }),
          fetch('/api/nexus/sentinel/security/stats', { headers: authHeaders() }),
        ]);

        if (logsRes.status === 'fulfilled' && logsRes.value.ok) {
          const json = await logsRes.value.json();
          const d = json.data ?? json;
          setLogs(Array.isArray(d) ? d : d.events || d.logs || []);
        }
        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          const json = await statsRes.value.json();
          const d = json.data ?? json;
          const sec = d.security || d.stats || d;
          const rl = d.rateLimit || {};
          setStats({
            total: sec.total ?? 0,
            bySeverity: sec.bySeverity ?? {},
            byType: sec.byType ?? {},
            blockedIps: rl.blocked ?? sec.blockedIps ?? 0,
            rateLimited: rl.totalTracked ?? sec.rateLimited ?? 0,
          });
        }
        setLastUpdate(new Date());
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, 20000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div className="space-y-4">
      {[1, 2].map(i => (
        <div key={i} className="h-28 bg-slate-900 rounded-lg animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );

  const sevColors: Record<string, string> = {
    critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-blue-500',
    CRITICAL: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-blue-500',
  };
  const sevText: Record<string, string> = {
    critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-blue-400',
    CRITICAL: 'text-red-400', HIGH: 'text-orange-400', MEDIUM: 'text-yellow-400', LOW: 'text-blue-400',
  };

  const typeLabels: Record<string, string> = {
    rate_limit_exceeded: 'Rate limit depasse',
    invalid_input: 'Entree invalide',
    sql_injection_attempt: 'Tentative injection SQL',
    xss_attempt: 'Tentative XSS',
    path_traversal_attempt: 'Tentative path traversal',
    csrf_failure: 'Echec CSRF',
    auth_failure: 'Echec authentification',
    auth_success: 'Connexion reussie',
    suspicious_activity: 'Activite suspecte',
    blocked_ip: 'IP bloquee',
    permission_denied: 'Permission refusee',
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AnimatedStatCard label="Evenements total" value={stats?.total ?? logs.length} color="blue" desc="Depuis le debut du mois" icon="📊" index={0} />
        <AnimatedStatCard label="Critiques" value={stats?.bySeverity?.critical ?? stats?.bySeverity?.CRITICAL ?? 0} color="red" desc="Evenements haute severite" icon="🔴" index={1} />
        <AnimatedStatCard label="IPs bloquees" value={stats?.blockedIps ?? 0} color="orange" desc="Auto-ban apres 10 violations" icon="🛡️" index={2} />
        <AnimatedStatCard label="Rate limited" value={stats?.rateLimited ?? 0} color="yellow" desc="Requetes refusees" icon="⚡" index={3} />
      </div>

      {/* Event type breakdown */}
      {stats?.byType && Object.keys(stats.byType).length > 0 && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <div className="text-sm font-medium text-white mb-3">Repartition par type</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count], i) => (
              <TypeCard key={type} type={type} count={count} label={typeLabels[type] || type} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Security logs */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">Journal de securite</div>
            <div className="text-[10px] text-slate-600">Derniers evenements detectes par le bouclier</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">{logs.length} events</span>
            <LiveDot lastUpdate={lastUpdate} />
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-green-400 text-sm flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Aucun evenement de securite
            </div>
            <div className="text-[10px] text-slate-600 mt-1">Le bouclier surveille intrusions, injections SQL, XSS, et brute-force</div>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            {logs.slice(0, 50).map((evt, i) => (
              <EventRow key={evt.id || i} evt={evt} index={i} sevText={sevText} sevColors={sevColors} typeLabels={typeLabels} />
            ))}
          </div>
        )}
      </div>

      {/* Security info */}
      <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3 flex items-start gap-2">
        <span className="w-2 h-2 mt-1 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
        <div className="text-[11px] text-slate-500">
          <strong className="text-slate-400">Bouclier actif :</strong> Detection automatique des injections SQL, XSS, DDoS, et brute-force. Auto-ban apres 10 violations. Rate limit : 20 req/min, 200/heure, 1000/jour.
        </div>
      </div>
    </div>
  );
}

function AnimatedStatCard({ label, value, color, desc, icon, index }: {
  label: string; value: number; color: string; desc: string; icon: string; index: number;
}) {
  const animated = useAnimatedNumber(value);
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 100); return () => clearTimeout(t); }, [index]);

  const bg: Record<string, string> = { blue: 'border-blue-800 bg-blue-950/30', red: 'border-red-800 bg-red-950/30', orange: 'border-orange-800 bg-orange-950/30', yellow: 'border-yellow-800 bg-yellow-950/30' };
  const text: Record<string, string> = { blue: 'text-blue-400', red: 'text-red-400', orange: 'text-orange-400', yellow: 'text-yellow-400' };

  return (
    <div className={`p-3 rounded-lg border ${bg[color]} transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <div className={`text-lg font-bold font-mono ${text[color]}`}>{animated}</div>
      <div className="text-[9px] text-slate-600 mt-0.5">{desc}</div>
    </div>
  );
}

function TypeCard({ type, count, label, index }: { type: string; count: number; label: string; index: number }) {
  const animated = useAnimatedNumber(count, 600);
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 60); return () => clearTimeout(t); }, [index]);

  return (
    <div className={`flex items-center justify-between px-3 py-2 bg-slate-800/40 rounded hover:bg-slate-800/70 transition-all duration-500 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
      <span className="text-[11px] text-slate-400 truncate mr-2">{label}</span>
      <span className="text-xs text-white font-mono">{animated}</span>
    </div>
  );
}

function EventRow({ evt, index, sevText, sevColors, typeLabels }: {
  evt: SecurityEvent; index: number;
  sevText: Record<string, string>;
  sevColors: Record<string, string>;
  typeLabels: Record<string, string>;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), Math.min(index * 40, 500)); return () => clearTimeout(t); }, [index]);

  const isCritical = evt.severity === 'critical' || evt.severity === 'CRITICAL';
  const dotColor = sevColors[evt.severity] || 'bg-slate-500';

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/30 hover:bg-slate-800/30 transition-all duration-400 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} ${isCritical ? 'animate-pulse shadow-md shadow-red-500/50' : ''}`} />
      <span className="text-[11px] text-slate-500 font-mono w-20 flex-shrink-0">
        {formatTime(evt.timestamp || evt.created_at)}
      </span>
      <span className={`text-[10px] font-medium w-16 flex-shrink-0 ${sevText[evt.severity] || 'text-slate-400'}`}>
        {evt.severity}
      </span>
      <span className="text-[11px] text-slate-300 flex-1 truncate">
        {typeLabels[evt.event_type || evt.type || ''] || evt.event_type || evt.type}
      </span>
      <span className="text-[11px] text-slate-600 font-mono w-24 text-right truncate">
        {evt.ip_address || evt.ip || '---'}
      </span>
    </div>
  );
}

function LiveDot({ lastUpdate }: { lastUpdate: Date | null }) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => { const id = setInterval(() => setPulse(v => !v), 1500); return () => clearInterval(id); }, []);

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <div className={`w-1.5 h-1.5 rounded-full bg-green-500 transition-all duration-500 ${pulse ? 'opacity-100' : 'opacity-40'}`} />
        <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-green-500 animate-ping opacity-20" />
      </div>
      <span className="text-[10px] text-slate-600 font-mono">20s</span>
    </div>
  );
}

function formatTime(ts?: string) {
  if (!ts) return '---';
  try {
    return new Date(ts).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
  } catch { return ts; }
}
