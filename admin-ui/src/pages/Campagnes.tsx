/**
 * Campagnes Marketing — CRUD + A/B Testing
 * Consomme les endpoints /api/marketing/campagnes
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi, type CampagneVariante } from '@/lib/marketingApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Play, Square, Trash2, Trophy, X, Loader2,
  Megaphone, Mail, MessageSquare, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
  en_cours: { label: 'En cours', color: 'bg-green-100 text-green-700' },
  termine: { label: 'Terminée', color: 'bg-blue-100 text-blue-700' },
  archive: { label: 'Archivée', color: 'bg-gray-100 text-gray-500' },
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  email: { label: 'Email', icon: Mail },
  sms: { label: 'SMS', icon: MessageSquare },
  push: { label: 'Push', icon: Megaphone },
};

export default function Campagnes() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampagne, setSelectedCampagne] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [formNom, setFormNom] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('email');
  const [formAbTesting, setFormAbTesting] = useState(false);
  const [formVariantes, setFormVariantes] = useState<Pick<CampagneVariante, 'nom' | 'poids'>[]>([
    { nom: 'Variante A', poids: 50 },
    { nom: 'Variante B', poids: 50 },
  ]);

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['campagnes'],
    queryFn: marketingApi.getCampagnes,
  });

  const { data: detailData } = useQuery({
    queryKey: ['campagne-detail', selectedCampagne],
    queryFn: () => marketingApi.getCampagne(selectedCampagne!),
    enabled: !!selectedCampagne,
  });

  const createMutation = useMutation({
    mutationFn: marketingApi.createCampagne,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campagnes'] });
      setShowCreateModal(false);
      resetForm();
      notify('success', 'Campagne créée');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const startMutation = useMutation({
    mutationFn: marketingApi.startCampagne,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campagnes'] });
      notify('success', 'Campagne démarrée');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const stopMutation = useMutation({
    mutationFn: marketingApi.stopCampagne,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campagnes'] });
      notify('success', 'Campagne arrêtée');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: marketingApi.deleteCampagne,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campagnes'] });
      setSelectedCampagne(null);
      notify('success', 'Campagne supprimée');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const declareWinnerMutation = useMutation({
    mutationFn: ({ id, variante_nom }: { id: number; variante_nom: string }) =>
      marketingApi.declareWinner(id, variante_nom),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campagnes'] });
      queryClient.invalidateQueries({ queryKey: ['campagne-detail'] });
      notify('success', 'Gagnant déclaré');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const resetForm = () => {
    setFormNom('');
    setFormDescription('');
    setFormType('email');
    setFormAbTesting(false);
    setFormVariantes([{ nom: 'Variante A', poids: 50 }, { nom: 'Variante B', poids: 50 }]);
  };

  const handleCreate = () => {
    if (!formNom.trim()) return;
    createMutation.mutate({
      nom: formNom,
      description: formDescription || undefined,
      type: formType,
      ab_testing_actif: formAbTesting,
      variantes: formAbTesting ? formVariantes : [{ nom: 'Principal', poids: 100 }],
    });
  };

  const campagnes = data?.campagnes || [];

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '-';
  const formatPercent = (v?: number) => v != null ? `${v.toFixed(1)}%` : '-';

  return (
    <div className="p-3 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campagnes Marketing</h1>
          <p className="text-gray-500 mt-1">Créez et gérez vos campagnes email, SMS et push</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nouvelle campagne
        </Button>
      </div>

      {/* Notification */}
      {notification && (
        <div className={cn(
          'px-4 py-3 rounded-lg text-sm font-medium',
          notification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {notification.message}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{campagnes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-500">En cours</p>
            <p className="text-2xl font-bold text-green-600">
              {campagnes.filter(c => c.statut === 'en_cours').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-500">Terminées</p>
            <p className="text-2xl font-bold text-blue-600">
              {campagnes.filter(c => c.statut === 'termine').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-500">Total envois</p>
            <p className="text-2xl font-bold">
              {campagnes.reduce((s, c) => s + (c.total_envois || 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : campagnes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">Aucune campagne</p>
            <p className="text-sm mt-1">Créez votre première campagne marketing</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campagnes.map(c => {
            const TypeIcon = TYPE_CONFIG[c.type]?.icon || Megaphone;
            const statutConf = STATUT_CONFIG[c.statut] || STATUT_CONFIG.brouillon;
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0">
                        <TypeIcon className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 truncate">{c.nom}</h3>
                          <Badge className={cn('text-xs', statutConf.color)}>{statutConf.label}</Badge>
                          {c.ab_testing_actif && (
                            <Badge variant="outline" className="text-xs">A/B Test</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {c.description || TYPE_CONFIG[c.type]?.label || c.type} — Créée le {formatDate(c.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {/* Stats */}
                      <div className="hidden md:flex items-center gap-6 text-sm text-gray-500">
                        <span>{c.total_envois || 0} envois</span>
                        <span>{formatPercent(c.total_ouvertures && c.total_envois ? (c.total_ouvertures / c.total_envois) * 100 : 0)} ouvert.</span>
                        <span>{formatPercent(c.total_clics && c.total_envois ? (c.total_clics / c.total_envois) * 100 : 0)} clics</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCampagne(c.id)}
                          title="Détails"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {c.statut === 'brouillon' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startMutation.mutate(c.id)}
                            title="Démarrer"
                            className="text-green-600 hover:text-green-700"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        {c.statut === 'en_cours' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => stopMutation.mutate(c.id)}
                            title="Arrêter"
                            className="text-orange-600 hover:text-orange-700"
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        )}
                        {c.statut === 'brouillon' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(c.id)}
                            title="Supprimer"
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Nouvelle campagne</h2>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-3 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <Input value={formNom} onChange={e => setFormNom(e.target.value)} placeholder="Ex: Promo été 2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Description optionnelle" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, conf]) => {
                    const Icon = conf.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setFormType(key)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                          formType === key
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        <Icon className="w-4 h-4" /> {conf.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAbTesting}
                    onChange={e => setFormAbTesting(e.target.checked)}
                    className="rounded border-gray-300 text-cyan-600"
                  />
                  <span className="text-sm font-medium text-gray-700">Activer A/B Testing</span>
                </label>
              </div>
              {formAbTesting && (
                <div className="space-y-2 pl-6 border-l-2 border-cyan-200">
                  {formVariantes.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={v.nom}
                        onChange={e => {
                          const updated = [...formVariantes];
                          updated[i] = { ...updated[i], nom: e.target.value };
                          setFormVariantes(updated);
                        }}
                        className="flex-1"
                        placeholder="Nom variante"
                      />
                      <Input
                        type="number"
                        value={v.poids}
                        onChange={e => {
                          const updated = [...formVariantes];
                          updated[i] = { ...updated[i], poids: Number(e.target.value) };
                          setFormVariantes(updated);
                        }}
                        className="w-20"
                        min={1}
                        max={100}
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={!formNom.trim() || createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Créer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCampagne && detailData?.campagne && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{detailData.campagne.nom}</h2>
              <button onClick={() => setSelectedCampagne(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-3 sm:p-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold">{detailData.campagne.total_envois || 0}</p>
                  <p className="text-xs text-gray-500">Envois</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold">{detailData.campagne.total_ouvertures || 0}</p>
                  <p className="text-xs text-gray-500">Ouvertures</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold">{detailData.campagne.total_clics || 0}</p>
                  <p className="text-xs text-gray-500">Clics</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold">{detailData.campagne.total_conversions || 0}</p>
                  <p className="text-xs text-gray-500">Conversions</p>
                </div>
              </div>

              {/* Variantes A/B */}
              {detailData.campagne.ab_testing_actif && detailData.campagne.variantes?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Variantes A/B</h3>
                  <div className="space-y-2">
                    {detailData.campagne.variantes.map((v, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium">{v.nom}</span>
                          <span className="text-sm text-gray-500 ml-2">({v.poids}%)</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>{v.envois || 0} envois</span>
                          <span>{formatPercent(v.taux_ouverture)} ouv.</span>
                          <span>{formatPercent(v.taux_clic)} clics</span>
                          <span>{formatPercent(v.taux_conversion)} conv.</span>
                          {detailData.campagne.statut === 'en_cours' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => declareWinnerMutation.mutate({
                                id: detailData.campagne.id,
                                variante_nom: v.nom,
                              })}
                              className="text-amber-600"
                              title="Déclarer gagnant"
                            >
                              <Trophy className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500">
                <p>Type: {TYPE_CONFIG[detailData.campagne.type]?.label || detailData.campagne.type}</p>
                <p>Début: {formatDate(detailData.campagne.date_debut)}</p>
                <p>Fin: {formatDate(detailData.campagne.date_fin)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
