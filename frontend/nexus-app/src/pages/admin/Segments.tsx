import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Plus,
  Filter,
  Tag,
  Trash2,
  Eye,
  RefreshCw,
  Loader2,
  X,
  Palette,
  TrendingUp,
  Clock,
  UserCheck,
} from 'lucide-react';

interface Segment {
  id: string;
  nom: string;
  description: string | null;
  criteres: Record<string, any>;
  nb_clients: number;
  auto_update: boolean;
  created_at: string;
  derniere_mise_a_jour: string | null;
}

interface TagItem {
  id: string;
  nom: string;
  couleur: string;
  description: string | null;
}

interface Client {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  ca_total: number;
  nb_rdv_total: number;
  derniere_visite: string | null;
  client_tags?: Array<{ tags: TagItem }>;
}

interface Analytics {
  total_clients: number;
  clients_actifs: number;
  taux_retention: number;
  nb_segments: number;
  nb_tags: number;
  ca_moyen: number;
}

export default function Segments() {
  const { toast } = useToast();

  // Etats principaux
  const [segments, setSegments] = useState<Segment[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateSegment, setShowCreateSegment] = useState(false);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [segmentClients, setSegmentClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Form segment
  const [segmentForm, setSegmentForm] = useState({
    nom: '',
    description: '',
    caMin: '',
    caMax: '',
    nbRdvMin: '',
    derniereVisiteJoursMax: '',
    tagsSelectionnes: [] as string[],
  });
  const [creatingSegment, setCreatingSegment] = useState(false);

  // Form tag
  const [tagForm, setTagForm] = useState({
    nom: '',
    couleur: '#3B82F6',
    description: '',
  });
  const [creatingTag, setCreatingTag] = useState(false);

  // Chargement initial
  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([
      loadSegments(),
      loadTags(),
      loadAnalytics(),
    ]);
    setLoading(false);
  }

  async function loadSegments() {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/crm/segments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSegments(data.segments || []);
      }
    } catch (err) {
      console.error('Erreur chargement segments:', err);
    }
  }

  async function loadTags() {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/crm/tags', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTags(data.tags || []);
      }
    } catch (err) {
      console.error('Erreur chargement tags:', err);
    }
  }

  async function loadAnalytics() {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/crm/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Erreur chargement analytics:', err);
    }
  }

  async function createSegment() {
    if (!segmentForm.nom.trim()) {
      toast({ title: 'Erreur', description: 'Nom requis', variant: 'destructive' });
      return;
    }

    const criteres: Record<string, any> = {};
    if (segmentForm.caMin) criteres.ca_min = parseFloat(segmentForm.caMin);
    if (segmentForm.caMax) criteres.ca_max = parseFloat(segmentForm.caMax);
    if (segmentForm.nbRdvMin) criteres.nb_rdv_min = parseInt(segmentForm.nbRdvMin);
    if (segmentForm.derniereVisiteJoursMax) criteres.derniere_visite_jours_max = parseInt(segmentForm.derniereVisiteJoursMax);
    if (segmentForm.tagsSelectionnes.length > 0) criteres.tags = segmentForm.tagsSelectionnes;

    setCreatingSegment(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/crm/segments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nom: segmentForm.nom,
          description: segmentForm.description || null,
          criteres,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Segment cree',
          description: `${data.segment.nb_clients} clients correspondent aux criteres`,
        });
        setShowCreateSegment(false);
        setSegmentForm({
          nom: '',
          description: '',
          caMin: '',
          caMax: '',
          nbRdvMin: '',
          derniereVisiteJoursMax: '',
          tagsSelectionnes: [],
        });
        loadSegments();
        loadAnalytics();
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: 'Echec creation segment', variant: 'destructive' });
    } finally {
      setCreatingSegment(false);
    }
  }

  async function createTag() {
    if (!tagForm.nom.trim()) {
      toast({ title: 'Erreur', description: 'Nom requis', variant: 'destructive' });
      return;
    }

    setCreatingTag(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(tagForm),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: 'Tag cree', description: `Tag "${tagForm.nom}" ajoute` });
        setShowCreateTag(false);
        setTagForm({ nom: '', couleur: '#3B82F6', description: '' });
        loadTags();
        loadAnalytics();
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: 'Echec creation tag', variant: 'destructive' });
    } finally {
      setCreatingTag(false);
    }
  }

  async function deleteSegment(id: string) {
    if (!confirm('Supprimer ce segment ?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/crm/segments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Supprime', description: 'Segment supprime' });
        loadSegments();
        loadAnalytics();
      }
    } catch (err) {
      toast({ title: 'Erreur', description: 'Echec suppression', variant: 'destructive' });
    }
  }

  async function deleteTag(id: string) {
    if (!confirm('Supprimer ce tag ?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/crm/tags/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadTags();
      loadAnalytics();
    } catch (err) {
      console.error('Erreur suppression tag:', err);
    }
  }

  async function viewSegmentClients(segment: Segment) {
    setSelectedSegment(segment);
    setShowClientsModal(true);
    setLoadingClients(true);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/crm/segments/${segment.id}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSegmentClients(data.clients || []);
      }
    } catch (err) {
      console.error('Erreur chargement clients segment:', err);
    } finally {
      setLoadingClients(false);
    }
  }

  function toggleTagSelection(tagNom: string) {
    setSegmentForm(prev => ({
      ...prev,
      tagsSelectionnes: prev.tagsSelectionnes.includes(tagNom)
        ? prev.tagsSelectionnes.filter(t => t !== tagNom)
        : [...prev.tagsSelectionnes, tagNom],
    }));
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Filter className="text-blue-400" size={28} />
              Segmentation Clients
            </h1>
            <p className="text-white/50">Ciblez vos clients avec precision</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadAll}
              className="p-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl hover:bg-white/10 transition-all"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => setShowCreateTag(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
            >
              <Tag size={18} />
              Nouveau tag
            </button>
            <button
              onClick={() => setShowCreateSegment(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all"
            >
              <Plus size={18} />
              Nouveau segment
            </button>
          </div>
        </div>

        {/* Analytics */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total clients', value: analytics.total_clients, icon: Users, color: 'text-white' },
              { label: 'Clients actifs', value: analytics.clients_actifs, icon: UserCheck, color: 'text-green-400' },
              { label: 'Segments', value: analytics.nb_segments, icon: Filter, color: 'text-blue-400' },
              { label: 'Tags', value: analytics.nb_tags, icon: Tag, color: 'text-purple-400' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} className={stat.color} />
                    <span className="text-xs text-white/50">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Tags */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Tag className="text-purple-400" size={20} />
            Tags disponibles
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <div
                key={tag.id}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: tag.couleur + '20',
                  color: tag.couleur,
                  border: `1px solid ${tag.couleur}40`,
                }}
              >
                <span>{tag.nom}</span>
                <button
                  onClick={() => deleteTag(tag.id)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {tags.length === 0 && (
              <p className="text-white/30 text-sm">Aucun tag cree</p>
            )}
          </div>
        </div>

        {/* Segments */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Mes segments</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-white/50" size={32} />
            </div>
          ) : segments.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <Filter size={48} className="mx-auto mb-2 opacity-50" />
              <p>Aucun segment cree</p>
              <p className="text-sm mt-1">Creez votre premier segment pour cibler vos clients</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {segments.map(segment => (
                <div
                  key={segment.id}
                  className="bg-white/5 rounded-xl border border-white/5 p-5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{segment.nom}</h3>
                      {segment.description && (
                        <p className="text-sm text-white/50">{segment.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => viewSegmentClients(segment)}
                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                        title="Voir clients"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => deleteSegment(segment.id)}
                        className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-2 rounded-lg">
                      <Users size={16} className="text-blue-400" />
                      <span className="text-lg font-bold text-blue-400">{segment.nb_clients}</span>
                      <span className="text-sm text-white/50">clients</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {segment.criteres.ca_min && (
                        <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">
                          CA &ge; {segment.criteres.ca_min}EUR
                        </span>
                      )}
                      {segment.criteres.ca_max && (
                        <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">
                          CA &le; {segment.criteres.ca_max}EUR
                        </span>
                      )}
                      {segment.criteres.nb_rdv_min && (
                        <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-xs">
                          &ge; {segment.criteres.nb_rdv_min} RDV
                        </span>
                      )}
                      {segment.criteres.derniere_visite_jours_max && (
                        <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs flex items-center gap-1">
                          <Clock size={12} />
                          {segment.criteres.derniere_visite_jours_max}j max
                        </span>
                      )}
                      {segment.criteres.tags && segment.criteres.tags.length > 0 && (
                        <span className="px-2 py-1 bg-pink-500/10 text-pink-400 rounded text-xs">
                          Tags: {segment.criteres.tags.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Creation Segment */}
        {showCreateSegment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Filter className="text-blue-400" size={20} />
                  Nouveau segment
                </h2>
                <button onClick={() => setShowCreateSegment(false)} className="text-white/50 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Nom du segment *</label>
                  <input
                    type="text"
                    value={segmentForm.nom}
                    onChange={(e) => setSegmentForm({ ...segmentForm, nom: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-blue-500/50 focus:outline-none"
                    placeholder="Ex: Clients VIP, Clients inactifs..."
                  />
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-2 block">Description</label>
                  <textarea
                    value={segmentForm.description}
                    onChange={(e) => setSegmentForm({ ...segmentForm, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-blue-500/50 focus:outline-none resize-none"
                    rows={2}
                    placeholder="Description du segment..."
                  />
                </div>

                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-sm font-medium text-white mb-3">Criteres de segmentation</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-white/50 mb-1 block">CA minimum (EUR)</label>
                      <input
                        type="number"
                        value={segmentForm.caMin}
                        onChange={(e) => setSegmentForm({ ...segmentForm, caMin: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:border-blue-500/50 focus:outline-none"
                        placeholder="200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1 block">CA maximum (EUR)</label>
                      <input
                        type="number"
                        value={segmentForm.caMax}
                        onChange={(e) => setSegmentForm({ ...segmentForm, caMax: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:border-blue-500/50 focus:outline-none"
                        placeholder="5000"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="text-xs text-white/50 mb-1 block">Nb RDV minimum</label>
                    <input
                      type="number"
                      value={segmentForm.nbRdvMin}
                      onChange={(e) => setSegmentForm({ ...segmentForm, nbRdvMin: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:border-blue-500/50 focus:outline-none"
                      placeholder="3"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="text-xs text-white/50 mb-1 block">Derniere visite (max jours)</label>
                    <input
                      type="number"
                      value={segmentForm.derniereVisiteJoursMax}
                      onChange={(e) => setSegmentForm({ ...segmentForm, derniereVisiteJoursMax: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:border-blue-500/50 focus:outline-none"
                      placeholder="90 (clients actifs dans les 90 derniers jours)"
                    />
                  </div>

                  {tags.length > 0 && (
                    <div className="mt-4">
                      <label className="text-xs text-white/50 mb-2 block">Tags requis (au moins un)</label>
                      <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                          <button
                            key={tag.id}
                            onClick={() => toggleTagSelection(tag.nom)}
                            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                              segmentForm.tagsSelectionnes.includes(tag.nom)
                                ? 'bg-blue-500 text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                          >
                            {tag.nom}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateSegment(false)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white/70 rounded-xl hover:bg-white/10 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={createSegment}
                  disabled={creatingSegment}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all disabled:opacity-50"
                >
                  {creatingSegment ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Plus size={18} />
                  )}
                  Creer segment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Creation Tag */}
        {showCreateTag && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Tag className="text-purple-400" size={20} />
                  Nouveau tag
                </h2>
                <button onClick={() => setShowCreateTag(false)} className="text-white/50 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Nom du tag *</label>
                  <input
                    type="text"
                    value={tagForm.nom}
                    onChange={(e) => setTagForm({ ...tagForm, nom: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-purple-500/50 focus:outline-none"
                    placeholder="Ex: VIP, Fidele, Prospect..."
                  />
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-2 block flex items-center gap-2">
                    <Palette size={14} />
                    Couleur
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={tagForm.couleur}
                      onChange={(e) => setTagForm({ ...tagForm, couleur: e.target.value })}
                      className="w-16 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={tagForm.couleur}
                      onChange={(e) => setTagForm({ ...tagForm, couleur: e.target.value })}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-purple-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-2 block">Description</label>
                  <input
                    type="text"
                    value={tagForm.description}
                    onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-purple-500/50 focus:outline-none"
                    placeholder="Description du tag..."
                  />
                </div>

                {/* Preview */}
                <div className="pt-2">
                  <label className="text-xs text-white/50 mb-2 block">Apercu</label>
                  <span
                    className="inline-block px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: tagForm.couleur + '20',
                      color: tagForm.couleur,
                      border: `1px solid ${tagForm.couleur}40`,
                    }}
                  >
                    {tagForm.nom || 'Nom du tag'}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateTag(false)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white/70 rounded-xl hover:bg-white/10 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={createTag}
                  disabled={creatingTag}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50"
                >
                  {creatingTag ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Tag size={18} />
                  )}
                  Creer tag
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Clients du Segment */}
        {showClientsModal && selectedSegment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Clients du segment "{selectedSegment.nom}"
                  </h2>
                  <p className="text-sm text-white/50">{segmentClients.length} clients</p>
                </div>
                <button onClick={() => setShowClientsModal(false)} className="text-white/50 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingClients ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-white/50" size={32} />
                  </div>
                ) : segmentClients.length === 0 ? (
                  <div className="text-center py-12 text-white/30">
                    <Users size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Aucun client dans ce segment</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {segmentClients.map(client => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {client.prenom} {client.nom}
                          </p>
                          <p className="text-sm text-white/50">{client.telephone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-green-400">
                            {client.ca_total || 0} EUR
                          </p>
                          <p className="text-xs text-white/40">
                            {client.nb_rdv_total || 0} RDV
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 mt-4">
                <button
                  onClick={() => setShowClientsModal(false)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white/70 rounded-xl hover:bg-white/10 transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
