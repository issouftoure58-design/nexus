import { useState, useEffect, useCallback } from 'react';
import { nexusApi } from '@/lib/nexusApi';

interface ModuleRequest {
  id: string;
  tenant_id: string;
  module_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
  tenants?: { name: string; plan: string } | null;
}

const MODULE_LABELS: Record<string, string> = {
  telephone_ia: 'Voix IA (Telephone)',
  whatsapp_ia: 'WhatsApp IA',
  web_chat_ia: 'Chat Web IA',
  sms_rdv: 'SMS RDV',
  marketing_email: 'Email Marketing',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-950/50 text-yellow-400 border-yellow-800',
  approved: 'bg-green-950/50 text-green-400 border-green-800',
  rejected: 'bg-red-950/50 text-red-400 border-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuve',
  rejected: 'Rejete',
};

type FilterStatus = 'all' | 'pending' | 'processed';

export default function SentinelDemandes() {
  const [requests, setRequests] = useState<ModuleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'ok' | 'error' } | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const fetchRequests = useCallback(async () => {
    try {
      const json = await nexusApi.get<{ data: ModuleRequest[] }>('/nexus/sentinel/module-requests');
      setRequests(json.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'approuver' : 'rejeter';
    if (!confirm(`Voulez-vous ${label} cette demande ?`)) return;

    setActionLoading(id);
    setMessage(null);
    try {
      await nexusApi.patch(`/nexus/sentinel/module-requests/${id}`, { action });
      setMessage({
        text: action === 'approve' ? 'Module active avec succes' : 'Demande rejetee',
        type: 'ok',
      });
      await fetchRequests();
    } catch {
      setMessage({ text: `Erreur lors du traitement`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'processed') return r.status !== 'pending';
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-900 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] text-slate-600">
            Demandes d'activation de modules par les tenants
            {pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-yellow-950/50 text-yellow-400 border border-yellow-800 rounded text-[10px]">
                {pendingCount} en attente
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending', 'processed'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] rounded-lg border transition ${
                filter === f
                  ? 'bg-cyan-900/50 text-cyan-400 border-cyan-800'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700/50'
              }`}
            >
              {f === 'all' ? 'Toutes' : f === 'pending' ? 'En attente' : 'Traitees'}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div
          className={`px-3 py-2 rounded-lg text-sm ${
            message.type === 'ok'
              ? 'bg-green-950/50 text-green-400 border border-green-800'
              : 'bg-red-950/50 text-red-400 border border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-medium text-white">Demandes d'activation</div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-slate-400 text-sm">Aucune demande</div>
            <div className="text-[10px] text-slate-600 mt-1">
              Les demandes d'activation de modules apparaitront ici
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white font-medium truncate">
                      {r.tenants?.name || r.tenant_id.slice(0, 8)}
                    </span>
                    {r.tenants?.plan && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded capitalize">
                        {r.tenants.plan}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[11px] text-cyan-400">
                      {MODULE_LABELS[r.module_id] || r.module_id}
                    </span>
                    <span className="text-[10px] text-slate-500">{formatDate(r.requested_at)}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[r.status]}`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  {r.notes && (
                    <div className="text-[10px] text-slate-500 mt-1 italic">{r.notes}</div>
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAction(r.id, 'approve')}
                      disabled={!!actionLoading}
                      className="text-[11px] px-2.5 py-1 bg-green-900/50 text-green-400 border border-green-800 rounded hover:bg-green-900 transition disabled:opacity-50"
                    >
                      {actionLoading === r.id ? '...' : 'Approuver'}
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'reject')}
                      disabled={!!actionLoading}
                      className="text-[11px] px-2.5 py-1 bg-red-900/50 text-red-400 border border-red-800 rounded hover:bg-red-900 transition disabled:opacity-50"
                    >
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3">
        <div className="text-[11px] text-slate-500">
          <strong className="text-slate-400">Activation modules :</strong> Approuver une demande
          active immediatement le module pour le tenant. Le rejet n'a pas d'effet sur la
          configuration actuelle du tenant.
        </div>
      </div>
    </div>
  );
}

function formatDate(ts?: string) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}
