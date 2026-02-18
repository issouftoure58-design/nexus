import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Image,
  Video,
  Download,
  Loader2,
  Wand2,
  Scissors,
  ZoomIn,
  Clock,
} from 'lucide-react';

interface GeneratedMedia {
  success: boolean;
  image?: string;
  url?: string;
  caption?: string;
  platform?: string;
  model?: string;
}

interface HistoryItem {
  id: number;
  type: string;
  model: string;
  prompt: string;
  output_url: string;
  platform: string;
  theme: string;
  cost_credits: number;
  created_at: string;
}

export default function MediaGenerator() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'tools' | 'history'>('generate');
  const [generatedMedia, setGeneratedMedia] = useState<GeneratedMedia | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [usage, setUsage] = useState({ images_generated: 0, videos_generated: 0, total_cost_credits: 0 });
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    platform: 'instagram',
    theme: 'promotion',
    text: '',
    style: 'moderne',
    quality: 'standard',
  });

  // Tool form
  const [toolForm, setToolForm] = useState({
    imageUrl: '',
    action: 'remove-background' as 'remove-background' | 'upscale' | 'video',
    scale: 2,
    motion: 'medium',
  });

  useEffect(() => {
    loadHistory();
    loadUsage();
  }, []);

  async function loadHistory() {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/media/history?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setHistory(data.history || []);
    } catch {}
  }

  async function loadUsage() {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/media/usage', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setUsage(data.usage);
    } catch {}
  }

  async function generatePost() {
    if (!formData.text) {
      toast({ title: 'Erreur', description: 'Veuillez entrer un texte', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/media/generate/social-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setGeneratedMedia(data);
        loadHistory();
        loadUsage();
        toast({ title: 'Post IA Genere !', description: `Image + caption pour ${formData.platform}` });
      } else {
        toast({ title: 'Erreur', description: data.error || 'Echec generation', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erreur', description: 'Echec generation', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function runTool() {
    if (!toolForm.imageUrl) {
      toast({ title: 'Erreur', description: 'URL image requise', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      let endpoint = '';
      let body: Record<string, unknown> = {};

      if (toolForm.action === 'remove-background') {
        endpoint = '/api/admin/media/remove-background';
        body = { imageUrl: toolForm.imageUrl };
      } else if (toolForm.action === 'upscale') {
        endpoint = '/api/admin/media/upscale';
        body = { imageUrl: toolForm.imageUrl, scale: toolForm.scale };
      } else {
        endpoint = '/api/admin/media/generate/video';
        body = { imageUrl: toolForm.imageUrl, motion: toolForm.motion };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setGeneratedMedia({ success: true, url: data.url });
        loadHistory();
        loadUsage();
        toast({ title: 'Traitement termine !' });
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Echec traitement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Medias IA</h1>
            <p className="text-white/50">Generez images, videos et posts avec l'IA</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-white/40">Ce mois</p>
              <p className="text-sm text-white/80">
                {usage.images_generated} images / {usage.videos_generated} videos
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'generate' as const, label: 'Generer Post', icon: Sparkles },
            { id: 'tools' as const, label: 'Outils', icon: Wand2 },
            { id: 'history' as const, label: 'Historique', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab: Generate Post */}
        {activeTab === 'generate' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">Creer un post</h2>

              {/* Platform */}
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Plateforme</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-amber-500/50 focus:outline-none"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>

              {/* Theme */}
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Theme</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-amber-500/50 focus:outline-none"
                  value={formData.theme}
                  onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                >
                  <option value="promotion">Promotion</option>
                  <option value="event">Evenement</option>
                  <option value="info">Information</option>
                </select>
              </div>

              {/* Text */}
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Texte du post</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                  placeholder="Ex: Soldes -30% ce weekend !"
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                />
              </div>

              {/* Style */}
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {['moderne', 'elegante', 'colore', 'minimal'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFormData({ ...formData, style: s })}
                      className={`px-3 py-2 rounded-xl text-sm capitalize transition-all ${
                        formData.style === s
                          ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                          : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Qualite</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, quality: 'standard' })}
                    className={`px-3 py-2 rounded-xl text-sm transition-all ${
                      formData.quality === 'standard'
                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Standard (0.30EUR)
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, quality: 'hd' })}
                    className={`px-3 py-2 rounded-xl text-sm transition-all ${
                      formData.quality === 'hd'
                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    HD (0.45EUR)
                  </button>
                </div>
              </div>

              <button
                onClick={generatePost}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generation en cours...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generer avec IA
                  </>
                )}
              </button>
            </div>

            {/* Preview */}
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Previsualisation</h2>

              {generatedMedia ? (
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <img
                      src={generatedMedia.image || generatedMedia.url}
                      alt="Post genere"
                      className="w-full h-auto"
                    />
                  </div>

                  {generatedMedia.caption && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-sm text-white/80 whitespace-pre-wrap">{generatedMedia.caption}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <a
                      href={generatedMedia.image || generatedMedia.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:bg-white/10 transition-all"
                    >
                      <Download size={16} />
                      Telecharger
                    </a>
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-all">
                      Publier
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-white/10 rounded-xl">
                  <div className="text-center text-white/30">
                    <Sparkles size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Votre post apparaitra ici</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Tools */}
        {activeTab === 'tools' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">Outils image/video</h2>

              {/* Action selection */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'remove-background' as const, label: 'Fond', icon: Scissors, price: '0.15EUR' },
                  { id: 'upscale' as const, label: 'Upscale', icon: ZoomIn, price: '0.24EUR' },
                  { id: 'video' as const, label: 'Video', icon: Video, price: '1.50EUR' },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => setToolForm({ ...toolForm, action: action.id })}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl text-sm transition-all ${
                        toolForm.action === action.id
                          ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                          : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <Icon size={20} />
                      <span>{action.label}</span>
                      <span className="text-xs opacity-60">{action.price}</span>
                    </button>
                  );
                })}
              </div>

              {/* Image URL */}
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">URL de l'image</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                  placeholder="https://..."
                  value={toolForm.imageUrl}
                  onChange={(e) => setToolForm({ ...toolForm, imageUrl: e.target.value })}
                />
              </div>

              {/* Scale option for upscale */}
              {toolForm.action === 'upscale' && (
                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Facteur</label>
                  <div className="flex gap-2">
                    {[2, 4].map((s) => (
                      <button
                        key={s}
                        onClick={() => setToolForm({ ...toolForm, scale: s })}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm transition-all ${
                          toolForm.scale === s
                            ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                            : 'bg-white/5 border border-white/10 text-white/60'
                        }`}
                      >
                        x{s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Motion for video */}
              {toolForm.action === 'video' && (
                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Mouvement</label>
                  <div className="flex gap-2">
                    {['low', 'medium', 'high'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setToolForm({ ...toolForm, motion: m })}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm capitalize transition-all ${
                          toolForm.motion === m
                            ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                            : 'bg-white/5 border border-white/10 text-white/60'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={runTool}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    Lancer
                  </>
                )}
              </button>
            </div>

            {/* Result */}
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Resultat</h2>
              {generatedMedia?.url ? (
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    {toolForm.action === 'video' ? (
                      <video src={generatedMedia.url as string} controls className="w-full" />
                    ) : (
                      <img src={generatedMedia.url as string} alt="Resultat" className="w-full h-auto" />
                    )}
                  </div>
                  <a
                    href={generatedMedia.url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:bg-white/10 transition-all"
                  >
                    <Download size={16} />
                    Telecharger
                  </a>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-white/10 rounded-xl">
                  <div className="text-center text-white/30">
                    <Image size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Le resultat apparaitra ici</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: History */}
        {activeTab === 'history' && (
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Historique des generations</h2>

            {history.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <Image size={48} className="mx-auto mb-2 opacity-50" />
                <p>Aucune generation pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {history.map((item) => (
                  <div key={item.id} className="group relative rounded-xl overflow-hidden border border-white/10">
                    <img
                      src={item.output_url}
                      alt=""
                      className="w-full aspect-square object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <span className="text-xs text-white/80 px-2 py-1 bg-white/10 rounded-full">
                        {item.model}
                      </span>
                      {item.platform && (
                        <span className="text-xs text-amber-400 px-2 py-1 bg-amber-500/10 rounded-full">
                          {item.platform}
                        </span>
                      )}
                      <a
                        href={item.output_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"
                      >
                        <Download size={16} className="text-white" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
