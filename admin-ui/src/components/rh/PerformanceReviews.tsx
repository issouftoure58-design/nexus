/**
 * PerformanceReviews — Evaluations de performance des employes
 * Backend: GET/POST /api/admin/rh/performances
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TrendingUp, Plus, X, Loader2, Star, Target, Users,
  Calendar, Euro, BarChart3, CheckCircle, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Performance {
  id: number;
  membre_id: number;
  periode: string;
  ca_genere: number;
  rdv_realises: number;
  taux_conversion: number;
  clients_acquis: number;
  note_satisfaction: number;
  objectif_atteint: boolean;
  membre?: { id: number; nom: string; prenom: string; role: string };
}

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  statut: string;
}

interface PerformanceReviewsProps {
  membres: Membre[];
}

export default function PerformanceReviews({ membres }: PerformanceReviewsProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [formMembreId, setFormMembreId] = useState<number>(0);
  const [formPeriode, setFormPeriode] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formCA, setFormCA] = useState('');
  const [formRDV, setFormRDV] = useState('');
  const [formConversion, setFormConversion] = useState('');
  const [formClients, setFormClients] = useState('');
  const [formSatisfaction, setFormSatisfaction] = useState('');
  const [formObjectif, setFormObjectif] = useState(false);

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const { data: performances, isLoading } = useQuery<Performance[]>({
    queryKey: ['rh-performances'],
    queryFn: () => api.get<Performance[]>('/admin/rh/performances'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Performance>('/admin/rh/performances', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-performances'] });
      setShowForm(false);
      resetForm();
      notify('success', 'Performance enregistrée');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const resetForm = () => {
    setFormMembreId(0);
    setFormCA('');
    setFormRDV('');
    setFormConversion('');
    setFormClients('');
    setFormSatisfaction('');
    setFormObjectif(false);
  };

  const handleSubmit = () => {
    if (!formMembreId || !formPeriode) return;
    createMutation.mutate({
      membre_id: formMembreId,
      periode: formPeriode,
      ca_genere: Number(formCA) || 0,
      rdv_realises: Number(formRDV) || 0,
      taux_conversion: Number(formConversion) || 0,
      clients_acquis: Number(formClients) || 0,
      note_satisfaction: Number(formSatisfaction) || 0,
      objectif_atteint: formObjectif,
    });
  };

  const activeMembres = membres.filter(m => m.statut === 'actif');

  // Agrégation par membre (dernier mois)
  const summary = useMemo(() => {
    if (!performances?.length) return [];
    const byMembre = new Map<number, Performance>();
    for (const p of performances) {
      if (!byMembre.has(p.membre_id) || p.periode > (byMembre.get(p.membre_id)?.periode || '')) {
        byMembre.set(p.membre_id, p);
      }
    }
    return Array.from(byMembre.values());
  }, [performances]);

  const avgSatisfaction = summary.length > 0
    ? (summary.reduce((s, p) => s + p.note_satisfaction, 0) / summary.length).toFixed(1)
    : '0';

  const totalCA = summary.reduce((s, p) => s + (p.ca_genere || 0), 0);
  const objectifRate = summary.length > 0
    ? Math.round((summary.filter(p => p.objectif_atteint).length / summary.length) * 100)
    : 0;

  const formatPeriode = (p: string) => {
    const [year, month] = p.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={cn(
          'px-4 py-3 rounded-lg text-sm font-medium',
          notification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {notification.message}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Euro className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">CA généré (dernier mois)</p>
              <p className="text-xl font-bold">{(totalCA / 100).toLocaleString('fr-FR')} €</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Satisfaction moyenne</p>
              <p className="text-xl font-bold">{avgSatisfaction}/5</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Objectifs atteints</p>
              <p className="text-xl font-bold">{objectifRate}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Évalués</p>
              <p className="text-xl font-bold">{summary.length}/{activeMembres.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Historique des évaluations</h3>
        <Button onClick={() => setShowForm(true)} className="gap-2" size="sm">
          <Plus className="w-4 h-4" /> Nouvelle évaluation
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
        </div>
      ) : !performances?.length ? (
        <Card className="p-8 text-center text-gray-500">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Aucune évaluation enregistrée</p>
          <p className="text-sm mt-1">Ajoutez les premières évaluations de performance</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left bg-gray-50">
                  <th className="px-4 py-3 font-medium">Employé</th>
                  <th className="px-4 py-3 font-medium">Période</th>
                  <th className="px-4 py-3 font-medium text-right">CA généré</th>
                  <th className="px-4 py-3 font-medium text-right">RDV</th>
                  <th className="px-4 py-3 font-medium text-right">Conv. %</th>
                  <th className="px-4 py-3 font-medium text-right">Clients</th>
                  <th className="px-4 py-3 font-medium text-center">Satisfaction</th>
                  <th className="px-4 py-3 font-medium text-center">Objectif</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {performances.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-semibold text-blue-600">
                            {p.membre?.prenom?.[0]}{p.membre?.nom?.[0]}
                          </span>
                        </div>
                        <span className="font-medium">{p.membre?.prenom} {p.membre?.nom}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatPeriode(p.periode)}</td>
                    <td className="px-4 py-3 text-right font-medium">{(p.ca_genere / 100).toLocaleString('fr-FR')} €</td>
                    <td className="px-4 py-3 text-right">{p.rdv_realises}</td>
                    <td className="px-4 py-3 text-right">{p.taux_conversion}%</td>
                    <td className="px-4 py-3 text-right">{p.clients_acquis}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'font-medium',
                        p.note_satisfaction >= 4 ? 'text-green-600' :
                        p.note_satisfaction >= 3 ? 'text-yellow-600' : 'text-red-600'
                      )}>
                        {p.note_satisfaction}/5
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.objectif_atteint ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Nouvelle évaluation</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label>
                  <select
                    value={formMembreId}
                    onChange={e => setFormMembreId(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  >
                    <option value={0}>Sélectionner...</option>
                    {activeMembres.map(m => (
                      <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Période *</label>
                  <Input type="month" value={formPeriode} onChange={e => setFormPeriode(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CA généré (centimes)</label>
                  <Input type="number" value={formCA} onChange={e => setFormCA(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RDV réalisés</label>
                  <Input type="number" value={formRDV} onChange={e => setFormRDV(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Taux de conversion %</label>
                  <Input type="number" value={formConversion} onChange={e => setFormConversion(e.target.value)} placeholder="0" min="0" max="100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clients acquis</label>
                  <Input type="number" value={formClients} onChange={e => setFormClients(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note satisfaction (1-5)</label>
                  <Input type="number" value={formSatisfaction} onChange={e => setFormSatisfaction(e.target.value)} min="1" max="5" placeholder="1-5" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formObjectif}
                      onChange={e => setFormObjectif(e.target.checked)}
                      className="rounded border-gray-300 text-cyan-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Objectif atteint</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Annuler</Button>
              <Button onClick={handleSubmit} disabled={!formMembreId || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
