/**
 * Blog article — Page publique d'un article SEO
 * Route publique /blog/:slug (pas d'auth requise)
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, FileText } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Article {
  id: number;
  titre: string;
  slug: string;
  contenu: string;
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

/**
 * Sanitize et formate le markdown pour affichage securise
 * (meme logique que SEOArticles.tsx)
 */
function sanitizeAndFormatMarkdown(content: string): string {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return escaped
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-6 mb-3 text-gray-800">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    .replace(/\n/g, '<br/>');
}

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (slug) fetchArticle(slug);
  }, [slug]);

  const fetchArticle = async (articleSlug: string) => {
    try {
      const tenantId = getTenantId();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      const res = await fetch(`${API_BASE}/blog/articles/${encodeURIComponent(articleSlug)}`, { headers });

      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('Erreur chargement article');

      const data = await res.json();
      setArticle(data.article);

      // Meta tags dynamiques
      if (data.article) {
        document.title = data.article.titre;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', data.article.meta_description);
        } else {
          const meta = document.createElement('meta');
          meta.name = 'description';
          meta.content = data.article.meta_description;
          document.head.appendChild(meta);
        }
      }
    } catch (err) {
      console.error('[BLOG ARTICLE]', err);
      setNotFound(true);
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

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-12 text-center max-w-md">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Article introuvable</h2>
          <p className="text-gray-500 mb-6">Cet article n'existe pas ou n'est plus disponible.</p>
          <Link to="/blog">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au blog
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <article className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
        {/* Navigation */}
        <Link
          to="/blog"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour au blog
        </Link>

        {/* Header article */}
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
            {article.titre}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mt-4">
            {article.date_publication && (
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date(article.date_publication).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {(article.mots_cles_cibles || []).map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>

          {article.meta_description && (
            <p className="text-lg text-gray-600 mt-4 italic">
              {article.meta_description}
            </p>
          )}
        </header>

        {/* Contenu article */}
        <div
          className="prose prose-gray max-w-none text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: sanitizeAndFormatMarkdown(article.contenu),
          }}
        />

        {/* CTA Réserver */}
        <div className="mt-12 p-6 bg-cyan-50 rounded-lg text-center border border-cyan-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Envie de prendre rendez-vous ?
          </h3>
          <p className="text-gray-600 mb-4">
            Réservez en ligne en quelques clics
          </p>
          <Link to="/activites">
            <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
              Réserver maintenant
            </Button>
          </Link>
        </div>

        {/* Lien retour */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link
            to="/blog"
            className="inline-flex items-center text-sm text-cyan-600 hover:text-cyan-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voir tous les articles
          </Link>
        </div>
      </article>
    </div>
  );
}
