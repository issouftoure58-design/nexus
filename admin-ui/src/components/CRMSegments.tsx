import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users, Plus, Trash2, RefreshCw, Edit2, Save, X,
  Filter, UserPlus, ChevronDown, ChevronUp
} from 'lucide-react';

interface Segment {
  id: string;
  nom: string;
  description?: string;
  type: 'manuel' | 'dynamique';
  criteres: Record<string, unknown>;
  client_count: number;
  created_at: string;
}

interface SegmentClient {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
}

export function CRMSegments() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [newSegment, setNewSegment] = useState<{ nom: string; description: string; type: 'manuel' | 'dynamique' }>({ nom: '', description: '', type: 'manuel' });
  const [editForm, setEditForm] = useState({ nom: '', description: '' });

  // Fetch segments
  const { data: segments, isLoading, error } = useQuery<Segment[]>({
    queryKey: ['segments'],
    queryFn: async () => {
      const res = await fetch('/api/admin/segments');
      if (!res.ok) {
        if (res.status === 403) throw new Error('Cette fonctionnalite necessite le plan Pro ou Business');
        throw new Error('Erreur lors du chargement des segments');
      }
      return res.json();
    },
  });

  // Fetch segment clients
  const { data: segmentClients } = useQuery<SegmentClient[]>({
    queryKey: ['segment-clients', expandedSegment],
    queryFn: async () => {
      if (!expandedSegment) return [];
      const res = await fetch(`/api/admin/segments/${expandedSegment}/clients`);
      if (!res.ok) throw new Error('Erreur lors du chargement des clients');
      return res.json();
    },
    enabled: !!expandedSegment,
  });

  // Create segment mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newSegment) => {
      const res = await fetch('/api/admin/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erreur lors de la creation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      setShowCreateForm(false);
      setNewSegment({ nom: '', description: '', type: 'manuel' });
    },
  });

  // Update segment mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { nom: string; description: string } }) => {
      const res = await fetch(`/api/admin/segments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erreur lors de la mise a jour');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      setEditingSegment(null);
    },
  });

  // Delete segment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/segments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });

  // Refresh dynamic segment
  const refreshMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/segments/${id}/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error('Erreur lors du rafraichissement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });

  const startEditing = (segment: Segment) => {
    setEditingSegment(segment.id);
    setEditForm({ nom: segment.nom, description: segment.description || '' });
  };

  const cancelEditing = () => {
    setEditingSegment(null);
    setEditForm({ nom: '', description: '' });
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, data: editForm });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{(error as Error).message}</p>
            <p className="text-sm text-gray-500 mt-2">
              La segmentation CRM est disponible a partir du plan Pro.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Segments CRM
            </CardTitle>
            <CardDescription>
              Organisez vos clients en segments pour des communications ciblees
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau segment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Formulaire de creation */}
        {showCreateForm && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h4 className="font-medium mb-4">Creer un nouveau segment</h4>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Nom du segment</label>
                <Input
                  value={newSegment.nom}
                  onChange={(e) => setNewSegment({ ...newSegment, nom: e.target.value })}
                  placeholder="Ex: Clients VIP, Nouveaux clients..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description (optionnel)</label>
                <Input
                  value={newSegment.description}
                  onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                  placeholder="Description du segment..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Type</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={newSegment.type === 'manuel'}
                      onChange={() => setNewSegment({ ...newSegment, type: 'manuel' })}
                      className="text-primary-600"
                    />
                    <span className="text-sm">Manuel</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={newSegment.type === 'dynamique'}
                      onChange={() => setNewSegment({ ...newSegment, type: 'dynamique' })}
                      className="text-primary-600"
                    />
                    <span className="text-sm">Dynamique</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={() => createMutation.mutate(newSegment)}
                  disabled={!newSegment.nom || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creation...' : 'Creer'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Liste des segments */}
        {segments && segments.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Aucun segment cree</p>
            <p className="text-sm text-gray-500 mt-1">
              Creez votre premier segment pour organiser vos clients
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {segments?.map((segment) => (
              <div
                key={segment.id}
                className="border rounded-lg overflow-hidden"
              >
                <div className="p-4 flex items-center justify-between bg-white">
                  {editingSegment === segment.id ? (
                    <div className="flex-1 flex items-center gap-4">
                      <Input
                        value={editForm.nom}
                        onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                        className="max-w-xs"
                      />
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Description"
                        className="max-w-sm"
                      />
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => saveEdit(segment.id)}>
                          <Save className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEditing}>
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="flex items-center gap-4 cursor-pointer flex-1"
                        onClick={() => setExpandedSegment(expandedSegment === segment.id ? null : segment.id)}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{segment.nom}</span>
                            <Badge variant={segment.type === 'dynamique' ? 'default' : 'secondary'}>
                              {segment.type}
                            </Badge>
                          </div>
                          {segment.description && (
                            <p className="text-sm text-gray-500 mt-1">{segment.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="h-4 w-4" />
                          <span>{segment.client_count} clients</span>
                        </div>
                        {expandedSegment === segment.id ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {segment.type === 'dynamique' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); refreshMutation.mutate(segment.id); }}
                            disabled={refreshMutation.isPending}
                          >
                            <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); startEditing(segment); }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Supprimer le segment "${segment.nom}" ?`)) {
                              deleteMutation.mutate(segment.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Clients du segment (expanded) */}
                {expandedSegment === segment.id && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-sm">Clients dans ce segment</h5>
                      {segment.type === 'manuel' && (
                        <Button size="sm" variant="outline" className="gap-1">
                          <UserPlus className="h-3 w-3" />
                          Ajouter
                        </Button>
                      )}
                    </div>
                    {segmentClients && segmentClients.length > 0 ? (
                      <div className="grid gap-2">
                        {segmentClients.map((client) => (
                          <div key={client.id} className="flex items-center justify-between p-2 bg-white rounded border">
                            <div>
                              <span className="font-medium">{client.prenom} {client.nom}</span>
                              {client.email && (
                                <span className="text-sm text-gray-500 ml-2">{client.email}</span>
                              )}
                            </div>
                            {segment.type === 'manuel' && (
                              <Button size="icon" variant="ghost">
                                <X className="h-3 w-3 text-gray-400" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Aucun client dans ce segment</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
