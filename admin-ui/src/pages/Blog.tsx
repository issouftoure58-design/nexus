/**
 * Blog public — Liste des articles SEO publiés
 * Route publique /blog (pas d'auth requise)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowLeft, Calendar } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface BlogArticle {
  id: number;
  titre: string;
  slug: string;
  meta_description: string;
  mots_cles_cibles: string[];
  date_publication: string | null;
}

/**
 * Récupère le tenant_id depuis le JWT en localStorage
 */
function getTenantId(): string | null {
  const token =
    localStorage.getItem('nexus_admin_token') ||
    (() => {
      const slug = localStorage.getItem('nexus_current_tenant');
      return slug ? localStorage.getItem(`nexus_admin_token_${slug}`) : null;
    })();

  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.tenant_id?.toString() || null;
  } catch {
    return null;
  }
}

export default function Blog() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Blog';
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const tenantId = getTenantId();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      const res = await fetch(`${API_BASE}/blog/articles`, { headers });
      if (!res.ok) throw new Error('Erreur chargement articles');

      const data = await res.json();
      setArticles(data.articles || []);
    } catch (err) {
      setError('Impossible de charger les articles');
      console.error('[BLOG]', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Blog</h1>
          <p className="text-gray-500 mt-1">Nos derniers articles et conseils</p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Liste articles */}
        {articles.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">Aucun article pour le moment</p>
            <p className="text-gray-400 text-sm mt-1">Revenez bientôt pour découvrir nos contenus</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {articles.map(article => (
              <Link key={article.id} to={`/blog/${article.slug}`} className="block group">
                <Card className="p-6 hover:shadow-md transition-shadow">
                  <h2 className="text-xl font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors">
                    {article.titre}
                  </h2>

                  <p className="text-gray-600 mt-2 line-clamp-2">
                    {article.meta_description}
                  </p>

                  <div className="flex items-center justify-between mt-4">
                    {/* Date */}
                    {article.date_publication && (
                      <div className="flex items-center text-sm text-gray-400">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(article.date_publication).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </div>
                    )}

                    {/* Mots-clés */}
                    <div className="flex gap-2 flex-wrap">
                      {(article.mots_cles_cibles || []).slice(0, 3).map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
