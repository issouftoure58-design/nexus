/**
 * SEO Dashboard - Business Plan
 * Vue d'ensemble SEO avec KPIs et recommandations
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  TrendingUp,
  FileText,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  CheckCircle
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
  id: number;
  mot_cle: string;
  position_actuelle: number | null;
  url_cible: string;
  variation?: number;
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
  const [stats, setStats] = useState<SEOStats | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` };

      // Fetch all data in parallel
      const [statsRes, keywordsRes, recoRes] = await Promise.all([
        fetch('/api/admin/seo/stats', { headers }),
        fetch('/api/admin/seo/keywords', { headers }),
        fetch('/api/admin/seo/recommendations', { headers })
      ]);

      const statsData = await statsRes.json();
      const keywordsData = await keywordsRes.json();
      const recoData = await recoRes.json();

      if (statsData) setStats(statsData);
      if (Array.isArray(keywordsData)) setKeywords(keywordsData);
      if (Array.isArray(recoData)) setRecommendations(recoData);

    } catch (error) {
      console.error('Erreur fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecommendation = async (recoId: number) => {
    try {
      await fetch(`/api/admin/seo/recommendations/${recoId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statut: 'appliquee' })
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Erreur application recommandation:', error);
    }
  };

  const handleDismissRecommendation = async (recoId: number) => {
    try {
      await fetch(`/api/admin/seo/recommendations/${recoId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statut: 'ignoree' })
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Erreur dismiss recommandation:', error);
    }
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
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const pendingRecos = recommendations.filter(r => r.statut === 'pending');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Dashboard SEO</h1>
          <p className="text-gray-500">
            Suivez vos performances de referencement
          </p>
        </div>
        <Button variant="outline" onClick={fetchDashboardData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Mots-cles suivis</div>
              <div className="text-2xl font-bold">{stats?.totalKeywords || 0}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Top 10 Google</div>
              <div className="text-2xl font-bold text-green-600">
                {stats?.keywordsTop10 || 0}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Articles publies</div>
              <div className="text-2xl font-bold text-purple-600">
                {stats?.articlesPublies || 0}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Lightbulb className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Recommandations</div>
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

          {pendingRecos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-300" />
              <p>Toutes les recommandations ont ete traitees</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {pendingRecos.slice(0, 5).map(reco => (
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
                      onClick={() => handleApplyRecommendation(reco.id)}
                    >
                      Appliquer
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
        <Card className="p-4">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" />
            Positions mots-cles
          </h3>

          {keywords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Aucun mot-cle suivi</p>
              <p className="text-xs mt-1">Ajoutez des mots-cles pour suivre vos positions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">Mot-cle</th>
                    <th className="pb-2 text-center">Position</th>
                    <th className="pb-2 text-center">Tendance</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords
                    .filter(k => k.position_actuelle !== null)
                    .sort((a, b) => (a.position_actuelle || 100) - (b.position_actuelle || 100))
                    .slice(0, 10)
                    .map(keyword => (
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
                          <span className={`font-bold ${
                            (keyword.position_actuelle || 100) <= 10
                              ? 'text-green-600'
                              : (keyword.position_actuelle || 100) <= 30
                              ? 'text-yellow-600'
                              : 'text-gray-600'
                          }`}>
                            {keyword.position_actuelle || '-'}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          {getPositionTrend(keyword)}
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
