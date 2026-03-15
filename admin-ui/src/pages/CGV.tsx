/**
 * Page CGV — Conditions Générales de Vente NEXUS
 * Route publique /cgv (pas d'auth requise)
 */

import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Article {
  numero: number;
  titre: string;
  contenu: string;
}

interface CGVData {
  version: string;
  updated_at: string;
  articles: Article[];
}

export default function CGV() {
  const [cgv, setCgv] = useState<CGVData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CGVData>('/api/cgv')
      .then(data => setCgv(data))
      .catch(() => setCgv(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <Link to="/signup" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Retour</span>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conditions Générales de Vente</h1>
            <p className="text-sm text-gray-500">
              Version {cgv?.version || '1.0'} — Mise à jour le {cgv?.updated_at || '2026-03-08'}
            </p>
          </div>
        </div>

        {/* Articles */}
        <div className="space-y-8">
          {cgv?.articles.map(article => (
            <section key={article.numero} className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Article {article.numero} — {article.titre}
              </h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{article.contenu}</p>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-400 text-sm">
          <p>NEXUS SAS — Plateforme SaaS de gestion d'activité</p>
          <p className="mt-1">
            En créant un compte NEXUS, vous acceptez les présentes conditions générales de vente.
          </p>
        </div>
      </div>
    </div>
  );
}
