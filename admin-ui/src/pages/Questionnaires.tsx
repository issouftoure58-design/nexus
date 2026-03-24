/**
 * Page Questionnaires — Gestion des formulaires de qualification
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardList,
  Plus,
  RefreshCw,
  CheckCircle2,
  Users,
  TrendingUp,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Eye,
  Copy,
} from 'lucide-react';
import { api } from '../lib/api';

interface Questionnaire {
  id: string;
  titre: string;
  description: string;
  slug: string;
  questions: Array<{ id: string; type: string; label: string }>;
  config: { scoring_threshold?: number };
  actif: boolean;
  submissions_count: number;
  created_at: string;
}

interface Submission {
  id: string;
  answers: Record<string, unknown>;
  contact: { prenom?: string; nom?: string; email?: string; telephone?: string };
  score: number;
  qualified: boolean;
  created_at: string;
}

export default function Questionnaires() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitre, setNewTitre] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['questionnaires'],
    queryFn: () =>
      api.get<{ questionnaires: Questionnaire[] }>('/questionnaires/admin'),
  });

  const { data: subsData } = useQuery({
    queryKey: ['questionnaire-submissions', selectedId],
    queryFn: () =>
      api.get<{ submissions: Submission[] }>(
        `/questionnaires/admin/${selectedId}/submissions`
      ),
    enabled: !!selectedId,
  });

  const toggleMutation = useMutation({
    mutationFn: (q: Questionnaire) =>
      api.put(`/questionnaires/admin/${q.id}`, { actif: !q.actif }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questionnaires'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/questionnaires/admin/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      setSelectedId(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (titre: string) =>
      api.post('/questionnaires/admin', {
        titre,
        questions: [
          { id: 'q1', type: 'select', label: 'Quel est votre besoin principal ?', max_points: 10, options: [
            { value: 'formation', label: 'Formation', points: 10 },
            { value: 'conseil', label: 'Conseil', points: 8 },
            { value: 'info', label: 'Information', points: 3 },
          ]},
          { id: 'q2', type: 'select', label: 'Quel est votre budget ?', max_points: 10, options: [
            { value: '5000+', label: '5000+', points: 10 },
            { value: '2000-5000', label: '2000-5000', points: 7 },
            { value: '<2000', label: 'Moins de 2000', points: 3 },
          ]},
          { id: 'q3', type: 'select', label: 'Quand souhaitez-vous demarrer ?', max_points: 10, options: [
            { value: 'urgent', label: 'Ce mois-ci', points: 10 },
            { value: 'trimestre', label: 'Ce trimestre', points: 6 },
            { value: 'later', label: 'Plus tard', points: 2 },
          ]},
        ],
        config: { scoring_threshold: 60 },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      setShowCreate(false);
      setNewTitre('');
    },
  });

  const questionnaires = data?.questionnaires || [];
  const submissions = subsData?.submissions || [];
  const landingUrl = import.meta.env.VITE_LANDING_URL || 'https://nexus-ai-saas.com';

  const totalSubs = questionnaires.reduce((s, q) => s + q.submissions_count, 0);
  const activeCount = questionnaires.filter(q => q.actif).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Questionnaires de Qualification</CardTitle>
                <CardDescription>
                  Formulaires publics avec scoring automatique
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Input
                placeholder="Titre du questionnaire..."
                value={newTitre}
                onChange={e => setNewTitre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newTitre && createMutation.mutate(newTitre)}
              />
              <Button
                size="sm"
                disabled={!newTitre || createMutation.isPending}
                onClick={() => createMutation.mutate(newTitre)}
              >
                Creer
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Questionnaires', value: questionnaires.length, icon: ClipboardList, color: 'text-cyan-600' },
          { label: 'Actifs', value: activeCount, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Soumissions', value: totalSubs, icon: Users, color: 'text-blue-600' },
          { label: 'Taux qual.', value: totalSubs > 0 ? '—' : '0%', icon: TrendingUp, color: 'text-orange-600' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List + Detail */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Questionnaires</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : questionnaires.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Aucun questionnaire</p>
                <p className="text-sm mt-1">Creez votre premier formulaire de qualification.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {questionnaires.map(q => (
                  <button
                    key={q.id}
                    onClick={() => setSelectedId(q.id === selectedId ? null : q.id)}
                    className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left ${
                      selectedId === q.id ? 'bg-cyan-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-teal-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{q.titre}</p>
                        <p className="text-xs text-gray-500">
                          {q.questions.length} questions · {q.submissions_count} soumissions
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={q.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {q.actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedId ? 'Detail' : 'Selectionnez un questionnaire'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedId ? (
              (() => {
                const q = questionnaires.find(x => x.id === selectedId);
                if (!q) return null;
                const publicUrl = `${landingUrl}/questionnaire/${q.slug}`;

                return (
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-gray-900">{q.titre}</p>
                      <p className="text-sm text-gray-500 mt-1">{q.description || 'Pas de description'}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(publicUrl)}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copier le lien
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMutation.mutate(q)}
                      >
                        {q.actif ? <ToggleRight className="w-3.5 h-3.5 mr-1" /> : <ToggleLeft className="w-3.5 h-3.5 mr-1" />}
                        {q.actif ? 'Desactiver' : 'Activer'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm('Supprimer ce questionnaire ?')) deleteMutation.mutate(q.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="border-t pt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        <Eye className="w-4 h-4 inline mr-1" />
                        Dernieres soumissions
                      </p>
                      {submissions.length === 0 ? (
                        <p className="text-sm text-gray-400">Aucune soumission</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {submissions.slice(0, 10).map(sub => (
                            <div key={sub.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">
                                  {sub.contact?.prenom || sub.contact?.email || 'Anonyme'}
                                </p>
                                <Badge className={sub.qualified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                                  {sub.score}pts {sub.qualified ? '- Qualifie' : ''}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(sub.created_at).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-3 space-y-1 text-sm">
                      <p><span className="text-gray-500">Seuil qualification :</span> {q.config?.scoring_threshold || 60}%</p>
                      <p><span className="text-gray-500">Cree le :</span> {new Date(q.created_at).toLocaleDateString('fr-FR')}</p>
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-600 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Voir le formulaire public
                      </a>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-8 text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Cliquez sur un questionnaire pour voir les details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
