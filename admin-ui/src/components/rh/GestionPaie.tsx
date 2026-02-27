import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Clock,
  Calendar,
  Euro,
  FileText,
  Calculator,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  Play,
  Check,
  Send,
  FileEdit
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Types
interface Pointage {
  id: number;
  membre_id: number;
  date_travail: string;
  heure_debut: string | null;
  heure_fin: string | null;
  pause_minutes: number;
  heures_travaillees: number;
  heures_theoriques: number;
  heures_supp: number;
  source: string;
  validated: boolean;
  notes: string | null;
  membre?: {
    id: number;
    nom: string;
    prenom: string;
    poste: string;
    heures_hebdo: number;
  };
}

interface ResumePointage {
  membre_id: number;
  membre_nom: string;
  heures_hebdo_contrat: number;
  salaire_mensuel: number;
  heures_travaillees: number;
  heures_supp: number;
  jours_pointes: number;
  jours_valides: number;
}

interface Bulletin {
  id: number;
  membre_id: number;
  periode: string;
  employe_nom: string;
  employe_prenom: string;
  brut_total: number;
  net_a_payer: number;
  statut: string;
  membre?: {
    id: number;
    nom: string;
    prenom: string;
  };
}

// API Functions
const getAuthHeaders = () => {
  const token = localStorage.getItem('nexus_admin_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

const fetchPointageResume = async (periode: string) => {
  const res = await fetch(`${API_BASE}/admin/rh/pointage/resume?periode=${periode}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement résumé');
  return res.json();
};

const fetchPointages = async (params: { membre_id?: number; date_debut?: string; date_fin?: string }) => {
  const query = new URLSearchParams();
  if (params.membre_id) query.set('membre_id', String(params.membre_id));
  if (params.date_debut) query.set('date_debut', params.date_debut);
  if (params.date_fin) query.set('date_fin', params.date_fin);

  const res = await fetch(`${API_BASE}/admin/rh/pointage?${query}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement pointages');
  return res.json();
};

const fetchBulletins = async (periode?: string) => {
  const query = periode ? `?periode=${periode}` : '';
  const res = await fetch(`${API_BASE}/admin/rh/bulletins${query}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement bulletins');
  return res.json();
};

const fetchMembres = async () => {
  const res = await fetch(`${API_BASE}/admin/rh/membres`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement membres');
  return res.json();
};

export function GestionPaie() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pointage' | 'heures-supp' | 'bulletins'>('pointage');

  // Période sélectionnée (mois)
  const [periode, setPeriode] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedMembre, setSelectedMembre] = useState<number | null>(null);

  // Navigation période
  const navigatePeriode = (direction: 'prev' | 'next') => {
    const [year, month] = periode.split('-').map(Number);
    const date = new Date(year, month - 1);
    date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
    setPeriode(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const periodeLabel = useMemo(() => {
    const [year, month] = periode.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [periode]);

  // Queries
  const { data: membresData } = useQuery({
    queryKey: ['rh-membres'],
    queryFn: fetchMembres
  });

  const { data: resumeData, isLoading: loadingResume } = useQuery({
    queryKey: ['pointage-resume', periode],
    queryFn: () => fetchPointageResume(periode)
  });

  const { data: pointagesData, isLoading: loadingPointages } = useQuery({
    queryKey: ['pointages', periode, selectedMembre],
    queryFn: () => {
      const [year, month] = periode.split('-');
      const dateDebut = `${year}-${month}-01`;
      const dateFin = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
      return fetchPointages({
        membre_id: selectedMembre || undefined,
        date_debut: dateDebut,
        date_fin: dateFin
      });
    }
  });

  const { data: bulletinsData, isLoading: loadingBulletins } = useQuery({
    queryKey: ['bulletins', periode],
    queryFn: () => fetchBulletins(periode)
  });

  // État pour messages
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mutations
  const genererPointageMutation = useMutation({
    mutationFn: async () => {
      const [year, month] = periode.split('-');
      const dateDebut = `${year}-${month}-01`;
      const dateFin = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      const res = await fetch(`${API_BASE}/admin/rh/pointage/generer-depuis-planning`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ date_debut: dateDebut, date_fin: dateFin })
      });
      if (!res.ok) throw new Error('Erreur génération');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pointage-resume'] });
      queryClient.invalidateQueries({ queryKey: ['pointages'] });
      setMessage({ type: 'success', text: `${data.count || 0} pointages générés depuis le planning` });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (err) => {
      setMessage({ type: 'error', text: 'Erreur lors de la génération des pointages' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  const calculerHeureSuppMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/admin/rh/heures-supp/calculer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ periode })
      });
      if (!res.ok) throw new Error('Erreur calcul');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heures-supp'] });
    }
  });

  const genererBulletinMutation = useMutation({
    mutationFn: async (membreId: number) => {
      const res = await fetch(`${API_BASE}/admin/rh/bulletins/generer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ membre_id: membreId, periode })
      });
      if (!res.ok) throw new Error('Erreur génération');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletins'] });
      setMessage({ type: 'success', text: 'Bulletin généré avec succès' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => {
      setMessage({ type: 'error', text: 'Erreur lors de la génération du bulletin' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  // Générer tous les bulletins pour les employés actifs
  const genererTousBulletinsMutation = useMutation({
    mutationFn: async () => {
      const membresActifs = membres.filter((m: any) => m.statut === 'actif');
      const results = [];
      for (const m of membresActifs) {
        const res = await fetch(`${API_BASE}/admin/rh/bulletins/generer`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ membre_id: m.id, periode })
        });
        if (res.ok) {
          results.push(await res.json());
        }
      }
      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bulletins'] });
      setMessage({ type: 'success', text: `${data.length} bulletins générés avec succès` });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: () => {
      setMessage({ type: 'error', text: 'Erreur lors de la génération des bulletins' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  const validerPointageMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch(`${API_BASE}/admin/rh/pointage/valider-lot`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error('Erreur validation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pointages'] });
      queryClient.invalidateQueries({ queryKey: ['pointage-resume'] });
    }
  });

  // Changer le statut d'un bulletin
  const changerStatutBulletinMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: number; statut: string }) => {
      const res = await fetch(`${API_BASE}/admin/rh/bulletins/${id}/statut`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ statut })
      });
      if (!res.ok) throw new Error('Erreur changement statut');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletins'] });
      setMessage({ type: 'success', text: 'Statut du bulletin mis à jour' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => {
      setMessage({ type: 'error', text: 'Erreur lors du changement de statut' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  };

  const membres = Array.isArray(membresData) ? membresData : (membresData?.membres || []);
  const resume: ResumePointage[] = resumeData?.resume || [];
  const pointages: Pointage[] = pointagesData?.pointages || [];
  const bulletins: Bulletin[] = bulletinsData?.bulletins || [];

  // Stats
  const totalHeuresTravaillees = resume.reduce((sum, r) => sum + r.heures_travaillees, 0);
  const totalHeuresSupp = resume.reduce((sum, r) => sum + r.heures_supp, 0);
  const pointagesNonValides = pointages.filter(p => !p.validated).length;

  return (
    <div className="space-y-6">
      {/* Message de feedback */}
      {message && (
        <div className={cn(
          "p-3 rounded-lg flex items-center gap-2",
          message.type === 'success' ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"
        )}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          )}
          {message.text}
        </div>
      )}

      {/* Header avec navigation période */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigatePeriode('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-semibold capitalize">{periodeLabel}</h2>
          <Button variant="outline" size="sm" onClick={() => navigatePeriode('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => genererPointageMutation.mutate()}
            disabled={genererPointageMutation.isPending}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", genererPointageMutation.isPending && "animate-spin")} />
            Générer depuis planning
          </Button>
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resume.length}</p>
                <p className="text-xs text-gray-500">Employés pointés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatHours(totalHeuresTravaillees)}</p>
                <p className="text-xs text-gray-500">Heures travaillées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatHours(totalHeuresSupp)}</p>
                <p className="text-xs text-gray-500">Heures supplémentaires</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{bulletins.length}</p>
                <p className="text-xs text-gray-500">Bulletins générés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === 'pointage'
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
          onClick={() => setActiveTab('pointage')}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Pointage
          {pointagesNonValides > 0 && (
            <Badge variant="destructive" className="ml-2">{pointagesNonValides}</Badge>
          )}
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === 'heures-supp'
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
          onClick={() => setActiveTab('heures-supp')}
        >
          <Calculator className="w-4 h-4 inline mr-2" />
          Heures Supp
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === 'bulletins'
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
          onClick={() => setActiveTab('bulletins')}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Bulletins de paie
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'pointage' && (
        <div className="space-y-4">
          {/* Filtre employé */}
          <div className="flex gap-4">
            <select
              className="px-3 py-2 border rounded-lg"
              value={selectedMembre || ''}
              onChange={(e) => setSelectedMembre(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Tous les employés</option>
              {membres.map((m: any) => (
                <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
              ))}
            </select>

            {pointagesNonValides > 0 && (
              <Button
                variant="default"
                onClick={() => {
                  const ids = pointages.filter(p => !p.validated).map(p => p.id);
                  validerPointageMutation.mutate(ids);
                }}
                disabled={validerPointageMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Valider tout ({pointagesNonValides})
              </Button>
            )}
          </div>

          {/* Résumé par employé */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Résumé du mois</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingResume ? (
                <p className="text-gray-500">Chargement...</p>
              ) : resume.length === 0 ? (
                <p className="text-gray-500">Aucun pointage ce mois</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-gray-500">
                        <th className="pb-2">Employé</th>
                        <th className="pb-2 text-right">Contrat</th>
                        <th className="pb-2 text-right">Heures travaillées</th>
                        <th className="pb-2 text-right">Heures supp</th>
                        <th className="pb-2 text-right">Jours</th>
                        <th className="pb-2 text-right">Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resume.map((r) => (
                        <tr key={r.membre_id} className="border-b">
                          <td className="py-3 font-medium">{r.membre_nom}</td>
                          <td className="py-3 text-right text-gray-600">{r.heures_hebdo_contrat}h/sem</td>
                          <td className="py-3 text-right">{formatHours(r.heures_travaillees)}</td>
                          <td className="py-3 text-right">
                            {r.heures_supp > 0 ? (
                              <span className="text-orange-600 font-medium">+{formatHours(r.heures_supp)}</span>
                            ) : '-'}
                          </td>
                          <td className="py-3 text-right">{r.jours_pointes}j</td>
                          <td className="py-3 text-right">
                            {r.jours_valides === r.jours_pointes ? (
                              <Badge className="bg-green-100 text-green-700">100%</Badge>
                            ) : (
                              <Badge variant="outline">{Math.round(r.jours_valides / r.jours_pointes * 100)}%</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Détail pointages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Détail des pointages</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPointages ? (
                <p className="text-gray-500">Chargement...</p>
              ) : pointages.length === 0 ? (
                <p className="text-gray-500">Aucun pointage</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-gray-500">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Employé</th>
                        <th className="pb-2">Horaires</th>
                        <th className="pb-2 text-right">Heures</th>
                        <th className="pb-2 text-right">H.Supp</th>
                        <th className="pb-2">Source</th>
                        <th className="pb-2 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pointages.slice(0, 20).map((p) => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                          <td className="py-3">
                            {new Date(p.date_travail).toLocaleDateString('fr-FR', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short'
                            })}
                          </td>
                          <td className="py-3">
                            {p.membre ? `${p.membre.prenom} ${p.membre.nom}` : '-'}
                          </td>
                          <td className="py-3 text-gray-600">
                            {p.heure_debut && p.heure_fin
                              ? `${p.heure_debut.slice(0, 5)} - ${p.heure_fin.slice(0, 5)}`
                              : '-'}
                          </td>
                          <td className="py-3 text-right font-medium">
                            {p.heures_travaillees ? formatHours(p.heures_travaillees) : '-'}
                          </td>
                          <td className="py-3 text-right">
                            {p.heures_supp > 0 ? (
                              <span className="text-orange-600">+{formatHours(p.heures_supp)}</span>
                            ) : '-'}
                          </td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-xs">
                              {p.source}
                            </Badge>
                          </td>
                          <td className="py-3 text-center">
                            {p.validated ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => validerPointageMutation.mutate([p.id])}
                              >
                                Valider
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'heures-supp' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => calculerHeureSuppMutation.mutate()}
              disabled={calculerHeureSuppMutation.isPending}
            >
              <Calculator className={cn("w-4 h-4 mr-2", calculerHeureSuppMutation.isPending && "animate-spin")} />
              Calculer les heures supp
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Heures supplémentaires - {periodeLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  Les heures supplémentaires sont calculées par semaine: les 8 premières heures sont majorées à 25%,
                  les suivantes à 50%. Le contingent annuel est de 220h.
                </p>
              </div>

              {resume.filter(r => r.heures_supp > 0).length === 0 ? (
                <p className="text-gray-500">Aucune heure supplémentaire ce mois</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-gray-500">
                        <th className="pb-2">Employé</th>
                        <th className="pb-2 text-right">H.Supp 25%</th>
                        <th className="pb-2 text-right">H.Supp 50%</th>
                        <th className="pb-2 text-right">Total H.Supp</th>
                        <th className="pb-2 text-right">Cumul annuel</th>
                        <th className="pb-2">Alerte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resume.filter(r => r.heures_supp > 0).map((r) => (
                        <tr key={r.membre_id} className="border-b">
                          <td className="py-3 font-medium">{r.membre_nom}</td>
                          <td className="py-3 text-right">{formatHours(Math.min(r.heures_supp, 32))}</td>
                          <td className="py-3 text-right">{formatHours(Math.max(0, r.heures_supp - 32))}</td>
                          <td className="py-3 text-right font-medium text-orange-600">
                            {formatHours(r.heures_supp)}
                          </td>
                          <td className="py-3 text-right">-</td>
                          <td className="py-3">
                            {r.heures_supp > 40 && (
                              <Badge variant="destructive">Attention</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'bulletins' && (
        <div className="space-y-4">
          {/* Génération bulletins */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Générer les bulletins</CardTitle>
              <Button
                onClick={() => genererTousBulletinsMutation.mutate()}
                disabled={genererTousBulletinsMutation.isPending}
              >
                <Play className={cn("w-4 h-4 mr-2", genererTousBulletinsMutation.isPending && "animate-spin")} />
                {genererTousBulletinsMutation.isPending
                  ? 'Génération en cours...'
                  : 'Générer tous les bulletins'}
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Cliquez sur un employé pour régénérer son bulletin, ou utilisez le bouton ci-dessus pour générer tous les bulletins.
              </p>
              <div className="flex flex-wrap gap-2">
                {membres.filter((m: any) => m.statut === 'actif').map((m: any) => {
                  const hasBulletin = bulletins.some(b => b.membre_id === m.id);
                  return (
                    <Button
                      key={m.id}
                      variant={hasBulletin ? "outline" : "default"}
                      size="sm"
                      onClick={() => genererBulletinMutation.mutate(m.id)}
                      disabled={genererBulletinMutation.isPending}
                    >
                      {hasBulletin ? (
                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      {m.prenom} {m.nom}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Liste bulletins */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bulletins de paie - {periodeLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBulletins ? (
                <p className="text-gray-500">Chargement...</p>
              ) : bulletins.length === 0 ? (
                <p className="text-gray-500">Aucun bulletin généré pour cette période</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-gray-500">
                        <th className="pb-2">Employé</th>
                        <th className="pb-2 text-right">Brut</th>
                        <th className="pb-2 text-right">Net à payer</th>
                        <th className="pb-2">Statut</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulletins.map((b) => (
                        <tr key={b.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 font-medium">
                            {b.employe_prenom} {b.employe_nom}
                          </td>
                          <td className="py-3 text-right">{formatCurrency(b.brut_total)}</td>
                          <td className="py-3 text-right font-medium text-green-600">
                            {formatCurrency(b.net_a_payer)}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={b.statut === 'brouillon' ? 'default' : 'ghost'}
                                className={cn(
                                  "h-7 px-2",
                                  b.statut === 'brouillon' && 'bg-gray-500 hover:bg-gray-600'
                                )}
                                onClick={() => changerStatutBulletinMutation.mutate({ id: b.id, statut: 'brouillon' })}
                                disabled={b.statut === 'brouillon' || changerStatutBulletinMutation.isPending}
                                title="Brouillon"
                              >
                                <FileEdit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={b.statut === 'valide' ? 'default' : 'ghost'}
                                className={cn(
                                  "h-7 px-2",
                                  b.statut === 'valide' && 'bg-green-500 hover:bg-green-600'
                                )}
                                onClick={() => changerStatutBulletinMutation.mutate({ id: b.id, statut: 'valide' })}
                                disabled={b.statut === 'valide' || changerStatutBulletinMutation.isPending}
                                title="Validé"
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={b.statut === 'envoye' ? 'default' : 'ghost'}
                                className={cn(
                                  "h-7 px-2",
                                  b.statut === 'envoye' && 'bg-blue-500 hover:bg-blue-600'
                                )}
                                onClick={() => changerStatutBulletinMutation.mutate({ id: b.id, statut: 'envoye' })}
                                disabled={b.statut === 'envoye' || changerStatutBulletinMutation.isPending}
                                title="Envoyé"
                              >
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                // Télécharger le PDF
                                const token = localStorage.getItem('nexus_admin_token');
                                const url = `${API_BASE}/admin/rh/bulletins/${b.id}/pdf`;
                                fetch(url, {
                                  headers: { 'Authorization': `Bearer ${token}` }
                                })
                                  .then(res => {
                                    if (!res.ok) throw new Error('Erreur PDF');
                                    return res.blob();
                                  })
                                  .then(blob => {
                                    const urlBlob = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = urlBlob;
                                    a.download = `bulletin_${b.employe_nom}_${b.employe_prenom}_${b.periode}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(urlBlob);
                                  })
                                  .catch(err => {
                                    console.error('Erreur téléchargement PDF:', err);
                                    alert('Erreur lors du téléchargement du PDF');
                                  });
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default GestionPaie;
