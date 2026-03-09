/**
 * Page Waitlist — Liste d'attente clients
 * Stats, filtres, table, modal ajout
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ListChecks, Clock, Bell, CheckCircle2, XCircle, Plus,
  Loader2, Trash2, ArrowRight, Calendar, User
} from 'lucide-react';
import { waitlistApi, clientsApi } from '@/lib/api';

interface WaitlistEntry {
  id: number;
  client_id: number;
  service_id: number | null;
  preferred_date: string;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  status: 'waiting' | 'notified' | 'converted' | 'expired' | 'cancelled';
  priority: number;
  notes: string | null;
  notified_at: string | null;
  created_at: string;
  clients: { nom: string; prenom: string; email: string; telephone: string } | null;
  services: { nom: string } | null;
}

interface WaitlistStats {
  waiting: number;
  notified: number;
  converted: number;
  expired: number;
  cancelled: number;
  total: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  waiting: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  notified: { label: 'Notifié', color: 'bg-blue-100 text-blue-700' },
  converted: { label: 'Converti', color: 'bg-green-100 text-green-700' },
  expired: { label: 'Expiré', color: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-700' },
};

export default function WaitlistPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    client_id: '',
    preferred_date: '',
    preferred_time_start: '',
    preferred_time_end: '',
    notes: '',
    priority: '0'
  });

  // Data
  const { data: statsData } = useQuery<{ stats: WaitlistStats }>({
    queryKey: ['waitlist-stats'],
    queryFn: waitlistApi.getStats,
  });

  const { data: listData, isLoading } = useQuery<{ waitlist: WaitlistEntry[] }>({
    queryKey: ['waitlist', statusFilter],
    queryFn: () => waitlistApi.list({ status: statusFilter || undefined }),
  });

  const addMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => waitlistApi.add(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] });
      setShowAddModal(false);
      setAddForm({ client_id: '', preferred_date: '', preferred_time_start: '', preferred_time_end: '', notes: '', priority: '0' });
    },
  });

  const notifyMutation = useMutation({
    mutationFn: (id: number) => waitlistApi.notify(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => waitlistApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] });
    },
  });

  const stats: WaitlistStats = statsData?.stats || { waiting: 0, notified: 0, converted: 0, expired: 0, cancelled: 0, total: 0 };
  const entries: WaitlistEntry[] = listData?.waitlist || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-cyan-500" />
            Liste d'attente
          </h1>
          <p className="text-gray-500 mt-1">Gestion des clients en attente d'un créneau</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Ajouter
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('')}>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('waiting')}>
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold text-yellow-600">{stats.waiting}</p>
            <p className="text-xs text-gray-500">En attente</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('notified')}>
          <CardContent className="pt-4 pb-4 text-center">
            <Bell className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold text-blue-600">{stats.notified}</p>
            <p className="text-xs text-gray-500">Notifiés</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('converted')}>
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{stats.converted}</p>
            <p className="text-xs text-gray-500">Convertis</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('cancelled')}>
          <CardContent className="pt-4 pb-4 text-center">
            <XCircle className="w-5 h-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
            <p className="text-xs text-gray-500">Annulés</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter indicator */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{STATUS_LABELS[statusFilter]?.label || statusFilter}</Badge>
          <button onClick={() => setStatusFilter('')} className="text-sm text-cyan-600 hover:underline">Tout afficher</button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucune entrée en liste d'attente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Date souhaitée</th>
                    <th className="py-3 px-4">Créneau</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Priorité</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Ajouté le</th>
                    <th className="py-3 px-4 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium">
                          {entry.clients ? `${entry.clients.prenom} ${entry.clients.nom}` : `Client #${entry.client_id}`}
                        </div>
                        {entry.clients?.telephone && (
                          <div className="text-xs text-gray-400">{entry.clients.telephone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">{new Date(entry.preferred_date).toLocaleDateString('fr-FR')}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {entry.preferred_time_start && entry.preferred_time_end
                          ? `${entry.preferred_time_start} - ${entry.preferred_time_end}`
                          : entry.preferred_time_start || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{entry.services?.nom || '-'}</td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className={entry.priority > 0 ? 'bg-amber-100 text-amber-700' : ''}>
                          {entry.priority > 0 ? `P${entry.priority}` : 'Normal'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={STATUS_LABELS[entry.status]?.color || ''}>
                          {STATUS_LABELS[entry.status]?.label || entry.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {entry.status === 'waiting' && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => notifyMutation.mutate(entry.id)}
                              disabled={notifyMutation.isPending}
                              title="Notifier"
                            >
                              <Bell className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              if (confirm('Supprimer cette entrée ?')) deleteMutation.mutate(entry.id);
                            }}
                            className="text-red-500 hover:text-red-700"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Modal */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowAddModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>Ajouter à la liste d'attente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">ID Client *</label>
                  <Input
                    type="number"
                    value={addForm.client_id}
                    onChange={e => setAddForm(prev => ({ ...prev, client_id: e.target.value }))}
                    placeholder="ID du client"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Date souhaitée *</label>
                  <Input
                    type="date"
                    value={addForm.preferred_date}
                    onChange={e => setAddForm(prev => ({ ...prev, preferred_date: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Heure début</label>
                    <Input
                      type="time"
                      value={addForm.preferred_time_start}
                      onChange={e => setAddForm(prev => ({ ...prev, preferred_time_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Heure fin</label>
                    <Input
                      type="time"
                      value={addForm.preferred_time_end}
                      onChange={e => setAddForm(prev => ({ ...prev, preferred_time_end: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Priorité</label>
                  <select
                    value={addForm.priority}
                    onChange={e => setAddForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="0">Normale</option>
                    <option value="1">Haute</option>
                    <option value="2">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <Input
                    value={addForm.notes}
                    onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notes optionnelles"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                    Annuler
                  </Button>
                  <Button
                    onClick={() => {
                      if (addForm.client_id && addForm.preferred_date) {
                        addMutation.mutate({
                          client_id: parseInt(addForm.client_id),
                          preferred_date: addForm.preferred_date,
                          preferred_time_start: addForm.preferred_time_start || undefined,
                          preferred_time_end: addForm.preferred_time_end || undefined,
                          priority: parseInt(addForm.priority),
                          notes: addForm.notes || undefined,
                        });
                      }
                    }}
                    disabled={!addForm.client_id || !addForm.preferred_date || addMutation.isPending}
                    className="flex-1"
                  >
                    {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
