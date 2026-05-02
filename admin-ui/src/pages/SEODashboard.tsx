/**
 * SEO Dashboard - Business Plan
 * Vue d'ensemble SEO avec KPIs et recommandations
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';
import {
  Search,
  TrendingUp,
  FileText,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  CheckCircle,
  Filter,
  RotateCcw,
  Loader2,
  Crosshair
} from 'lucide-react';

interface SEOStats {
  totalKeywords: number;
  keywordsTop10: number;
  totalArticles: number;
  articlesPublies: number;
  totalRecommendations: number;
  recommendationsPending: number;
}

interface Keyword {
  id: string;
  mot_cle: string;
  position_actuelle: number | null;
  url_cible: string;
  variation?: number;
  last_checked?: string;
}

interface Recommendation {
  id: number;
  type: string;
  titre: string;
  description: string;
  priorite: string;
  impact_estime: string;
  statut: string;
  created_at: string;
}

export default function SEODashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SEOStats | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingPositions, setCheckingPositions] = useState<Set<string>>(new Set());

  // Filters for keywords
  const [keywordFilters, setKeywordFilters] = useState({
    search: '',
    positionRange: 'all', // all, top10, top30, beyond30
    trend: 'all', // all, improving, declining, stable
  });

  // Filters for recommendations
  const [recoFilters, setRecoFilters] = useState({
    priority: 'all', // all, high, medium, low
    type: 'all', // all, technical, content, backlinks, local
    status: 'pending', // pending, appliquee, ignoree, all
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all data in parallel
      const [statsData, keywordsData, recoData] = await Promise.all([
        api.get<SEOStats>('/admin/seo/stats'),
        api.get<Keyword[]>('/admin/seo/keywords'),
        api.get<Recommendation[]>('/admin/seo/recommendations')
      ]);

      if (statsData) setStats(statsData);
      if (Array.isArray(keywordsData)) setKeywords(keywordsData);
      if (Array.isArray(recoData)) setRecommendations(recoData);

    } catch (err) {
      setError('Impossible de charger les données SEO. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecommendation = async (reco: Recommendation) => {
    try {
      // Marquer comme appliquee
      await api.patch(`/admin/seo/recommendations/${reco.id}`, { statut: 'appliquee' });
      fetchDashboardData();

      // Naviguer vers la page pertinente selon le type de reco
      const titre = reco.titre.toLowerCase();
      if (titre.includes('mots-cl') && titre.includes('non exploit')) {
        // Mots-cles non exploites → creer un article
        navigate('/seo/articles?action=new');
      } else if (titre.includes('titres trop longs') || titre.includes('meta description')) {
        // Titres longs ou meta manquantes → liste articles pour editer
        navigate('/seo/articles');
      } else if (titre.includes('largir') && titre.includes('mots-cl')) {
        // Elargir suivi mots-cles → section mots-cles (scroll)
        const keywordsSection = document.querySelector('[data-section="keywords"]');
        if (keywordsSection) keywordsSection.scrollIntoView({ behavior: 'smooth' });
      } else if (titre.includes('publier plus') || titre.includes('contenu')) {
        // Publier regulierement → creer un article
        navigate('/seo/articles?action=new');
      } else if (titre.includes('page 2') || titre.includes('optimiser')) {
        // Positions page 2 → articles pour optimiser
        navigate('/seo/articles');
      }
    } catch (err) {
      setError('Impossible d\'appliquer la recommandation. Veuillez réessayer.');
    }
  };

  const handleDismissRecommendation = async (recoId: number) => {
    try {
      await api.patch(`/admin/seo/recommendations/${recoId}`, { statut: 'ignoree' });
      fetchDashboardData();
    } catch (err) {
      setError('Impossible d\'ignorer la recommandation. Veuillez réessayer.');
    }
  };

  const handleCheckPosition = async (keywordId: string) => {
    setCheckingPositions(prev => new Set(prev).add(keywordId));
    try {
      await api.post(`/admin/seo/keywords/${keywordId}/check-position`);
      await fetchDashboardData();
    } catch (err) {
      setError('Erreur lors de la vérification de position');
    } finally {
      setCheckingPositions(prev => {
        const next = new Set(prev);
        next.delete(keywordId);
        return next;
      });
    }
  };

  const handleCheckAllPositions = async () => {
    for (const kw of keywords) {
      await handleCheckPosition(kw.id);
    }
  };

  // Filtered keywords
  const filteredKeywords = useMemo(() => {
    return keywords
      .filter(k => {
        // Search filter
        if (keywordFilters.search && !k.mot_cle.toLowerCase().includes(keywordFilters.search.toLowerCase())) {
          return false;
        }

        // Position range filter
        const pos = k.position_actuelle || 100;
        if (keywordFilters.positionRange === 'top10' && pos > 10) return false;
        if (keywordFilters.positionRange === 'top30' && (pos <= 10 || pos > 30)) return false;
        if (keywordFilters.positionRange === 'beyond30' && pos <= 30) return false;

        // Trend filter
        const variation = k.variation || 0;
        if (keywordFilters.trend === 'improving' && variation >= 0) return false; // lower is better
        if (keywordFilters.trend === 'declining' && variation <= 0) return false;
        if (keywordFilters.trend === 'stable' && variation !== 0) return false;

        return true;
      })
      .sort((a, b) => (a.position_actuelle || 100) - (b.position_actuelle || 100));
  }, [keywords, keywordFilters]);

  // Filtered recommendations
  const filteredRecos = useMemo(() => {
    return recommendations.filter(r => {
      // Status filter
      if (recoFilters.status !== 'all' && r.statut !== recoFilters.status) return false;

      // Priority filter
      if (recoFilters.priority !== 'all' && r.priorite !== recoFilters.priority) return false;

      // Type filter
      if (recoFilters.type !== 'all' && r.type !== recoFilters.type) return false;

      return true;
    });
  }, [recommendations, recoFilters]);

  const resetKeywordFilters = () => {
    setKeywordFilters({ search: '', positionRange: 'all', trend: 'all' });
  };

  const resetRecoFilters = () => {
    setRecoFilters({ priority: 'all', type: 'all', status: 'pending' });
  };

  const hasActiveKeywordFilters = keywordFilters.search || keywordFilters.positionRange !== 'all' || keywordFilters.trend !== 'all';
  const hasActiveRecoFilters = recoFilters.priority !== 'all' || recoFilters.type !== 'all' || recoFilters.status !== 'pending';

  const getRecoActionLabel = (reco: Recommendation) => {
    const titre = reco.titre.toLowerCase();
    if (titre.includes('mots-cl') && titre.includes('non exploit')) return 'Creer un article';
    if (titre.includes('titres trop longs')) return 'Editer les articles';
    if (titre.includes('meta description')) return 'Editer les articles';
    if (titre.includes('largir') && titre.includes('mots-cl')) return 'Ajouter mots-cles';
    if (titre.includes('publier plus')) return 'Creer un article';
    if (titre.includes('page 2') || titre.includes('optimiser')) return 'Voir les articles';
    return 'Appliquer';
  };

  const getPriorityColor = (priorite: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[priorite] || colors.medium;
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      technical: '🔧',
      content: '📝',
      backlinks: '🔗',
      local: '📍'
    };
    return icons[type] || '💡';
  };

  const getPositionTrend = (keyword: Keyword) => {
    if (!keyword.variation || keyword.variation === 0) {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
    if (keyword.variation < 0) {
      return (
        <span className="flex items-center text-green-600">
          <ArrowUp className="w-4 h-4" />
          <span className="text-xs ml-1">+{Math.abs(keyword.variation)}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center text-red-600">
        <ArrowDown className="w-4 h-4" />
        <span className="text-xs ml-1">-{keyword.variation}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard SEO</h1>
          <p className="text-gray-500">
            Suivez vos performances de referencement
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/seo/articles')} size="sm">
            <FileText className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Articles</span> SEO
          </Button>
          <Button variant="outline" onClick={fetchDashboardData} size="sm">
            <RefreshCw className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-blue-100 rounded-lg shrink-0">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-gray-500 truncate">Mots-clés suivis</div>
              <div className="text-2xl font-bold">{stats?.totalKeywords || 0}</div>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-green-100 rounded-lg shrink-0">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-gray-500 truncate">Top 10 Google</div>
              <div className="text-2xl font-bold text-green-600">
                {stats?.keywordsTop10 || 0}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-purple-100 rounded-lg shrink-0">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-gray-500 truncate">Articles publiés</div>
              <div className="text-2xl font-bold text-purple-600">
                {stats?.articlesPublies || 0}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-orange-100 rounded-lg shrink-0">
              <Lightbulb className="w-5 h-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-gray-500 truncate">Recommandations</div>
              <div className="text-2xl font-bold text-orange-600">
                {stats?.recommendationsPending || 0}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recommandations SEO */}
        <Card className="p-4">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-orange-500" />
            Recommandations SEO
          </h3>

          {/* Recommendation Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={recoFilters.status}
              onChange={(e) => setRecoFilters({ ...recoFilters, status: e.target.value })}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Tous statuts</option>
              <option value="pending">En attente</option>
              <option value="appliquee">Appliquées</option>
              <option value="ignoree">Ignorées</option>
            </select>

            <select
              value={recoFilters.priority}
              onChange={(e) => setRecoFilters({ ...recoFilters, priority: e.target.value })}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Toutes priorités</option>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </select>

            <select
              value={recoFilters.type}
              onChange={(e) => setRecoFilters({ ...recoFilters, type: e.target.value })}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Tous types</option>
              <option value="technical">🔧 Technique</option>
              <option value="content">📝 Contenu</option>
              <option value="backlinks">🔗 Backlinks</option>
              <option value="local">📍 Local</option>
            </select>

            {hasActiveRecoFilters && (
              <Button onClick={resetRecoFilters} variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}
          </div>

          {filteredRecos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-300" />
              <p>{hasActiveRecoFilters ? 'Aucune recommandation avec ces filtres' : 'Toutes les recommandations ont ete traitees'}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {filteredRecos.slice(0, 10).map(reco => (
                <div
                  key={reco.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{getTypeIcon(reco.type)}</span>
                        <span className="font-medium text-sm">{reco.titre}</span>
                        <Badge className={getPriorityColor(reco.priorite)}>
                          {reco.priorite}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {reco.description}
                      </p>
                      {reco.impact_estime && (
                        <p className="text-xs text-blue-600 mt-1">
                          Impact: {reco.impact_estime}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleApplyRecommendation(reco)}
                    >
                      {getRecoActionLabel(reco)}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-gray-400"
                      onClick={() => handleDismissRecommendation(reco.id)}
                    >
                      Ignorer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Keywords */}
        <Card className="p-4" data-section="keywords">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-500" />
              Positions mots-cles
            </h3>
            {keywords.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={checkingPositions.size > 0}
                onClick={handleCheckAllPositions}
              >
                {checkingPositions.size > 0 ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Crosshair className="w-3 h-3 mr-1" />
                )}
                Verifier tout
              </Button>
            )}
          </div>

          {/* Keyword Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b">
            <Filter className="w-4 h-4 text-gray-400" />

            <div className="relative flex-1 min-w-[120px] max-w-[150px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher..."
                value={keywordFilters.search}
                onChange={(e) => setKeywordFilters({ ...keywordFilters, search: e.target.value })}
                className="pl-7 h-7 text-xs"
              />
            </div>

            <select
              value={keywordFilters.positionRange}
              onChange={(e) => setKeywordFilters({ ...keywordFilters, positionRange: e.target.value })}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes positions</option>
              <option value="top10">Top 10</option>
              <option value="top30">11-30</option>
              <option value="beyond30">&gt; 30</option>
            </select>

            <select
              value={keywordFilters.trend}
              onChange={(e) => setKeywordFilters({ ...keywordFilters, trend: e.target.value })}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes tendances</option>
              <option value="improving">↑ En hausse</option>
              <option value="declining">↓ En baisse</option>
              <option value="stable">→ Stable</option>
            </select>

            {hasActiveKeywordFilters && (
              <Button onClick={resetKeywordFilters} variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}
          </div>

          {keywords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Aucun mot-cle suivi</p>
              <p className="text-xs mt-1">Ajoutez des mots-cles pour suivre vos positions</p>
            </div>
          ) : filteredKeywords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Aucun mot-clé avec ces filtres</p>
              <Button variant="link" onClick={resetKeywordFilters} className="mt-2 text-xs">
                Effacer les filtres
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">Mot-cle</th>
                    <th className="pb-2 text-center">Position</th>
                    <th className="pb-2 text-center">Tendance</th>
                    <th className="pb-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeywords.slice(0, 10).map(keyword => (
                      <tr key={keyword.id} className="border-b last:border-0">
                        <td className="py-2">
                          <div className="font-medium">{keyword.mot_cle}</div>
                          {keyword.url_cible && (
                            <div className="text-xs text-gray-400 truncate max-w-[150px]">
                              {keyword.url_cible}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {keyword.position_actuelle ? (
                            <span className={`font-bold ${
                              keyword.position_actuelle <= 10
                                ? 'text-green-600'
                                : keyword.position_actuelle <= 30
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                              #{keyword.position_actuelle}
                            </span>
                          ) : keyword.last_checked ? (
                            <span className="text-xs text-gray-400">Non classe</span>
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {getPositionTrend(keyword)}
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => handleCheckPosition(keyword.id)}
                            disabled={checkingPositions.has(keyword.id)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                            aria-label="Verifier la position"
                          >
                            {checkingPositions.has(keyword.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Crosshair className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Conseils rapides */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50">
        <h3 className="font-semibold mb-3">Conseils SEO du jour</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-lg">📝</span>
            <div>
              <div className="font-medium">Contenu regulier</div>
              <p className="text-gray-600 text-xs">
                Publiez au moins 2 articles par semaine pour ameliorer votre visibilite
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">🔗</span>
            <div>
              <div className="font-medium">Liens internes</div>
              <p className="text-gray-600 text-xs">
                Liez vos articles entre eux pour renforcer votre maillage interne
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">📍</span>
            <div>
              <div className="font-medium">SEO local</div>
              <p className="text-gray-600 text-xs">
                Optimisez votre fiche Google My Business pour le referencement local
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
