/**
 * GestionAbsences - Composant complet de gestion des absences
 * - Création d'absences avec demi-journées
 * - Calendrier mensuel des absences
 * - Workflow d'approbation avec motif de refus
 * - Affichage des compteurs CP/RTT avec alertes
 */

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  Plus,
  Check,
  X,
  Clock,
  AlertTriangle,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  RefreshCw,
  Sun,
  Moon,
  CalendarDays,
  Umbrella,
  Stethoscope,
  GraduationCap,
  Coffee,
  HelpCircle,
  Trash2,
  Calculator
} from 'lucide-react';

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  email?: string;
}

interface Compteur {
  membre_id: number;
  membre_nom: string;
  annee: number;
  cp: { acquis: number; pris: number; report: number; solde: number };
  rtt: { acquis: number; pris: number; solde: number };
  rc: { acquis: number; pris: number; solde: number };
  conges_anciennete: number;
  conges_fractionnement: number;
}

interface Absence {
  id: number;
  membre_id: number;
  type: string;
  date_debut: string;
  date_fin: string;
  demi_journee: boolean;
  periode?: string;
  jours_ouvres: number;
  statut: string;
  motif?: string;
  commentaire_refus?: string;
  justificatif_url?: string;
  approuve_par?: number;
  date_approbation?: string;
  membre?: { nom: string; prenom: string };
  created_at: string;
}

interface GestionAbsencesProps {
  membres: Membre[];
  onRefresh: () => void;
}

const TYPES_ABSENCE = [
  { value: 'conge', label: 'Congés payés', icon: Umbrella, color: 'bg-blue-500' },
  { value: 'rtt', label: 'RTT', icon: Coffee, color: 'bg-purple-500' },
  { value: 'maladie', label: 'Maladie', icon: Stethoscope, color: 'bg-red-500' },
  { value: 'formation', label: 'Formation', icon: GraduationCap, color: 'bg-green-500' },
  { value: 'repos_compensateur', label: 'Repos compensateur', icon: Clock, color: 'bg-orange-500' },
  { value: 'conge_sans_solde', label: 'Congé sans solde', icon: CalendarDays, color: 'bg-gray-500' },
  { value: 'evenement_familial', label: 'Événement familial', icon: User, color: 'bg-pink-500' },
  { value: 'autre', label: 'Autre', icon: HelpCircle, color: 'bg-slate-500' }
];

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function GestionAbsences({ membres, onRefresh }: GestionAbsencesProps) {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [compteurs, setCompteurs] = useState<Compteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'liste' | 'calendrier'>('liste');
  const [showForm, setShowForm] = useState(false);
  const [showRefusModal, setShowRefusModal] = useState<number | null>(null);
  const [refusMotif, setRefusMotif] = useState('');

  // Filtres
  const [filters, setFilters] = useState({
    statut: 'all',
    type: 'all',
    membre_id: 'all',
    periode: 'mois' // mois, trimestre, annee
  });

  // Calendrier
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Formulaire nouvelle absence
  const [formData, setFormData] = useState({
    membre_id: '',
    type: 'conge',
    date_debut: '',
    date_fin: '',
    demi_journee: false,
    periode: 'matin',
    motif: ''
  });

  useEffect(() => {
    fetchAbsences();
    fetchCompteurs();
  }, []);

  const fetchAbsences = async () => {
    try {
      const response = await fetch('/api/admin/rh/absences', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAbsences(data);
      }
    } catch (err) {
      console.error('Erreur fetch absences:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompteurs = async () => {
    try {
      const response = await fetch('/api/admin/rh/compteurs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCompteurs(data);
      }
    } catch (err) {
      console.error('Erreur fetch compteurs:', err);
    }
  };

  const handleSubmitAbsence = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.membre_id || !formData.date_debut) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const response = await fetch('/api/admin/rh/absences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          membre_id: parseInt(formData.membre_id),
          date_fin: formData.date_fin || formData.date_debut
        })
      });

      if (response.ok) {
        setShowForm(false);
        setFormData({
          membre_id: '',
          type: 'conge',
          date_debut: '',
          date_fin: '',
          demi_journee: false,
          periode: 'matin',
          motif: ''
        });
        fetchAbsences();
        fetchCompteurs();
        onRefresh();
      } else {
        const err = await response.json();
        alert(err.error || 'Erreur lors de la création');
      }
    } catch (err) {
      console.error('Erreur création absence:', err);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/rh/absences/${id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (response.ok) {
        fetchAbsences();
        fetchCompteurs();
        onRefresh();
      }
    } catch (err) {
      console.error('Erreur approbation:', err);
    }
  };

  const handleRefuse = async (id: number) => {
    if (!refusMotif.trim()) {
      alert('Veuillez indiquer un motif de refus');
      return;
    }

    try {
      const response = await fetch(`/api/admin/rh/absences/${id}/refuse`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ commentaire_refus: refusMotif })
      });
      if (response.ok) {
        setShowRefusModal(null);
        setRefusMotif('');
        fetchAbsences();
        onRefresh();
      }
    } catch (err) {
      console.error('Erreur refus:', err);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Annuler cette absence ?')) return;

    try {
      const response = await fetch(`/api/admin/rh/absences/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (response.ok) {
        fetchAbsences();
        fetchCompteurs();
        onRefresh();
      }
    } catch (err) {
      console.error('Erreur annulation:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer définitivement cette demande d\'absence ?')) return;

    try {
      const response = await fetch(`/api/admin/rh/absences/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (response.ok) {
        fetchAbsences();
        onRefresh();
      }
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  const handleRecalculerCompteurs = async () => {
    try {
      const response = await fetch('/api/admin/rh/compteurs/recalculer', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (response.ok) {
        fetchCompteurs();
        alert('Compteurs recalculés avec succès');
      }
    } catch (err) {
      console.error('Erreur recalcul:', err);
    }
  };

  // Filtrage des absences
  const filteredAbsences = useMemo(() => {
    return absences.filter(absence => {
      if (filters.statut !== 'all' && absence.statut !== filters.statut) return false;
      if (filters.type !== 'all' && absence.type !== filters.type) return false;
      if (filters.membre_id !== 'all' && absence.membre_id !== parseInt(filters.membre_id)) return false;

      // Filtre par période
      const dateDebut = new Date(absence.date_debut);
      const now = new Date();
      if (filters.periode === 'mois') {
        if (dateDebut.getMonth() !== now.getMonth() || dateDebut.getFullYear() !== now.getFullYear()) {
          // Inclure aussi les absences qui chevauchent le mois en cours
          const dateFin = new Date(absence.date_fin);
          const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
          const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          if (dateFin < debutMois || dateDebut > finMois) return false;
        }
      }

      return true;
    });
  }, [absences, filters]);

  // Absences en attente
  const absencesEnAttente = useMemo(() => {
    return absences.filter(a => a.statut === 'en_attente');
  }, [absences]);

  // Données calendrier
  const calendarData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7; // Lundi = 0

    const days: { date: Date; absences: Absence[] }[] = [];

    // Jours du mois précédent
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, absences: [] });
    }

    // Jours du mois courant
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().split('T')[0];

      const absencesJour = absences.filter(a => {
        if (a.statut === 'refuse' || a.statut === 'annule') return false;
        return dateStr >= a.date_debut && dateStr <= a.date_fin;
      });

      days.push({ date, absences: absencesJour });
    }

    // Compléter la dernière semaine
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, absences: [] });
      }
    }

    return days;
  }, [calendarDate, absences]);

  const getTypeInfo = (type: string) => {
    return TYPES_ABSENCE.find(t => t.value === type) || TYPES_ABSENCE[TYPES_ABSENCE.length - 1];
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'en_attente':
        return <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">En attente</span>;
      case 'approuve':
        return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">Approuvé</span>;
      case 'refuse':
        return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">Refusé</span>;
      case 'annule':
        return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">Annulé</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">{statut}</span>;
    }
  };

  const getCompteurMembre = (membreId: number) => {
    return compteurs.find(c => c.membre_id === membreId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertes absences en attente */}
      {absencesEnAttente.length > 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">
                {absencesEnAttente.length} demande(s) d'absence en attente d'approbation
              </p>
              <p className="text-sm text-yellow-600">
                {absencesEnAttente.map(a => `${a.membre?.prenom} ${a.membre?.nom}`).join(', ')}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Compteurs résumés */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Calculator className="w-4 h-4" />
            <span>
              <strong>Compteurs dynamiques:</strong> 2.5j CP acquis par mois travaillé depuis l'embauche
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRecalculerCompteurs}
            className="text-blue-600 border-blue-300"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Recalculer
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {membres.slice(0, 4).map(membre => {
          const compteur = getCompteurMembre(membre.id);
          const cpSolde = compteur?.cp?.solde ?? 0;
          const alerteCP = cpSolde < 5;

          return (
            <Card key={membre.id} className={`p-3 ${alerteCP ? 'border-red-300 bg-red-50' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm truncate">{membre.prenom} {membre.nom}</span>
                {alerteCP && <AlertTriangle className="w-4 h-4 text-red-500" />}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">CP:</span>
                  <span className={`ml-1 font-semibold ${alerteCP ? 'text-red-600' : ''}`}>
                    {cpSolde}j
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">RTT:</span>
                  <span className="ml-1 font-semibold">{compteur?.rtt?.solde ?? 0}j</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Actions et filtres */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant={view === 'liste' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('liste')}
          >
            <FileText className="w-4 h-4 mr-1" />
            Liste
          </Button>
          <Button
            variant={view === 'calendrier' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('calendrier')}
          >
            <Calendar className="w-4 h-4 mr-1" />
            Calendrier
          </Button>

          <div className="h-6 w-px bg-gray-300 mx-2" />

          <select
            value={filters.statut}
            onChange={e => setFilters({ ...filters, statut: e.target.value })}
            className="text-sm border rounded px-2 py-1.5"
          >
            <option value="all">Tous statuts</option>
            <option value="en_attente">En attente</option>
            <option value="approuve">Approuvé</option>
            <option value="refuse">Refusé</option>
          </select>

          <select
            value={filters.type}
            onChange={e => setFilters({ ...filters, type: e.target.value })}
            className="text-sm border rounded px-2 py-1.5"
          >
            <option value="all">Tous types</option>
            {TYPES_ABSENCE.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <select
            value={filters.membre_id}
            onChange={e => setFilters({ ...filters, membre_id: e.target.value })}
            className="text-sm border rounded px-2 py-1.5"
          >
            <option value="all">Tous employés</option>
            {membres.map(m => (
              <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
            ))}
          </select>
        </div>

        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle absence
        </Button>
      </div>

      {/* Formulaire nouvelle absence */}
      {showForm && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Nouvelle demande d'absence</h3>
          <form onSubmit={handleSubmitAbsence} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Employé */}
              <div>
                <label className="text-sm text-gray-600 block mb-1">Employé *</label>
                <select
                  value={formData.membre_id}
                  onChange={e => setFormData({ ...formData, membre_id: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {membres.map(m => {
                    const compteur = getCompteurMembre(m.id);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.prenom} {m.nom} (CP: {compteur?.cp?.solde ?? '?'}j)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="text-sm text-gray-600 block mb-1">Type d'absence *</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  {TYPES_ABSENCE.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Demi-journée */}
              <div>
                <label className="text-sm text-gray-600 block mb-1">Durée</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={!formData.demi_journee ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormData({ ...formData, demi_journee: false })}
                  >
                    Journée(s) complète(s)
                  </Button>
                  <Button
                    type="button"
                    variant={formData.demi_journee ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormData({ ...formData, demi_journee: true })}
                  >
                    Demi-journée
                  </Button>
                </div>
              </div>

              {/* Date début */}
              <div>
                <label className="text-sm text-gray-600 block mb-1">Date début *</label>
                <Input
                  type="date"
                  value={formData.date_debut}
                  onChange={e => setFormData({ ...formData, date_debut: e.target.value })}
                  required
                />
              </div>

              {/* Date fin (si pas demi-journée) */}
              {!formData.demi_journee && (
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Date fin</label>
                  <Input
                    type="date"
                    value={formData.date_fin}
                    onChange={e => setFormData({ ...formData, date_fin: e.target.value })}
                    min={formData.date_debut}
                  />
                </div>
              )}

              {/* Période (si demi-journée) */}
              {formData.demi_journee && (
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Période</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={formData.periode === 'matin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData({ ...formData, periode: 'matin' })}
                    >
                      <Sun className="w-4 h-4 mr-1" />
                      Matin
                    </Button>
                    <Button
                      type="button"
                      variant={formData.periode === 'apres_midi' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData({ ...formData, periode: 'apres_midi' })}
                    >
                      <Moon className="w-4 h-4 mr-1" />
                      Après-midi
                    </Button>
                  </div>
                </div>
              )}

              {/* Motif */}
              <div className="md:col-span-2 lg:col-span-3">
                <label className="text-sm text-gray-600 block mb-1">Motif / Notes</label>
                <Input
                  type="text"
                  value={formData.motif}
                  onChange={e => setFormData({ ...formData, motif: e.target.value })}
                  placeholder="Optionnel"
                />
              </div>
            </div>

            {/* Info compteur si employé sélectionné */}
            {formData.membre_id && (
              <div className="p-3 bg-blue-50 rounded-lg">
                {(() => {
                  const compteur = getCompteurMembre(parseInt(formData.membre_id));
                  if (!compteur) return <p className="text-sm text-gray-500">Compteur non disponible</p>;

                  return (
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">CP disponibles:</span>
                        <span className={`ml-1 font-semibold ${compteur.cp.solde < 5 ? 'text-red-600' : 'text-green-600'}`}>
                          {compteur.cp.solde} jours
                        </span>
                        <span className="text-xs text-gray-400 ml-1">
                          (acquis: {compteur.cp.acquis}j)
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">RTT disponibles:</span>
                        <span className="ml-1 font-semibold text-purple-600">{compteur.rtt.solde} jours</span>
                      </div>
                      {compteur.rc.solde > 0 && (
                        <div>
                          <span className="text-gray-500">Repos compensateur:</span>
                          <span className="ml-1 font-semibold text-orange-600">{compteur.rc.solde} jours</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit">
                <Check className="w-4 h-4 mr-2" />
                Créer l'absence
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Vue Liste */}
      {view === 'liste' && (
        <div className="space-y-3">
          {filteredAbsences.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              Aucune absence trouvée
            </Card>
          ) : (
            filteredAbsences.map(absence => {
              const typeInfo = getTypeInfo(absence.type);
              const TypeIcon = typeInfo.icon;

              return (
                <Card key={absence.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${typeInfo.color} bg-opacity-20`}>
                        <TypeIcon className={`w-5 h-5 ${typeInfo.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">
                            {absence.membre?.prenom} {absence.membre?.nom}
                          </h4>
                          {getStatutBadge(absence.statut)}
                        </div>
                        <p className="text-sm text-gray-500">
                          {typeInfo.label} - Du {new Date(absence.date_debut).toLocaleDateString('fr-FR')}
                          {absence.date_debut !== absence.date_fin && ` au ${new Date(absence.date_fin).toLocaleDateString('fr-FR')}`}
                          {absence.demi_journee && ` (${absence.periode === 'matin' ? 'Matin' : 'Après-midi'})`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {absence.jours_ouvres} jour(s) ouvré(s)
                          {absence.motif && ` - ${absence.motif}`}
                        </p>
                        {absence.commentaire_refus && (
                          <p className="text-xs text-red-600 mt-1">
                            Refus: {absence.commentaire_refus}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {absence.statut === 'en_attente' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(absence.id)}
                            title="Approuver"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowRefusModal(absence.id)}
                            title="Refuser"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(absence.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4 text-gray-500" />
                          </Button>
                        </>
                      )}
                      {absence.statut === 'approuve' && new Date(absence.date_debut) > new Date() && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(absence.id)}
                            title="Annuler"
                          >
                            <X className="w-4 h-4 text-orange-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(absence.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      {(absence.statut === 'refuse' || absence.statut === 'annule') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(absence.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Vue Calendrier */}
      {view === 'calendrier' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="font-semibold text-lg">
              {MOIS[calendarDate.getMonth()]} {calendarDate.getFullYear()}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* En-têtes jours */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {JOURS_SEMAINE.map(jour => (
              <div key={jour} className="text-center text-xs font-medium text-gray-500 py-2">
                {jour}
              </div>
            ))}
          </div>

          {/* Grille calendrier */}
          <div className="grid grid-cols-7 gap-1">
            {calendarData.map((day, index) => {
              const isCurrentMonth = day.date.getMonth() === calendarDate.getMonth();
              const isToday = day.date.toDateString() === new Date().toDateString();
              const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

              return (
                <div
                  key={index}
                  className={`min-h-[80px] p-1 border rounded ${
                    !isCurrentMonth ? 'bg-gray-50 text-gray-400' :
                    isWeekend ? 'bg-gray-100' :
                    'bg-white'
                  } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="text-xs font-medium mb-1">{day.date.getDate()}</div>
                  <div className="space-y-0.5">
                    {day.absences.slice(0, 3).map(absence => {
                      const typeInfo = getTypeInfo(absence.type);
                      return (
                        <div
                          key={absence.id}
                          className={`text-xs px-1 py-0.5 rounded truncate ${typeInfo.color} text-white`}
                          title={`${absence.membre?.prenom} ${absence.membre?.nom} - ${typeInfo.label}`}
                        >
                          {absence.membre?.prenom}
                        </div>
                      );
                    })}
                    {day.absences.length > 3 && (
                      <div className="text-xs text-gray-500 px-1">
                        +{day.absences.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Légende */}
          <div className="mt-4 flex flex-wrap gap-3">
            {TYPES_ABSENCE.map(type => (
              <div key={type.value} className="flex items-center gap-1 text-xs">
                <div className={`w-3 h-3 rounded ${type.color}`} />
                <span>{type.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal refus */}
      {showRefusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-lg mb-4">Refuser la demande</h3>
            <div className="mb-4">
              <label className="text-sm text-gray-600 block mb-1">Motif du refus *</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 h-24"
                value={refusMotif}
                onChange={e => setRefusMotif(e.target.value)}
                placeholder="Expliquez la raison du refus..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleRefuse(showRefusModal)}>
                Confirmer le refus
              </Button>
              <Button variant="outline" onClick={() => { setShowRefusModal(null); setRefusMotif(''); }}>
                Annuler
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
