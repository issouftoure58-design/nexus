import { useState, useEffect } from 'react';
import NexusLayout from '../../components/nexus/NexusLayout';

interface TenantInfo {
  id: string;
  name: string;
  plan: string;
  status: string;
  usage: { calls: number; cost: number };
  quota: { percentage: number; status: string };
  lastActivity: string | null;
}

export default function NexusTenants() {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch('/api/nexus/tenants', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Erreur API');
        const json = await res.json();
        setTenants(json.tenants);
      } catch {
        setError('Erreur chargement des tenants');
      } finally {
        setLoading(false);
      }
    };
    fetchTenants();
  }, []);

  return (
    <NexusLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-white">Tenants</h1>
          <button
            disabled
            className="px-4 py-2 bg-cyan-600/30 border border-cyan-500/30 text-cyan-400 rounded-lg text-sm cursor-not-allowed opacity-60"
          >
            + Ajouter tenant
          </button>
        </div>

        {loading && <div className="text-slate-400">Chargement...</div>}
        {error && <div className="text-red-400">{error}</div>}

        {!loading && !error && (
          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Tenant</th>
                  <th className="px-4 py-3 text-left text-sm text-slate-400">Plan</th>
                  <th className="px-4 py-3 text-center text-sm text-slate-400">Status</th>
                  <th className="px-4 py-3 text-right text-sm text-slate-400">Appels</th>
                  <th className="px-4 py-3 text-right text-sm text-slate-400">Coût</th>
                  <th className="px-4 py-3 text-right text-sm text-slate-400">Quota</th>
                  <th className="px-4 py-3 text-center text-sm text-slate-400">Santé</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs bg-slate-800 text-slate-300 capitalize">{t.plan}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded text-xs bg-green-900/50 text-green-400 border border-green-800">
                        Actif
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{t.usage.calls}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{t.usage.cost.toFixed(4)}€</td>
                    <td className="px-4 py-3 text-right text-slate-300">{t.quota.percentage}%</td>
                    <td className="px-4 py-3 text-center">
                      <QuotaBadge status={t.quota.status} />
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Aucun tenant</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </NexusLayout>
  );
}

function QuotaBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok: 'bg-green-900/50 text-green-400 border-green-800',
    warning: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    critical: 'bg-red-900/50 text-red-400 border-red-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs border ${styles[status] || styles.ok}`}>
      {status.toUpperCase()}
    </span>
  );
}
