import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  UserX,
  Users,
  Mail,
  Phone,
  Calendar,
  Star,
  Crown,
  Award,
  TrendingUp,
  Clock,
  Send,
  MessageSquare,
  Plus,
  X,
  Loader2,
  Target,
  Euro,
  BarChart3,
  Filter,
  Sparkles,
  Gift,
} from 'lucide-react';

interface InactiveClient {
  id: number;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  dernier_rdv: string;
  jours_inactivite: number;
  mois_inactivite: number;
  niveau_inactivite: 'leger' | 'moyen' | 'fort';
  nb_rdv_total: number;
  ca_total_euros: string;
  score: number;
  segment: 'vip' | 'fidele' | 'standard';
  service_prefere: string;
  offre_suggeree: number;
  message_type: string;
}

interface Campaign {
  id: number;
  nom: string;
  type: string;
  statut: string;
  clients_cibles: number;
  clients_contactes: number;
  clients_convertis: number;
  taux_conversion: number;
  created_at: string;
}

interface CommercialStats {
  total_clients_inactifs: number;
  vip_inactifs: number;
  fideles_inactifs: number;
  ca_potentiel_euros: number;
  campagnes_actives: number;
  taux_reactivation: number;
}

export default function Commercial() {
  const [activeTab, setActiveTab] = useState<'clients' | 'campagnes'>('clients');
  const [clients, setClients] = useState<InactiveClient[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<CommercialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState(3);
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<InactiveClient | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, [periode]);

  const loadData = async () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [clientsRes, campaignsRes, statsRes] = await Promise.all([
        fetch(`/api/commercial/clients/inactifs?periode=${periode}`, { headers }).then(r => r.json()).catch(() => ({ clients_inactifs: [] })),
        fetch('/api/commercial/campagnes', { headers }).then(r => r.json()).catch(() => ({ campagnes: [] })),
        fetch('/api/commercial/stats', { headers }).then(r => r.json()).catch(() => null),
      ]);

      setClients(clientsRes.clients_inactifs || []);
      setCampaigns(campaignsRes.campagnes || []);
      setStats(statsRes);
    } catch (error) {
      console.error('Erreur chargement commercial:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRelance = async (client: InactiveClient) => {
    setSelectedClient(client);
    setShowModal(true);
  };

  const sendRelance = async (method: 'sms' | 'email') => {
    if (!selectedClient) return;
    setSending(true);

    try {
      const token = localStorage.getItem('admin_token');
      // Appel API pour envoyer la relance
      await fetch('/api/commercial/relance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: selectedClient.id,
          method,
          offre: selectedClient.offre_suggeree,
        }),
      });

      setShowModal(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Erreur relance:', error);
    } finally {
      setSending(false);
    }
  };

  const getSegmentBadge = (segment: string) => {
    const config: Record<string, { icon: typeof Crown; color: string; label: string }> = {
      vip: { icon: Crown, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'VIP' },
      fidele: { icon: Award, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Fidèle' },
      standard: { icon: Star, color: 'bg-white/10 text-white/60 border-white/20', label: 'Standard' },
    };
    const { icon: Icon, color, label } = config[segment] || config.standard;
    return (
      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const getInactiviteBadge = (niveau: string) => {
    const colors: Record<string, string> = {
      leger: 'bg-yellow-500/20 text-yellow-400',
      moyen: 'bg-orange-500/20 text-orange-400',
      fort: 'bg-red-500/20 text-red-400',
    };
    const labels: Record<string, string> = {
      leger: 'Récent',
      moyen: 'Modéré',
      fort: 'Critique',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[niveau] || colors.leger}`}>
        {labels[niveau] || niveau}
      </span>
    );
  };

  const filteredClients = segmentFilter === 'all'
    ? clients
    : clients.filter(c => c.segment === segmentFilter);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <UserX className="w-7 h-7 text-amber-400" />
              Commercial
            </h1>
            <p className="text-white/50 text-sm">Détection clients inactifs & relances</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouvelle campagne
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Clients inactifs', value: stats?.total_clients_inactifs || clients.length, icon: UserX, color: 'from-red-500 to-rose-600' },
            { label: 'VIP à réactiver', value: stats?.vip_inactifs || clients.filter(c => c.segment === 'vip').length, icon: Crown, color: 'from-amber-500 to-orange-600' },
            { label: 'CA potentiel', value: `${stats?.ca_potentiel_euros || clients.reduce((sum, c) => sum + parseFloat(c.ca_total_euros), 0).toFixed(0)}€`, icon: Euro, color: 'from-green-500 to-emerald-600' },
            { label: 'Taux réactivation', value: stats?.taux_reactivation ? `${stats.taux_reactivation}%` : '—', icon: TrendingUp, color: 'from-purple-500 to-violet-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/50 text-sm">{stat.label}</span>
                <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs + Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl">
            {[
              { id: 'clients', label: 'Clients inactifs', icon: Users },
              { id: 'campagnes', label: 'Campagnes', icon: Mail },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'clients' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-white/50" />
                <select
                  value={periode}
                  onChange={e => setPeriode(parseInt(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value={3}>Inactifs +3 mois</option>
                  <option value={6}>Inactifs +6 mois</option>
                  <option value={12}>Inactifs +12 mois</option>
                </select>
              </div>
              <select
                value={segmentFilter}
                onChange={e => setSegmentFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="all">Tous segments</option>
                <option value="vip">VIP uniquement</option>
                <option value="fidele">Fidèles</option>
                <option value="standard">Standard</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : (
          <>
            {/* TAB: Clients inactifs */}
            {activeTab === 'clients' && (
              <div className="space-y-4">
                {filteredClients.length === 0 ? (
                  <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-white/10">
                    <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <h3 className="text-white font-semibold mb-2">Aucun client inactif</h3>
                    <p className="text-white/50 text-sm">Tous vos clients sont actifs, bravo !</p>
                  </div>
                ) : (
                  filteredClients.map(client => (
                    <div key={client.id} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 hover:border-amber-500/30 transition-all">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Client info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {client.prenom?.[0]}{client.nom?.[0]}
                            </div>
                            <div>
                              <h3 className="text-white font-semibold">{client.prenom} {client.nom}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {getSegmentBadge(client.segment)}
                                {getInactiviteBadge(client.niveau_inactivite)}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                              <Calendar className="w-4 h-4" />
                              <span>Dernier RDV: {new Date(client.dernier_rdv).toLocaleDateString('fr-FR')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/60">
                              <Clock className="w-4 h-4" />
                              <span>{client.mois_inactivite} mois d'inactivité</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/60">
                              <BarChart3 className="w-4 h-4" />
                              <span>{client.nb_rdv_total} RDV total</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-400">
                              <Euro className="w-4 h-4" />
                              <span>{client.ca_total_euros}€ CA</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 lg:items-end">
                          <div className="flex items-center gap-2 text-sm mb-2">
                            <Gift className="w-4 h-4 text-amber-400" />
                            <span className="text-amber-400 font-medium">Offre suggérée: -{client.offre_suggeree}%</span>
                          </div>
                          <div className="flex gap-2">
                            {client.telephone && (
                              <button
                                onClick={() => handleRelance(client)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-xl text-sm transition-all"
                              >
                                <Phone className="w-4 h-4" />
                                SMS
                              </button>
                            )}
                            {client.email && (
                              <button
                                onClick={() => handleRelance(client)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-xl text-sm transition-all"
                              >
                                <Mail className="w-4 h-4" />
                                Email
                              </button>
                            )}
                            <button
                              onClick={() => handleRelance(client)}
                              className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-xl text-sm transition-all"
                            >
                              <Sparkles className="w-4 h-4" />
                              Relancer IA
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: Campagnes */}
            {activeTab === 'campagnes' && (
              <div className="space-y-4">
                {campaigns.length === 0 ? (
                  <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-white/10">
                    <Mail className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <h3 className="text-white font-semibold mb-2">Aucune campagne</h3>
                    <p className="text-white/50 text-sm mb-4">Créez votre première campagne de relance</p>
                    <button className="px-4 py-2 bg-amber-500 text-white rounded-xl font-medium">
                      Créer une campagne
                    </button>
                  </div>
                ) : (
                  campaigns.map(campaign => (
                    <div key={campaign.id} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-white font-semibold">{campaign.nom}</h3>
                          <p className="text-white/50 text-sm">{campaign.type}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          campaign.statut === 'active' ? 'bg-green-500/20 text-green-400' :
                          campaign.statut === 'terminee' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-white/10 text-white/60'
                        }`}>
                          {campaign.statut}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-white/5 rounded-xl">
                          <p className="text-2xl font-bold text-white">{campaign.clients_cibles}</p>
                          <p className="text-xs text-white/50">Ciblés</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-xl">
                          <p className="text-2xl font-bold text-blue-400">{campaign.clients_contactes}</p>
                          <p className="text-xs text-white/50">Contactés</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-xl">
                          <p className="text-2xl font-bold text-green-400">{campaign.clients_convertis}</p>
                          <p className="text-xs text-white/50">Convertis</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-xl">
                          <p className="text-2xl font-bold text-amber-400">{campaign.taux_conversion}%</p>
                          <p className="text-xs text-white/50">Conversion</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Relance */}
      {showModal && selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-400" />
                Relancer {selectedClient.prenom}
              </h3>
              <button onClick={() => { setShowModal(false); setSelectedClient(null); }} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Gift className="w-5 h-5 text-amber-400" />
                  <span className="text-amber-400 font-medium">Offre suggérée par l'IA</span>
                </div>
                <p className="text-white text-2xl font-bold">-{selectedClient.offre_suggeree}%</p>
                <p className="text-white/60 text-sm mt-1">
                  Sur {selectedClient.service_prefere}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-white/70 text-sm">Choisissez le canal de relance :</p>
                {selectedClient.telephone && (
                  <button
                    onClick={() => sendRelance('sms')}
                    disabled={sending}
                    className="w-full flex items-center justify-between px-4 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5" />
                      <div className="text-left">
                        <p className="font-medium">SMS</p>
                        <p className="text-xs text-green-400/70">{selectedClient.telephone}</p>
                      </div>
                    </div>
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                )}
                {selectedClient.email && (
                  <button
                    onClick={() => sendRelance('email')}
                    disabled={sending}
                    className="w-full flex items-center justify-between px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5" />
                      <div className="text-left">
                        <p className="font-medium">Email</p>
                        <p className="text-xs text-blue-400/70">{selectedClient.email}</p>
                      </div>
                    </div>
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => { setShowModal(false); setSelectedClient(null); }}
                className="w-full px-4 py-3 border border-white/10 text-white/70 rounded-xl hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
