import { useState, useEffect, useRef } from 'react';
import NexusLayout from '../../components/nexus/NexusLayout';

interface TenantInfo {
  id: string;
  name: string;
  plan: string;
  status: string;
  usage: { calls: number; cost: number };
  quota: { percentage: number; status: string };
}

const PLAN_PRICES: Record<string, number> = { starter: 99, pro: 249, business: 499 };
const PLAN_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  starter: { bar: 'bg-cyan-500', text: 'text-cyan-400', bg: 'bg-cyan-950/30 border-cyan-800' },
  pro: { bar: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-950/30 border-blue-800' },
  business: { bar: 'bg-purple-500', text: 'text-purple-400', bg: 'bg-purple-950/30 border-purple-800' },
};

export default function NexusBilling() {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch('/api/nexus/tenants', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Erreur API');
        const json = await res.json();
        setTenants(json.tenants || []);
      } catch {
        setError('Erreur chargement des données');
      } finally {
        setLoading(false);
      }
    };
    fetchTenants();
    const interval = setInterval(fetchTenants, 30000);
    return () => clearInterval(interval);
  }, []);

  // Animate tick for pulse effects
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const mrr = tenants.reduce((sum, t) => sum + (PLAN_PRICES[t.plan] || 0), 0);
  const arr = mrr * 12;
  const totalCost = tenants.reduce((sum, t) => sum + t.usage.cost, 0);
  const margin = mrr > 0 ? ((mrr - totalCost) / mrr * 100) : 0;
  const planCounts = tenants.reduce<Record<string, number>>((acc, t) => { acc[t.plan] = (acc[t.plan] || 0) + 1; return acc; }, {});

  return (
    <NexusLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-white">Revenus & Facturation</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full bg-green-400 ${tick % 2 === 0 ? 'opacity-100' : 'opacity-60'} transition-opacity`} />
            <span className="text-[10px] text-slate-500 font-mono">Auto-refresh 30s</span>
          </div>
        </div>

        {loading && <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-900 rounded-lg animate-pulse" />)}</div>}
        {error && <div className="text-red-400">{error}</div>}

        {!loading && !error && (
          <>
            {/* KPIs with animated values */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
              <AnimatedKpi title="MRR" value={mrr} suffix="€" color="cyan" />
              <AnimatedKpi title="ARR" value={arr} suffix="€" color="blue" />
              <AnimatedKpi title="Couts variables" value={totalCost} suffix="€" color="purple" decimals={2} />
              <AnimatedKpi title="Marge" value={margin} suffix="%" color={margin > 70 ? 'green' : 'red'} decimals={0} />
            </div>

            {/* Revenue breakdown - animated bars */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 mb-6 p-4">
              <h2 className="font-semibold text-white mb-4">Revenus par plan</h2>
              <div className="space-y-4">
                {(['starter', 'pro', 'business'] as const).map((plan) => {
                  const count = planCounts[plan] || 0;
                  const total = tenants.length || 1;
                  const pct = (count / total) * 100;
                  const revenue = count * (PLAN_PRICES[plan] || 0);
                  const c = PLAN_COLORS[plan];
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${c.text} capitalize`}>{plan}</span>
                          <span className="text-xs text-slate-600">{count} tenant{count > 1 ? 's' : ''}</span>
                        </div>
                        <span className="text-sm text-white font-bold font-mono">{revenue}€<span className="text-slate-500 text-xs">/mois</span></span>
                      </div>
                      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                        <AnimatedBarFill pct={pct} className={c.bar} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center">
                <span className="text-sm text-slate-400">Total MRR</span>
                <span className="text-lg font-bold text-white font-mono">{mrr}€</span>
              </div>
            </div>

            {/* Tenant detail table */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-semibold text-white">Detail par tenant</h2>
                <span className="text-xs text-slate-500">{tenants.length} tenant{tenants.length > 1 ? 's' : ''}</span>
              </div>
              <table className="w-full min-w-[500px]">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm text-slate-400">Tenant</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-400">Plan</th>
                    <th className="px-4 py-3 text-right text-sm text-slate-400">Prix</th>
                    <th className="px-4 py-3 text-right text-sm text-slate-400">Cout</th>
                    <th className="px-4 py-3 text-right text-sm text-slate-400">Marge</th>
                    <th className="px-4 py-3 text-right text-sm text-slate-400">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => {
                    const price = PLAN_PRICES[t.plan] || 0;
                    const tMargin = price > 0 ? ((price - t.usage.cost) / price * 100) : 0;
                    const c = PLAN_COLORS[t.plan] || PLAN_COLORS.starter;
                    return (
                      <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-800/30 transition group">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{t.name}</div>
                          <div className="text-xs text-slate-500">{t.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs border ${c.bg} ${c.text} capitalize`}>{t.plan}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300 font-mono">{price}€</td>
                        <td className="px-4 py-3 text-right text-slate-300 font-mono">{t.usage.cost.toFixed(2)}€</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono ${tMargin > 70 ? 'text-green-400' : tMargin > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {tMargin.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className={`w-2 h-2 rounded-full inline-block ${t.quota.status === 'ok' ? 'bg-green-500' : t.quota.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        </td>
                      </tr>
                    );
                  })}
                  {tenants.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucun tenant</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </NexusLayout>
  );
}

function AnimatedKpi({ title, value, suffix = '', color, decimals = 0 }: {
  title: string; value: number; suffix?: string; color: string; decimals?: number;
}) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const startTime = Date.now();
    const id = setInterval(() => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (value - start) * eased);
      if (progress >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [value]);

  const bg: Record<string, string> = {
    cyan: 'border-cyan-800 bg-cyan-950/30', blue: 'border-blue-800 bg-blue-950/30',
    purple: 'border-purple-800 bg-purple-950/30', green: 'border-green-800 bg-green-950/30', red: 'border-red-800 bg-red-950/30',
  };
  const text: Record<string, string> = {
    cyan: 'text-cyan-400', blue: 'text-blue-400', purple: 'text-purple-400', green: 'text-green-400', red: 'text-red-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${bg[color]} hover:brightness-110 transition`}>
      <div className="text-sm text-slate-400">{title}</div>
      <div className={`text-2xl font-bold ${text[color]} tabular-nums font-mono`}>
        {decimals > 0 ? displayed.toFixed(decimals) : Math.round(displayed).toLocaleString('fr-FR')}{suffix}
      </div>
    </div>
  );
}

function AnimatedBarFill({ pct, className }: { pct: number; className: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(pct), 100); }, [pct]);
  return (
    <div className={`h-full rounded-full ${className} transition-all duration-1000 ease-out relative`} style={{ width: `${Math.max(width, 2)}%` }}>
      <div className={`absolute inset-0 rounded-full ${className} animate-pulse opacity-30`} />
    </div>
  );
}
