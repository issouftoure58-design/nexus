/**
 * Page Campagnes Marketing - A/B Testing + Analytics
 * Mission Marketing Automation Partie 2
 */

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  BarChart3,
  Plus,
  Play,
  Square,
  Trophy,
  TrendingUp,
  Mail,
  MessageSquare,
  Loader2,
  Eye,
  MousePointerClick,
  ShoppingCart,
  Send,
  X,
  ChevronRight,
  Trash2,
} from 'lucide-react';

interface Variante {
  nom: string;
  workflow_id?: string;
  poids: number;
  envois?: number;
  ouvertures?: number;
  clics?: number;
  conversions?: number;
  taux_ouverture?: string | number;
  taux_clic?: string | number;
  taux_conversion?: string | number;
}

interface Campagne {
  id: string;
  nom: string;
  description: string;
  type: 'email' | 'sms' | 'mixte';
  ab_testing_actif: boolean;
  variantes: Variante[];
  variante_gagnante?: string;
  statut: 'brouillon' | 'en_cours' | 'termine' | 'pause';
  date_debut?: string;
  date_fin?: string;
  total_envois: number;
  total_ouvertures: number;
  total_clics: number;
  total_conversions: number;
  analytics?: Variante[];
  created_at: string;
}

interface Analytics {
  periode: number;
  stats: {
    envois: number;
    ouvertures: number;
    clics: number;
    conversions: number;
    taux_ouverture: string | number;
    taux_clic: string | number;
    taux_conversion: string | number;
  };
  campagnes: {
    total: number;
    en_cours: number;
    terminees: number;
  };
  top_campagnes: Campagne[];
}

export default function Campagnes() {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Campagne | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'email' | 'sms' | 'mixte'>('email');
  const [abTestingActif, setAbTestingActif] = useState(false);
  const [variantes, setVariantes] = useState<Variante[]>([
    { nom: 'Variante A', poids: 50 },
    { nom: 'Variante B', poids: 50 },
  ]);

  useEffect(() => {
    chargerDonnees();
  }, []);

  const chargerDonnees = async () => {
    setLoading(true);
    await Promise.all([chargerCampagnes(), chargerAnalytics()]);
    setLoading(false);
  };

  const chargerCampagnes = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/marketing/campagnes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setCampagnes(data.campagnes);
      }
    } catch (error) {
      console.error('Erreur chargement campagnes:', error);
    }
  };

  const chargerAnalytics = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/marketing/analytics/overview?periode=30', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Erreur analytics:', error);
    }
  };

  const chargerDetailCampagne = async (id: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/marketing/campagnes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setShowDetail(data.campagne);
      }
    } catch (error) {
      console.error('Erreur détail campagne:', error);
    }
  };

  const creerCampagne = async () => {
    if (!nom.trim()) {
      alert('Le nom est requis');
      return;
    }

    if (abTestingActif) {
      const totalPoids = variantes.reduce((sum, v) => sum + v.poids, 0);
      if (totalPoids !== 100) {
        alert(`Le poids total des variantes doit être 100% (actuel: ${totalPoids}%)`);
        return;
      }
    }

    setActionLoading('create');
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/marketing/campagnes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nom: nom.trim(),
          description: description.trim() || null,
          type,
          ab_testing_actif: abTestingActif,
          variantes: abTestingActif ? variantes : [],
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowCreate(false);
        resetForm();
        chargerCampagnes();
      } else {
        alert(data.error || 'Erreur création');
      }
    } catch (error) {
      console.error('Erreur création campagne:', error);
      alert('Erreur création');
    } finally {
      setActionLoading(null);
    }
  };

  const demarrerCampagne = async (id: string) => {
    if (!confirm('Démarrer cette campagne ?')) return;

    setActionLoading(id);
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/marketing/campagnes/${id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      chargerCampagnes();
    } catch (error) {
      console.error('Erreur démarrage:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const arreterCampagne = async (id: string) => {
    if (!confirm('Terminer cette campagne ?')) return;

    setActionLoading(id);
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/marketing/campagnes/${id}/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      chargerCampagnes();
      if (showDetail?.id === id) {
        chargerDetailCampagne(id);
      }
    } catch (error) {
      console.error('Erreur arrêt:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const declarerGagnant = async (campagneId: string, varianteNom: string) => {
    if (!confirm(`Déclarer "${varianteNom}" comme variante gagnante ?`)) return;

    setActionLoading(campagneId);
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/marketing/campagnes/${campagneId}/declare-winner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ variante_nom: varianteNom }),
      });
      chargerCampagnes();
      if (showDetail?.id === campagneId) {
        chargerDetailCampagne(campagneId);
      }
    } catch (error) {
      console.error('Erreur déclaration gagnant:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const supprimerCampagne = async (id: string) => {
    if (!confirm('Supprimer cette campagne ?')) return;

    setActionLoading(id);
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/marketing/campagnes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      chargerCampagnes();
      if (showDetail?.id === id) {
        setShowDetail(null);
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setNom('');
    setDescription('');
    setType('email');
    setAbTestingActif(false);
    setVariantes([
      { nom: 'Variante A', poids: 50 },
      { nom: 'Variante B', poids: 50 },
    ]);
  };

  const modifierPoidsVariante = (index: number, poids: number) => {
    const newVariantes = [...variantes];
    newVariantes[index].poids = Math.max(0, Math.min(100, poids));
    setVariantes(newVariantes);
  };

  const ajouterVariante = () => {
    if (variantes.length >= 4) return;
    const letters = ['A', 'B', 'C', 'D'];
    setVariantes([...variantes, { nom: `Variante ${letters[variantes.length]}`, poids: 0 }]);
  };

  const supprimerVariante = (index: number) => {
    if (variantes.length <= 2) return;
    setVariantes(variantes.filter((_, i) => i !== index));
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'en_cours':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'termine':
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
      case 'pause':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              Campagnes Marketing
            </h1>
            <p className="text-white/60 mt-1">A/B Testing & Analytics</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-5 h-5" />
            Nouvelle campagne
          </button>
        </div>

        {/* Analytics globales */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Send className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-white/60 text-sm">Envois (30j)</span>
              </div>
              <p className="text-2xl font-bold text-white">{analytics.stats.envois}</p>
            </div>
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Eye className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-white/60 text-sm">Taux ouverture</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{analytics.stats.taux_ouverture}%</p>
            </div>
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <MousePointerClick className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-white/60 text-sm">Taux clic</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">{analytics.stats.taux_clic}%</p>
            </div>
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <ShoppingCart className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-white/60 text-sm">Conversions</span>
              </div>
              <p className="text-2xl font-bold text-amber-400">{analytics.stats.conversions}</p>
            </div>
          </div>
        )}

        {/* Liste campagnes */}
        <div className="space-y-4">
          {campagnes.map((campagne) => {
            const tauxOuverture =
              campagne.total_envois > 0
                ? ((campagne.total_ouvertures / campagne.total_envois) * 100).toFixed(1)
                : 0;
            const tauxClic =
              campagne.total_ouvertures > 0
                ? ((campagne.total_clics / campagne.total_ouvertures) * 100).toFixed(1)
                : 0;

            return (
              <div
                key={campagne.id}
                className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:border-amber-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-xl font-bold text-white">{campagne.nom}</h3>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatutBadge(
                          campagne.statut
                        )}`}
                      >
                        {campagne.statut === 'en_cours'
                          ? 'En cours'
                          : campagne.statut === 'termine'
                          ? 'Terminée'
                          : campagne.statut === 'pause'
                          ? 'En pause'
                          : 'Brouillon'}
                      </span>
                      <span className="px-2 py-1 bg-white/5 rounded-lg text-xs text-white/60 flex items-center gap-1">
                        {getTypeIcon(campagne.type)}
                        {campagne.type}
                      </span>
                      {campagne.ab_testing_actif && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium border border-purple-500/30">
                          A/B Test
                        </span>
                      )}
                      {campagne.variante_gagnante && (
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium border border-amber-500/30 flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          {campagne.variante_gagnante}
                        </span>
                      )}
                    </div>
                    {campagne.description && (
                      <p className="text-white/50 text-sm mt-1">{campagne.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {campagne.statut === 'brouillon' && (
                      <button
                        onClick={() => demarrerCampagne(campagne.id)}
                        disabled={actionLoading === campagne.id}
                        className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-all"
                        title="Démarrer"
                      >
                        {actionLoading === campagne.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {campagne.statut === 'en_cours' && (
                      <button
                        onClick={() => arreterCampagne(campagne.id)}
                        disabled={actionLoading === campagne.id}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                        title="Arrêter"
                      >
                        {actionLoading === campagne.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => supprimerCampagne(campagne.id)}
                      disabled={actionLoading === campagne.id}
                      className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats campagne */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/50 mb-1">Envois</p>
                    <p className="text-lg font-bold text-white">{campagne.total_envois}</p>
                  </div>
                  <div className="bg-blue-500/10 rounded-lg p-3">
                    <p className="text-xs text-white/50 mb-1">Ouvertures</p>
                    <p className="text-lg font-bold text-blue-400">
                      {campagne.total_ouvertures}
                      <span className="text-xs ml-1 text-white/40">({tauxOuverture}%)</span>
                    </p>
                  </div>
                  <div className="bg-purple-500/10 rounded-lg p-3">
                    <p className="text-xs text-white/50 mb-1">Clics</p>
                    <p className="text-lg font-bold text-purple-400">
                      {campagne.total_clics}
                      <span className="text-xs ml-1 text-white/40">({tauxClic}%)</span>
                    </p>
                  </div>
                  <div className="bg-emerald-500/10 rounded-lg p-3">
                    <p className="text-xs text-white/50 mb-1">Conversions</p>
                    <p className="text-lg font-bold text-emerald-400">{campagne.total_conversions}</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => chargerDetailCampagne(campagne.id)}
                      className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center gap-1 transition-all"
                    >
                      Voir détails
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Variantes A/B preview */}
                {campagne.ab_testing_actif && campagne.variantes.length > 0 && (
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-sm font-medium text-white/70 mb-2">Variantes A/B :</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {campagne.variantes.map((variante, i) => (
                        <div
                          key={i}
                          className={`bg-white/5 rounded-lg p-3 text-sm ${
                            campagne.variante_gagnante === variante.nom
                              ? 'border border-amber-500/30 bg-amber-500/10'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-white flex items-center gap-1">
                              {campagne.variante_gagnante === variante.nom && (
                                <Trophy className="w-3 h-3 text-amber-400" />
                              )}
                              {variante.nom}
                            </span>
                            <span className="text-xs text-white/40">{variante.poids}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {campagnes.length === 0 && (
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-white/30" />
              </div>
              <p className="text-white/60 mb-2">Aucune campagne créée</p>
              <p className="text-sm text-white/40 mb-6">
                Lancez vos premières campagnes marketing avec A/B testing
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-all"
              >
                Créer une campagne
              </button>
            </div>
          )}
        </div>

        {/* Modal création */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Nouvelle campagne</h2>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Nom *</label>
                  <input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Ex: Promotion Black Friday"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description de la campagne"
                    rows={2}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['email', 'sms', 'mixte'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`px-4 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                          type === t
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                        }`}
                      >
                        {t === 'email' && <Mail className="w-4 h-4" />}
                        {t === 'sms' && <MessageSquare className="w-4 h-4" />}
                        {t === 'mixte' && <TrendingUp className="w-4 h-4" />}
                        <span className="capitalize">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      className={`w-12 h-6 rounded-full transition-all ${
                        abTestingActif ? 'bg-amber-500' : 'bg-white/10'
                      }`}
                      onClick={() => setAbTestingActif(!abTestingActif)}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full transform transition-all mt-0.5 ${
                          abTestingActif ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                    <span className="text-white font-medium">Activer A/B Testing</span>
                  </label>
                </div>

                {abTestingActif && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white">Configuration variantes</p>
                      {variantes.length < 4 && (
                        <button
                          onClick={ajouterVariante}
                          className="text-sm text-amber-400 hover:text-amber-300"
                        >
                          + Ajouter variante
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {variantes.map((variante, index) => (
                        <div key={index} className="flex gap-3 items-center">
                          <input
                            type="text"
                            value={variante.nom}
                            onChange={(e) => {
                              const newVariantes = [...variantes];
                              newVariantes[index].nom = e.target.value;
                              setVariantes(newVariantes);
                            }}
                            placeholder="Nom variante"
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={variante.poids}
                              onChange={(e) =>
                                modifierPoidsVariante(index, parseInt(e.target.value) || 0)
                              }
                              min="0"
                              max="100"
                              className="w-20 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-amber-500/50"
                            />
                            <span className="text-white/40 text-sm">%</span>
                          </div>
                          {variantes.length > 2 && (
                            <button
                              onClick={() => supprimerVariante(index)}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p
                      className={`text-sm ${
                        variantes.reduce((sum, v) => sum + v.poids, 0) === 100
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      Total : {variantes.reduce((sum, v) => sum + v.poids, 0)}%
                      {variantes.reduce((sum, v) => sum + v.poids, 0) !== 100 && ' (doit = 100%)'}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/10 flex gap-3">
                <button
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={creerCampagne}
                  disabled={actionLoading === 'create'}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === 'create' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Créer campagne
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal détail */}
        {showDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{showDetail.nom}</h2>
                  {showDetail.description && (
                    <p className="text-white/50 text-sm mt-1">{showDetail.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowDetail(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Stats globales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/5 rounded-lg p-4 text-center">
                    <Send className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{showDetail.total_envois}</p>
                    <p className="text-xs text-white/50">Envois</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 text-center">
                    <Eye className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-emerald-400">
                      {showDetail.total_ouvertures}
                    </p>
                    <p className="text-xs text-white/50">Ouvertures</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 text-center">
                    <MousePointerClick className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-400">{showDetail.total_clics}</p>
                    <p className="text-xs text-white/50">Clics</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 text-center">
                    <ShoppingCart className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-amber-400">
                      {showDetail.total_conversions}
                    </p>
                    <p className="text-xs text-white/50">Conversions</p>
                  </div>
                </div>

                {/* Analytics par variante */}
                {showDetail.ab_testing_actif && showDetail.analytics && showDetail.analytics.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Comparaison A/B</h3>
                    <div className="space-y-3">
                      {showDetail.analytics.map((variante, i) => (
                        <div
                          key={i}
                          className={`bg-white/5 border rounded-xl p-4 ${
                            showDetail.variante_gagnante === variante.nom
                              ? 'border-amber-500/50 bg-amber-500/10'
                              : 'border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {showDetail.variante_gagnante === variante.nom && (
                                <Trophy className="w-5 h-5 text-amber-400" />
                              )}
                              <span className="font-semibold text-white">{variante.nom}</span>
                              <span className="text-xs text-white/40">({variante.poids}%)</span>
                            </div>
                            {showDetail.statut === 'en_cours' &&
                              !showDetail.variante_gagnante && (
                                <button
                                  onClick={() => declarerGagnant(showDetail.id, variante.nom)}
                                  className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                >
                                  <Trophy className="w-4 h-4" />
                                  Déclarer gagnant
                                </button>
                              )}
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-white/50">Envois</p>
                              <p className="font-semibold text-white">{variante.envois || 0}</p>
                            </div>
                            <div>
                              <p className="text-white/50">Taux ouverture</p>
                              <p className="font-semibold text-emerald-400">
                                {variante.taux_ouverture}%
                              </p>
                            </div>
                            <div>
                              <p className="text-white/50">Taux clic</p>
                              <p className="font-semibold text-purple-400">{variante.taux_clic}%</p>
                            </div>
                            <div>
                              <p className="text-white/50">Taux conversion</p>
                              <p className="font-semibold text-amber-400">
                                {variante.taux_conversion}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  {showDetail.statut === 'brouillon' && (
                    <button
                      onClick={() => demarrerCampagne(showDetail.id)}
                      className="flex-1 px-4 py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Play className="w-5 h-5" />
                      Démarrer
                    </button>
                  )}
                  {showDetail.statut === 'en_cours' && (
                    <button
                      onClick={() => arreterCampagne(showDetail.id)}
                      className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Square className="w-5 h-5" />
                      Terminer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
