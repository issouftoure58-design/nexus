import { useState, useEffect } from 'react';
import { nexusApi } from '@/lib/nexusApi';

interface Backup {
  name: string;
  date?: string;
  created_at?: string;
  size?: string;
  type?: string;
}

export default function SentinelBackups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'ok' | 'error' } | null>(null);

  const fetchBackups = async () => {
    try {
      const json = await nexusApi.get<{ data?: Backup[] | { backups?: Backup[] } } | Backup[]>('/nexus/sentinel/backups');
      const d = Array.isArray(json) ? json : (json as { data?: unknown }).data ?? json;
      setBackups(Array.isArray(d) ? d : (d as { backups?: Backup[] }).backups || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchBackups(); }, []);

  const createBackup = async () => {
    setActionLoading('create');
    setMessage(null);
    try {
      await nexusApi.post('/nexus/sentinel/backups');
      setMessage({ text: 'Backup cree avec succes', type: 'ok' });
      await fetchBackups();
    } catch {
      setMessage({ text: 'Erreur lors de la creation', type: 'error' });
    } finally { setActionLoading(null); }
  };

  const restoreBackup = async (name: string) => {
    if (!confirm(`Restaurer le backup "${name}" ? Cette action va remplacer les donnees actuelles.`)) return;
    setActionLoading(`restore-${name}`);
    setMessage(null);
    try {
      await nexusApi.post(`/nexus/sentinel/backups/${encodeURIComponent(name)}/restore`);
      setMessage({ text: `Backup "${name}" restaure`, type: 'ok' });
    } catch {
      setMessage({ text: 'Erreur lors de la restauration', type: 'error' });
    } finally { setActionLoading(null); }
  };

  if (loading) return <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-20 bg-slate-900 rounded-lg animate-pulse" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-slate-600">Les backups sauvegardent la configuration et les donnees de la plateforme</div>
        </div>
        <button onClick={createBackup} disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs bg-cyan-900/50 text-cyan-400 border border-cyan-800 rounded-lg hover:bg-cyan-900 transition disabled:opacity-50">
          {actionLoading === 'create' ? 'Creation...' : 'Nouveau backup'}
        </button>
      </div>

      {message && (
        <div className={`px-3 py-2 rounded-lg text-sm ${message.type === 'ok' ? 'bg-green-950/50 text-green-400 border border-green-800' : 'bg-red-950/50 text-red-400 border border-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-medium text-white">Backups disponibles</div>
        </div>

        {backups.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-slate-400 text-sm">Aucun backup</div>
            <div className="text-[10px] text-slate-600 mt-1">Cliquez sur "Nouveau backup" pour creer votre premiere sauvegarde</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {backups.map((b, i) => (
              <div key={b.name || i} className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-mono truncate">{b.name}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-slate-500">{formatDate(b.date || b.created_at)}</span>
                    {b.size && <span className="text-[10px] text-slate-600">{b.size}</span>}
                    {b.type && <span className="text-[10px] text-slate-600 capitalize">{b.type}</span>}
                  </div>
                </div>
                <button onClick={() => restoreBackup(b.name)} disabled={!!actionLoading}
                  className="text-[11px] px-2.5 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition disabled:opacity-50 whitespace-nowrap">
                  {actionLoading === `restore-${b.name}` ? 'Restauration...' : 'Restaurer'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3">
        <div className="text-[11px] text-slate-500">
          <strong className="text-slate-400">Backups automatiques :</strong> Les backups incluent les configurations tenants, les parametres Sentinel, et les metriques d'usage. La restauration remplace les donnees actuelles par celles du backup selectionne.
        </div>
      </div>
    </div>
  );
}

function formatDate(ts?: string) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ts; }
}
