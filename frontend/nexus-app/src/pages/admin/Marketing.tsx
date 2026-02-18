import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Megaphone,
  Instagram,
  Facebook,
  Plus,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  Send,
  Eye,
  TrendingUp,
  Users,
  Mail,
  MessageSquare,
  Hash,
  Sparkles,
  X,
  Check,
  Loader2,
  Image,
  Target,
  Gift,
  BarChart3,
} from 'lucide-react';

interface Post {
  id: number;
  platform: string;
  content: string;
  hashtags?: string[];
  media_url?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_at?: string;
  published_at?: string;
  stats?: {
    likes: number;
    comments: number;
    shares: number;
  };
}

interface Campaign {
  id: number;
  name: string;
  type: string;
  status: string;
  target_count: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  created_at: string;
}

interface MarketingStats {
  posts_total: number;
  posts_published: number;
  posts_scheduled: number;
  campaigns_active: number;
  total_reach: number;
  engagement_rate: number;
}

export default function Marketing() {
  const [activeTab, setActiveTab] = useState<'posts' | 'campaigns' | 'stats'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    platform: 'instagram',
    occasion: 'promo',
    tone: 'professionnel',
    details: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [postsRes, campaignsRes, statsRes] = await Promise.all([
        fetch('/api/admin/social/posts', { headers }).then(r => r.json()).catch(() => ({ posts: [] })),
        fetch('/api/admin/marketing/campaigns', { headers }).then(r => r.json()).catch(() => ({ campaigns: [] })),
        fetch('/api/admin/marketing/stats/overview', { headers }).then(r => r.json()).catch(() => null),
      ]);

      setPosts(postsRes.posts || []);
      setCampaigns(campaignsRes.campaigns || []);
      setStats(statsRes);
    } catch (error) {
      console.error('Erreur chargement marketing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePost = async () => {
    setGenerating(true);
    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch('/api/admin/social/ai/generate-promo-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        loadData();
      }
    } catch (error) {
      console.error('Erreur génération:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeletePost = async (id: number) => {
    if (!confirm('Supprimer ce post ?')) return;
    const token = localStorage.getItem('admin_token');

    try {
      await fetch(`/api/admin/social/posts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-500/20 text-gray-400',
      scheduled: 'bg-blue-500/20 text-blue-400',
      published: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
      active: 'bg-green-500/20 text-green-400',
      paused: 'bg-amber-500/20 text-amber-400',
      completed: 'bg-purple-500/20 text-purple-400',
    };
    const labels: Record<string, string> = {
      draft: 'Brouillon',
      scheduled: 'Programmé',
      published: 'Publié',
      failed: 'Échec',
      active: 'Active',
      paused: 'En pause',
      completed: 'Terminée',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPlatformIcon = (platform: string) => {
    if (platform === 'instagram') return <Instagram className="w-5 h-5 text-pink-500" />;
    if (platform === 'facebook') return <Facebook className="w-5 h-5 text-blue-500" />;
    return <MessageSquare className="w-5 h-5 text-white/50" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Megaphone className="w-7 h-7 text-amber-400" />
              Marketing
            </h1>
            <p className="text-white/50 text-sm">Gérez vos publications et campagnes</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouveau post IA
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Posts publiés', value: stats?.posts_published || posts.filter(p => p.status === 'published').length, icon: Check, color: 'from-green-500 to-emerald-600' },
            { label: 'Programmés', value: stats?.posts_scheduled || posts.filter(p => p.status === 'scheduled').length, icon: Clock, color: 'from-blue-500 to-cyan-600' },
            { label: 'Campagnes actives', value: stats?.campaigns_active || campaigns.filter(c => c.status === 'active').length, icon: Target, color: 'from-purple-500 to-violet-600' },
            { label: "Taux d'engagement", value: stats?.engagement_rate ? `${stats.engagement_rate}%` : '—', icon: TrendingUp, color: 'from-amber-500 to-orange-600' },
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

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl w-fit">
          {[
            { id: 'posts', label: 'Publications', icon: Image },
            { id: 'campaigns', label: 'Campagnes', icon: Mail },
            { id: 'stats', label: 'Statistiques', icon: BarChart3 },
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

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : (
          <>
            {/* TAB: Posts */}
            {activeTab === 'posts' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-zinc-900/50 rounded-2xl border border-white/10">
                    <Image className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <h3 className="text-white font-semibold mb-2">Aucun post</h3>
                    <p className="text-white/50 text-sm mb-4">Créez votre premier post avec l'IA</p>
                    <button
                      onClick={() => setShowModal(true)}
                      className="px-4 py-2 bg-amber-500 text-white rounded-xl font-medium"
                    >
                      Générer un post
                    </button>
                  </div>
                ) : (
                  posts.map(post => (
                    <div key={post.id} className="bg-zinc-900/80 border border-white/10 rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all">
                      {post.media_url && (
                        <div className="aspect-square bg-zinc-800">
                          <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          {getPlatformIcon(post.platform)}
                          {getStatusBadge(post.status)}
                        </div>
                        <p className="text-white text-sm line-clamp-3 mb-3">{post.content}</p>
                        {post.hashtags && post.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {post.hashtags.slice(0, 5).map((tag, i) => (
                              <span key={i} className="text-xs text-amber-400">#{tag}</span>
                            ))}
                          </div>
                        )}
                        {post.scheduled_at && (
                          <p className="text-xs text-white/40 flex items-center gap-1 mb-3">
                            <Calendar className="w-3 h-3" />
                            {new Date(post.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {post.stats && (
                          <div className="flex gap-4 text-xs text-white/50 border-t border-white/10 pt-3">
                            <span>❤️ {post.stats.likes}</span>
                            <span>💬 {post.stats.comments}</span>
                            <span>🔄 {post.stats.shares}</span>
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm transition-all">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="flex items-center justify-center px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {post.status === 'draft' && (
                            <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm transition-all">
                              <Send className="w-4 h-4" />
                              Publier
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: Campaigns */}
            {activeTab === 'campaigns' && (
              <div className="space-y-4">
                {campaigns.length === 0 ? (
                  <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-white/10">
                    <Mail className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <h3 className="text-white font-semibold mb-2">Aucune campagne</h3>
                    <p className="text-white/50 text-sm">Créez votre première campagne de relance</p>
                  </div>
                ) : (
                  campaigns.map(campaign => (
                    <div key={campaign.id} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-white font-semibold">{campaign.name}</h3>
                          <p className="text-white/50 text-sm">{campaign.type}</p>
                        </div>
                        {getStatusBadge(campaign.status)}
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-white/5 rounded-xl">
                          <p className="text-2xl font-bold text-white">{campaign.target_count}</p>
                          <p className="text-xs text-white/50">Ciblés</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-xl">
                          <p className="text-2xl font-bold text-blue-400">{campaign.sent_count}</p>
                          <p className="text-xs text-white/50">Envoyés</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-xl">
                          <p className="text-2xl font-bold text-green-400">{campaign.opened_count}</p>
                          <p className="text-xs text-white/50">Ouverts</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-xl">
                          <p className="text-2xl font-bold text-amber-400">{campaign.clicked_count}</p>
                          <p className="text-xs text-white/50">Clics</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: Stats */}
            {activeTab === 'stats' && (
              <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-white/10">
                <BarChart3 className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">Statistiques détaillées</h3>
                <p className="text-white/50 text-sm">Les statistiques avancées seront bientôt disponibles</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal création post */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Générer un post IA
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Plateforme</label>
                <div className="flex gap-2">
                  {['instagram', 'facebook'].map(p => (
                    <button
                      key={p}
                      onClick={() => setFormData({ ...formData, platform: p })}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                        formData.platform === p
                          ? 'border-amber-500 bg-amber-500/10 text-white'
                          : 'border-white/10 text-white/50 hover:border-white/30'
                      }`}
                    >
                      {p === 'instagram' ? <Instagram className="w-5 h-5" /> : <Facebook className="w-5 h-5" />}
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Type de post</label>
                <select
                  value={formData.occasion}
                  onChange={e => setFormData({ ...formData, occasion: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="promo">Promotion</option>
                  <option value="nouveaute">Nouveauté</option>
                  <option value="conseil">Conseil beauté</option>
                  <option value="evenement">Événement</option>
                  <option value="temoignage">Témoignage client</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Ton</label>
                <select
                  value={formData.tone}
                  onChange={e => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="professionnel">Professionnel</option>
                  <option value="fun">Fun & décontracté</option>
                  <option value="inspirant">Inspirant</option>
                  <option value="urgent">Urgence / FOMO</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Détails (optionnel)</label>
                <textarea
                  value={formData.details}
                  onChange={e => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Ex: -20% sur les tresses cette semaine..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-amber-500 focus:outline-none resize-none h-24"
                />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-white/10">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 border border-white/10 text-white/70 rounded-xl hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleGeneratePost}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium disabled:opacity-50 transition-all"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Générer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
