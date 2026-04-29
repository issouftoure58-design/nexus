import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
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
  FileEdit,
  Plus,
  Trash2,
  Stethoscope,
  Info,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

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

interface CotisationLine {
  nom: string;
  code: string;
  base: number;
  taux: number;
  montant: number;
  plafonne: boolean;
}

interface AbsenceDetail {
  type: string;
  joursAbsence: number;
  retenue: number;
  ijssBrutes: number;
  ijssNettes: number;
  csgCrdsIJSS: number;
  complementEmployeur: number;
  subrogation: boolean;
  label?: string;
}

interface Bulletin {
  id: number;
  membre_id: number;
  periode: string;
  employe_nom: string;
  employe_prenom: string;
  employe_poste: string;
  salaire_base: number;
  brut_total: number;
  heures_supp_25: number;
  montant_hs_25: number;
  heures_supp_50: number;
  montant_hs_50: number;
  primes: Array<{ code: string; nom: string; montant: number; exonere?: boolean }>;
  absences: AbsenceDetail[];
  retenue_absences: number;
  ijss_brutes: number;
  complement_employeur: number;
  cotisations_salariales: CotisationLine[];
  cotisations_patronales: CotisationLine[];
  total_cotisations_salariales: number;
  total_cotisations_patronales: number;
  net_social: number;
  net_imposable: number;
  net_avant_ir: number;
  taux_ir: number;
  montant_ir: number;
  net_a_payer: number;
  reduction_fillon: number;
  cumul_brut: number;
  cumul_net_imposable: number;
  cumul_ir: number;
  cp_acquis: number;
  cp_pris: number;
  cp_solde: number;
  statut: string;
  membre?: {
    id: number;
    nom: string;
    prenom: string;
  };
}

interface AbsenceInput {
  type: string;
  jours: string;
  subrogation: boolean;
}

const ABSENCE_TYPES = [
  { code: 'maladie', label: 'Maladie' },
  { code: 'accident_travail', label: 'Accident du travail' },
  { code: 'maladie_pro', label: 'Maladie professionnelle' },
  { code: 'maternite', label: 'Maternité' },
  { code: 'paternite', label: 'Paternité' },
  { code: 'conge_sans_solde', label: 'Congé sans solde' },
  { code: 'formation', label: 'Formation (CPF)' },
];

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  poste: string;
  statut: string;
  heures_hebdo: number;
  salaire_mensuel: number;
  categorie_sociopro?: string;
}

// API Functions
const fetchPointageResume = async (periode: string) =>
  api.get<any>(`/admin/rh/pointage/resume?periode=${periode}`);

const fetchPointages = async (params: { membre_id?: number; date_debut?: string; date_fin?: string }) => {
  const query = new URLSearchParams();
  if (params.membre_id) query.set('membre_id', String(params.membre_id));
  if (params.date_debut) query.set('date_debut', params.date_debut);
  if (params.date_fin) query.set('date_fin', params.date_fin);
  return api.get<any>(`/admin/rh/pointage?${query}`);
};

const fetchBulletins = async (periode?: string) => {
  const query = periode ? `?periode=${periode}` : '';
  return api.get<any>(`/admin/rh/bulletins${query}`);
};

const fetchMembres = async () => api.get<any>('/admin/rh/membres');

export function GestionPaie() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pointage' | 'heures-supp' | 'bulletins'>('pointage');

  // Période sélectionnée (mois)
  const [periode, setPeriode] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedMembre, setSelectedMembre] = useState<number | null>(null);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);

  // Absences pour génération bulletin
  const [showAbsenceForm, setShowAbsenceForm] = useState<number | null>(null); // membre_id
  const [absencesForm, setAbsencesForm] = useState<AbsenceInput[]>([]);

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

  // Mode de calcul HS
  const { data: configHS } = useQuery({
    queryKey: ['config-hs'],
    queryFn: () => api.get<{ mode: string }>('/admin/rh/config-hs')
  });

  const modeCalculHS = (configHS as any)?.mode || 'hebdomadaire';

  const updateModeHSMutation = useMutation({
    mutationFn: (mode: string) => api.patch('/admin/rh/config-hs', { mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-hs'] });
      queryClient.invalidateQueries({ queryKey: ['pointage-resume'] });
      queryClient.invalidateQueries({ queryKey: ['pointages'] });
      queryClient.invalidateQueries({ queryKey: ['heures-supp'] });
      setMessage({ type: 'success', text: 'Mode de calcul des heures supplémentaires mis à jour. Régénérez le pointage pour appliquer.' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  // État pour messages
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mutations
  const genererPointageMutation = useMutation({
    mutationFn: async () => {
      const [year, month] = periode.split('-');
      const dateDebut = `${year}-${month}-01`;
      const dateFin = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
      return api.post<any>('/admin/rh/pointage/generer-depuis-planning', { date_debut: dateDebut, date_fin: dateFin });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pointage-resume'] });
      queryClient.invalidateQueries({ queryKey: ['pointages'] });
      setMessage({ type: 'success', text: `${data.count || 0} pointages générés depuis le planning` });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (_err) => {
      setMessage({ type: 'error', text: 'Erreur lors de la génération des pointages' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  const calculerHeureSuppMutation = useMutation({
    mutationFn: async () => {
      return api.post('/admin/rh/heures-supp/calculer', { periode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heures-supp'] });
    }
  });

  const genererBulletinMutation = useMutation({
    mutationFn: async ({ membreId, absences }: { membreId: number; absences?: Array<{ type: string; jours: number; subrogation: boolean }> }) => {
      return api.post('/admin/rh/bulletins/generer', {
        membre_id: membreId,
        periode,
        ...(absences && absences.length > 0 ? { absences } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletins'] });
      setMessage({ type: 'success', text: 'Bulletin généré avec succès' });
      setShowAbsenceForm(null);
      setAbsencesForm([]);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => {
      setMessage({ type: 'error', text: 'Erreur lors de la génération du bulletin' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  // Générer tous les bulletins pour les employés actifs (sans absences — pour les absences, générer individuellement)
  const genererTousBulletinsMutation = useMutation({
    mutationFn: async () => {
      const membresActifs = membres.filter((m: Membre) => m.statut === 'actif');
      const results: any[] = [];
      const errors: string[] = [];
      for (const m of membresActifs) {
        try {
          const data = await api.post<any>('/admin/rh/bulletins/generer', { membre_id: m.id, periode });
          results.push(data);
        } catch (err: any) {
          const msg = err?.response?.data?.error || err?.message || 'Erreur inconnue';
          errors.push(`${m.prenom} ${m.nom}: ${msg}`);
        }
      }
      return { results, errors };
    },
    onSuccess: ({ results, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['bulletins'] });
      if (errors.length > 0 && results.length === 0) {
        setMessage({ type: 'error', text: `Échec génération : ${errors[0]}` });
      } else if (errors.length > 0) {
        setMessage({ type: 'warning' as any, text: `${results.length} bulletins générés, ${errors.length} erreur(s) : ${errors[0]}` });
      } else {
        setMessage({ type: 'success', text: `${results.length} bulletins générés avec succès` });
      }
      setTimeout(() => setMessage(null), 8000);
    },
    onError: () => {
      setMessage({ type: 'error', text: 'Erreur lors de la génération des bulletins' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  const validerPointageMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return api.post('/admin/rh/pointage/valider-lot', { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pointages'] });
      queryClient.invalidateQueries({ queryKey: ['pointage-resume'] });
    }
  });

  // Changer le statut d'un bulletin
  const changerStatutBulletinMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: number; statut: string }) => {
      return api.put(`/admin/rh/bulletins/${id}/statut`, { statut });
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

  const membres: Membre[] = Array.isArray(membresData) ? membresData : (membresData?.data || membresData?.membres || []);
  const resume: ResumePointage[] = resumeData?.resume || [];
  const pointages: Pointage[] = pointagesData?.pointages || (Array.isArray((pointagesData as any)?.data) ? (pointagesData as any).data : []);
  const bulletins: Bulletin[] = bulletinsData?.bulletins || (Array.isArray((bulletinsData as any)?.data) ? (bulletinsData as any).data : []);

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
          {/* Mode calcul HS + Filtre employé */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Settings className="w-3 h-3" />
                Mode calcul HS
              </label>
              <div className="flex items-center gap-2">
                <select
                  className="px-3 py-2 border rounded-lg text-sm"
                  value={modeCalculHS}
                  onChange={(e) => updateModeHSMutation.mutate(e.target.value)}
                  disabled={updateModeHSMutation.isPending}
                >
                  <option value="hebdomadaire">Hebdomadaire (défaut)</option>
                  <option value="mensuel">Mensuel (lissage)</option>
                  <option value="annualisation">Annualisation</option>
                </select>
                <div className="relative group">
                  <Info className="w-4 h-4 text-gray-400 cursor-help" />
                  <div className="absolute left-6 top-0 z-50 hidden group-hover:block w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                    <p className="font-semibold mb-1">Modes de calcul :</p>
                    <p className="mb-1"><strong>Hebdomadaire</strong> : &gt;35h/sem = HS (+25% h36→h43, +50% h44+). Code du travail.</p>
                    <p className="mb-1"><strong>Mensuel</strong> : &gt;151,67h/mois = HS. Lissage sur le mois (convention collective).</p>
                    <p><strong>Annualisation</strong> : &gt;1607h/an = HS. Bilan en fin de période de référence.</p>
                  </div>
                </div>
              </div>
            </div>

            <select
              className="px-3 py-2 border rounded-lg"
              value={selectedMembre || ''}
              onChange={(e) => setSelectedMembre(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Tous les employés</option>
              {membres.map((m: Membre) => (
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
                              <Badge variant="outline">{r.jours_pointes > 0 ? Math.round(r.jours_valides / r.jours_pointes * 100) : 0}%</Badge>
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
                      {pointages.map((p) => (
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
                Cliquez sur un employé pour générer son bulletin. Utilisez le bouton d'absence pour déclarer des absences avant la génération.
              </p>
              <div className="flex flex-wrap gap-2">
                {membres.filter((m: Membre) => m.statut === 'actif').map((m: Membre) => {
                  const hasBulletin = bulletins.some(b => b.membre_id === m.id);
                  return (
                    <div key={m.id} className="flex items-center gap-1">
                      <Button
                        variant={hasBulletin ? "outline" : "default"}
                        size="sm"
                        onClick={() => genererBulletinMutation.mutate({ membreId: m.id })}
                        disabled={genererBulletinMutation.isPending}
                      >
                        {hasBulletin ? (
                          <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        {m.prenom} {m.nom}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Générer avec absences"
                        onClick={() => {
                          setShowAbsenceForm(showAbsenceForm === m.id ? null : m.id);
                          setAbsencesForm([]);
                        }}
                      >
                        <Stethoscope className={cn("w-4 h-4", showAbsenceForm === m.id ? "text-blue-600" : "text-gray-400")} />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Formulaire absences inline */}
              {showAbsenceForm && (
                <div className="mt-4 border rounded-lg p-4 bg-orange-50 border-orange-200">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-orange-600" />
                    Absences - {membres.find(m => m.id === showAbsenceForm)?.prenom} {membres.find(m => m.id === showAbsenceForm)?.nom}
                  </h4>

                  {absencesForm.map((abs, i) => (
                    <div key={i} className="flex items-center gap-3 mb-2">
                      <select
                        className="border rounded px-2 py-1.5 text-sm flex-1"
                        value={abs.type}
                        onChange={e => {
                          const newAbs = [...absencesForm];
                          newAbs[i] = { ...newAbs[i], type: e.target.value };
                          setAbsencesForm(newAbs);
                        }}
                      >
                        <option value="">Type d'absence</option>
                        {ABSENCE_TYPES.map(t => (
                          <option key={t.code} value={t.code}>{t.label}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="31"
                          className="border rounded px-2 py-1.5 text-sm w-20"
                          placeholder="Jours"
                          value={abs.jours}
                          onChange={e => {
                            const newAbs = [...absencesForm];
                            newAbs[i] = { ...newAbs[i], jours: e.target.value };
                            setAbsencesForm(newAbs);
                          }}
                        />
                        <span className="text-xs text-gray-500">j</span>
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={abs.subrogation}
                          onChange={e => {
                            const newAbs = [...absencesForm];
                            newAbs[i] = { ...newAbs[i], subrogation: e.target.checked };
                            setAbsencesForm(newAbs);
                          }}
                          className="rounded"
                        />
                        Subrogation
                      </label>
                      <button
                        type="button"
                        onClick={() => setAbsencesForm(absencesForm.filter((_, idx) => idx !== i))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAbsencesForm([...absencesForm, { type: 'maladie', jours: '', subrogation: true }])}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Ajouter une absence
                    </Button>
                    <Button
                      size="sm"
                      disabled={genererBulletinMutation.isPending || absencesForm.some(a => !a.type || !a.jours)}
                      onClick={() => {
                        genererBulletinMutation.mutate({
                          membreId: showAbsenceForm,
                          absences: absencesForm
                            .filter(a => a.type && a.jours)
                            .map(a => ({ type: a.type, jours: parseInt(a.jours), subrogation: a.subrogation })),
                        });
                      }}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Générer avec absences
                    </Button>
                  </div>
                </div>
              )}
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
                        <th className="pb-2 text-right">Cotis. S.</th>
                        <th className="pb-2 text-right">Cotis. P.</th>
                        <th className="pb-2 text-right">Net à payer</th>
                        <th className="pb-2">Statut</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulletins.map((b) => (
                        <tr
                          key={b.id}
                          className={cn(
                            "border-b hover:bg-gray-50 cursor-pointer",
                            selectedBulletin?.id === b.id && "bg-blue-50"
                          )}
                          onClick={() => setSelectedBulletin(selectedBulletin?.id === b.id ? null : b)}
                        >
                          <td className="py-3 font-medium">
                            {b.employe_prenom} {b.employe_nom}
                          </td>
                          <td className="py-3 text-right">{formatCurrency(b.brut_total)}</td>
                          <td className="py-3 text-right text-red-600 text-sm">
                            {formatCurrency(b.total_cotisations_salariales || 0)}
                          </td>
                          <td className="py-3 text-right text-orange-600 text-sm">
                            {formatCurrency(b.total_cotisations_patronales || 0)}
                          </td>
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
                                onClick={(e) => { e.stopPropagation(); changerStatutBulletinMutation.mutate({ id: b.id, statut: 'brouillon' }); }}
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
                                onClick={(e) => { e.stopPropagation(); changerStatutBulletinMutation.mutate({ id: b.id, statut: 'valide' }); }}
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
                                onClick={(e) => { e.stopPropagation(); changerStatutBulletinMutation.mutate({ id: b.id, statut: 'envoye' }); }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                const token = api.getToken();
                                const url = `/api/admin/rh/bulletins/${b.id}/pdf`;
                                fetch(url, {
                                  headers: { 'Authorization': `Bearer ${token}` }
                                })
                                  .then(r => {
                                    if (!r.ok) throw new Error('Erreur PDF');
                                    return r.blob();
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

          {/* Detail cotisations du bulletin sélectionné */}
          {selectedBulletin && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  Détail - {selectedBulletin.employe_prenom} {selectedBulletin.employe_nom}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedBulletin(null)}>
                  Fermer
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Brut */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Rémunération brute</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-gray-500">Salaire de base</span>
                      <p className="font-medium">{formatCurrency(selectedBulletin.salaire_base || 0)}</p>
                    </div>
                    {(selectedBulletin.heures_supp_25 || 0) > 0 && (
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">HS 25% ({selectedBulletin.heures_supp_25}h)</span>
                        <p className="font-medium">{formatCurrency(selectedBulletin.montant_hs_25 || 0)}</p>
                      </div>
                    )}
                    {(selectedBulletin.heures_supp_50 || 0) > 0 && (
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">HS 50% ({selectedBulletin.heures_supp_50}h)</span>
                        <p className="font-medium">{formatCurrency(selectedBulletin.montant_hs_50 || 0)}</p>
                      </div>
                    )}
                    <div className="bg-green-50 p-2 rounded border border-green-200">
                      <span className="text-green-700">Total brut</span>
                      <p className="font-bold text-green-700">{formatCurrency(selectedBulletin.brut_total)}</p>
                    </div>
                  </div>
                </div>

                {/* Primes */}
                {selectedBulletin.primes && selectedBulletin.primes.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Primes</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      {selectedBulletin.primes.map((p, i) => (
                        <div key={i} className={cn("p-2 rounded", p.exonere ? "bg-green-50 border border-green-100" : "bg-gray-50")}>
                          <span className="text-gray-600 text-xs">{p.nom}</span>
                          {p.exonere && <span className="text-[10px] text-green-600 ml-1">(exo)</span>}
                          <p className="font-medium">{formatCurrency(p.montant)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Absences */}
                {selectedBulletin.absences && selectedBulletin.absences.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Absences</h4>
                    <div className="space-y-2">
                      {selectedBulletin.absences.map((a, i) => (
                        <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{a.label || ABSENCE_TYPES.find(t => t.code === a.type)?.label || a.type}</span>
                            <Badge variant="outline" className="text-xs">{a.joursAbsence}j</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Retenue</span>
                              <p className="font-medium text-red-600">-{formatCurrency(a.retenue)}</p>
                            </div>
                            {a.ijssBrutes > 0 && (
                              <div>
                                <span className="text-gray-500">IJSS brutes</span>
                                <p className="font-medium text-blue-600">{formatCurrency(a.ijssBrutes)}</p>
                              </div>
                            )}
                            {a.complementEmployeur > 0 && (
                              <div>
                                <span className="text-gray-500">Complément empl.</span>
                                <p className="font-medium text-green-600">{formatCurrency(a.complementEmployeur)}</p>
                              </div>
                            )}
                            {a.subrogation && (
                              <div>
                                <span className="text-gray-500">Subrogation</span>
                                <p className="font-medium text-purple-600">Oui</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {/* Totaux absences */}
                      <div className="flex gap-4 text-xs bg-orange-100 p-2 rounded">
                        <span>Retenue totale: <strong className="text-red-600">-{formatCurrency(selectedBulletin.retenue_absences || 0)}</strong></span>
                        {(selectedBulletin.ijss_brutes || 0) > 0 && (
                          <span>IJSS brutes: <strong className="text-blue-600">{formatCurrency(selectedBulletin.ijss_brutes)}</strong></span>
                        )}
                        {(selectedBulletin.complement_employeur || 0) > 0 && (
                          <span>Complément: <strong className="text-green-600">{formatCurrency(selectedBulletin.complement_employeur)}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cotisations salariales */}
                {selectedBulletin.cotisations_salariales && Array.isArray(selectedBulletin.cotisations_salariales) && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Cotisations salariales</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-gray-500">
                            <th className="pb-1 text-left">Rubrique</th>
                            <th className="pb-1 text-right">Base</th>
                            <th className="pb-1 text-right">Taux</th>
                            <th className="pb-1 text-right">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBulletin.cotisations_salariales.filter((c: CotisationLine) => c.montant > 0).map((c: CotisationLine, i: number) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-1.5">
                                {c.nom}
                                {c.plafonne && <span className="text-xs text-blue-500 ml-1">(T1)</span>}
                              </td>
                              <td className="py-1.5 text-right text-gray-600">{formatCurrency(c.base)}</td>
                              <td className="py-1.5 text-right text-gray-600">{c.taux}%</td>
                              <td className="py-1.5 text-right font-medium text-red-600">{formatCurrency(c.montant)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold bg-red-50">
                            <td className="py-1.5" colSpan={3}>Total salarié</td>
                            <td className="py-1.5 text-right text-red-700">{formatCurrency(selectedBulletin.total_cotisations_salariales || 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Cotisations patronales */}
                {selectedBulletin.cotisations_patronales && Array.isArray(selectedBulletin.cotisations_patronales) && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Cotisations patronales</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-gray-500">
                            <th className="pb-1 text-left">Rubrique</th>
                            <th className="pb-1 text-right">Base</th>
                            <th className="pb-1 text-right">Taux</th>
                            <th className="pb-1 text-right">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBulletin.cotisations_patronales.map((c: CotisationLine, i: number) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-1.5">
                                {c.nom}
                                {c.plafonne && <span className="text-xs text-blue-500 ml-1">(T1)</span>}
                              </td>
                              <td className="py-1.5 text-right text-gray-600">{formatCurrency(c.base)}</td>
                              <td className="py-1.5 text-right text-gray-600">{c.taux}%</td>
                              <td className="py-1.5 text-right font-medium text-orange-600">{formatCurrency(c.montant)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold bg-orange-50">
                            <td className="py-1.5" colSpan={3}>Total employeur</td>
                            <td className="py-1.5 text-right text-orange-700">{formatCurrency(selectedBulletin.total_cotisations_patronales || 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Reduction Fillon */}
                {(selectedBulletin.reduction_fillon || 0) > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-emerald-700">
                      Réduction générale (ex-Fillon): -{formatCurrency(selectedBulletin.reduction_fillon)}
                    </p>
                  </div>
                )}

                {/* Nets */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  <div className="bg-blue-50 p-2 rounded border border-blue-200">
                    <span className="text-blue-600">Net social</span>
                    <p className="font-bold">{formatCurrency(selectedBulletin.net_social || selectedBulletin.net_avant_ir || 0)}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Net imposable</span>
                    <p className="font-medium">{formatCurrency(selectedBulletin.net_imposable || 0)}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">PAS ({selectedBulletin.taux_ir || 0}%)</span>
                    <p className="font-medium">-{formatCurrency(selectedBulletin.montant_ir || 0)}</p>
                  </div>
                  <div className="bg-green-100 p-2 rounded border border-green-300">
                    <span className="text-green-700">Net à payer</span>
                    <p className="font-bold text-green-700 text-lg">{formatCurrency(selectedBulletin.net_a_payer)}</p>
                  </div>
                  <div className="bg-purple-50 p-2 rounded border border-purple-200">
                    <span className="text-purple-600">Coût employeur</span>
                    <p className="font-bold text-purple-700">
                      {formatCurrency(selectedBulletin.brut_total + (selectedBulletin.total_cotisations_patronales || 0) - (selectedBulletin.reduction_fillon || 0))}
                    </p>
                  </div>
                </div>

                {/* Cumuls */}
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Cumul brut: {formatCurrency(selectedBulletin.cumul_brut || 0)}</span>
                  <span>Cumul net imposable: {formatCurrency(selectedBulletin.cumul_net_imposable || 0)}</span>
                  <span>Cumul PAS: {formatCurrency(selectedBulletin.cumul_ir || 0)}</span>
                  <span>CP: {selectedBulletin.cp_acquis || 0} acquis / {selectedBulletin.cp_pris || 0} pris / {selectedBulletin.cp_solde || 0} solde</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default GestionPaie;
