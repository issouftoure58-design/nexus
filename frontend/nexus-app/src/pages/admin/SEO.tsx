import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Search,
  TrendingUp,
  TrendingDown,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Target,
  BarChart3,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  Eye,
  Share2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  ExternalLink,
  Wand2,
  Save,
  X,
} from 'lucide-react';

// Types
interface MotCle {
  id: string;
  mot_cle: string;
  volume_recherche?: number;
  difficulte?: number;
  tendance: 'hausse' | 'stable' | 'baisse';
  categorie?: string;
  intention?: string;
  position_google?: number;
  clics_mensuels: number;
  impressions_mensuelles: number;
  cible: boolean;
}

interface Article {
  id: string;
  titre: string;
  slug: string;
  contenu: string;
  image_principale?: string;
  meta_title?: string;
  meta_description?: string;
  mots_cles_cibles: string[];
  categorie?: string;
  auteur?: string;
  temps_lecture?: number;
  statut: 'brouillon' | 'publie' | 'archive';
  date_publication?: string;
  vues: number;
  partages: number;
  created_at: string;
}

interface Audit {
  id: string;
  url_page: string;
  titre_page?: string;
  score_global?: number;
  score_technique?: number;
  score_contenu?: number;
  score_metas?: number;
  score_performance?: number;
  problemes?: { type: string; severite: string; message: string; solution: string }[];
  opportunites?: { titre: string; description: string; impact: string }[];
  mots_cles_detectes?: string[];
  date_audit: string;
}

interface Recommandation {
  id: string;
  type: string;
  priorite: 'haute' | 'moyenne' | 'basse';
  titre: string;
  description: string;
  actions_suggerees: string[];
  impact_estime?: string;
  effort: 'faible' | 'moyen' | 'eleve';
  statut: 'ouverte' | 'en_cours' | 'terminee' | 'ignoree';
  created_at: string;
}

interface DashboardStats {
  motsClés: { total: number; cibles: number; enTop10: number };
  articles: { total: number; publies: number; vuesTotal: number };
  dernierAudit?: Audit;
  recommandations: { ouvertes: number; hautesPriorites: number };
}

export default function SEO() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'mots-cles' | 'articles' | 'audits' | 'recommandations'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [motsClés, setMotsClés] = useState<MotCle[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [recommandations, setRecommandations] = useState<Recommandation[]>([]);

  // Modals
  const [showMotCleModal, setShowMotCleModal] = useState(false);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Forms
  const [motCleForm, setMotCleForm] = useState({ mot_cle: '', categorie: '', cible: false });
  const [auditUrl, setAuditUrl] = useState('');
  const [generateSubject, setGenerateSubject] = useState('');
  const [generatedArticle, setGeneratedArticle] = useState<any>(null);

  // Processing states
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const token = localStorage.getItem('adminToken');

  // Fetch dashboard stats
  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/seo/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Erreur dashboard SEO:', err);
    }
  };

  // Fetch mots-clés
  const fetchMotsClés = async () => {
    try {
      const res = await fetch('/api/seo/mots-cles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMotsClés(data.motsClés || []);
      }
    } catch (err) {
      console.error('Erreur mots-clés:', err);
    }
  };

  // Fetch articles
  const fetchArticles = async () => {
    try {
      const res = await fetch('/api/seo/articles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setArticles(data.articles || []);
      }
    } catch (err) {
      console.error('Erreur articles:', err);
    }
  };

  // Fetch audits
  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/seo/audits', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAudits(data.audits || []);
      }
    } catch (err) {
      console.error('Erreur audits:', err);
    }
  };

  // Fetch recommandations
  const fetchRecommandations = async () => {
    try {
      const res = await fetch('/api/seo/recommandations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setRecommandations(data.recommandations || []);
      }
    } catch (err) {
      console.error('Erreur recommandations:', err);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDashboard(),
        fetchMotsClés(),
        fetchArticles(),
        fetchAudits(),
        fetchRecommandations(),
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Add mot-clé
  const handleAddMotCle = async () => {
    if (!motCleForm.mot_cle) return;
    setAnalyzing(true);
    try {
      // Analyze first
      const analyseRes = await fetch('/api/seo/mots-cles/analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mot_cle: motCleForm.mot_cle, secteur: 'coiffure afro' }),
      });
      const analyseData = await analyseRes.json();

      // Create with analysis
      const createRes = await fetch('/api/seo/mots-cles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mot_cle: motCleForm.mot_cle,
          categorie: motCleForm.categorie,
          cible: motCleForm.cible,
          volume_recherche: analyseData.analyse?.volume_estime,
          difficulte: analyseData.analyse?.difficulte,
          tendance: analyseData.analyse?.tendance || 'stable',
          intention: analyseData.analyse?.intention,
        }),
      });
      const data = await createRes.json();
      if (data.success) {
        setMotsClés([data.motCle, ...motsClés]);
        setShowMotCleModal(false);
        setMotCleForm({ mot_cle: '', categorie: '', cible: false });
      }
    } catch (err) {
      console.error('Erreur ajout mot-clé:', err);
    }
    setAnalyzing(false);
  };

  // Delete mot-clé
  const handleDeleteMotCle = async (id: string) => {
    if (!confirm('Supprimer ce mot-clé ?')) return;
    try {
      await fetch(`/api/seo/mots-cles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMotsClés(motsClés.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  // Toggle cible
  const handleToggleCible = async (motCle: MotCle) => {
    try {
      await fetch(`/api/seo/mots-cles/${motCle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cible: !motCle.cible }),
      });
      setMotsClés(motsClés.map((m) => (m.id === motCle.id ? { ...m, cible: !m.cible } : m)));
    } catch (err) {
      console.error('Erreur toggle cible:', err);
    }
  };

  // Generate article
  const handleGenerateArticle = async () => {
    if (!generateSubject) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/seo/articles/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sujet: generateSubject,
          mots_cles: motsClés.filter((m) => m.cible).map((m) => m.mot_cle),
          longueur: 'moyen',
          secteur: 'coiffure afro',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedArticle(data.article);
      }
    } catch (err) {
      console.error('Erreur génération:', err);
    }
    setGenerating(false);
  };

  // Save generated article
  const handleSaveGeneratedArticle = async () => {
    if (!generatedArticle) return;
    try {
      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          titre: generatedArticle.titre,
          contenu: generatedArticle.contenu,
          meta_title: generatedArticle.meta_title,
          meta_description: generatedArticle.meta_description,
          mots_cles_cibles: generatedArticle.mots_cles_suggeres,
          statut: 'brouillon',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setArticles([data.article, ...articles]);
        setShowGenerateModal(false);
        setGeneratedArticle(null);
        setGenerateSubject('');
      }
    } catch (err) {
      console.error('Erreur sauvegarde article:', err);
    }
  };

  // Launch audit
  const handleLaunchAudit = async () => {
    if (!auditUrl) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/seo/audits/analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url_page: auditUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setAudits([data.audit, ...audits]);
        setShowAuditModal(false);
        setAuditUrl('');
        fetchDashboard();
      }
    } catch (err) {
      console.error('Erreur audit:', err);
    }
    setAnalyzing(false);
  };

  // Generate recommendations
  const handleGenerateRecommandations = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/seo/recommandations/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ secteur: 'coiffure afro', objectifs: 'augmenter le trafic organique' }),
      });
      const data = await res.json();
      if (data.success) {
        setRecommandations([...data.recommandations, ...recommandations]);
        fetchDashboard();
      }
    } catch (err) {
      console.error('Erreur génération recommandations:', err);
    }
    setGenerating(false);
  };

  // Update recommendation status
  const handleUpdateRecommandationStatus = async (id: string, statut: string) => {
    try {
      await fetch(`/api/seo/recommandations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut }),
      });
      setRecommandations(recommandations.map((r) => (r.id === id ? { ...r, statut: statut as any } : r)));
      fetchDashboard();
    } catch (err) {
      console.error('Erreur mise à jour:', err);
    }
  };

  // Delete article
  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Supprimer cet article ?')) return;
    try {
      await fetch(`/api/seo/articles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setArticles(articles.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  // Publish article
  const handlePublishArticle = async (id: string) => {
    try {
      await fetch(`/api/seo/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut: 'publie' }),
      });
      setArticles(articles.map((a) => (a.id === id ? { ...a, statut: 'publie' } : a)));
    } catch (err) {
      console.error('Erreur publication:', err);
    }
  };

  // Helpers
  const getTendanceIcon = (tendance: string) => {
    if (tendance === 'hausse') return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (tendance === 'baisse') return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getDifficulteColor = (diff?: number) => {
    if (!diff) return 'bg-gray-200';
    if (diff < 30) return 'bg-green-500';
    if (diff < 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPrioriteColor = (priorite: string) => {
    if (priorite === 'haute') return 'bg-red-100 text-red-700';
    if (priorite === 'moyenne') return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  };

  const getStatutBadge = (statut: string) => {
    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      brouillon: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
      publie: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
      archive: { bg: 'bg-gray-100', text: 'text-gray-500', icon: XCircle },
      ouverte: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Lightbulb },
      en_cours: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
      terminee: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
      ignoree: { bg: 'bg-gray-100', text: 'text-gray-500', icon: XCircle },
    };
    const badge = badges[statut] || badges.brouillon;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-3 h-3" />
        {statut}
      </span>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SEO & Contenu</h1>
            <p className="text-gray-500">Optimisez votre visibilité sur les moteurs de recherche</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'mots-cles', label: 'Mots-clés', icon: Search },
              { id: 'articles', label: 'Articles', icon: FileText },
              { id: 'audits', label: 'Audits', icon: Target },
              { id: 'recommandations', label: 'Recommandations', icon: Lightbulb },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Mots-clés suivis</p>
                    <p className="text-2xl font-bold">{stats.motsClés.total}</p>
                  </div>
                  <Search className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {stats.motsClés.cibles} ciblés | {stats.motsClés.enTop10} en Top 10
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Articles publiés</p>
                    <p className="text-2xl font-bold">{stats.articles.publies}</p>
                  </div>
                  <FileText className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-xs text-gray-400 mt-2">{stats.articles.vuesTotal} vues totales</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Score SEO</p>
                    <p className={`text-2xl font-bold ${getScoreColor(stats.dernierAudit?.score_global)}`}>
                      {stats.dernierAudit?.score_global || '-'}/100
                    </p>
                  </div>
                  <Target className="w-8 h-8 text-amber-500" />
                </div>
                <p className="text-xs text-gray-400 mt-2">Dernier audit</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Recommandations</p>
                    <p className="text-2xl font-bold">{stats.recommandations.ouvertes}</p>
                  </div>
                  <Lightbulb className="w-8 h-8 text-purple-500" />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {stats.recommandations.hautesPriorites} hautes priorités
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">Actions rapides</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowMotCleModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un mot-clé
                </button>
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                >
                  <Wand2 className="w-4 h-4" />
                  Générer un article
                </button>
                <button
                  onClick={() => setShowAuditModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100"
                >
                  <Target className="w-4 h-4" />
                  Lancer un audit
                </button>
                <button
                  onClick={handleGenerateRecommandations}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Obtenir des recommandations IA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mots-clés Tab */}
        {activeTab === 'mots-cles' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Mots-clés SEO</h2>
              <button
                onClick={() => setShowMotCleModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mot-clé</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volume</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difficulté</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tendance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cible</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {motsClés.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        Aucun mot-clé. Ajoutez-en pour commencer le suivi SEO.
                      </td>
                    </tr>
                  ) : (
                    motsClés.map((mc) => (
                      <tr key={mc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{mc.mot_cle}</p>
                            {mc.categorie && <p className="text-xs text-gray-500">{mc.categorie}</p>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {mc.volume_recherche?.toLocaleString() || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getDifficulteColor(mc.difficulte)}`}
                                style={{ width: `${mc.difficulte || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{mc.difficulte || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">{getTendanceIcon(mc.tendance)}</td>
                        <td className="px-6 py-4 text-sm">
                          {mc.position_google ? (
                            <span className={mc.position_google <= 10 ? 'text-green-600 font-medium' : 'text-gray-500'}>
                              #{mc.position_google}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleCible(mc)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              mc.cible ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <Target className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteMotCle(mc.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Articles Tab */}
        {activeTab === 'articles' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Articles Blog</h2>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                <Wand2 className="w-4 h-4" />
                Générer avec IA
              </button>
            </div>

            <div className="grid gap-4">
              {articles.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun article. Générez-en un avec l'IA.</p>
                </div>
              ) : (
                articles.map((article) => (
                  <div key={article.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{article.titre}</h3>
                          {getStatutBadge(article.statut)}
                        </div>
                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                          {article.meta_description || article.contenu.substring(0, 160)}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {article.vues} vues
                          </span>
                          <span className="flex items-center gap-1">
                            <Share2 className="w-3 h-3" />
                            {article.partages} partages
                          </span>
                          {article.temps_lecture && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {article.temps_lecture} min
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {article.statut === 'brouillon' && (
                          <button
                            onClick={() => handlePublishArticle(article.id)}
                            className="px-3 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm"
                          >
                            Publier
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteArticle(article.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Audits Tab */}
        {activeTab === 'audits' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Audits SEO</h2>
              <button
                onClick={() => setShowAuditModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                <Target className="w-4 h-4" />
                Nouvel audit
              </button>
            </div>

            <div className="grid gap-4">
              {audits.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun audit. Lancez-en un pour analyser vos pages.</p>
                </div>
              ) : (
                audits.map((audit) => (
                  <div key={audit.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {audit.titre_page || audit.url_page}
                          <a
                            href={audit.url_page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </h3>
                        <p className="text-xs text-gray-500">
                          {new Date(audit.date_audit).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className={`text-3xl font-bold ${getScoreColor(audit.score_global)}`}>
                        {audit.score_global}/100
                      </div>
                    </div>

                    {/* Score breakdown */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {[
                        { label: 'Technique', score: audit.score_technique },
                        { label: 'Contenu', score: audit.score_contenu },
                        { label: 'Metas', score: audit.score_metas },
                        { label: 'Performance', score: audit.score_performance },
                      ].map(({ label, score }) => (
                        <div key={label} className="text-center">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className={`font-semibold ${getScoreColor(score)}`}>{score || '-'}</p>
                        </div>
                      ))}
                    </div>

                    {/* Problems */}
                    {audit.problemes && audit.problemes.length > 0 && (
                      <div className="mt-4 border-t pt-4">
                        <p className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          {audit.problemes.length} problème(s) détecté(s)
                        </p>
                        <ul className="space-y-1">
                          {audit.problemes.slice(0, 3).map((p, i) => (
                            <li key={i} className="text-sm text-gray-600">
                              <span
                                className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                  p.severite === 'haute' ? 'bg-red-500' : p.severite === 'moyenne' ? 'bg-yellow-500' : 'bg-blue-500'
                                }`}
                              />
                              {p.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Recommandations Tab */}
        {activeTab === 'recommandations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Recommandations IA</h2>
              <button
                onClick={handleGenerateRecommandations}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Générer des recommandations
              </button>
            </div>

            <div className="grid gap-4">
              {recommandations.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucune recommandation. Cliquez pour en générer.</p>
                </div>
              ) : (
                recommandations.map((rec) => (
                  <div key={rec.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPrioriteColor(rec.priorite)}`}>
                          {rec.priorite}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">{rec.type}</span>
                      </div>
                      {getStatutBadge(rec.statut)}
                    </div>

                    <h3 className="font-semibold mb-2">{rec.titre}</h3>
                    <p className="text-sm text-gray-600 mb-3">{rec.description}</p>

                    {rec.actions_suggerees && rec.actions_suggerees.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Actions suggérées:</p>
                        <ul className="text-sm text-gray-600 list-disc list-inside">
                          {rec.actions_suggerees.map((action, i) => (
                            <li key={i}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {rec.impact_estime && <span>Impact: {rec.impact_estime}</span>}
                        <span>Effort: {rec.effort}</span>
                      </div>

                      {rec.statut === 'ouverte' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateRecommandationStatus(rec.id, 'en_cours')}
                            className="px-3 py-1 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 text-sm"
                          >
                            Commencer
                          </button>
                          <button
                            onClick={() => handleUpdateRecommandationStatus(rec.id, 'ignoree')}
                            className="px-3 py-1 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 text-sm"
                          >
                            Ignorer
                          </button>
                        </div>
                      )}
                      {rec.statut === 'en_cours' && (
                        <button
                          onClick={() => handleUpdateRecommandationStatus(rec.id, 'terminee')}
                          className="px-3 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm"
                        >
                          Marquer terminée
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Modal: Add Mot-clé */}
        {showMotCleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Ajouter un mot-clé</h3>
                <button onClick={() => setShowMotCleModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot-clé</label>
                  <input
                    type="text"
                    value={motCleForm.mot_cle}
                    onChange={(e) => setMotCleForm({ ...motCleForm, mot_cle: e.target.value })}
                    placeholder="ex: coiffure afro Paris"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie (optionnel)</label>
                  <input
                    type="text"
                    value={motCleForm.categorie}
                    onChange={(e) => setMotCleForm({ ...motCleForm, categorie: e.target.value })}
                    placeholder="ex: tresses, locks, soins"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="cible"
                    checked={motCleForm.cible}
                    onChange={(e) => setMotCleForm({ ...motCleForm, cible: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="cible" className="text-sm text-gray-700">
                    Mot-clé prioritaire (cible)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowMotCleModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddMotCle}
                  disabled={analyzing || !motCleForm.mot_cle}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyser et ajouter
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Launch Audit */}
        {showAuditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Lancer un audit SEO</h3>
                <button onClick={() => setShowAuditModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL de la page</label>
                  <input
                    type="url"
                    value={auditUrl}
                    onChange={(e) => setAuditUrl(e.target.value)}
                    placeholder="https://votre-site.com/page"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button
                  onClick={handleLaunchAudit}
                  disabled={analyzing || !auditUrl}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4" />
                      Lancer l'audit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Generate Article */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Générer un article avec IA</h3>
                <button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setGeneratedArticle(null);
                    setGenerateSubject('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!generatedArticle ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sujet de l'article</label>
                      <input
                        type="text"
                        value={generateSubject}
                        onChange={(e) => setGenerateSubject(e.target.value)}
                        placeholder="ex: Comment entretenir ses locks au quotidien"
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>

                    {motsClés.filter((m) => m.cible).length > 0 && (
                      <div className="text-sm text-gray-500">
                        <p className="font-medium mb-1">Mots-clés cibles qui seront intégrés:</p>
                        <div className="flex flex-wrap gap-2">
                          {motsClés
                            .filter((m) => m.cible)
                            .map((m) => (
                              <span key={m.id} className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs">
                                {m.mot_cle}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setShowGenerateModal(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleGenerateArticle}
                      disabled={generating || !generateSubject}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Génération en cours...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          Générer
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                      <p className="text-lg font-semibold">{generatedArticle.titre}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          {generatedArticle.meta_title}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          {generatedArticle.meta_description}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contenu (aperçu)</label>
                      <div className="bg-gray-50 p-4 rounded max-h-64 overflow-y-auto prose prose-sm">
                        <pre className="whitespace-pre-wrap text-sm">
                          {generatedArticle.contenu?.substring(0, 1000)}...
                        </pre>
                      </div>
                    </div>

                    {generatedArticle.mots_cles_suggeres && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mots-clés suggérés</label>
                        <div className="flex flex-wrap gap-2">
                          {generatedArticle.mots_cles_suggeres.map((mc: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                              {mc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => {
                        setGeneratedArticle(null);
                        setGenerateSubject('');
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Recommencer
                    </button>
                    <button
                      onClick={handleSaveGeneratedArticle}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      <Save className="w-4 h-4" />
                      Sauvegarder comme brouillon
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
