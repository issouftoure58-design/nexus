/**
 * RH Page - Business Plan
 * Gestion equipe simplifiee
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Building2,
  AlertTriangle,
  Info,
  Search,
  Plus,
  Mail,
  Phone,
  FileUp,
  Printer,
  Eye,
  UserCheck,
  ClipboardList
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
  nir?: string; // Numéro de sécurité sociale
  date_naissance?: string;
  lieu_naissance?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  notes: string;
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

// Taux de cotisation 2026 (valeurs officielles)
const TAUX_COTISATIONS_2026 = {
  // Sécurité sociale
  maladie_employeur: 13.00,
  maladie_salarie: 0,
  vieillesse_plafonnee_employeur: 8.55,
  vieillesse_plafonnee_salarie: 6.90,
  vieillesse_deplafonnee_employeur: 2.02,
  vieillesse_deplafonnee_salarie: 0.40,
  allocations_familiales: 5.25, // taux réduit si salaire < 3.5 SMIC
  accidents_travail: 2.00, // variable selon activité

  // Chômage
  chomage_employeur: 4.05,
  chomage_salarie: 0,
  ags: 0.15,

  // Retraite complémentaire AGIRC-ARRCO
  retraite_t1_employeur: 4.72,
  retraite_t1_salarie: 3.15,
  retraite_t2_employeur: 12.95,
  retraite_t2_salarie: 8.64,
  ceg_t1_employeur: 1.29,
  ceg_t1_salarie: 0.86,

  // CSG/CRDS
  csg_deductible: 6.80,
  csg_non_deductible: 2.40,
  crds: 0.50,

  // SMIC 2026 (estimé +2% vs 2025)
  smic_horaire: 12.12,
  smic_mensuel: 1837.84,
  plafond_ss_mensuel: 3941,
};

type TauxCotisations = typeof TAUX_COTISATIONS_2026;

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

type TabType = 'equipe' | 'absences' | 'performances' | 'dsn' | 'recrutement' | 'documents';

export default function RH() {
  const [tab, setTab] = useState<TabType>('equipe');
  const [dashboard, setDashboard] = useState<DashboardRH | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMembre, setEditMembre] = useState<Membre | null>(null);
  const [formData, setFormData] = useState({
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
  const [entrepriseInfo, setEntrepriseInfo] = useState<EntrepriseInfo>({
    raison_sociale: '',
    siret: '',
    code_naf: '',
    adresse: '',
    code_postal: '',
    ville: '',
    urssaf: ''
  });
  const [dsnPeriode, setDsnPeriode] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generatingDsn, setGeneratingDsn] = useState(false);
  const [tauxCotisations, setTauxCotisations] = useState<TauxCotisations>(TAUX_COTISATIONS_2026);
  const [showTauxSettings, setShowTauxSettings] = useState(false);
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

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` };

      const [dashRes, membresRes, absencesRes, recrutementsRes, candidaturesRes] = await Promise.all([
        fetch('/api/admin/rh/dashboard', { headers }),
        fetch('/api/admin/rh/membres', { headers }),
        fetch('/api/admin/rh/absences', { headers }),
        fetch('/api/admin/rh/recrutements', { headers }),
        fetch('/api/admin/rh/candidatures', { headers })
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (membresRes.ok) setMembres(await membresRes.json());
      if (absencesRes.ok) setAbsences(await absencesRes.json());
      if (recrutementsRes.ok) setRecrutements(await recrutementsRes.json());
      if (candidaturesRes.ok) setCandidatures(await candidaturesRes.json());
    } catch (err) {
      console.error('Erreur fetch RH:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMembre = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
        'Content-Type': 'application/json'
      };

      const url = editMembre
        ? `/api/admin/rh/membres/${editMembre.id}`
        : '/api/admin/rh/membres';

      const method = editMembre ? 'PUT' : 'POST';

      // Convert salary to centimes
      const dataToSend = {
        ...formData,
        salaire_mensuel: formData.salaire_mensuel ? Math.round(parseFloat(formData.salaire_mensuel) * 100) : 0,
        nir: formData.nir || null,
        date_naissance: formData.date_naissance || null
      };

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        setShowForm(false);
        setEditMembre(null);
        setFormData({ nom: '', prenom: '', email: '', telephone: '', role: 'commercial', date_embauche: '', salaire_mensuel: '', nir: '', date_naissance: '', notes: '' });
        fetchAll();
      }
    } catch (err) {
      console.error('Erreur save membre:', err);
    }
  };

  const handleDeleteMembre = async (id: number) => {
    if (!confirm('Desactiver ce membre ?')) return;
    try {
      await fetch(`/api/admin/rh/membres/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      fetchAll();
    } catch (err) {
      console.error('Erreur delete membre:', err);
    }
  };

  const handleAbsenceAction = async (id: number, action: 'approve' | 'refuse') => {
    try {
      await fetch(`/api/admin/rh/absences/${id}/${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      fetchAll();
    } catch (err) {
      console.error('Erreur action absence:', err);
    }
  };

  const openEditForm = (membre: Membre) => {
    setEditMembre(membre);
    setFormData({
      nom: membre.nom,
      prenom: membre.prenom,
      email: membre.email || '',
      telephone: membre.telephone || '',
      role: membre.role,
      date_embauche: membre.date_embauche || '',
      salaire_mensuel: membre.salaire_mensuel ? String(membre.salaire_mensuel / 100) : '',
      nir: membre.nir || '',
      date_naissance: membre.date_naissance || '',
      notes: membre.notes || ''
    });
    setShowForm(true);
  };

  // Calcul des cotisations pour un salaire brut
  const calculerCotisations = (salaireBrut: number) => {
    const plafondSS = tauxCotisations.plafond_ss_mensuel * 100; // en centimes
    const tranche1 = Math.min(salaireBrut, plafondSS);
    const tranche2 = Math.max(0, salaireBrut - plafondSS);

    // Cotisations patronales
    const patronales = {
      maladie: salaireBrut * tauxCotisations.maladie_employeur / 100,
      vieillesse_plafonnee: tranche1 * tauxCotisations.vieillesse_plafonnee_employeur / 100,
      vieillesse_deplafonnee: salaireBrut * tauxCotisations.vieillesse_deplafonnee_employeur / 100,
      allocations_familiales: salaireBrut * tauxCotisations.allocations_familiales / 100,
      accidents_travail: salaireBrut * tauxCotisations.accidents_travail / 100,
      chomage: salaireBrut * tauxCotisations.chomage_employeur / 100,
      ags: salaireBrut * tauxCotisations.ags / 100,
      retraite_t1: tranche1 * tauxCotisations.retraite_t1_employeur / 100,
      retraite_t2: tranche2 * tauxCotisations.retraite_t2_employeur / 100,
      ceg: tranche1 * tauxCotisations.ceg_t1_employeur / 100,
    };

    // Cotisations salariales
    const salariales = {
      vieillesse_plafonnee: tranche1 * tauxCotisations.vieillesse_plafonnee_salarie / 100,
      vieillesse_deplafonnee: salaireBrut * tauxCotisations.vieillesse_deplafonnee_salarie / 100,
      retraite_t1: tranche1 * tauxCotisations.retraite_t1_salarie / 100,
      retraite_t2: tranche2 * tauxCotisations.retraite_t2_salarie / 100,
      ceg: tranche1 * tauxCotisations.ceg_t1_salarie / 100,
      csg_deductible: salaireBrut * 0.9825 * tauxCotisations.csg_deductible / 100, // Assiette CSG = 98.25% du brut
      csg_non_deductible: salaireBrut * 0.9825 * tauxCotisations.csg_non_deductible / 100,
      crds: salaireBrut * 0.9825 * tauxCotisations.crds / 100,
    };

    const totalPatronales = Object.values(patronales).reduce((a, b) => a + b, 0);
    const totalSalariales = Object.values(salariales).reduce((a, b) => a + b, 0);
    const salaireNet = salaireBrut - totalSalariales;

    return { patronales, salariales, totalPatronales, totalSalariales, salaireNet };
  };

  // Génération du fichier DSN
  const generateDSN = () => {
    if (!entrepriseInfo.siret || !entrepriseInfo.raison_sociale) {
      alert('Veuillez renseigner les informations de l\'entreprise');
      return;
    }

    const membresActifs = membres.filter(m => m.statut === 'actif');
    if (membresActifs.length === 0) {
      alert('Aucun employé actif à déclarer');
      return;
    }

    setGeneratingDsn(true);

    try {
      const [year, month] = dsnPeriode.split('-');
      const dateGeneration = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const siren = entrepriseInfo.siret.slice(0, 9);
      const nic = entrepriseInfo.siret.slice(9, 14);

      // Structure DSN simplifiée (format réel beaucoup plus complexe)
      let dsn = '';

      // S10 - Envoi
      dsn += `S10.G00.00.001,'${dateGeneration}'\n`;
      dsn += `S10.G00.00.002,'01'\n`; // Nature de la déclaration
      dsn += `S10.G00.00.003,'11'\n`; // Type d'envoi (11 = mensuel normal)
      dsn += `S10.G00.00.005,'${entrepriseInfo.raison_sociale}'\n`;
      dsn += `S10.G00.00.006,'${siren}'\n`;
      dsn += `S10.G00.00.007,'${nic}'\n`;

      // S20 - Entreprise
      dsn += `S20.G00.05.001,'${siren}'\n`;
      dsn += `S20.G00.05.002,'${nic}'\n`;
      dsn += `S20.G00.05.003,'${entrepriseInfo.code_naf}'\n`;
      dsn += `S20.G00.05.004,'${entrepriseInfo.adresse}'\n`;
      dsn += `S20.G00.05.006,'${entrepriseInfo.code_postal}'\n`;
      dsn += `S20.G00.05.007,'${entrepriseInfo.ville}'\n`;

      // S21 - Pour chaque salarié
      membresActifs.forEach((membre, index) => {
        const numLigne = String(index + 1).padStart(3, '0');
        const cotisations = calculerCotisations(membre.salaire_mensuel || 0);

        // Individu
        dsn += `S21.G00.06.001,'${membre.nir || ''}'\n`;
        dsn += `S21.G00.06.002,'${membre.nom}'\n`;
        dsn += `S21.G00.06.003,'${membre.prenom}'\n`;
        dsn += `S21.G00.06.004,'${membre.date_naissance || ''}'\n`;

        // Contrat
        dsn += `S21.G00.40.001,'${numLigne}'\n`;
        dsn += `S21.G00.40.002,'${membre.date_embauche || ''}'\n`;
        dsn += `S21.G00.40.007,'01'\n`; // CDI

        // Rémunération
        const brutCentimes = membre.salaire_mensuel || 0;
        dsn += `S21.G00.51.001,'${year}${month}'\n`; // Période
        dsn += `S21.G00.51.010,'001'\n`; // Type = salaire brut
        dsn += `S21.G00.51.011,'${(brutCentimes / 100).toFixed(2)}'\n`;
        dsn += `S21.G00.51.012,'151.67'\n`; // Heures

        // Cotisations individuelles
        dsn += `S21.G00.78.001,'016'\n`; // Code CSG
        dsn += `S21.G00.78.002,'${(cotisations.salariales.csg_deductible / 100).toFixed(2)}'\n`;
        dsn += `S21.G00.78.001,'018'\n`; // Code CRDS
        dsn += `S21.G00.78.002,'${(cotisations.salariales.crds / 100).toFixed(2)}'\n`;
      });

      // S80 - Totaux
      const totalBrut = membresActifs.reduce((sum, m) => sum + (m.salaire_mensuel || 0), 0);
      const totauxCotis = calculerCotisations(totalBrut);
      dsn += `S80.G01.00.001,'${(totalBrut / 100).toFixed(2)}'\n`; // Assiette brute
      dsn += `S80.G01.00.002,'${(totauxCotis.totalPatronales / 100).toFixed(2)}'\n`;
      dsn += `S80.G01.00.003,'${(totauxCotis.totalSalariales / 100).toFixed(2)}'\n`;

      // Téléchargement
      const blob = new Blob([dsn], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DSN_${entrepriseInfo.siret}_${dsnPeriode}.dsn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`DSN générée pour ${membresActifs.length} salarié(s)\nPériode: ${month}/${year}\nMasse salariale: ${(totalBrut / 100).toLocaleString('fr-FR')} €`);
    } catch (error) {
      console.error('Erreur génération DSN:', error);
      alert('Erreur lors de la génération de la DSN');
    } finally {
      setGeneratingDsn(false);
    }
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

  const getAbsenceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      conge: 'Conge',
      maladie: 'Maladie',
      formation: 'Formation',
      autre: 'Autre'
    };
    return labels[type] || type;
  };

  // Gestion recrutement
  const handleSubmitRecrutement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
        'Content-Type': 'application/json'
      };

      const dataToSend = {
        ...recrutementForm,
        salaire_min: recrutementForm.salaire_min ? Math.round(parseFloat(recrutementForm.salaire_min) * 100) : null,
        salaire_max: recrutementForm.salaire_max ? Math.round(parseFloat(recrutementForm.salaire_max) * 100) : null,
        competences: recrutementForm.competences.split(',').map(c => c.trim()).filter(c => c)
      };

      const url = selectedRecrutement
        ? `/api/admin/rh/recrutements/${selectedRecrutement.id}`
        : '/api/admin/rh/recrutements';

      const response = await fetch(url, {
        method: selectedRecrutement ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        setShowRecrutementForm(false);
        setSelectedRecrutement(null);
        setRecrutementForm({ titre: '', description: '', type_contrat: 'cdi', salaire_min: '', salaire_max: '', lieu: '', competences: '', date_limite: '' });
        fetchAll();
      }
    } catch (err) {
      console.error('Erreur save recrutement:', err);
    }
  };

  const handleCandidatureStatus = async (id: number, statut: string) => {
    try {
      await fetch(`/api/admin/rh/candidatures/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statut })
      });
      fetchAll();
    } catch (err) {
      console.error('Erreur update candidature:', err);
    }
  };

  // Génération paie vers compta
  const genererPaie = async () => {
    if (!confirm('Générer les écritures comptables de paie pour ce mois ?')) return;

    setGeneratingPaie(true);
    try {
      const now = new Date();
      const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const response = await fetch('/api/admin/rh/paie/generer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ periode, heures_supp: heuresSupp })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Paie générée avec succès !\n\nSalaires nets: ${result.totaux.net.toLocaleString('fr-FR')} €\nCotisations: ${(result.totaux.cotisations_patronales + result.totaux.cotisations_salariales).toLocaleString('fr-FR')} €\n\nLes écritures ont été ajoutées en comptabilité.`);
        fetchAll();
      } else {
        const err = await response.json();
        alert(`Erreur: ${err.error}`);
      }
    } catch (err) {
      console.error('Erreur génération paie:', err);
      alert('Erreur lors de la génération de la paie');
    } finally {
      setGeneratingPaie(false);
    }
  };

  // Documents RH
  const downloadRegistrePersonnel = async () => {
    try {
      const response = await fetch('/api/admin/rh/documents/registre-personnel', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      const data = await response.json();

      // Créer CSV
      const headers = ['N°', 'Nom', 'Prénom', 'Date naissance', 'Emploi', 'Date entrée', 'Date sortie', 'Type contrat'];
      const rows = data.employes.map((e: { numero_ordre: number; nom: string; prenom: string; date_naissance: string; emploi: string; date_entree: string; date_sortie: string; type_contrat: string }) =>
        [e.numero_ordre, e.nom, e.prenom, e.date_naissance || '', e.emploi, e.date_entree || '', e.date_sortie || '', e.type_contrat]
      );

      const csv = [headers.join(';'), ...rows.map((r: (string | number)[]) => r.join(';'))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registre_personnel_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement registre:', err);
    }
  };

  const downloadEtatCotisations = async () => {
    const now = new Date();
    const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      const response = await fetch(`/api/admin/rh/documents/etat-cotisations?periode=${periode}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!response.ok) {
        alert('Aucune paie générée pour ce mois');
        return;
      }
      const data = await response.json();

      // Créer texte
      let content = `ÉTAT DES COTISATIONS SOCIALES\n`;
      content += `Période: ${data.periode}\n`;
      content += `Date: ${data.date_generation}\n`;
      content += `Nb salariés: ${data.nb_salaries}\n\n`;
      content += `Masse salariale brute: ${data.masse_salariale_brute.toFixed(2)} €\n\n`;
      content += `URSSAF:\n`;
      content += `  Maladie: ${data.cotisations.urssaf.maladie.toFixed(2)} €\n`;
      content += `  Vieillesse: ${data.cotisations.urssaf.vieillesse.toFixed(2)} €\n`;
      content += `  Alloc. familiales: ${data.cotisations.urssaf.allocations_familiales.toFixed(2)} €\n`;
      content += `  AT: ${data.cotisations.urssaf.accidents_travail.toFixed(2)} €\n`;
      content += `  CSG/CRDS: ${data.cotisations.urssaf.csg_crds.toFixed(2)} €\n\n`;
      content += `Pôle Emploi:\n`;
      content += `  Chômage: ${data.cotisations.pole_emploi.chomage.toFixed(2)} €\n`;
      content += `  AGS: ${data.cotisations.pole_emploi.ags.toFixed(2)} €\n\n`;
      content += `Retraite:\n`;
      content += `  AGIRC-ARRCO: ${data.cotisations.retraite.agirc_arrco_t1.toFixed(2)} €\n`;
      content += `  CEG: ${data.cotisations.retraite.ceg.toFixed(2)} €\n\n`;
      content += `TOTAL Patronal: ${data.total_patronal.toFixed(2)} €\n`;
      content += `TOTAL Salarial: ${data.total_salarial.toFixed(2)} €\n`;
      content += `TOTAL COTISATIONS: ${data.total_cotisations.toFixed(2)} €\n`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etat_cotisations_${periode}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement état cotisations:', err);
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
          className={`px-4 py-2 -mb-px ${tab === 'absences' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('absences')}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Absences
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'performances' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('performances')}
        >
          <Wallet className="w-4 h-4 inline mr-2" />
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
      </div>

      {/* Tab Equipe */}
      {tab === 'equipe' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setShowForm(true); setEditMembre(null); }}>
              <UserPlus className="w-4 h-4 mr-2" />
              Ajouter membre
            </Button>
          </div>

          {showForm && (
            <Card className="p-4 mb-4">
              <h3 className="font-semibold mb-4">{editMembre ? 'Modifier' : 'Nouveau'} membre</h3>
              <form onSubmit={handleSubmitMembre} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Nom"
                  value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
                <Input
                  placeholder="Prenom"
                  value={formData.prenom}
                  onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
                <Input
                  placeholder="Telephone"
                  value={formData.telephone}
                  onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                />
                <select
                  className="border rounded-md px-3 py-2"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="manager">Manager</option>
                  <option value="commercial">Commercial</option>
                  <option value="technicien">Technicien</option>
                  <option value="admin">Admin</option>
                  <option value="autre">Autre</option>
                </select>
                <Input
                  type="date"
                  placeholder="Date embauche"
                  value={formData.date_embauche}
                  onChange={e => setFormData({ ...formData, date_embauche: e.target.value })}
                />
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Salaire mensuel brut"
                    value={formData.salaire_mensuel}
                    onChange={e => setFormData({ ...formData, salaire_mensuel: e.target.value })}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                </div>
                <Input
                  placeholder="NIR (n° sécurité sociale)"
                  value={formData.nir}
                  onChange={e => setFormData({ ...formData, nir: e.target.value.replace(/\s/g, '') })}
                  maxLength={15}
                />
                <Input
                  type="date"
                  placeholder="Date de naissance"
                  value={formData.date_naissance}
                  onChange={e => setFormData({ ...formData, date_naissance: e.target.value })}
                />
                <div className="md:col-span-2">
                  <Input
                    placeholder="Notes"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button type="submit">
                    <Check className="w-4 h-4 mr-2" />
                    {editMembre ? 'Modifier' : 'Ajouter'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditMembre(null); }}>
                    <X className="w-4 h-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid gap-4">
            {membres.filter(m => m.statut !== 'inactif').map(membre => (
              <Card key={membre.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-semibold text-blue-600">
                        {membre.prenom[0]}{membre.nom[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{membre.prenom} {membre.nom}</h3>
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

            {membres.filter(m => m.statut !== 'inactif').length === 0 && (
              <Card className="p-8 text-center text-gray-500">
                Aucun membre dans l'equipe
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Tab Absences */}
      {tab === 'absences' && (
        <div className="space-y-4">
          {absences.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              Aucune demande d'absence
            </Card>
          ) : (
            absences.map(absence => (
              <Card key={absence.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {absence.membre?.prenom} {absence.membre?.nom}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {getAbsenceTypeLabel(absence.type)} - Du {new Date(absence.date_debut).toLocaleDateString('fr-FR')} au {new Date(absence.date_fin).toLocaleDateString('fr-FR')}
                    </p>
                    {absence.motif && <p className="text-sm text-gray-400 mt-1">{absence.motif}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {absence.statut === 'en_attente' ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleAbsenceAction(absence.id, 'approve')}>
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAbsenceAction(absence.id, 'refuse')}>
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs ${
                        absence.statut === 'approuve' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {absence.statut === 'approuve' ? 'Approuve' : 'Refuse'}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab Paie */}
      {tab === 'performances' && (
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

      {/* Tab DSN */}
      {tab === 'dsn' && (
        <div className="space-y-6">
          {/* Info banner */}
          <Card className="bg-blue-50 border-blue-200">
            <div className="p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Déclaration Sociale Nominative (DSN)</p>
                <p className="text-blue-600 mt-1">
                  Générez votre fichier DSN mensuel à déposer sur <strong>net-entreprises.fr</strong>.
                  Ce fichier contient les données de paie de vos employés pour transmission aux organismes sociaux.
                </p>
              </div>
            </div>
          </Card>

          {/* Informations entreprise */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-600" />
              Informations entreprise
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Raison sociale *</label>
                <Input
                  value={entrepriseInfo.raison_sociale}
                  onChange={e => setEntrepriseInfo({ ...entrepriseInfo, raison_sociale: e.target.value })}
                  placeholder="Nom de l'entreprise"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">SIRET *</label>
                <Input
                  value={entrepriseInfo.siret}
                  onChange={e => setEntrepriseInfo({ ...entrepriseInfo, siret: e.target.value.replace(/\s/g, '') })}
                  placeholder="14 chiffres"
                  maxLength={14}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Code NAF/APE *</label>
                <Input
                  value={entrepriseInfo.code_naf}
                  onChange={e => setEntrepriseInfo({ ...entrepriseInfo, code_naf: e.target.value.toUpperCase() })}
                  placeholder="Ex: 6201Z"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Adresse</label>
                <Input
                  value={entrepriseInfo.adresse}
                  onChange={e => setEntrepriseInfo({ ...entrepriseInfo, adresse: e.target.value })}
                  placeholder="Adresse"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Code postal</label>
                <Input
                  value={entrepriseInfo.code_postal}
                  onChange={e => setEntrepriseInfo({ ...entrepriseInfo, code_postal: e.target.value })}
                  placeholder="75001"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Ville</label>
                <Input
                  value={entrepriseInfo.ville}
                  onChange={e => setEntrepriseInfo({ ...entrepriseInfo, ville: e.target.value })}
                  placeholder="Paris"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">N° URSSAF</label>
                <Input
                  value={entrepriseInfo.urssaf}
                  onChange={e => setEntrepriseInfo({ ...entrepriseInfo, urssaf: e.target.value })}
                  placeholder="N° de compte URSSAF"
                />
              </div>
            </div>
          </Card>

          {/* Taux de cotisations */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Percent className="w-5 h-5 text-gray-600" />
                Taux de cotisations 2026
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTauxSettings(!showTauxSettings)}
              >
                {showTauxSettings ? 'Masquer' : 'Voir les taux'}
              </Button>
            </div>

            {showTauxSettings && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-gray-500">SMIC horaire</p>
                    <p className="font-semibold">{tauxCotisations.smic_horaire} €</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-gray-500">SMIC mensuel</p>
                    <p className="font-semibold">{tauxCotisations.smic_mensuel.toLocaleString('fr-FR')} €</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-gray-500">Plafond SS</p>
                    <p className="font-semibold">{tauxCotisations.plafond_ss_mensuel.toLocaleString('fr-FR')} €</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-gray-500">Accidents travail</p>
                    <p className="font-semibold">{tauxCotisations.accidents_travail}%</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm text-gray-700 mb-3">Cotisations patronales</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex justify-between p-2 bg-green-50 rounded">
                      <span>Maladie</span>
                      <span className="font-medium">{tauxCotisations.maladie_employeur}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-green-50 rounded">
                      <span>Vieillesse plaf.</span>
                      <span className="font-medium">{tauxCotisations.vieillesse_plafonnee_employeur}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-green-50 rounded">
                      <span>Vieillesse déplaf.</span>
                      <span className="font-medium">{tauxCotisations.vieillesse_deplafonnee_employeur}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-green-50 rounded">
                      <span>Alloc. familiales</span>
                      <span className="font-medium">{tauxCotisations.allocations_familiales}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-green-50 rounded">
                      <span>Chômage</span>
                      <span className="font-medium">{tauxCotisations.chomage_employeur}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-green-50 rounded">
                      <span>AGS</span>
                      <span className="font-medium">{tauxCotisations.ags}%</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm text-gray-700 mb-3">Cotisations salariales</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span>Vieillesse plaf.</span>
                      <span className="font-medium">{tauxCotisations.vieillesse_plafonnee_salarie}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span>Vieillesse déplaf.</span>
                      <span className="font-medium">{tauxCotisations.vieillesse_deplafonnee_salarie}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span>CSG déductible</span>
                      <span className="font-medium">{tauxCotisations.csg_deductible}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span>CSG non déd.</span>
                      <span className="font-medium">{tauxCotisations.csg_non_deductible}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span>CRDS</span>
                      <span className="font-medium">{tauxCotisations.crds}%</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Ces taux sont mis à jour automatiquement chaque année. Dernier ajustement : janvier 2026.
                </p>
              </div>
            )}
          </Card>

          {/* Période et génération */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Générer la DSN mensuelle
            </h3>

            <div className="flex items-end gap-4 mb-6">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Période</label>
                <Input
                  type="month"
                  value={dsnPeriode}
                  onChange={e => setDsnPeriode(e.target.value)}
                  className="w-48"
                />
              </div>
              <Button
                onClick={generateDSN}
                disabled={generatingDsn || !entrepriseInfo.siret || !entrepriseInfo.raison_sociale}
                className="gap-2"
              >
                {generatingDsn ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Générer le fichier DSN
              </Button>
            </div>

            {/* Vérification des données */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-3">Données à inclure dans la DSN</h4>
              {membres.filter(m => m.statut === 'actif').length === 0 ? (
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Aucun employé actif à déclarer</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {membres.filter(m => m.statut === 'actif').map(membre => (
                    <div key={membre.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-semibold text-blue-600">
                            {membre.prenom[0]}{membre.nom[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{membre.prenom} {membre.nom}</p>
                          <p className="text-xs text-gray-500">
                            {membre.nir ? `NIR: ${membre.nir.slice(0, 7)}...` : 'NIR manquant'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {membre.salaire_mensuel ? `${(membre.salaire_mensuel / 100).toLocaleString('fr-FR')} €` : 'Salaire non défini'}
                        </p>
                        {!membre.nir && (
                          <span className="text-xs text-orange-600">Compléter les infos</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Avertissement */}
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">
                <strong>Important :</strong> Vérifiez que tous les employés ont leur NIR (numéro de sécurité sociale)
                et leur salaire renseignés avant de générer la DSN. Le fichier généré doit être déposé sur
                net-entreprises.fr avant le 5 ou 15 du mois suivant.
              </p>
            </div>
          </Card>
        </div>
      )}

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
          {/* Info banner */}
          <Card className="bg-blue-50 border-blue-200">
            <div className="p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Documents RH obligatoires</p>
                <p className="text-blue-600 mt-1">
                  Téléchargez les documents obligatoires pour la gestion de votre personnel.
                </p>
              </div>
            </div>
          </Card>

          {/* Documents légaux */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents légaux
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="border hover:shadow-md transition-shadow cursor-pointer p-4" onClick={downloadRegistrePersonnel}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Registre du personnel</p>
                    <p className="text-xs text-gray-500">Document obligatoire</p>
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
                    <p className="text-xs text-gray-500">Récapitulatif mensuel</p>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 ml-auto" />
                </div>
              </Card>

              <Card className="border p-4 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <UserCheck className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">DPAE</p>
                    <p className="text-xs text-gray-500">Bientôt disponible</p>
                  </div>
                </div>
              </Card>

              <Card className="border p-4 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium">Certificat de travail</p>
                    <p className="text-xs text-gray-500">Bientôt disponible</p>
                  </div>
                </div>
              </Card>

              <Card className="border p-4 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <FileText className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium">Attestation Pôle Emploi</p>
                    <p className="text-xs text-gray-500">Bientôt disponible</p>
                  </div>
                </div>
              </Card>

              <Card className="border p-4 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Wallet className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="font-medium">Solde de tout compte</p>
                    <p className="text-xs text-gray-500">Bientôt disponible</p>
                  </div>
                </div>
              </Card>
            </div>
          </Card>

          {/* Génération paie vers compta */}
          <Card className="p-6 bg-gradient-to-r from-green-50 to-blue-50">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Euro className="w-5 h-5 text-green-600" />
              Génération de la paie
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
    </div>
  );
}
