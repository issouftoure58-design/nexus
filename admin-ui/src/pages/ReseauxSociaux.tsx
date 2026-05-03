/**
 * Page Reseaux Sociaux — Generation IA + Publication Facebook/Instagram
 * Connexion OAuth Meta, creation posts IA (Claude + DALL-E), programmation
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import {
  Facebook,
  Instagram,
  Plus,
  Send,
  Calendar,
  Clock,
  CheckCircle,
  Loader2,
  X,
  Sparkles,
  Trash2,
  RefreshCw,
  Lightbulb,
  Image,
  Link2,
  Unlink,
  AlertTriangle,
} from 'lucide-react';

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  image_url: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  category: string | null;
  created_at: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_id: string;
  page_id: string;
  ig_account_id: string | null;
  is_active: boolean;
  connected_at: string;
  token_expires_at: string;
  token_expiring_soon: boolean;
  token_expired: boolean;
}

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600', light: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-gradient-to-r from-pink-500 to-purple-600', light: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400' },
];

export default function ReseauxSociaux() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [connectingFb, setConnectingFb] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newPost, setNewPost] = useState({
    platform: 'facebook',
    sujet: '',
    contenu: '',
    scheduledAt: '',
    imageUrl: '',
    imagePrompt: '',
  });

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setMessage({ type: 'success', text: `${params.get('pages') || ''} compte(s) connecte(s) avec succes !` });
      window.history.replaceState({}, '', '/reseaux-sociaux');
    } else if (params.get('error')) {
      setMessage({ type: 'error', text: params.get('error') || 'Erreur de connexion' });
      window.history.replaceState({}, '', '/reseaux-sociaux');
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.get<{ accounts: SocialAccount[] }>('/social/auth/accounts');
      setAccounts(res?.accounts || []);
    } catch {
      // Silencieux si pas encore configure
    }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      setLoadingPosts(true);
      const res = await api.get<{ data?: SocialPost[]; posts?: SocialPost[]; success?: boolean }>('/social/posts?limit=50');
      setPosts(res?.data || res?.posts || []);
    } catch {
      // Table peut ne pas exister encore
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadPosts();
  }, [loadAccounts, loadPosts]);

  async function connectFacebook() {
    setConnectingFb(true);
    try {
      const res = await api.get<{ url: string }>('/social/auth/facebook');
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur connexion Facebook';
      setMessage({ type: 'error', text: msg });
      setConnectingFb(false);
    }
  }

  async function disconnectAccount(id: string) {
    if (!confirm('Deconnecter ce compte ?')) return;
    try {
      await api.delete(`/social/auth/accounts/${id}`);
      setMessage({ type: 'success', text: 'Compte deconnecte' });
      loadAccounts();
    } catch {
      setMessage({ type: 'error', text: 'Erreur deconnexion' });
    }
  }

  async function generateWithAI() {
    if (!newPost.sujet.trim()) return;
    setGenerating(true);
    try {
      const res = await api.post<{ success: boolean; contenu: string; error?: string }>('/social/generate-post', {
        sujet: newPost.sujet,
        plateforme: newPost.platform,
      });
      if (res?.success) {
        setNewPost(p => ({ ...p, contenu: res.contenu }));
        setMessage({ type: 'success', text: 'Contenu genere par l\'IA' });
      } else {
        setMessage({ type: 'error', text: res?.error || 'Echec generation' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Echec de la generation IA' });
    } finally {
      setGenerating(false);
    }
  }

  async function generateImage() {
    const prompt = newPost.imagePrompt.trim() || newPost.sujet.trim();
    if (!prompt) return;
    setGeneratingImage(true);
    try {
      const res = await api.post<{ success: boolean; image_url: string; error?: string }>('/social/generate-image', { prompt, size: '1024x1024' });
      if (res?.success) {
        setNewPost(p => ({ ...p, imageUrl: res.image_url }));
        setMessage({ type: 'success', text: 'Image generee par DALL-E' });
      } else {
        setMessage({ type: 'error', text: res?.error || 'Echec generation image' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Echec de la generation d\'image' });
    } finally {
      setGeneratingImage(false);
    }
  }

  async function savePost() {
    if (!newPost.contenu.trim()) return;
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; post: SocialPost; error?: string }>('/social/posts', {
        plateforme: newPost.platform,
        contenu: newPost.contenu,
        sujet: newPost.sujet,
        scheduled_at: newPost.scheduledAt || null,
        media_urls: newPost.imageUrl ? [newPost.imageUrl] : [],
      });
      if (res?.success) {
        setMessage({ type: 'success', text: newPost.scheduledAt ? 'Post programme !' : 'Brouillon sauvegarde' });
        setShowNewPost(false);
        setNewPost({ platform: 'facebook', sujet: '', contenu: '', scheduledAt: '', imageUrl: '', imagePrompt: '' });
        loadPosts();
      } else {
        setMessage({ type: 'error', text: res?.error || 'Erreur' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Echec sauvegarde' });
    } finally {
      setLoading(false);
    }
  }

  async function deletePost(postId: string) {
    if (!confirm('Supprimer ce post ?')) return;
    try {
      await api.delete(`/social/posts/${postId}`);
      setMessage({ type: 'success', text: 'Post supprime' });
      loadPosts();
    } catch {
      setMessage({ type: 'error', text: 'Echec suppression' });
    }
  }

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    drafts: posts.filter(p => p.status === 'draft').length,
  };

  const fbAccount = accounts.find(a => a.platform === 'facebook');
  const igAccount = accounts.find(a => a.platform === 'instagram');

  return (
    <div className="space-y-6">
      {/* Message toast */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="p-0.5"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reseaux Sociaux</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Generez du contenu avec l'IA et publiez sur Facebook et Instagram.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { loadPosts(); loadAccounts(); }}
            className="p-2.5 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowNewPost(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors">
            <Sparkles className="w-4 h-4" />
            Creer avec l'IA
          </button>
        </div>
      </div>

      {/* Comptes connectes */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-cyan-500" />
            Comptes connectes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Facebook */}
            <div className={`p-4 rounded-lg border ${fbAccount ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Facebook className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900 dark:text-white">Facebook</span>
                </div>
                {fbAccount && (
                  <button onClick={() => disconnectAccount(fbAccount.id)} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Deconnecter">
                    <Unlink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Deconnecter</span>
                  </button>
                )}
              </div>
              {fbAccount ? (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{fbAccount.account_name}</p>
                  {fbAccount.token_expiring_soon && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Token expire bientot — reconnectez
                    </p>
                  )}
                </div>
              ) : (
                <button onClick={connectFacebook} disabled={connectingFb}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                  {connectingFb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Connecter Facebook
                </button>
              )}
            </div>
            {/* Instagram */}
            <div className={`p-4 rounded-lg border ${igAccount ? 'border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-900/10' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Instagram className="w-5 h-5 text-pink-600" />
                  <span className="font-medium text-gray-900 dark:text-white">Instagram</span>
                </div>
                {igAccount && (
                  <button onClick={() => disconnectAccount(igAccount.id)} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Deconnecter">
                    <Unlink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Deconnecter</span>
                  </button>
                )}
              </div>
              {igAccount ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">@{igAccount.account_name}</p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  {fbAccount ? 'Aucun compte IG lie a votre page Facebook' : 'Connectez Facebook d\'abord — Instagram est lie automatiquement'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total posts', value: stats.total, icon: Send, iconClass: 'text-gray-500' },
          { label: 'Publies', value: stats.published, icon: CheckCircle, iconClass: 'text-green-500' },
          { label: 'Programmes', value: stats.scheduled, icon: Clock, iconClass: 'text-blue-500' },
          { label: 'Brouillons', value: stats.drafts, icon: Calendar, iconClass: 'text-amber-500' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.iconClass}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Liste des posts */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Mes posts</h2>

          {loadingPosts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-gray-400" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun post cree</p>
              <p className="text-sm mt-1">Utilisez l'IA pour creer votre premier post</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => {
                const platform = PLATFORMS.find(p => p.id === post.platform);
                const Icon = platform?.icon || Send;
                return (
                  <div key={post.id} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${platform?.text || 'text-gray-500'}`} />
                        <span className="text-xs text-gray-500 dark:text-gray-400">{platform?.name || post.platform}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          post.status === 'published' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : post.status === 'scheduled' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : post.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {post.status === 'published' ? 'Publie' : post.status === 'scheduled' ? 'Programme' : post.status === 'error' ? 'Erreur' : 'Brouillon'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{post.content}</p>
                      {post.image_url && (
                        <img src={post.image_url} alt="" className="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {post.scheduled_at
                          ? `Programme: ${new Date(post.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
                          : `Cree le ${new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
                      </p>
                    </div>
                    <button onClick={() => deletePost(post.id)}
                      className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal nouvelle publication avec IA */}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowNewPost(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-500" />
                Creer un post avec l'IA
              </h2>
              <button onClick={() => setShowNewPost(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plateforme */}
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">Plateforme</label>
              <div className="flex gap-2">
                {PLATFORMS.map((p) => (
                  <button key={p.id} onClick={() => setNewPost(prev => ({ ...prev, platform: p.id }))}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border transition-all ${
                      newPost.platform === p.id
                        ? `${p.color} text-white border-transparent`
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}>
                    <p.icon className="w-4 h-4" />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sujet */}
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">Sujet du post</label>
              <input type="text"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                placeholder="Ex: Nouvelle fonctionnalite, Promo, Temoignage client..."
                value={newPost.sujet}
                onChange={(e) => setNewPost(prev => ({ ...prev, sujet: e.target.value }))}
              />
            </div>

            {/* Bouton generation IA */}
            <button onClick={generateWithAI} disabled={generating || !newPost.sujet.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generation en cours...</> : <><Sparkles className="w-4 h-4" /> Generer avec l'IA</>}
            </button>

            {/* Contenu genere */}
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">
                Contenu {newPost.contenu && <span className="text-cyan-500">(genere par l'IA — modifiable)</span>}
              </label>
              <textarea
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none resize-none"
                rows={8}
                placeholder="Le contenu genere apparaitra ici... Vous pouvez aussi ecrire manuellement."
                value={newPost.contenu}
                onChange={(e) => setNewPost(prev => ({ ...prev, contenu: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">{newPost.contenu.length} caracteres</p>
            </div>

            {/* Generation image */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <label className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Image className="w-4 h-4 text-pink-500" />
                Image DALL-E (optionnel)
              </label>
              <input type="text"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-pink-500 focus:outline-none"
                placeholder="Description de l'image (laissez vide pour utiliser le sujet)"
                value={newPost.imagePrompt}
                onChange={(e) => setNewPost(prev => ({ ...prev, imagePrompt: e.target.value }))}
              />
              <button onClick={generateImage} disabled={generatingImage}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors">
                {generatingImage ? <><Loader2 className="w-4 h-4 animate-spin" /> Generation en cours...</> : <><Image className="w-4 h-4" /> Generer une image</>}
              </button>
              {newPost.imageUrl && (
                <div className="relative">
                  <img src={newPost.imageUrl} alt="Image generee" className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                  <button onClick={() => setNewPost(prev => ({ ...prev, imageUrl: '' }))}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white/70 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Programmation */}
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Programmer (optionnel)
              </label>
              <input type="datetime-local"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                value={newPost.scheduledAt}
                onChange={(e) => setNewPost(prev => ({ ...prev, scheduledAt: e.target.value }))}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowNewPost(false)}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                Annuler
              </button>
              <button onClick={savePost} disabled={loading || !newPost.contenu.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {newPost.scheduledAt ? 'Programmer' : 'Sauvegarder brouillon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
