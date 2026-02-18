import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useToast } from '@/hooks/use-toast';
import {
  Facebook,
  Instagram,
  Linkedin,
  Plus,
  Send,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Link2,
  X,
  Sparkles,
  Trash2,
  RefreshCw,
  Lightbulb,
  Image,
  Gauge,
} from 'lucide-react';

interface SocialPost {
  id: string;
  platforms: string[];
  content: string;
  media_urls: string[];
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  category: string | null;
  created_at: string;
}

interface Quotas {
  plan: string;
  posts: { utilise: number; limite: number; restant: number; pourcentage: number };
  images: { utilise: number; limite: number; restant: number; pourcentage: number };
}

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'from-pink-500 to-purple-600', bg: 'bg-pink-500/10', text: 'text-pink-400' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'from-blue-600 to-blue-700', bg: 'bg-blue-600/10', text: 'text-blue-300' },
];

export default function SocialMedia() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [quotas, setQuotas] = useState<Quotas | null>(null);
  const { toast } = useToast();

  const [newPost, setNewPost] = useState({
    platform: 'instagram',
    sujet: '',
    contenu: '',
    scheduledAt: '',
    imageUrl: '',
    imagePrompt: '',
  });

  useEffect(() => {
    loadPosts();
    loadQuotas();
  }, []);

  async function loadQuotas() {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/social/quotas', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setQuotas(data.quotas);
      }
    } catch (err) {
      console.error('Erreur chargement quotas:', err);
    }
  }

  async function loadPosts() {
    try {
      setLoadingPosts(true);
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/social/posts?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Erreur chargement posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  }

  async function generateWithAI() {
    if (!newPost.sujet.trim()) {
      toast({ title: 'Erreur', description: 'Entrez un sujet pour la generation', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/social/generate-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sujet: newPost.sujet,
          plateforme: newPost.platform,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewPost({ ...newPost, contenu: data.contenu });
        toast({ title: 'Genere!', description: 'Contenu genere par l\'IA' });
      } else {
        toast({ title: 'Erreur', description: data.error || 'Echec generation', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: 'Echec de la generation IA', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }

  async function generateImage() {
    const prompt = newPost.imagePrompt.trim() || newPost.sujet.trim();
    if (!prompt) {
      toast({ title: 'Erreur', description: 'Entrez une description pour l\'image', variant: 'destructive' });
      return;
    }

    if (quotas && quotas.images.restant <= 0) {
      toast({ title: 'Quota atteint', description: 'Vous avez atteint votre limite d\'images ce mois-ci', variant: 'destructive' });
      return;
    }

    setGeneratingImage(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/social/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          size: '1024x1024',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewPost({ ...newPost, imageUrl: data.image_url });
        toast({ title: 'Image generee!', description: 'Image creee par DALL-E' });
        loadQuotas(); // Recharger les quotas apres generation
      } else {
        toast({ title: 'Erreur', description: data.error || 'Echec generation image', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: 'Echec de la generation d\'image', variant: 'destructive' });
    } finally {
      setGeneratingImage(false);
    }
  }

  async function savePost() {
    if (!newPost.contenu.trim()) {
      toast({ title: 'Erreur', description: 'Le contenu est vide', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/social/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plateforme: newPost.platform,
          contenu: newPost.contenu,
          sujet: newPost.sujet,
          scheduled_at: newPost.scheduledAt || null,
          media_urls: newPost.imageUrl ? [newPost.imageUrl] : [],
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: 'Sauvegarde!', description: newPost.scheduledAt ? 'Post programme' : 'Brouillon sauvegarde' });
        setShowNewPost(false);
        setNewPost({ platform: 'instagram', sujet: '', contenu: '', scheduledAt: '', imageUrl: '', imagePrompt: '' });
        loadPosts();
        loadQuotas();
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: 'Echec sauvegarde', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function deletePost(postId: string) {
    if (!confirm('Supprimer ce post?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/social/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: 'Supprime', description: 'Post supprime' });
        loadPosts();
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: 'Echec suppression', variant: 'destructive' });
    }
  }

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    drafts: posts.filter(p => p.status === 'draft').length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Reseaux Sociaux</h1>
            <p className="text-white/50">Creez du contenu avec l'IA et gerez vos publications</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadPosts}
              className="p-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl hover:bg-white/10 transition-all"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => setShowNewPost(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
            >
              <Sparkles size={18} />
              Creer avec l'IA
            </button>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total posts', value: stats.total, icon: Send, color: 'text-white' },
            { label: 'Publies', value: stats.published, icon: CheckCircle, color: 'text-green-400' },
            { label: 'Programmes', value: stats.scheduled, icon: Clock, color: 'text-blue-400' },
            { label: 'Brouillons', value: stats.drafts, icon: Calendar, color: 'text-amber-400' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} className={stat.color} />
                  <span className="text-xs text-white/50">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Quotas IA */}
        {quotas && (
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="text-purple-400" size={20} />
              <h2 className="text-lg font-semibold text-white">Quotas IA - Plan {quotas.plan.charAt(0).toUpperCase() + quotas.plan.slice(1)}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Posts IA */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    Posts IA generes
                  </span>
                  <span className="text-sm text-white font-medium">
                    {quotas.posts.utilise} / {quotas.posts.limite}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quotas.posts.pourcentage > 90 ? 'bg-red-500' : quotas.posts.pourcentage > 70 ? 'bg-amber-500' : 'bg-purple-500'
                    }`}
                    style={{ width: `${Math.min(quotas.posts.pourcentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-white/40 mt-1">{quotas.posts.restant} restant(s) ce mois</p>
              </div>
              {/* Images DALL-E */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Image size={14} className="text-pink-400" />
                    Images DALL-E
                  </span>
                  <span className="text-sm text-white font-medium">
                    {quotas.images.utilise} / {quotas.images.limite}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quotas.images.pourcentage > 90 ? 'bg-red-500' : quotas.images.pourcentage > 70 ? 'bg-amber-500' : 'bg-pink-500'
                    }`}
                    style={{ width: `${Math.min(quotas.images.pourcentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-white/40 mt-1">{quotas.images.restant} restant(s) ce mois</p>
              </div>
            </div>
          </div>
        )}

        {/* Liste des posts */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Mes posts</h2>

          {loadingPosts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-white/50" size={32} />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <Lightbulb size={48} className="mx-auto mb-2 opacity-50" />
              <p>Aucun post cree</p>
              <p className="text-sm mt-1">Utilisez l'IA pour creer votre premier post</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => {
                const platform = PLATFORMS.find(p => post.platforms?.includes(p.id));
                const Icon = platform?.icon || Send;

                return (
                  <div key={post.id} className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-6 h-6 rounded ${platform?.bg || 'bg-white/10'} flex items-center justify-center`}>
                          <Icon size={14} className={platform?.text || 'text-white/60'} />
                        </div>
                        <span className="text-xs text-white/60">{platform?.name || post.platforms?.join(', ')}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            post.status === 'published'
                              ? 'bg-green-500/10 text-green-400'
                              : post.status === 'scheduled'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-white/10 text-white/50'
                          }`}
                        >
                          {post.status === 'published' ? 'Publie' : post.status === 'scheduled' ? 'Programme' : 'Brouillon'}
                        </span>
                      </div>
                      <p className="text-sm text-white/80 line-clamp-3">{post.content}</p>
                      <p className="text-xs text-white/30 mt-2">
                        {post.scheduled_at
                          ? `Programme: ${new Date(post.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
                          : `Cree le ${new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
                      </p>
                    </div>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="p-2 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal nouvelle publication avec IA */}
        {showNewPost && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="text-purple-400" size={20} />
                  Creer un post avec l'IA
                </h2>
                <button onClick={() => setShowNewPost(false)} className="text-white/50 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Plateforme */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Plateforme</label>
                <div className="flex gap-2 flex-wrap">
                  {PLATFORMS.map((platform) => {
                    const Icon = platform.icon;
                    return (
                      <button
                        key={platform.id}
                        onClick={() => setNewPost({ ...newPost, platform: platform.id })}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${
                          newPost.platform === platform.id
                            ? `bg-gradient-to-r ${platform.color} text-white shadow-lg`
                            : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/20'
                        }`}
                      >
                        <Icon size={16} />
                        {platform.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sujet */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Sujet du post</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-purple-500/50 focus:outline-none"
                  placeholder="Ex: Nouvelle tendance coiffure 2026, Promo Saint-Valentin..."
                  value={newPost.sujet}
                  onChange={(e) => setNewPost({ ...newPost, sujet: e.target.value })}
                />
              </div>

              {/* Bouton generation IA */}
              <button
                onClick={generateWithAI}
                disabled={generating || !newPost.sujet.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generation en cours...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generer avec l'IA
                  </>
                )}
              </button>

              {/* Contenu genere */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">
                  Contenu {newPost.contenu && <span className="text-purple-400">(genere par l'IA)</span>}
                </label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-purple-500/50 focus:outline-none resize-none"
                  rows={8}
                  placeholder="Le contenu genere apparaitra ici... Vous pouvez aussi l'editer manuellement."
                  value={newPost.contenu}
                  onChange={(e) => setNewPost({ ...newPost, contenu: e.target.value })}
                />
                <p className="text-xs text-white/30 mt-1">{newPost.contenu.length} caracteres</p>
              </div>

              {/* Generation image */}
              <div className="border border-white/10 rounded-xl p-4 space-y-3">
                <label className="text-sm text-white/60 flex items-center gap-2">
                  <Image size={14} className="text-pink-400" />
                  Image DALL-E (optionnel)
                  {quotas && (
                    <span className="text-xs text-white/40 ml-auto">
                      {quotas.images.restant} image(s) restante(s)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-pink-500/50 focus:outline-none"
                  placeholder="Description de l'image (laissez vide pour utiliser le sujet)"
                  value={newPost.imagePrompt}
                  onChange={(e) => setNewPost({ ...newPost, imagePrompt: e.target.value })}
                />
                <button
                  onClick={generateImage}
                  disabled={generatingImage || (quotas && quotas.images.restant <= 0)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-medium rounded-xl shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingImage ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generation en cours...
                    </>
                  ) : (
                    <>
                      <Image size={16} />
                      Generer une image
                    </>
                  )}
                </button>
                {newPost.imageUrl && (
                  <div className="relative">
                    <img
                      src={newPost.imageUrl}
                      alt="Image generee"
                      className="w-full h-48 object-cover rounded-lg border border-white/10"
                    />
                    <button
                      onClick={() => setNewPost({ ...newPost, imageUrl: '' })}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white/70 hover:text-white transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Programmation optionnelle */}
              <div>
                <label className="text-sm text-white/60 mb-2 block flex items-center gap-2">
                  <Calendar size={14} />
                  Programmer (optionnel)
                </label>
                <input
                  type="datetime-local"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500/50 focus:outline-none"
                  value={newPost.scheduledAt}
                  onChange={(e) => setNewPost({ ...newPost, scheduledAt: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowNewPost(false)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white/70 rounded-xl hover:bg-white/10 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={savePost}
                  disabled={loading || !newPost.contenu.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  {newPost.scheduledAt ? 'Programmer' : 'Sauvegarder brouillon'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
