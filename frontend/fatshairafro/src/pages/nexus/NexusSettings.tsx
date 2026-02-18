import { useState, useEffect } from 'react';
import NexusLayout from '../../components/nexus/NexusLayout';

interface SystemStatus {
  status: string;
  uptime?: number;
  memory?: { heapUsed: number; heapTotal: number };
  tenants?: number;
}

const PLANS = [
  {
    name: 'Starter', price: 99, color: 'cyan',
    features: ['Reservations multi-canal', 'IA telephone (Halimah)', 'Dashboard admin', 'Notifications SMS', 'Rappels J-1'],
  },
  {
    name: 'Pro', price: 199, color: 'blue', popular: true,
    features: ['Tout Starter +', 'Comptabilite', 'Marketing SMS/Email', 'Medias IA', 'Reseaux sociaux'],
  },
  {
    name: 'Business', price: 399, color: 'purple',
    features: ['Tout Pro +', 'SEO', 'Gestion RH', 'Sentinel client', 'Support prioritaire'],
  },
];

export default function NexusSettings() {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch('/api/nexus/sentinel/status', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const json = await res.json();
          setSystem(json);
          setUptime(json.uptime || 0);
        }
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Live uptime counter
  useEffect(() => {
    const id = setInterval(() => setUptime((u) => u + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}j ${h}h ${m}m`;
    return `${h}h ${m}m ${s}s`;
  };

  const formatMB = (bytes?: number) => bytes ? `${(bytes / 1024 / 1024).toFixed(0)} MB` : 'N/A';
  const heapPct = system?.memory ? Math.round((system.memory.heapUsed / system.memory.heapTotal) * 100) : 0;

  return (
    <NexusLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-6">Parametres NEXUS</h1>

        {/* Plans - animated cards */}
        <div className="mb-6">
          <h2 className="font-semibold text-white mb-4">Plans tarifaires</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map((plan, idx) => (
              <PlanCard key={plan.name} plan={plan} delay={idx * 150} />
            ))}
          </div>
        </div>

        {/* System - live data */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 mb-6 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Systeme</h2>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${system?.status === 'healthy' ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
              <span className="text-xs text-slate-500">{system?.status === 'healthy' ? 'Healthy' : 'Checking...'}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <LiveInfoItem
              label="Environnement"
              value={system?.status === 'healthy' ? 'Production' : 'Dev'}
              icon={<div className={`w-2 h-2 rounded-full ${system?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />}
            />
            <LiveInfoItem
              label="Uptime"
              value={formatUptime(uptime)}
              live
            />
            <LiveInfoItem
              label="Memoire Heap"
              value={`${formatMB(system?.memory?.heapUsed)} / ${formatMB(system?.memory?.heapTotal)}`}
              bar={heapPct}
              barColor={heapPct > 80 ? '#ef4444' : heapPct > 60 ? '#eab308' : '#22d3ee'}
            />
            <LiveInfoItem
              label="Tenants actifs"
              value={String(system?.tenants ?? '---')}
            />
          </div>
        </div>

        {/* Notifications with animated toggles */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h2 className="font-semibold text-white mb-4">Notifications</h2>
          <div className="space-y-3">
            <AnimatedToggle label="Alertes email (quota depasse)" defaultOn description="Notification quand un tenant depasse 80% de son quota" />
            <AnimatedToggle label="Alertes SMS (systeme down)" defaultOn={false} description="SMS d'urgence si un service critique tombe" />
            <AnimatedToggle label="Rapport hebdomadaire" defaultOn description="Resume automatique chaque lundi a 9h" />
            <AnimatedToggle label="Alertes Sentinel" defaultOn description="Notifications en temps reel des anomalies detectees" />
          </div>
        </div>
      </div>
    </NexusLayout>
  );
}

function PlanCard({ plan, delay }: { plan: typeof PLANS[0] & { popular?: boolean }; delay: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), delay); }, [delay]);

  const borders: Record<string, string> = { cyan: 'border-cyan-800', blue: 'border-blue-800', purple: 'border-purple-800' };
  const texts: Record<string, string> = { cyan: 'text-cyan-400', blue: 'text-blue-400', purple: 'text-purple-400' };
  const glows: Record<string, string> = { cyan: 'hover:shadow-cyan-500/10', blue: 'hover:shadow-blue-500/10', purple: 'hover:shadow-purple-500/10' };
  const dots: Record<string, string> = { cyan: 'bg-cyan-400', blue: 'bg-blue-400', purple: 'bg-purple-400' };

  return (
    <div
      className={`bg-slate-900 rounded-lg border ${borders[plan.color]} p-4 transition-all duration-500 hover:shadow-lg ${glows[plan.color]} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {plan.popular && (
        <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-2 font-bold">Le plus populaire</div>
      )}
      <div className="flex items-baseline justify-between mb-3">
        <h3 className={`font-bold text-lg ${texts[plan.color]}`}>{plan.name}</h3>
        <div>
          <span className="text-white text-2xl font-bold">{plan.price}€</span>
          <span className="text-sm text-slate-500">/mois</span>
        </div>
      </div>
      <ul className="space-y-2">
        {plan.features.map((f, i) => (
          <li key={f} className="text-sm text-slate-400 flex items-center gap-2"
            style={{ opacity: visible ? 1 : 0, transition: `opacity 300ms ${delay + i * 80}ms` }}>
            <span className={`w-1.5 h-1.5 rounded-full ${dots[plan.color]}`} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiveInfoItem({ label, value, icon, live, bar, barColor }: {
  label: string; value: string; icon?: React.ReactNode; live?: boolean; bar?: number; barColor?: string;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
        {icon}
        {label}
        {live && <span className="text-[8px] text-green-500 font-mono animate-pulse">LIVE</span>}
      </div>
      <div className="text-sm text-white font-medium font-mono">{value}</div>
      {bar != null && (
        <div className="h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${bar}%`, backgroundColor: barColor }}
          />
        </div>
      )}
    </div>
  );
}

function AnimatedToggle({ label, defaultOn, description }: { label: string; defaultOn: boolean; description?: string }) {
  const [on, setOn] = useState(defaultOn);
  const [justToggled, setJustToggled] = useState(false);

  const toggle = () => {
    setOn(!on);
    setJustToggled(true);
    setTimeout(() => setJustToggled(false), 600);
  };

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 -mx-3 transition ${justToggled ? 'bg-slate-800/50' : 'hover:bg-slate-800/20'}`}>
      <div>
        <span className="text-sm text-slate-300">{label}</span>
        {description && <div className="text-[10px] text-slate-600 mt-0.5">{description}</div>}
      </div>
      <button
        onClick={toggle}
        className={`w-11 h-6 rounded-full transition-all relative ${on ? 'bg-cyan-600 shadow-[0_0_8px_rgba(34,211,238,0.3)]' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${on ? 'left-6' : 'left-1'} ${justToggled ? 'scale-110' : ''}`} />
      </button>
    </div>
  );
}
