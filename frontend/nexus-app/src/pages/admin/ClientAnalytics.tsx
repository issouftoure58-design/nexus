/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   CLIENT ANALYTICS - Vue 360° d'un client                          ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   - KPIs : CA, Panier moyen, NB RDV, LTV                          ║
 * ║   - Score engagement + Risque churn                                ║
 * ║   - Services préférés                                              ║
 * ║   - Historique RDV                                                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  TrendingUp,
  AlertTriangle,
  Star,
  DollarSign,
  Calendar,
  Award,
  ArrowLeft,
  User,
  Phone,
  Mail,
  Clock,
  Tag,
  RefreshCw,
} from 'lucide-react';

interface ClientAnalyticsData {
  client: {
    id: number;
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    created_at: string;
    tags: Array<{ id: string; nom: string; couleur: string }>;
  };
  analytics: {
    nb_rdv: number;
    nb_rdv_termines: number;
    ca_total: number;
    panier_moyen: number;
    ltv_estimee: number;
    frequence_moyenne_jours: number | null;
    services_preferes: Array<{ nom: string; count: number }>;
    score_engagement: number;
    churn: {
      score: number;
      risque: string;
      raisons: string[];
      couleur: string;
    };
  };
  rdv_historique: Array<{
    id: string;
    date_rdv: string;
    heure: string;
    prix: number;
    statut: string;
    services: { nom: string } | null;
  }>;
}

export default function ClientAnalytics() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;

  const [data, setData] = useState<ClientAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (clientId) {
      chargerAnalytics();
    }
  }, [clientId]);

  const chargerAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/crm/clients/${clientId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Erreur chargement');
      }
    } catch (err) {
      console.error('Erreur chargement analytics:', err);
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const rafraichirEngagement = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('admin_token');

      await fetch(`/api/crm/clients/${clientId}/update-engagement`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      await chargerAnalytics();
    } catch (err) {
      console.error('Erreur rafraîchissement:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'termine':
        return 'text-emerald-400 bg-emerald-500/20';
      case 'annule':
        return 'text-red-400 bg-red-500/20';
      case 'confirme':
        return 'text-blue-400 bg-blue-500/20';
      default:
        return 'text-amber-400 bg-amber-500/20';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            <p className="text-white/60">Chargement analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="w-16 h-16 text-red-400" />
          <p className="text-white/60">{error || 'Client non trouvé'}</p>
          <Link href="/admin/clients">
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition">
              Retour aux clients
            </button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const { client, analytics, rdv_historique } = data;
  const churn = analytics.churn;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/admin/clients">
              <button className="flex items-center gap-2 text-white/60 hover:text-white mb-4 transition">
                <ArrowLeft size={18} />
                Retour aux clients
              </button>
            </Link>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-white">
                  {client.prenom?.[0]}
                  {client.nom?.[0]}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {client.prenom} {client.nom}
                </h1>
                <div className="flex items-center gap-4 text-white/60 mt-1">
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={14} />
                      {client.email}
                    </span>
                  )}
                  {client.telephone && (
                    <span className="flex items-center gap-1">
                      <Phone size={14} />
                      {client.telephone}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {client.tags?.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {client.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1"
                        style={{
                          backgroundColor: tag.couleur + '20',
                          color: tag.couleur,
                          border: `1px solid ${tag.couleur}40`,
                        }}
                      >
                        <Tag size={12} />
                        {tag.nom}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={rafraichirEngagement}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Rafraîchir
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/50">CA Total</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {analytics.ca_total.toFixed(0)}€
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/50">Panier Moyen</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {analytics.panier_moyen.toFixed(0)}€
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/50">Nombre RDV</p>
                <p className="text-3xl font-bold text-white mt-1">{analytics.nb_rdv}</p>
                <p className="text-xs text-white/40">{analytics.nb_rdv_termines} terminés</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/50">LTV Estimée</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {analytics.ltv_estimee.toFixed(0)}€
                </p>
                {analytics.frequence_moyenne_jours && (
                  <p className="text-xs text-white/40">
                    ~{analytics.frequence_moyenne_jours}j entre visites
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Score Engagement */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              Score Engagement
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                    style={{ width: `${analytics.score_engagement}%` }}
                  />
                </div>
              </div>
              <span className="text-2xl font-bold text-white">{analytics.score_engagement}/100</span>
            </div>
            <p className="text-white/50 text-sm mt-3">
              {analytics.score_engagement >= 70
                ? 'Client très engagé'
                : analytics.score_engagement >= 40
                  ? 'Engagement modéré'
                  : 'Engagement faible'}
            </p>
          </div>

          {/* Risque Churn */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" style={{ color: churn.couleur }} />
              Risque Churn
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${churn.score}%`,
                      backgroundColor: churn.couleur,
                    }}
                  />
                </div>
              </div>
              <span className="text-2xl font-bold" style={{ color: churn.couleur }}>
                {churn.score}/100
              </span>
            </div>

            {churn.raisons.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-white/70 mb-2">Facteurs de risque :</p>
                <ul className="text-sm text-white/50 space-y-1">
                  {churn.raisons.map((raison, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: churn.couleur }}
                      />
                      {raison}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Services préférés + Historique */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Services préférés */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Services préférés</h2>
            {analytics.services_preferes.length > 0 ? (
              <div className="space-y-3">
                {analytics.services_preferes.map((service, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-white/70">{service.nom}</span>
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium">
                      {service.count}x
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm">Aucun service enregistré</p>
            )}
          </div>

          {/* Historique RDV */}
          <div className="lg:col-span-2 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-white/50" />
              Historique RDV (10 derniers)
            </h2>
            {rdv_historique.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {rdv_historique.map((rdv) => (
                  <div
                    key={rdv.id}
                    className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {rdv.services?.nom || 'Service inconnu'}
                      </p>
                      <p className="text-sm text-white/50">
                        {formatDate(rdv.date_rdv)} à {rdv.heure}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="font-bold text-white">{rdv.prix}€</span>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatutColor(rdv.statut)}`}
                      >
                        {rdv.statut}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm">Aucun RDV enregistré</p>
            )}
          </div>
        </div>

        {/* Informations client */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-white/50" />
            Informations client
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-white/50">Client depuis</p>
              <p className="text-white font-medium">{formatDate(client.created_at)}</p>
            </div>
            <div>
              <p className="text-white/50">Email</p>
              <p className="text-white font-medium">{client.email || '-'}</p>
            </div>
            <div>
              <p className="text-white/50">Téléphone</p>
              <p className="text-white font-medium">{client.telephone || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
