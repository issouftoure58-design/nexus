import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  MessageSquare,
  Calendar,
  Phone,
  User,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Scissors,
  Brain,
} from 'lucide-react';

interface Booking {
  id: number;
  date: string;
  heure: string;
  service: string;
  client: string;
  telephone: string;
  statut: string;
  created_at: string;
  notes: string | null;
}

interface Memory {
  id: string;
  type: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  confirme: { label: 'Confirmé', color: 'text-green-400 bg-green-500/20', icon: CheckCircle },
  demande: { label: 'En attente', color: 'text-amber-400 bg-amber-500/20', icon: AlertCircle },
  annule: { label: 'Annulé', color: 'text-red-400 bg-red-500/20', icon: XCircle },
  termine: { label: 'Terminé', color: 'text-blue-400 bg-blue-500/20', icon: CheckCircle },
};

export default function HalimahLogs() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'bookings' | 'memories'>('bookings');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/admin/halimah/logs', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBookings(d.recent_bookings || []);
          setMemories(d.memories || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredBookings = bookings.filter(b =>
    !search ||
    b.client?.toLowerCase().includes(search.toLowerCase()) ||
    b.telephone?.includes(search) ||
    b.service?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMemories = memories.filter(m =>
    !search ||
    m.key?.toLowerCase().includes(search.toLowerCase()) ||
    m.value?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Logs Halimah</h1>
            <p className="text-white/50 text-sm">Historique des interactions et réservations</p>
          </div>
        </div>

        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par client, service, téléphone..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-white/10 rounded-xl text-white placeholder:text-white/30 outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab('bookings')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                tab === 'bookings'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Réservations ({bookings.length})
            </button>
            <button
              onClick={() => setTab('memories')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                tab === 'memories'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <Brain className="w-4 h-4" />
              Mémoire IA ({memories.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : tab === 'bookings' ? (
          /* Bookings List */
          <div className="space-y-3">
            {filteredBookings.length === 0 ? (
              <div className="text-center py-16 text-white/40">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Aucune réservation trouvée</p>
              </div>
            ) : (
              filteredBookings.map(b => {
                const st = STATUS_MAP[b.statut] || STATUS_MAP.demande;
                const StIcon = st.icon;
                return (
                  <div key={b.id} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 hover:border-amber-500/20 transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                        <Scissors className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-white font-medium truncate">{b.service || 'Service non spécifié'}</h3>
                          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full shrink-0 ${st.color}`}>
                            <StIcon className="w-3 h-3" />
                            {st.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-white/50">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            {b.client || 'Client inconnu'}
                          </span>
                          {b.telephone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5" />
                              {b.telephone}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(b.date)} {b.heure && `à ${b.heure}`}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Créé le {formatDate(b.created_at)} {formatTime(b.created_at)}
                          </span>
                        </div>
                        {b.notes && (
                          <p className="mt-2 text-xs text-white/30 italic">Note: {b.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Memories List */
          <div className="space-y-3">
            {filteredMemories.length === 0 ? (
              <div className="text-center py-16 text-white/40">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Aucune mémoire trouvée</p>
              </div>
            ) : (
              filteredMemories.map(m => (
                <div key={m.id} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 hover:border-purple-500/20 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <Brain className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">{m.type}</span>
                        <span className="text-xs px-2 py-0.5 bg-white/10 text-white/50 rounded-full">{m.category}</span>
                        <span className="text-xs text-white/30 ml-auto">{formatDate(m.created_at)}</span>
                      </div>
                      <h4 className="text-white font-medium text-sm">{m.key}</h4>
                      <p className="text-white/50 text-sm mt-1">{m.value}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(m.confidence || 0.5) * 100}%` }} />
                        </div>
                        <span className="text-xs text-white/30">Confiance: {Math.round((m.confidence || 0.5) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
