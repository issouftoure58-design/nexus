import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, ArrowLeft, Plus, TrendingUp, User,
  Calendar, GripVertical, X, Check, AlertCircle, Target
} from 'lucide-react';

interface Client {
  id: number;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
}

interface Opportunite {
  id: number;
  nom: string;
  description?: string;
  montant: number;
  etape: string;
  probabilite: number;
  date_cloture_prevue?: string;
  priorite: string;
  clients?: Client;
  created_at: string;
}

interface EtapeStats {
  count: number;
  montantTotal: string;
  montantPondere: string;
  label: string;
  color: string;
}

interface PipelineData {
  pipeline: {
    prospect: Opportunite[];
    contact: Opportunite[];
    devis: Opportunite[];
    negociation: Opportunite[];
  };
  stats: Record<string, EtapeStats>;
  previsionCA: string;
}

const ETAPES = [
  { key: 'prospect', label: 'Prospect', color: 'bg-gray-100 border-gray-300' },
  { key: 'contact', label: 'Contact', color: 'bg-blue-50 border-blue-300' },
  { key: 'devis', label: 'Devis', color: 'bg-yellow-50 border-yellow-300' },
  { key: 'negociation', label: 'Negociation', color: 'bg-orange-50 border-orange-300' }
];

const PRIORITE_COLORS: Record<string, string> = {
  basse: 'bg-gray-100 text-gray-700',
  normale: 'bg-blue-100 text-blue-700',
  haute: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700'
};

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [draggedItem, setDraggedItem] = useState<Opportunite | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOpp, setNewOpp] = useState({ nom: '', montant: '', client_id: '' });

  // Fetch pipeline data
  const { data, isLoading, error } = useQuery<PipelineData>({
    queryKey: ['pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/admin/pipeline', {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Plan Pro requis');
        throw new Error('Erreur chargement');
      }
      return res.json();
    }
  });

  // Move opportunity mutation
  const moveMutation = useMutation({
    mutationFn: async ({ id, etape }: { id: number; etape: string }) => {
      const res = await fetch(`/api/admin/pipeline/${id}/etape`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ etape })
      });
      if (!res.ok) throw new Error('Erreur deplacement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    }
  });

  // Create opportunity mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newOpp) => {
      const res = await fetch('/api/admin/pipeline', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nom: data.nom,
          montant: parseFloat(data.montant) || 0,
          client_id: data.client_id ? parseInt(data.client_id) : null,
          etape: 'prospect'
        })
      });
      if (!res.ok) throw new Error('Erreur creation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      setShowCreateForm(false);
      setNewOpp({ nom: '', montant: '', client_id: '' });
    }
  });

  // Win/Lose mutations
  const winMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/pipeline/${id}/etape`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ etape: 'gagne' })
      });
      if (!res.ok) throw new Error('Erreur');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline'] })
  });

  const loseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/pipeline/${id}/etape`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ etape: 'perdu' })
      });
      if (!res.ok) throw new Error('Erreur');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline'] })
  });

  const handleDragStart = (opp: Opportunite) => {
    setDraggedItem(opp);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (etape: string) => {
    if (draggedItem && draggedItem.etape !== etape) {
      moveMutation.mutate({ id: draggedItem.id, etape });
    }
    setDraggedItem(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Pipeline Commercial</h2>
              <p className="text-gray-600 mb-4">
                Cette fonctionnalite est disponible a partir du plan Pro.
              </p>
              <Button>Passer au Plan Pro</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-4 hover:bg-gray-100 hover:text-gray-900 rounded-md px-3 py-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" />
            Retour au dashboard
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pipeline Commercial</h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Prevision CA pondéré :
                <span className="font-bold text-green-600 text-lg">
                  {data?.previsionCA || '0'} EUR
                </span>
              </p>
            </div>
            <Button onClick={() => setShowCreateForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle opportunite
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Nouvelle opportunite</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Nom de l'opportunite"
                  value={newOpp.nom}
                  onChange={(e) => setNewOpp({ ...newOpp, nom: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Montant (EUR)"
                  value={newOpp.montant}
                  onChange={(e) => setNewOpp({ ...newOpp, montant: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => createMutation.mutate(newOpp)}
                    disabled={!newOpp.nom || createMutation.isPending}
                  >
                    Creer
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Kanban */}
        <div className="grid grid-cols-4 gap-4 min-h-[600px]">
          {ETAPES.map((etape) => {
            const opps = data?.pipeline[etape.key as keyof typeof data.pipeline] || [];
            const stats = data?.stats[etape.key];

            return (
              <div
                key={etape.key}
                className="flex flex-col"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(etape.key)}
              >
                {/* Column Header */}
                <div className={`${etape.color} border-2 p-4 rounded-t-lg`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">{etape.label}</h3>
                    <Badge variant="secondary">{stats?.count || 0}</Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Total:</span>
                      <span className="font-medium">{stats?.montantTotal || 0} EUR</span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>Pondere:</span>
                      <span className="font-bold">{stats?.montantPondere || 0} EUR</span>
                    </div>
                  </div>
                </div>

                {/* Cards Container */}
                <div
                  className={`flex-1 p-2 bg-gray-50 border-x-2 border-b-2 ${etape.color.replace('bg-', 'border-').split(' ')[1]} rounded-b-lg space-y-2 overflow-y-auto`}
                >
                  {opps.map((opp) => (
                    <Card
                      key={opp.id}
                      draggable
                      onDragStart={() => handleDragStart(opp)}
                      className={`cursor-move hover:shadow-lg transition-all ${
                        draggedItem?.id === opp.id ? 'opacity-50 scale-95' : ''
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-sm truncate max-w-[120px]">
                              {opp.nom}
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={PRIORITE_COLORS[opp.priorite] || ''}
                          >
                            {opp.probabilite}%
                          </Badge>
                        </div>

                        {opp.clients && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                            <User className="h-3 w-3" />
                            {opp.clients.prenom} {opp.clients.nom}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="font-bold text-green-600">
                            {opp.montant.toLocaleString('fr-FR')} EUR
                          </span>
                          {opp.date_cloture_prevue && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(opp.date_cloture_prevue).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>

                        {/* Win/Lose buttons for negociation stage */}
                        {opp.etape === 'negociation' && (
                          <div className="flex gap-1 mt-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-green-600 hover:bg-green-50"
                              onClick={() => winMutation.mutate(opp.id)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Gagne
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-red-600 hover:bg-red-50"
                              onClick={() => loseMutation.mutate(opp.id)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Perdu
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {opps.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      Deposez une opportunite ici
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Synthese du pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              {ETAPES.map((etape) => {
                const stats = data?.stats[etape.key];
                return (
                  <div key={etape.key} className="p-4 rounded-lg bg-gray-50">
                    <div className="text-3xl font-bold text-gray-800">{stats?.count || 0}</div>
                    <div className="text-sm text-gray-500 mb-2">{etape.label}</div>
                    <div className="text-sm font-medium text-green-600">
                      {stats?.montantTotal || 0} EUR
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary-600" />
            <span className="text-xl font-bold">NEXUS Admin</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link to="/segments" className="text-gray-600 hover:text-gray-900">Segments</Link>
            <Link to="/workflows" className="text-gray-600 hover:text-gray-900">Workflows</Link>
            <Link to="/pipeline" className="text-primary-600 font-medium">Pipeline</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
