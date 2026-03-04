import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Users,
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  UserPlus,
  CalendarDays,
  ClipboardCheck,
  Timer,
  TrendingUp,
  AlertCircle,
  UserCheck,
  UserX,
  Coffee,
  Briefcase,
  GraduationCap,
  Heart,
  Sun,
  Moon,
} from 'lucide-react';

// Types
interface Membre {
  id: string;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  role: string;
  type_contrat: string;
  date_embauche: string;
  date_fin_contrat?: string;
  heures_semaine: number;
  taux_horaire?: number;
  actif: boolean;
  photo_url?: string;
}

interface Shift {
  id: string;
  membre_id: string;
  date_shift: string;
  heure_debut: string;
  heure_fin: string;
  type_shift: string;
  lieu?: string;
  statut: string;
  equipe?: { prenom: string; nom: string };
}

interface Absence {
  id: string;
  membre_id: string;
  date_debut: string;
  date_fin: string;
  type_absence: string;
  statut: string;
  nb_jours?: number;
  motif?: string;
  equipe?: { prenom: string; nom: string; role: string };
}

interface Pointage {
  id: string;
  membre_id: string;
  date_pointage: string;
  heure_arrivee: string;
  heure_depart?: string;
  heures_travaillees?: number;
  heures_supplementaires?: number;
  valide: boolean;
  equipe?: { prenom: string; nom: string };
}

interface RHStats {
  effectif_actif: number;
  heures_travaillees_total: number;
  heures_supplementaires_total: number;
  jours_absence_total: number;
  absences_en_attente: number;
  nb_pointages_mois: number;
  absences_par_type: Record<string, number>;
}

const TYPE_ABSENCE_LABELS: Record<string, { label: string; icon: typeof Coffee }> = {
  conge_paye: { label: 'Congé payé', icon: Sun },
  rtt: { label: 'RTT', icon: Clock },
  maladie: { label: 'Maladie', icon: Heart },
  maternite: { label: 'Maternité', icon: Heart },
  paternite: { label: 'Paternité', icon: Heart },
  sans_solde: { label: 'Sans solde', icon: Coffee },
  formation: { label: 'Formation', icon: GraduationCap },
  evenement_familial: { label: 'Événement familial', icon: Users },
  autre: { label: 'Autre', icon: Calendar },
};

const TYPE_CONTRAT_LABELS: Record<string, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  freelance: 'Freelance',
  stage: 'Stage',
  apprentissage: 'Apprentissage',
};

export default function RH() {
  const [activeTab, setActiveTab] = useState<'equipe' | 'planning' | 'absences' | 'pointages'>('equipe');
  const [equipe, setEquipe] = useState<Membre[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [stats, setStats] = useState<RHStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'membre' | 'shift' | 'absence' | 'pointage'>('membre');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [selectedSemaine, setSelectedSemaine] = useState(() => {
    const now = new Date();
    const week = getISOWeek(now);
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
  });
  const [selectedMois, setSelectedMois] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [shiftMode, setShiftMode] = useState<'jour' | 'semaine' | 'mois'>('jour');

  // Helper pour calculer le numéro de semaine ISO
  function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  useEffect(() => {
    loadData();
  }, [selectedSemaine, selectedMois]);

  const loadData = async () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [equipeRes, shiftsRes, absencesRes, pointagesRes, statsRes] = await Promise.all([
        fetch('/api/rh/equipe', { headers }).then(r => r.json()).catch(() => ({ equipe: [] })),
        fetch(`/api/rh/planning?semaine=${selectedSemaine}`, { headers }).then(r => r.json()).catch(() => ({ shifts: [] })),
        fetch('/api/rh/absences', { headers }).then(r => r.json()).catch(() => ({ absences: [] })),
        fetch(`/api/rh/pointages?mois=${selectedMois}`, { headers }).then(r => r.json()).catch(() => ({ pointages: [] })),
        fetch(`/api/rh/stats?mois=${selectedMois}`, { headers }).then(r => r.json()).catch(() => ({ stats: null })),
      ]);

      setEquipe(equipeRes.equipe || []);
      setShifts(shiftsRes.shifts || []);
      setAbsences(absencesRes.absences || []);
      setPointages(pointagesRes.pointages || []);
      setStats(statsRes.stats || null);
    } catch (error) {
      console.error('Erreur chargement RH:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMembre = async (data: Partial<Membre>) => {
    setSaving(true);
    const token = localStorage.getItem('admin_token');

    try {
      const url = selectedItem?.id ? `/api/rh/equipe/${selectedItem.id}` : '/api/rh/equipe';
      const method = selectedItem?.id ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      setShowModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveShift = async (data: Partial<Shift> & { mode?: string; jours_semaine?: string[] }) => {
    setSaving(true);
    const token = localStorage.getItem('admin_token');

    try {
      // Si on modifie un shift existant
      if (selectedItem?.id) {
        await fetch(`/api/rh/planning/${selectedItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            membre_id: data.membre_id,
            date_shift: data.date_shift,
            heure_debut: data.heure_debut,
            heure_fin: data.heure_fin,
            type_shift: data.type_shift,
            lieu: data.lieu,
          }),
        });
      } else {
        // Création de nouveaux shifts
        const mode = data.mode || 'jour';
        const baseDate = new Date(data.date_shift as string);
        const joursSemaine = data.jours_semaine || ['1', '2', '3', '4', '5']; // Lun-Ven par défaut

        const shiftsToCreate: Partial<Shift>[] = [];

        if (mode === 'jour') {
          shiftsToCreate.push({
            membre_id: data.membre_id,
            date_shift: data.date_shift,
            heure_debut: data.heure_debut,
            heure_fin: data.heure_fin,
            type_shift: data.type_shift,
            lieu: data.lieu,
          });
        } else if (mode === 'semaine') {
          const startOfWeek = new Date(baseDate);
          const dayOfWeek = startOfWeek.getDay();
          startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

          for (let i = 0; i < 7; i++) {
            if (joursSemaine.includes(String(i + 1))) {
              const shiftDate = new Date(startOfWeek);
              shiftDate.setDate(startOfWeek.getDate() + i);
              shiftsToCreate.push({
                membre_id: data.membre_id,
                date_shift: shiftDate.toISOString().split('T')[0],
                heure_debut: data.heure_debut,
                heure_fin: data.heure_fin,
                type_shift: data.type_shift,
                lieu: data.lieu,
              });
            }
          }
        } else if (mode === 'mois') {
          const year = baseDate.getFullYear();
          const month = baseDate.getMonth();
          const daysInMonth = new Date(year, month + 1, 0).getDate();

          for (let day = 1; day <= daysInMonth; day++) {
            const shiftDate = new Date(year, month, day);
            const dayOfWeek = shiftDate.getDay();
            const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

            if (joursSemaine.includes(String(isoDay))) {
              shiftsToCreate.push({
                membre_id: data.membre_id,
                date_shift: shiftDate.toISOString().split('T')[0],
                heure_debut: data.heure_debut,
                heure_fin: data.heure_fin,
                type_shift: data.type_shift,
                lieu: data.lieu,
              });
            }
          }
        }

        for (const shift of shiftsToCreate) {
          await fetch('/api/rh/planning', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(shift),
          });
        }
      }

      setShowModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erreur sauvegarde shift:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAbsence = async (data: Partial<Absence>) => {
    setSaving(true);
    const token = localStorage.getItem('admin_token');

    try {
      const url = selectedItem?.id ? `/api/rh/absences/${selectedItem.id}` : '/api/rh/absences';
      const method = selectedItem?.id ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      setShowModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erreur sauvegarde absence:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePointage = async (data: Partial<Pointage>) => {
    setSaving(true);
    const token = localStorage.getItem('admin_token');

    try {
      const url = selectedItem?.id ? `/api/rh/pointages/${selectedItem.id}` : '/api/rh/pointages';
      const method = selectedItem?.id ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      setShowModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erreur sauvegarde pointage:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleValidatePointage = async (id: string) => {
    const token = localStorage.getItem('admin_token');

    try {
      await fetch(`/api/rh/pointages/${id}/valider`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      loadData();
    } catch (error) {
      console.error('Erreur validation pointage:', error);
    }
  };

  const handleDeletePointage = async (id: string) => {
    if (!confirm('Supprimer ce pointage ?')) return;
    const token = localStorage.getItem('admin_token');

    try {
      await fetch(`/api/rh/pointages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadData();
    } catch (error) {
      console.error('Erreur suppression pointage:', error);
    }
  };

  const handleValidateAbsence = async (id: string, approved: boolean) => {
    const token = localStorage.getItem('admin_token');

    try {
      await fetch(`/api/rh/absences/${id}/statut`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statut: approved ? 'approuve' : 'refuse' }),
      });
      loadData();
    } catch (error) {
      console.error('Erreur validation:', error);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm('Confirmer la suppression ?')) return;
    const token = localStorage.getItem('admin_token');

    try {
      await fetch(`/api/rh/${type}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const openModal = (type: 'membre' | 'shift' | 'absence' | 'pointage', item?: any) => {
    setModalType(type);
    setSelectedItem(item || null);
    setShowModal(true);
  };

  const getContratBadge = (type: string) => {
    const colors: Record<string, string> = {
      cdi: 'bg-green-500/20 text-green-400',
      cdd: 'bg-yellow-500/20 text-yellow-400',
      freelance: 'bg-purple-500/20 text-purple-400',
      stage: 'bg-blue-500/20 text-blue-400',
      apprentissage: 'bg-cyan-500/20 text-cyan-400',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${colors[type] || 'bg-gray-500/20 text-gray-400'}`}>
        {TYPE_CONTRAT_LABELS[type] || type}
      </span>
    );
  };

  const getAbsenceStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      en_attente: 'bg-yellow-500/20 text-yellow-400',
      approuve: 'bg-green-500/20 text-green-400',
      refuse: 'bg-red-500/20 text-red-400',
      annule: 'bg-gray-500/20 text-gray-400',
    };
    const labels: Record<string, string> = {
      en_attente: 'En attente',
      approuve: 'Approuvé',
      refuse: 'Refusé',
      annule: 'Annulé',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${styles[status] || styles.en_attente}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Stats cards
  const renderStats = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-blue-400" />
          <span className="text-xs text-white/60">Effectif actif</span>
        </div>
        <p className="text-2xl font-bold text-white">{stats?.effectif_actif || 0}</p>
      </div>

      <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-green-400" />
          <span className="text-xs text-white/60">Heures travaillées</span>
        </div>
        <p className="text-2xl font-bold text-white">{stats?.heures_travaillees_total || 0}h</p>
      </div>

      <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-orange-400" />
          <span className="text-xs text-white/60">Heures supp.</span>
        </div>
        <p className="text-2xl font-bold text-white">{stats?.heures_supplementaires_total || 0}h</p>
      </div>

      <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-5 h-5 text-purple-400" />
          <span className="text-xs text-white/60">Jours absence</span>
        </div>
        <p className="text-2xl font-bold text-white">{stats?.jours_absence_total || 0}</p>
      </div>

      <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-yellow-400" />
          <span className="text-xs text-white/60">En attente</span>
        </div>
        <p className="text-2xl font-bold text-white">{stats?.absences_en_attente || 0}</p>
      </div>

      <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 border border-cyan-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="w-5 h-5 text-cyan-400" />
          <span className="text-xs text-white/60">Pointages</span>
        </div>
        <p className="text-2xl font-bold text-white">{stats?.nb_pointages_mois || 0}</p>
      </div>
    </div>
  );

  // Tab: Équipe
  const renderEquipe = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Équipe ({equipe.length})</h2>
        <button
          onClick={() => openModal('membre')}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all"
        >
          <UserPlus size={18} />
          Ajouter
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {equipe.map((membre) => (
          <div
            key={membre.id}
            className={`bg-zinc-900/50 border rounded-2xl p-4 ${
              membre.actif ? 'border-white/10' : 'border-red-500/30 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {membre.prenom[0]}{membre.nom[0]}
                </div>
                <div>
                  <p className="font-semibold text-white">{membre.prenom} {membre.nom}</p>
                  <p className="text-sm text-white/60">{membre.role}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openModal('membre', membre)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-amber-400"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete('equipe', membre.id)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Contrat</span>
                {getContratBadge(membre.type_contrat)}
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Heures/sem</span>
                <span className="text-white">{membre.heures_semaine}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Depuis</span>
                <span className="text-white">{new Date(membre.date_embauche).toLocaleDateString('fr-FR')}</span>
              </div>
              {membre.email && (
                <div className="flex justify-between">
                  <span className="text-white/60">Email</span>
                  <span className="text-white truncate ml-2">{membre.email}</span>
                </div>
              )}
            </div>

            {!membre.actif && (
              <div className="mt-3 pt-3 border-t border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
                <UserX size={14} />
                Membre inactif
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Tab: Planning
  const renderPlanning = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-xl font-bold text-white">Planning</h2>
        <div className="flex items-center gap-4">
          <input
            type="week"
            value={selectedSemaine}
            onChange={(e) => setSelectedSemaine(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
          />
          <button
            onClick={() => openModal('shift')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all"
          >
            <Plus size={18} />
            Ajouter shift
          </button>
        </div>
      </div>

      {shifts.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-8 text-center">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 text-white/30" />
          <p className="text-white/60">Aucun shift planifié cette semaine</p>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-4 text-white/60 font-medium">Membre</th>
                <th className="text-left p-4 text-white/60 font-medium">Date</th>
                <th className="text-left p-4 text-white/60 font-medium">Horaires</th>
                <th className="text-left p-4 text-white/60 font-medium">Type</th>
                <th className="text-left p-4 text-white/60 font-medium">Lieu</th>
                <th className="text-right p-4 text-white/60 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} className="border-t border-white/5">
                  <td className="p-4 text-white">
                    {shift.equipe ? `${shift.equipe.prenom} ${shift.equipe.nom}` : '-'}
                  </td>
                  <td className="p-4 text-white">
                    {new Date(shift.date_shift).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="p-4 text-white">
                    <span className="flex items-center gap-2">
                      <Sun size={14} className="text-amber-400" />
                      {shift.heure_debut}
                      <span className="text-white/40">→</span>
                      <Moon size={14} className="text-blue-400" />
                      {shift.heure_fin}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
                      {shift.type_shift}
                    </span>
                  </td>
                  <td className="p-4 text-white/60">{shift.lieu || '-'}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openModal('shift', shift)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-amber-400"
                        title="Modifier"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete('planning', shift.id)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Tab: Absences
  const renderAbsences = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Absences ({absences.length})</h2>
        <button
          onClick={() => openModal('absence')}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all"
        >
          <Plus size={18} />
          Nouvelle absence
        </button>
      </div>

      {/* Absences en attente */}
      {absences.filter(a => a.statut === 'en_attente').length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
          <h3 className="text-yellow-400 font-semibold mb-3 flex items-center gap-2">
            <AlertCircle size={18} />
            À valider
          </h3>
          <div className="space-y-3">
            {absences.filter(a => a.statut === 'en_attente').map((absence) => (
              <div key={absence.id} className="flex items-center justify-between bg-zinc-900/50 rounded-xl p-3">
                <div>
                  <p className="text-white font-medium">
                    {absence.equipe ? `${absence.equipe.prenom} ${absence.equipe.nom}` : '-'}
                  </p>
                  <p className="text-sm text-white/60">
                    {TYPE_ABSENCE_LABELS[absence.type_absence]?.label || absence.type_absence} •{' '}
                    {new Date(absence.date_debut).toLocaleDateString('fr-FR')} →{' '}
                    {new Date(absence.date_fin).toLocaleDateString('fr-FR')} •{' '}
                    {absence.nb_jours} jour(s)
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleValidateAbsence(absence.id, true)}
                    className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => handleValidateAbsence(absence.id, false)}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des absences */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left p-4 text-white/60 font-medium">Membre</th>
              <th className="text-left p-4 text-white/60 font-medium">Type</th>
              <th className="text-left p-4 text-white/60 font-medium">Période</th>
              <th className="text-left p-4 text-white/60 font-medium">Jours</th>
              <th className="text-left p-4 text-white/60 font-medium">Statut</th>
              <th className="text-right p-4 text-white/60 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {absences.map((absence) => {
              const TypeIcon = TYPE_ABSENCE_LABELS[absence.type_absence]?.icon || Calendar;
              return (
                <tr key={absence.id} className="border-t border-white/5">
                  <td className="p-4 text-white">
                    {absence.equipe ? `${absence.equipe.prenom} ${absence.equipe.nom}` : '-'}
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-2 text-white">
                      <TypeIcon size={14} className="text-amber-400" />
                      {TYPE_ABSENCE_LABELS[absence.type_absence]?.label || absence.type_absence}
                    </span>
                  </td>
                  <td className="p-4 text-white/80">
                    {new Date(absence.date_debut).toLocaleDateString('fr-FR')} →{' '}
                    {new Date(absence.date_fin).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-4 text-white">{absence.nb_jours}</td>
                  <td className="p-4">{getAbsenceStatusBadge(absence.statut)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openModal('absence', absence)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-amber-400"
                        title="Modifier"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete('absences', absence.id)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Tab: Pointages
  const renderPointages = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-xl font-bold text-white">Pointages</h2>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={selectedMois}
            onChange={(e) => setSelectedMois(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
          />
          <button
            onClick={() => openModal('pointage')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all"
          >
            <Timer size={18} />
            Pointer
          </button>
        </div>
      </div>

      {pointages.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-8 text-center">
          <Timer className="w-12 h-12 mx-auto mb-4 text-white/30" />
          <p className="text-white/60">Aucun pointage ce mois</p>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-4 text-white/60 font-medium">Membre</th>
                <th className="text-left p-4 text-white/60 font-medium">Date</th>
                <th className="text-left p-4 text-white/60 font-medium">Arrivée</th>
                <th className="text-left p-4 text-white/60 font-medium">Départ</th>
                <th className="text-left p-4 text-white/60 font-medium">Heures</th>
                <th className="text-left p-4 text-white/60 font-medium">Supp.</th>
                <th className="text-left p-4 text-white/60 font-medium">Statut</th>
                <th className="text-right p-4 text-white/60 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pointages.map((pointage) => (
                <tr key={pointage.id} className="border-t border-white/5">
                  <td className="p-4 text-white">
                    {pointage.equipe ? `${pointage.equipe.prenom} ${pointage.equipe.nom}` : '-'}
                  </td>
                  <td className="p-4 text-white">
                    {new Date(pointage.date_pointage).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="p-4 text-green-400">{pointage.heure_arrivee}</td>
                  <td className="p-4 text-orange-400">{pointage.heure_depart || '-'}</td>
                  <td className="p-4 text-white">{pointage.heures_travaillees?.toFixed(1) || '-'}h</td>
                  <td className="p-4">
                    {pointage.heures_supplementaires && pointage.heures_supplementaires > 0 ? (
                      <span className="text-amber-400">+{pointage.heures_supplementaires.toFixed(1)}h</span>
                    ) : (
                      <span className="text-white/40">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {pointage.valide ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                        Validé
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                        À valider
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      {!pointage.valide && (
                        <button
                          onClick={() => handleValidatePointage(pointage.id)}
                          className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition text-green-400"
                          title="Valider"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => openModal('pointage', pointage)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-amber-400"
                        title="Modifier"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeletePointage(pointage.id)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Modal de formulaire
  const renderModal = () => {
    if (!showModal) return null;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">
              {modalType === 'membre' && (selectedItem ? 'Modifier membre' : 'Ajouter un membre')}
              {modalType === 'shift' && (selectedItem ? 'Modifier le shift' : 'Ajouter un shift')}
              {modalType === 'absence' && (selectedItem ? 'Modifier l\'absence' : 'Déclarer une absence')}
              {modalType === 'pointage' && (selectedItem ? 'Modifier le pointage' : 'Nouveau pointage')}
            </h3>
            <button
              onClick={() => { setShowModal(false); setSelectedItem(null); }}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <X size={20} className="text-white/60" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data: any = {};

              // Convertir FormData en objet, gérer les valeurs multiples (checkboxes)
              for (const [key, value] of formData.entries()) {
                if (key === 'jours_semaine') {
                  // Collecter tous les jours cochés
                  if (!data.jours_semaine) data.jours_semaine = [];
                  data.jours_semaine.push(value);
                } else {
                  data[key] = value;
                }
              }

              if (modalType === 'membre') {
                handleSaveMembre(data);
              } else if (modalType === 'shift') {
                handleSaveShift(data);
              } else if (modalType === 'absence') {
                handleSaveAbsence(data);
              } else if (modalType === 'pointage') {
                handleSavePointage(data);
              }
            }}
            className="p-6 space-y-4"
          >
            {/* Formulaire MEMBRE */}
            {modalType === 'membre' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Prénom *</label>
                    <input
                      type="text"
                      name="prenom"
                      defaultValue={selectedItem?.prenom}
                      required
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Nom *</label>
                    <input
                      type="text"
                      name="nom"
                      defaultValue={selectedItem?.nom}
                      required
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Rôle *</label>
                  <input
                    type="text"
                    name="role"
                    defaultValue={selectedItem?.role}
                    placeholder="ex: Coiffeuse, Manager..."
                    required
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Type de contrat</label>
                    <select
                      name="type_contrat"
                      defaultValue={selectedItem?.type_contrat || 'cdi'}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    >
                      <option value="cdi">CDI</option>
                      <option value="cdd">CDD</option>
                      <option value="freelance">Freelance</option>
                      <option value="stage">Stage</option>
                      <option value="apprentissage">Apprentissage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Heures/semaine</label>
                    <input
                      type="number"
                      name="heures_semaine"
                      defaultValue={selectedItem?.heures_semaine || 35}
                      step="0.5"
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Date d'embauche *</label>
                  <input
                    type="date"
                    name="date_embauche"
                    defaultValue={selectedItem?.date_embauche}
                    required
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={selectedItem?.email}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      name="telephone"
                      defaultValue={selectedItem?.telephone}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Formulaire SHIFT (Planning) */}
            {modalType === 'shift' && (
              <>
                {!selectedItem && (
                  <>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-sm text-blue-300">
                      Créez un planning pour un jour, une semaine ou un mois entier.
                    </div>

                    {/* Mode de création */}
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Mode de création</label>
                      <div className="flex gap-2">
                        {[
                          { id: 'jour', label: 'Un jour' },
                          { id: 'semaine', label: 'Une semaine' },
                          { id: 'mois', label: 'Un mois' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setShiftMode(m.id as any)}
                            className={`flex-1 px-3 py-2 rounded-xl text-sm transition ${
                              shiftMode === m.id
                                ? 'bg-amber-500 text-white'
                                : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <input type="hidden" name="mode" value={shiftMode} />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm text-white/60 mb-1">Membre *</label>
                  <select
                    name="membre_id"
                    required
                    defaultValue={selectedItem?.membre_id || ''}
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                  >
                    <option value="">Sélectionner un membre</option>
                    {equipe.filter(m => m.actif).map(m => (
                      <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">
                    {selectedItem ? 'Date du shift *' :
                     shiftMode === 'jour' ? 'Date du shift *' :
                     shiftMode === 'semaine' ? 'Semaine (choisir un jour de la semaine) *' :
                     'Mois (choisir un jour du mois) *'}
                  </label>
                  <input
                    type="date"
                    name="date_shift"
                    required
                    defaultValue={selectedItem?.date_shift || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                  />
                </div>

                {/* Jours de la semaine (pour mode semaine/mois) - seulement pour création */}
                {!selectedItem && (shiftMode === 'semaine' || shiftMode === 'mois') && (
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Jours travaillés</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: '1', label: 'Lun' },
                        { id: '2', label: 'Mar' },
                        { id: '3', label: 'Mer' },
                        { id: '4', label: 'Jeu' },
                        { id: '5', label: 'Ven' },
                        { id: '6', label: 'Sam' },
                        { id: '7', label: 'Dim' },
                      ].map((jour) => (
                        <label key={jour.id} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            name="jours_semaine"
                            value={jour.id}
                            defaultChecked={['1', '2', '3', '4', '5'].includes(jour.id)}
                            className="w-4 h-4 rounded bg-zinc-800 border-white/20 text-amber-500"
                          />
                          <span className="text-white text-sm">{jour.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Heure début *</label>
                    <input
                      type="time"
                      name="heure_debut"
                      required
                      defaultValue={selectedItem?.heure_debut || '09:00'}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Heure fin *</label>
                    <input
                      type="time"
                      name="heure_fin"
                      required
                      defaultValue={selectedItem?.heure_fin || '17:00'}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Type de shift</label>
                    <select
                      name="type_shift"
                      defaultValue={selectedItem?.type_shift || 'journee'}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    >
                      <option value="matin">Matin</option>
                      <option value="apres-midi">Après-midi</option>
                      <option value="journee">Journée complète</option>
                      <option value="soiree">Soirée</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Lieu</label>
                    <input
                      type="text"
                      name="lieu"
                      defaultValue={selectedItem?.lieu || ''}
                      placeholder="ex: Domicile client, Salon..."
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                {!selectedItem && (shiftMode === 'semaine' || shiftMode === 'mois') && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-300">
                    {shiftMode === 'semaine'
                      ? 'Les shifts seront créés pour les jours sélectionnés de la semaine.'
                      : 'Les shifts seront créés pour tous les jours sélectionnés du mois.'}
                  </div>
                )}
              </>
            )}

            {/* Formulaire ABSENCE */}
            {modalType === 'absence' && (
              <>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Membre *</label>
                  <select
                    name="membre_id"
                    required
                    defaultValue={selectedItem?.membre_id || ''}
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                  >
                    <option value="">Sélectionner un membre</option>
                    {equipe.filter(m => m.actif).map(m => (
                      <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Type d'absence *</label>
                  <select
                    name="type_absence"
                    required
                    defaultValue={selectedItem?.type_absence || 'conge_paye'}
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                  >
                    <option value="conge_paye">Congé payé</option>
                    <option value="rtt">RTT</option>
                    <option value="maladie">Maladie</option>
                    <option value="maternite">Maternité</option>
                    <option value="paternite">Paternité</option>
                    <option value="sans_solde">Sans solde</option>
                    <option value="formation">Formation</option>
                    <option value="evenement_familial">Événement familial</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Date début *</label>
                    <input
                      type="date"
                      name="date_debut"
                      required
                      defaultValue={selectedItem?.date_debut || ''}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Date fin *</label>
                    <input
                      type="date"
                      name="date_fin"
                      required
                      defaultValue={selectedItem?.date_fin || ''}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Motif / Notes</label>
                  <textarea
                    name="motif"
                    rows={2}
                    defaultValue={selectedItem?.motif || ''}
                    placeholder="Motif de l'absence..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white resize-none"
                  />
                </div>
              </>
            )}

            {/* Formulaire POINTAGE */}
            {modalType === 'pointage' && (
              <>
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm text-green-300">
                  {selectedItem ? 'Modifiez les informations du pointage.' : 'Enregistrez l\'arrivée et le départ d\'un membre de l\'équipe.'}
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Membre *</label>
                  <select
                    name="membre_id"
                    required
                    defaultValue={selectedItem?.membre_id || ''}
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                  >
                    <option value="">Sélectionner un membre</option>
                    {equipe.filter(m => m.actif).map(m => (
                      <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Date *</label>
                  <input
                    type="date"
                    name="date_pointage"
                    required
                    defaultValue={selectedItem?.date_pointage || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Heure d'arrivée *</label>
                    <input
                      type="time"
                      name="heure_arrivee"
                      required
                      defaultValue={selectedItem?.heure_arrivee || '09:00'}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Heure de départ</label>
                    <input
                      type="time"
                      name="heure_depart"
                      defaultValue={selectedItem?.heure_depart || ''}
                      className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Heures supplémentaires</label>
                  <input
                    type="number"
                    name="heures_supplementaires"
                    step="0.5"
                    min="0"
                    defaultValue={selectedItem?.heures_supplementaires || ''}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => { setShowModal(false); setSelectedItem(null); }}
                className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Ressources Humaines
            </h1>
            <p className="text-white/60 mt-1">Gestion de l'équipe, planning et absences</p>
          </div>
        </div>

        {/* Stats */}
        {renderStats()}

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'equipe', label: 'Équipe', icon: Users },
            { id: 'planning', label: 'Planning', icon: CalendarDays },
            { id: 'absences', label: 'Absences', icon: Calendar },
            { id: 'pointages', label: 'Pointages', icon: Timer },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-zinc-800/50 text-white/60 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : (
          <>
            {activeTab === 'equipe' && renderEquipe()}
            {activeTab === 'planning' && renderPlanning()}
            {activeTab === 'absences' && renderAbsences()}
            {activeTab === 'pointages' && renderPointages()}
          </>
        )}

        {/* Modal */}
        {renderModal()}
      </div>
    </AdminLayout>
  );
}
