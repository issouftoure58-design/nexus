/**
 * SEO Articles - Business Plan
 * Gestion et génération d'articles SEO via IA
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FileText, Eye, Trash2, Send, AlertCircle, X } from 'lucide-react';
import { api } from '../lib/api';

/**
 * 🔒 SECURITY: Sanitize HTML to prevent XSS attacks
 * Escapes HTML entities before applying safe markdown transformations
 */
function sanitizeAndFormatMarkdown(content: string): string {
  // Step 1: Escape ALL HTML to prevent XSS
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Step 2: Apply safe markdown transformations (on escaped content)
  return escaped
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

interface Article {
  id: number;
  titre: string;
  slug: string;
  meta_description: string;
  contenu: string;
  mot_cle_principal: string;
  mots_cles_secondaires: string[];
  statut: 'brouillon' | 'publie' | 'archive';
  date_publication: string | null;
  lectures: number;
  partages: number;
  created_at: string;
}

interface ArticleIdea {
  titre: string;
  mot_cle: string;
  angle: string;
  public: string;
}

export default function SEOArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [showGenerator, setShowGenerator] = useState(false);
  const [_showEditor, _setShowEditor] = useState<number | null>(null);
  const [ideas, setIdeas] = useState<ArticleIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

  const [formData, setFormData] = useState({
    mot_cle_principal: '',
    mots_cles_secondaires: '',
    longueur: 'moyen'
  });

  const [generating, setGenerating] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const data = await api.get('/admin/seo/articles');
      if (Array.isArray(data)) {
        setArticles(data);
      }
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Erreur lors du chargement des articles' });
    }
  };

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    try {
      const result = await api.get<{ ideas?: ArticleIdea[] }>('/admin/seo/articles/ideas');
      if (result.ideas) {
        setIdeas(result.ideas);
      }
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Erreur lors du chargement des idees' });
    } finally {
      setLoadingIdeas(false);
    }
  };

  const handleGenerate = async () => {
    if (!formData.mot_cle_principal) {
      setFeedbackMessage({ type: 'error', text: 'Veuillez entrer un mot-cle principal' });
      return;
    }

    setGenerating(true);
    setFeedbackMessage(null);
    try {
      const result = await api.post<{ success?: boolean; error?: string }>('/admin/seo/articles/generate', {
        mot_cle_principal: formData.mot_cle_principal,
        mots_cles_secondaires: formData.mots_cles_secondaires
          .split(',')
          .map(k => k.trim())
          .filter(Boolean),
        longueur: formData.longueur
      });

      if (result.success) {
        setFeedbackMessage({ type: 'success', text: 'Article genere avec succes !' });
        setShowGenerator(false);
        setFormData({ mot_cle_principal: '', mots_cles_secondaires: '', longueur: 'moyen' });
        setIdeas([]);
        fetchArticles();
      } else {
        setFeedbackMessage({ type: 'error', text: result.error || 'Erreur generation article' });
      }
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Erreur generation article' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (articleId: number) => {
    try {
      await api.post(`/admin/seo/articles/${articleId}/publier`, {});
      setFeedbackMessage({ type: 'success', text: 'Article publie avec succes' });
      fetchArticles();
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Erreur lors de la publication' });
    }
  };

  const handleDelete = async (articleId: number) => {
    if (!confirm('Supprimer cet article ?')) return;

    try {
      await api.delete(`/admin/seo/articles/${articleId}`);
      setFeedbackMessage({ type: 'success', text: 'Article supprime' });
      fetchArticles();
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Erreur lors de la suppression' });
    }
  };

  const getStatusBadge = (statut: string) => {
    const colors: Record<string, string> = {
      brouillon: 'bg-yellow-100 text-yellow-800',
      publie: 'bg-green-100 text-green-800',
      archive: 'bg-gray-100 text-gray-800'
    };
    return colors[statut] || colors.brouillon;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Articles SEO</h1>
          <p className="text-gray-500">
            Generez du contenu optimise pour le referencement
          </p>
        </div>
        <Button onClick={() => setShowGenerator(true)}>
          <Sparkles className="w-4 h-4 mr-2" />
          Generer avec IA
        </Button>
      </div>

      {/* Feedback Message */}
      {feedbackMessage && (
        <div className={`p-3 rounded-lg flex items-center justify-between ${
          feedbackMessage.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            {feedbackMessage.text}
          </div>
          <button onClick={() => setFeedbackMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total articles</div>
          <div className="text-2xl font-bold">{articles.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Publies</div>
          <div className="text-2xl font-bold text-green-600">
            {articles.filter(a => a.statut === 'publie').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Brouillons</div>
          <div className="text-2xl font-bold text-yellow-600">
            {articles.filter(a => a.statut === 'brouillon').length}
          </div>
        </Card>
      </div>

      {/* Generateur */}
      {showGenerator && (
        <Card className="p-6 space-y-4 border-2 border-blue-200">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg">Generer un article SEO</h3>
            <Button variant="outline" size="sm" onClick={() => setShowGenerator(false)}>
              Fermer
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={fetchIdeas}
            disabled={loadingIdeas}
            className="w-full"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {loadingIdeas ? 'Chargement...' : 'Obtenir des idees d\'articles'}
          </Button>

          {ideas.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Idees suggerees :</p>
              {ideas.map((idea, i) => (
                <Card
                  key={i}
                  className="p-3 cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => setFormData({
                    ...formData,
                    mot_cle_principal: idea.mot_cle
                  })}
                >
                  <div className="font-medium">{idea.titre}</div>
                  <div className="text-sm text-gray-500">
                    Mot-cle : <span className="text-blue-600">{idea.mot_cle}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {idea.angle} - {idea.public}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Mot-cle principal *</label>
              <Input
                placeholder="Ex: coiffeur afro paris"
                value={formData.mot_cle_principal}
                onChange={(e) => setFormData({ ...formData, mot_cle_principal: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Mots-cles secondaires</label>
              <Input
                placeholder="Separes par virgules (ex: tresses, locks, soins)"
                value={formData.mots_cles_secondaires}
                onChange={(e) => setFormData({ ...formData, mots_cles_secondaires: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Longueur</label>
              <select
                className="w-full p-2 border rounded-md"
                value={formData.longueur}
                onChange={(e) => setFormData({ ...formData, longueur: e.target.value })}
              >
                <option value="court">Court (~500 mots)</option>
                <option value="moyen">Moyen (~1000 mots)</option>
                <option value="long">Long (~2000 mots)</option>
              </select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !formData.mot_cle_principal}
            className="w-full"
          >
            {generating ? (
              <>Génération en cours...</>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generer l'article
              </>
            )}
          </Button>
        </Card>
      )}

      {/* Liste articles */}
      <div className="space-y-4">
        {articles.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucun article pour le moment</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowGenerator(true)}
            >
              Creer votre premier article
            </Button>
          </Card>
        ) : (
          articles.map(article => (
            <Card key={article.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{article.titre}</h3>
                    <Badge className={getStatusBadge(article.statut)}>
                      {article.statut}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">
                    {article.meta_description}
                  </p>
                  <div className="flex gap-2 flex-wrap text-xs">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {article.mot_cle_principal}
                    </span>
                    {article.mots_cles_secondaires?.slice(0, 3).map((kw, i) => (
                      <span key={i} className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {kw}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>{new Date(article.created_at).toLocaleDateString()}</span>
                    <span>{article.lectures} lectures</span>
                    <span>{article.partages} partages</span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {article.statut === 'brouillon' && (
                    <Button
                      size="sm"
                      onClick={() => handlePublish(article.id)}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Publier
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(article.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal preview article */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedArticle.titre}</h2>
                <p className="text-sm text-gray-500">{selectedArticle.meta_description}</p>
              </div>
              <Button variant="outline" onClick={() => setSelectedArticle(null)}>
                Fermer
              </Button>
            </div>
            <div className="prose max-w-none">
              {/* 🔒 SECURITY: Use sanitized HTML to prevent XSS */}
              <div
                dangerouslySetInnerHTML={{
                  __html: sanitizeAndFormatMarkdown(selectedArticle.contenu)
                }}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
