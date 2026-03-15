/**
 * RH Page - Business Plan
 * Gestion equipe simplifiee
 */

import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EntityLink } from '@/components/EntityLink';
import FormulaireEmploye, { type EmployeSubmitData } from '@/components/rh/FormulaireEmploye';
import GestionAbsences from '@/components/rh/GestionAbsences';
import GestionPaie from '@/components/rh/GestionPaie';
import GenerateurDSN from '@/components/rh/GenerateurDSN';
import ParametresSociaux from '@/components/rh/ParametresSociaux';
import { DocumentsRH } from '@/components/rh/DocumentsRH';
import PlanningEmploye from '@/components/rh/PlanningEmploye';
import PerformanceReviews from '@/components/rh/PerformanceReviews';
import OnboardingChecklist from '@/components/rh/OnboardingChecklist';
import OrgChart from '@/components/rh/OrgChart';
import {
  Users,
  UserPlus,
  Calendar,
  Euro,
  RefreshCw,
  Check,
  X,
  Edit2,
  Trash2,
  Briefcase,
  Clock,
  Wallet,
  Percent,
  Timer,
  FileText,
  Download,
  Search,
  Plus,
  Mail,
  Phone,
  ClipboardList,
  Filter,
  RotateCcw
} from 'lucide-react';

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  role: string;
  statut: string;
  date_embauche: string;
  salaire_mensuel?: number;
  nir?: string;
  date_naissance?: string;
  notes: string;
  // Champs enrichis
  sexe?: string;
  nationalite?: string;
  lieu_naissance?: string;
  adresse_rue?: string;
  adresse_cp?: string;
  adresse_ville?: string;
  adresse_pays?: string;
  piece_identite_type?: string;
  piece_identite_numero?: string;
  piece_identite_expiration?: string;
  poste?: string;
  type_contrat?: string;
  date_fin_contrat?: string;
  temps_travail?: string;
  heures_hebdo?: number;
  heures_mensuelles?: number;
  jours_travailles?: string[];
  convention_collective?: string;
  classification_niveau?: string;
  classification_echelon?: string;
  classification_coefficient?: number;
  categorie_sociopro?: string;
  regime_ss?: string;
  mutuelle_obligatoire?: boolean;
  mutuelle_dispense?: boolean;
  prevoyance?: boolean;
  iban?: string;
  bic?: string;
  contact_urgence_nom?: string;
  contact_urgence_tel?: string;
  contact_urgence_lien?: string;
}

interface EntrepriseInfo {
  raison_sociale: string;
  siret: string;
  code_naf: string;
  adresse: string;
  code_postal: string;
  ville: string;
  urssaf: string;
}

interface Absence {
  id: number;
  membre_id: number;
  type: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  motif: string;
  membre: { nom: string; prenom: string };
}

interface DashboardRH {
  equipe: {
    total: number;
    actifs: number;
    en_conge: number;
    roles: Record<string, number>;
  };
  absences: { en_attente: number; total_jours_mois: number };
  paie: {
    periode: string;
    masse_salariale: number;
    heures_travaillees: number;
    taux_absenteisme: number;
    cout_moyen_employe: number;
  };
}

interface HeuresSupp {
  membre_id: number;
  heures_25: number; // +25%
  heures_50: number; // +50%
}

interface Recrutement {
  id: number;
  titre: string;
  description: string;
  type_contrat: string;
  salaire_min?: number;
  salaire_max?: number;
  lieu?: string;
  competences: string[];
  date_limite?: string;
  statut: string;
  candidatures?: { count: number }[];
  created_at: string;
}

interface Candidature {
  id: number;
  recrutement_id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  cv_url?: string;
  lettre_motivation?: string;
  source: string;
  notes?: string;
  statut: string;
  date_entretien?: string;
  recrutement?: { id: number; titre: string };
  created_at: string;
}

type TabType = 'equipe' | 'planning' | 'absences' | 'paie' | 'performances' | 'dsn' | 'recrutement' | 'documents' | 'onboarding' | 'organigramme' | 'parametres';

export default function RH() {
  const [tab, setTab] = useState<TabType>('equipe');
  const [dashboard, setDashboard] = useState<DashboardRH | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [_absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMembre, setEditMembre] = useState<Membre | null>(null);
  const [_formData, _setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    role: 'commercial',
    date_embauche: '',
    salaire_mensuel: '',
    nir: '',
    date_naissance: '',
    notes: ''
  });

  // DSN State
  const [_entrepriseInfo, _setEntrepriseInfo] = useState<EntrepriseInfo>({
    raison_sociale: '',
    siret: '',
    code_naf: '',
    adresse: '',
    code_postal: '',
    ville: '',
    urssaf: ''
  });
  const [_dsnPeriode, _setDsnPeriode] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [_generatingDsn, _setGeneratingDsn] = useState(false);
  const [_showTauxSettings, _setShowTauxSettings] = useState(false);
  const [heuresSupp, setHeuresSupp] = useState<HeuresSupp[]>([]);

  // Recrutement
  const [recrutements, setRecrutements] = useState<Recrutement[]>([]);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [showRecrutementForm, setShowRecrutementForm] = useState(false);
  const [selectedRecrutement, setSelectedRecrutement] = useState<Recrutement | null>(null);
  const [recrutementForm, setRecrutementForm] = useState({
    titre: '',
    description: '',
    type_contrat: 'cdi',
    salaire_min: '',
    salaire_max: '',
    lieu: '',
    competences: '',
    date_limite: ''
  });
  const [generatingPaie, setGeneratingPaie] = useState(false);

  // Employee filters
  const [employeeFilters, setEmployeeFilters] = useState({
    role: 'all',
    status: 'all',
    search: ''
  });

  // Filtered employees
  const filteredMembres = useMemo(() => {
    return membres.filter(m => {
      // Only active employees in main list
      if (m.statut === 'inactif') return false;

      // Search filter
      if (employeeFilters.search) {
        const searchLower = employeeFilters.search.toLowerCase();
        if (!m.nom.toLowerCase().includes(searchLower) &&
            !m.prenom.toLowerCase().includes(searchLower) &&
            !m.email?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Role filter
      if (employeeFilters.role !== 'all' && m.role !== employeeFilters.role) {
        return false;
      }

      // Status filter
      if (employeeFilters.status !== 'all' && m.statut !== employeeFilters.status) {
        return false;
      }

      return true;
    });
  }, [membres, employeeFilters]);

  const resetEmployeeFilters = () => {
    setEmployeeFilters({ role: 'all', status: 'all', search: '' });
  };

  const hasActiveEmployeeFilters = employeeFilters.role !== 'all' || employeeFilters.status !== 'all' || employeeFilters.search;

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, membresData, absencesData, recrutementsData, candidaturesData] = await Promise.all([
        api.get<DashboardRH>('/admin/rh/dashboard').catch(() => null),
        api.get<Membre[]>('/admin/rh/membres').catch(() => null),
        api.get<Absence[]>('/admin/rh/absences').catch(() => null),
        api.get<Recrutement[]>('/admin/rh/recrutements').catch(() => null),
        api.get<Candidature[]>('/admin/rh/candidatures').catch(() => null),
      ]);

      if (dashData) setDashboard((dashData as any).data ?? dashData);
      if (membresData) setMembres(Array.isArray(membresData) ? membresData : (membresData as any).data || []);
      if (absencesData) setAbsences(Array.isArray(absencesData) ? absencesData : (absencesData as any).data || []);
      if (recrutementsData) setRecrutements(Array.isArray(recrutementsData) ? recrutementsData : (recrutementsData as any).data || []);
      if (candidaturesData) setCandidatures(Array.isArray(candidaturesData) ? candidaturesData : (candidaturesData as any).data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des donnees RH');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMembre = async (data: EmployeSubmitData) => {
    try {
      const endpoint = editMembre
        ? `/admin/rh/membres/${editMembre.id}`
        : '/admin/rh/membres';

      const { diplomes, ...membreData } = data;

      const response = editMembre
        ? await api.put<any>(endpoint, membreData)
        : await api.post<any>(endpoint, membreData);

      // Backend retourne { membre: {...} } — extraire l'objet
      const membre = response?.membre || response;

      // If diplomas provided, save them
      const membreId = editMembre?.id || membre?.id;
      if (membreId && diplomes && diplomes.length > 0) {
        for (const diplome of diplomes) {
          if (diplome.intitule) {
            await api.post(`/admin/rh/membres/${membreId}/diplomes`, diplome);
          }
        }
      }

      setShowForm(false);
      setEditMembre(null);
      setError(null);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du membre');
    }
  };

  const handleDeleteMembre = async (id: number) => {
    if (!confirm('Desactiver ce membre ?')) return;
    try {
      await api.delete(`/admin/rh/membres/${id}`);
      setError(null);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la desactivation du membre');
    }
  };

  const openEditForm = (membre: Membre) => {
    setEditMembre(membre);
    setShowForm(true);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      manager: 'Manager',
      commercial: 'Commercial',
      technicien: 'Technicien',
      admin: 'Admin',
      autre: 'Autre'
    };
    return labels[role] || role;
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'actif': return 'bg-green-100 text-green-700';
      case 'conge': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Gestion recrutement
  const handleSubmitRecrutement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...recrutementForm,
        salaire_min: recrutementForm.salaire_min ? Math.round(parseFloat(recrutementForm.salaire_min) * 100) : null,
        salaire_max: recrutementForm.salaire_max ? Math.round(parseFloat(recrutementForm.salaire_max) * 100) : null,
        competences: recrutementForm.competences.split(',').map(c => c.trim()).filter(c => c)
      };

      if (selectedRecrutement) {
        await api.put(`/admin/rh/recrutements/${selectedRecrutement.id}`, dataToSend);
      } else {
        await api.post('/admin/rh/recrutements', dataToSend);
      }

      setShowRecrutementForm(false);
      setSelectedRecrutement(null);
      setRecrutementForm({ titre: '', description: '', type_contrat: 'cdi', salaire_min: '', salaire_max: '', lieu: '', competences: '', date_limite: '' });
      setError(null);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du recrutement');
    }
  };

  const handleCandidatureStatus = async (id: number, statut: string) => {
    try {
      await api.put(`/admin/rh/candidatures/${id}`, { statut });
      setError(null);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise a jour de la candidature');
    }
  };

  // Generation paie vers compta
  const genererPaie = async () => {
    if (!confirm('Generer les ecritures comptables de paie pour ce mois ?')) return;

    setGeneratingPaie(true);
    try {
      const now = new Date();
      const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const result = await api.post<{ totaux: { net: number; cotisations_patronales: number; cotisations_salariales: number } }>('/admin/rh/paie/generer', { periode, heures_supp: heuresSupp });

      alert(`Paie generee avec succes !\n\nSalaires nets: ${result.totaux.net.toLocaleString('fr-FR')} \u20ac\nCotisations: ${(result.totaux.cotisations_patronales + result.totaux.cotisations_salariales).toLocaleString('fr-FR')} \u20ac\n\nLes ecritures ont ete ajoutees en comptabilite.`);
      setError(null);
      fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la generation de la paie';
      setError(message);
      alert(message);
    } finally {
      setGeneratingPaie(false);
    }
  };

  // Documents RH - Registre unique du personnel (PDF conforme Code du travail)
  const downloadRegistrePersonnel = async () => {
    try {
      // Telechargement blob (PDF) - le wrapper api ne supporte pas les reponses non-JSON
      const token = localStorage.getItem('nexus_admin_token');
      const response = await fetch('/api/admin/rh/documents/registre-personnel?format=pdf', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Erreur telechargement');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registre_personnel_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du telechargement du registre');
      alert('Erreur lors du telechargement du registre');
    }
  };

  const downloadEtatCotisations = async () => {
    const now = new Date();
    const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      const data = await api.get<{ periode: string; date_generation: string; nb_salaries: number; masse_salariale_brute: number; cotisations: { urssaf: Record<string, number>; retraite: Record<string, number>; prevoyance: Record<string, number>; pole_emploi: Record<string, number> }; total: number; total_patronal: number; total_salarial: number; total_cotisations: number }>(`/admin/rh/documents/etat-cotisations?periode=${periode}`);

      // Creer texte
      let content = `ETAT DES COTISATIONS SOCIALES\n`;
      content += `Periode: ${data.periode}\n`;
      content += `Date: ${data.date_generation}\n`;
      content += `Nb salaries: ${data.nb_salaries}\n\n`;
      content += `Masse salariale brute: ${data.masse_salariale_brute.toFixed(2)} \u20ac\n\n`;
      content += `URSSAF:\n`;
      content += `  Maladie: ${data.cotisations.urssaf.maladie.toFixed(2)} \u20ac\n`;
      content += `  Vieillesse: ${data.cotisations.urssaf.vieillesse.toFixed(2)} \u20ac\n`;
      content += `  Alloc. familiales: ${data.cotisations.urssaf.allocations_familiales.toFixed(2)} \u20ac\n`;
      content += `  AT: ${data.cotisations.urssaf.accidents_travail.toFixed(2)} \u20ac\n`;
      content += `  CSG/CRDS: ${data.cotisations.urssaf.csg_crds.toFixed(2)} \u20ac\n\n`;
      content += `Pole Emploi:\n`;
      content += `  Chomage: ${data.cotisations.pole_emploi.chomage.toFixed(2)} \u20ac\n`;
      content += `  AGS: ${data.cotisations.pole_emploi.ags.toFixed(2)} \u20ac\n\n`;
      content += `Retraite:\n`;
      content += `  AGIRC-ARRCO: ${data.cotisations.retraite.agirc_arrco_t1.toFixed(2)} \u20ac\n`;
      content += `  CEG: ${data.cotisations.retraite.ceg.toFixed(2)} \u20ac\n\n`;
      content += `TOTAL Patronal: ${data.total_patronal.toFixed(2)} \u20ac\n`;
      content += `TOTAL Salarial: ${data.total_salarial.toFixed(2)} \u20ac\n`;
      content += `TOTAL COTISATIONS: ${data.total_cotisations.toFixed(2)} \u20ac\n`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etat_cotisations_${periode}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Aucune paie generee pour ce mois';
      setError(message);
      alert(message);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Gestion RH
          </h1>
          <p className="text-gray-500 mt-1">Gerez votre equipe</p>
        </div>
        <Button variant="outline" onClick={fetchAll}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex justify-between items-center">
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Equipe</p>
              <p className="text-2xl font-bold">{dashboard?.equipe.total || 0}</p>
              <p className="text-xs text-gray-400">{dashboard?.equipe.actifs || 0} actifs</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En conge</p>
              <p className="text-2xl font-bold">{dashboard?.equipe.en_conge || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Absences en attente</p>
              <p className="text-2xl font-bold text-orange-600">{dashboard?.absences.en_attente || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Euro className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Masse salariale</p>
              <p className="text-2xl font-bold">{((dashboard?.paie?.masse_salariale || 0) / 100).toLocaleString('fr-FR')} €</p>
              <p className="text-xs text-gray-400">ce mois</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          className={`px-4 py-2 -mb-px ${tab === 'equipe' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('equipe')}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Equipe
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'planning' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('planning')}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Planning
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'absences' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('absences')}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Absences
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'paie' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('paie')}
        >
          <Euro className="w-4 h-4 inline mr-2" />
          Paie
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'dsn' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('dsn')}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          DSN
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'recrutement' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('recrutement')}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Recrutement
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'documents' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('documents')}
        >
          <ClipboardList className="w-4 h-4 inline mr-2" />
          Documents
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'onboarding' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('onboarding')}
        >
          <ClipboardList className="w-4 h-4 inline mr-2" />
          Onboarding
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'organigramme' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('organigramme')}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Organigramme
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'parametres' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('parametres')}
        >
          <Percent className="w-4 h-4 inline mr-2" />
          Taux & Paramètres
        </button>
      </div>

      {/* Tab Equipe */}
      {tab === 'equipe' && (
        <div>
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
            {/* Filters */}
            <Card className="p-4 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="w-4 h-4 text-gray-400" />

                {/* Search */}
                <div className="relative flex-1 min-w-[150px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Rechercher..."
                    value={employeeFilters.search}
                    onChange={(e) => setEmployeeFilters({ ...employeeFilters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>

                {/* Role filter */}
                <select
                  value={employeeFilters.role}
                  onChange={(e) => setEmployeeFilters({ ...employeeFilters, role: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tous les rôles</option>
                  <option value="manager">Manager</option>
                  <option value="commercial">Commercial</option>
                  <option value="technicien">Technicien</option>
                  <option value="admin">Admin</option>
                  <option value="autre">Autre</option>
                </select>

                {/* Status filter */}
                <select
                  value={employeeFilters.status}
                  onChange={(e) => setEmployeeFilters({ ...employeeFilters, status: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="actif">Actif</option>
                  <option value="conge">En congé</option>
                </select>

                {hasActiveEmployeeFilters && (
                  <Button onClick={resetEmployeeFilters} variant="outline" size="sm">
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                )}

                {hasActiveEmployeeFilters && (
                  <span className="text-sm text-gray-500">
                    {filteredMembres.length} / {membres.filter(m => m.statut !== 'inactif').length}
                  </span>
                )}
              </div>
            </Card>

            <Button onClick={() => { setShowForm(true); setEditMembre(null); }}>
              <UserPlus className="w-4 h-4 mr-2" />
              Ajouter membre
            </Button>
          </div>

          {showForm && (
            <Card className="p-6 mb-4">
              <h3 className="font-semibold text-lg mb-4">{editMembre ? 'Modifier l\'employé' : 'Nouvel employé'}</h3>
              <FormulaireEmploye
                editMembre={editMembre}
                onSubmit={handleSubmitMembre}
                onCancel={() => { setShowForm(false); setEditMembre(null); }}
              />
            </Card>
          )}

          <div className="grid gap-4">
            {filteredMembres.map(membre => (
              <Card key={membre.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-semibold text-blue-600">
                        {membre.prenom[0]}{membre.nom[0]}
                      </span>
                    </div>
                    <div>
                      <EntityLink
                        type="employee"
                        entity={{
                          id: membre.id,
                          nom: membre.nom,
                          prenom: membre.prenom,
                          role: membre.role
                        }}
                        label={`${membre.prenom} ${membre.nom}`}
                        className="font-semibold"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Briefcase className="w-3 h-3" />
                        {getRoleLabel(membre.role)}
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getStatutColor(membre.statut)}`}>
                          {membre.statut}
                        </span>
                      </div>
                      {membre.email && <p className="text-sm text-gray-400">{membre.email}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditForm(membre)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteMembre(membre.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {filteredMembres.length === 0 && (
              <Card className="p-8 text-center text-gray-500">
                {hasActiveEmployeeFilters ? (
                  <>
                    <p>Aucun membre trouvé avec ces filtres</p>
                    <Button variant="link" onClick={resetEmployeeFilters} className="mt-2">
                      Effacer les filtres
                    </Button>
                  </>
                ) : (
                  'Aucun membre dans l\'equipe'
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Tab Planning */}
      {tab === 'planning' && (
        <PlanningEmploye />
      )}

      {/* Tab Absences */}
      {tab === 'absences' && (
        <GestionAbsences
          membres={membres.filter(m => m.statut === 'actif')}
          onRefresh={fetchAll}
        />
      )}

      {/* Tab Paie - Nouveau composant complet */}
      {tab === 'paie' && (
        <GestionPaie />
      )}

      {/* Tab Performances */}
      {tab === 'performances' && (
        <PerformanceReviews membres={membres} />
      )}

      {/* Legacy performances content removed — replaced by PerformanceReviews component */}
      {false && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-600" />
              Paie du mois ({dashboard?.paie?.periode || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Euro className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{((dashboard?.paie?.masse_salariale || 0) / 100).toLocaleString('fr-FR')} €</p>
                <p className="text-sm text-gray-500">Masse salariale</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Timer className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{dashboard?.paie?.heures_travaillees || 0}h</p>
                <p className="text-sm text-gray-500">Heures travaillées</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Percent className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-600">{(dashboard?.paie?.taux_absenteisme || 0).toFixed(1)}%</p>
                <p className="text-sm text-gray-500">Taux d'absentéisme</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-600">{((dashboard?.paie?.cout_moyen_employe || 0) / 100).toLocaleString('fr-FR')} €</p>
                <p className="text-sm text-gray-500">Coût moyen/employé</p>
              </div>
            </div>
          </Card>

          {/* Section heures supplémentaires */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Heures supplémentaires du mois
            </h3>
            {membres.filter(m => m.statut === 'actif').length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun employé actif</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Employé</th>
                      <th className="pb-2 font-medium text-center">Heures +25%</th>
                      <th className="pb-2 font-medium text-center">Heures +50%</th>
                      <th className="pb-2 font-medium text-right">Montant HS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membres.filter(m => m.statut === 'actif').map(membre => {
                      const hs = heuresSupp.find(h => h.membre_id === membre.id) || { heures_25: 0, heures_50: 0 };
                      const tauxHoraire = membre.salaire_mensuel ? (membre.salaire_mensuel / 100) / 151.67 : 0;
                      const montantHS = (hs.heures_25 * tauxHoraire * 1.25) + (hs.heures_50 * tauxHoraire * 1.50);

                      return (
                        <tr key={membre.id} className="border-b">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-semibold text-blue-600">
                                  {membre.prenom[0]}{membre.nom[0]}
                                </span>
                              </div>
                              <span>{membre.prenom} {membre.nom}</span>
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={hs.heures_25 || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setHeuresSupp(prev => {
                                  const existing = prev.find(h => h.membre_id === membre.id);
                                  if (existing) {
                                    return prev.map(h => h.membre_id === membre.id ? { ...h, heures_25: val } : h);
                                  }
                                  return [...prev, { membre_id: membre.id, heures_25: val, heures_50: 0 }];
                                });
                              }}
                              className="w-20 mx-auto text-center"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-3 text-center">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={hs.heures_50 || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setHeuresSupp(prev => {
                                  const existing = prev.find(h => h.membre_id === membre.id);
                                  if (existing) {
                                    return prev.map(h => h.membre_id === membre.id ? { ...h, heures_50: val } : h);
                                  }
                                  return [...prev, { membre_id: membre.id, heures_25: 0, heures_50: val }];
                                });
                              }}
                              className="w-20 mx-auto text-center"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-3 text-right font-medium">
                            {montantHS > 0 ? `${montantHS.toFixed(2)} €` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="pt-3">Total</td>
                      <td className="pt-3 text-center">
                        {heuresSupp.reduce((sum, h) => sum + h.heures_25, 0)}h
                      </td>
                      <td className="pt-3 text-center">
                        {heuresSupp.reduce((sum, h) => sum + h.heures_50, 0)}h
                      </td>
                      <td className="pt-3 text-right">
                        {(() => {
                          const total = membres.filter(m => m.statut === 'actif').reduce((sum, membre) => {
                            const hs = heuresSupp.find(h => h.membre_id === membre.id) || { heures_25: 0, heures_50: 0 };
                            const tauxHoraire = membre.salaire_mensuel ? (membre.salaire_mensuel / 100) / 151.67 : 0;
                            return sum + (hs.heures_25 * tauxHoraire * 1.25) + (hs.heures_50 * tauxHoraire * 1.50);
                          }, 0);
                          return `${total.toFixed(2)} €`;
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <strong>Rappel :</strong> Les 8 premières heures supp. sont majorées de 25%, les suivantes de 50%.
              Le contingent annuel est de 220h par salarié (au-delà, repos compensateur obligatoire).
            </div>
          </Card>

          {/* Section bulletins de paie */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Bulletins de paie</h3>
            {membres.filter(m => m.statut === 'actif').length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun employé actif</p>
            ) : (
              <div className="space-y-3">
                {membres.filter(m => m.statut === 'actif').map(membre => {
                  const hs = heuresSupp.find(h => h.membre_id === membre.id) || { heures_25: 0, heures_50: 0 };
                  const tauxHoraire = membre.salaire_mensuel ? (membre.salaire_mensuel / 100) / 151.67 : 0;
                  const montantHS = (hs.heures_25 * tauxHoraire * 1.25) + (hs.heures_50 * tauxHoraire * 1.50);
                  const totalBrut = (membre.salaire_mensuel || 0) / 100 + montantHS;

                  return (
                    <div key={membre.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">
                            {membre.prenom[0]}{membre.nom[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{membre.prenom} {membre.nom}</p>
                          <p className="text-xs text-gray-500">{getRoleLabel(membre.role)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{totalBrut.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € brut</p>
                        {montantHS > 0 && (
                          <p className="text-xs text-orange-600">dont {montantHS.toFixed(2)} € HS</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab DSN - Composant dédié */}
      {tab === 'dsn' && <GenerateurDSN />}

      {/* Tab Recrutement */}
      {tab === 'recrutement' && (
        <div className="space-y-6">
          {/* Stats recrutement */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Postes ouverts</p>
                  <p className="text-2xl font-bold">{recrutements.filter(r => r.statut === 'ouvert').length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Candidatures totales</p>
                  <p className="text-2xl font-bold">{candidatures.length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">En attente</p>
                  <p className="text-2xl font-bold text-orange-600">{candidatures.filter(c => c.statut === 'nouveau').length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Liste des offres */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Offres de recrutement
              </h3>
              <Button onClick={() => { setShowRecrutementForm(true); setSelectedRecrutement(null); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle offre
              </Button>
            </div>

            {showRecrutementForm && (
              <Card className="p-4 mb-4 bg-gray-50">
                <h4 className="font-medium mb-3">{selectedRecrutement ? 'Modifier' : 'Nouvelle'} offre</h4>
                <form onSubmit={handleSubmitRecrutement} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Titre du poste"
                    value={recrutementForm.titre}
                    onChange={e => setRecrutementForm({ ...recrutementForm, titre: e.target.value })}
                    required
                  />
                  <select
                    className="border rounded-md px-3 py-2"
                    value={recrutementForm.type_contrat}
                    onChange={e => setRecrutementForm({ ...recrutementForm, type_contrat: e.target.value })}
                  >
                    <option value="cdi">CDI</option>
                    <option value="cdd">CDD</option>
                    <option value="stage">Stage</option>
                    <option value="alternance">Alternance</option>
                  </select>
                  <Input
                    placeholder="Lieu"
                    value={recrutementForm.lieu}
                    onChange={e => setRecrutementForm({ ...recrutementForm, lieu: e.target.value })}
                  />
                  <Input
                    type="date"
                    placeholder="Date limite"
                    value={recrutementForm.date_limite}
                    onChange={e => setRecrutementForm({ ...recrutementForm, date_limite: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Salaire min (€/an)"
                    value={recrutementForm.salaire_min}
                    onChange={e => setRecrutementForm({ ...recrutementForm, salaire_min: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Salaire max (€/an)"
                    value={recrutementForm.salaire_max}
                    onChange={e => setRecrutementForm({ ...recrutementForm, salaire_max: e.target.value })}
                  />
                  <div className="md:col-span-2">
                    <Input
                      placeholder="Compétences (séparées par des virgules)"
                      value={recrutementForm.competences}
                      onChange={e => setRecrutementForm({ ...recrutementForm, competences: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <textarea
                      className="w-full border rounded-md px-3 py-2 h-24"
                      placeholder="Description du poste"
                      value={recrutementForm.description}
                      onChange={e => setRecrutementForm({ ...recrutementForm, description: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <Button type="submit">
                      <Check className="w-4 h-4 mr-2" />
                      {selectedRecrutement ? 'Modifier' : 'Créer'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowRecrutementForm(false)}>
                      <X className="w-4 h-4 mr-2" />
                      Annuler
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {recrutements.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucune offre de recrutement</p>
            ) : (
              <div className="space-y-3">
                {recrutements.map(recrutement => (
                  <Card key={recrutement.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{recrutement.titre}</h4>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            recrutement.statut === 'ouvert' ? 'bg-green-100 text-green-700' :
                            recrutement.statut === 'pourvu' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {recrutement.statut}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {recrutement.type_contrat.toUpperCase()} {recrutement.lieu && `- ${recrutement.lieu}`}
                          {recrutement.salaire_min && recrutement.salaire_max && ` - ${(recrutement.salaire_min/100).toLocaleString()}€ - ${(recrutement.salaire_max/100).toLocaleString()}€`}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {recrutement.candidatures?.[0]?.count || 0} candidature(s)
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setSelectedRecrutement(recrutement);
                          setRecrutementForm({
                            titre: recrutement.titre,
                            description: recrutement.description || '',
                            type_contrat: recrutement.type_contrat,
                            salaire_min: recrutement.salaire_min ? String(recrutement.salaire_min / 100) : '',
                            salaire_max: recrutement.salaire_max ? String(recrutement.salaire_max / 100) : '',
                            lieu: recrutement.lieu || '',
                            competences: recrutement.competences?.join(', ') || '',
                            date_limite: recrutement.date_limite || ''
                          });
                          setShowRecrutementForm(true);
                        }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          {/* Candidatures */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Candidatures récentes
            </h3>
            {candidatures.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucune candidature</p>
            ) : (
              <div className="space-y-3">
                {candidatures.slice(0, 10).map(candidature => (
                  <Card key={candidature.id} className="p-4 border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-purple-600">
                            {candidature.prenom[0]}{candidature.nom[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{candidature.prenom} {candidature.nom}</p>
                          <p className="text-sm text-gray-500">{candidature.recrutement?.titre}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Mail className="w-3 h-3" /> {candidature.email}
                            {candidature.telephone && <><Phone className="w-3 h-3 ml-2" /> {candidature.telephone}</>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="text-sm border rounded px-2 py-1"
                          value={candidature.statut}
                          onChange={e => handleCandidatureStatus(candidature.id, e.target.value)}
                        >
                          <option value="nouveau">Nouveau</option>
                          <option value="preselection">Présélection</option>
                          <option value="entretien">Entretien</option>
                          <option value="retenu">Retenu</option>
                          <option value="refuse">Refusé</option>
                        </select>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab Documents */}
      {tab === 'documents' && (
        <div className="space-y-6">
          {/* Composant DocumentsRH complet */}
          <DocumentsRH />

          {/* Documents légaux rapides */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Documents légaux obligatoires
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border hover:shadow-md transition-shadow cursor-pointer p-4" onClick={downloadRegistrePersonnel}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Registre du personnel</p>
                    <p className="text-xs text-gray-500">Document obligatoire - PDF</p>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 ml-auto" />
                </div>
              </Card>

              <Card className="border hover:shadow-md transition-shadow cursor-pointer p-4" onClick={downloadEtatCotisations}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Euro className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">État des cotisations</p>
                    <p className="text-xs text-gray-500">Récapitulatif mensuel - PDF</p>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 ml-auto" />
                </div>
              </Card>
            </div>
          </Card>

          {/* Génération paie vers compta */}
          <Card className="p-6 bg-gradient-to-r from-green-50 to-blue-50">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Euro className="w-5 h-5 text-green-600" />
              Génération de la paie vers comptabilité
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Générez automatiquement les écritures comptables de paie (salaires nets et cotisations sociales)
              pour le mois en cours. Ces écritures seront ajoutées dans la comptabilité.
            </p>
            <div className="flex items-center gap-4">
              <Button onClick={genererPaie} disabled={generatingPaie} className="gap-2">
                {generatingPaie ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Euro className="w-4 h-4" />
                )}
                Générer les écritures de paie
              </Button>
              <span className="text-sm text-gray-500">
                {membres.filter(m => m.statut === 'actif').length} salarié(s) actif(s)
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Tab Paramètres sociaux */}
      {/* Tab Onboarding */}
      {tab === 'onboarding' && <OnboardingChecklist membres={membres} />}

      {/* Tab Organigramme */}
      {tab === 'organigramme' && <OrgChart membres={membres} />}

      {tab === 'parametres' && <ParametresSociaux />}
    </div>
  );
}
