/**
 * Page Satisfaction — Enquetes a chaud / a froid
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Star,
  RefreshCw,
  Send,
  BarChart3,
  MessageSquare,
  ChevronRight,
  X,
  ThermometerSun,
  Snowflake,
} from 'lucide-react';
import { api } from '../lib/api';

interface Enquete {
  id: string;
  titre: string;
  description: string;
  type: 'chaud' | 'froid' | 'custom';
  questions: Array<{ id: string; type: string; label: string; max?: number }>;
  actif: boolean;
  envois_count: number;
  reponses_count: number;
  created_at: string;
}

interface ResultsData {
  reponses: Array<{
    id: string;
    answers: Record<string, unknown>;
    clients?: { prenom: string; nom: string };
    created_at: string;
  }>;
  stats: Record<string, {
    label: string;
    avg: number;
    count: number;
    distribution: Array<{ value: number; count: number }>;
  }>;
  global_average: number;
  total_responses: number;
}

const TYPE_MAP: Record<string, { label: string; icon: typeof Star; color: string }> = {
  chaud: { label: 'A chaud', icon: ThermometerSun, color: 'bg-orange-100 text-orange-700' },
  froid: { label: 'A froid', icon: Snowflake, color: 'bg-blue-100 text-blue-700' },
  custom: { label: 'Personnalise', icon: Star, color: 'bg-purple-100 text-purple-700' },
};

export default function Satisfaction() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['satisfaction-enquetes'],
    queryFn: () =>
      api.get<{ enquetes: Enquete[] }>('/satisfaction/admin/enquetes'),
  });

  const { data: resultsData } = useQuery({
    queryKey: ['satisfaction-results', selectedId],
    queryFn: () =>
      api.get<ResultsData>(`/satisfaction/admin/enquetes/${selectedId}/results`),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (type: 'chaud' | 'froid') =>
      api.post('/satisfaction/admin/enquetes', { type }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['satisfaction-enquetes'] }),
  });

  const enquetes = data?.enquetes || [];
  const results = resultsData || null;

  const totalEnvois = enquetes.reduce((s, e) => s + e.envois_count, 0);
  const totalReponses = enquetes.reduce((s, e) => s + e.reponses_count, 0);
  const tauxReponse = totalEnvois > 0 ? Math.round((totalReponses / totalEnvois) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Enquetes de Satisfaction</CardTitle>
                <CardDescription>
                  Evaluation a chaud et a froid des formations
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => createMutation.mutate('chaud')}
                disabled={createMutation.isPending}
              >
                <ThermometerSun className="w-4 h-4 mr-2" />
                A chaud
              </Button>
              <Button
                size="sm"
                onClick={() => createMutation.mutate('froid')}
                disabled={createMutation.isPending}
              >
                <Snowflake className="w-4 h-4 mr-2" />
                A froid
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Enquetes', value: enquetes.length, icon: Star, color: 'text-amber-600' },
          { label: 'Envois', value: totalEnvois, icon: Send, color: 'text-blue-600' },
          { label: 'Reponses', value: totalReponses, icon: MessageSquare, color: 'text-green-600' },
          { label: 'Taux reponse', value: `${tauxReponse}%`, icon: BarChart3, color: 'text-purple-600' },
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

      {/* List + Results */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Enquetes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : enquetes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Aucune enquete</p>
                <p className="text-sm mt-1">Creez une enquete a chaud ou a froid pour commencer.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {enquetes.map(e => {
                  const typeInfo = TYPE_MAP[e.type] || TYPE_MAP.custom;
                  const TypeIcon = typeInfo.icon;

                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
                      className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left ${
                        selectedId === e.id ? 'bg-amber-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <TypeIcon className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{e.titre}</p>
                          <p className="text-xs text-gray-500">
                            {e.envois_count} envois · {e.reponses_count} reponses
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={typeInfo.color}>
                          <TypeIcon className="w-3 h-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedId ? 'Resultats' : 'Selectionnez une enquete'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedId && results ? (
              <div className="space-y-4">
                {/* Global average */}
                <div className="text-center bg-amber-50 rounded-lg p-4">
                  <p className="text-4xl font-bold text-amber-600">{results.global_average}</p>
                  <p className="text-sm text-gray-500">Moyenne globale / 5</p>
                  <p className="text-xs text-gray-400 mt-1">{results.total_responses} reponse{results.total_responses !== 1 ? 's' : ''}</p>
                </div>

                {/* Per-question stats */}
                {Object.entries(results.stats || {}).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">Detail par question</p>
                    {Object.entries(results.stats).map(([qId, stat]) => (
                      <div key={qId} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">{stat.label}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${(Number(stat.avg) / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-amber-600">{stat.avg}/5</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{stat.count} reponse{stat.count !== 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent responses */}
                {results.reponses.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Dernieres reponses</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {results.reponses.slice(0, 5).map(r => (
                        <div key={r.id} className="bg-gray-50 rounded-lg p-2 text-sm">
                          <p className="font-medium text-gray-700">
                            {r.clients ? `${r.clients.prenom} ${r.clients.nom}` : 'Anonyme'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(r.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedId(null)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Fermer
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Cliquez sur une enquete pour voir les resultats</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
