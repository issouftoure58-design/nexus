/**
 * PlanningEmploye - Vue planning dynamique des employés
 * Affiche les rendez-vous, heures travaillées et alertes de charge
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Filter,
  Users,
  Briefcase,
  Printer,
  Download,
  Mail
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  heures_hebdo?: number;
  statut: string;
}

interface HoursBreakdown {
  jour: number;
  nuit: number;
  dimanche_jour: number;
  dimanche_nuit: number;
  ferie_jour: number;
  ferie_nuit: number;
  dimanche_ferie_jour: number;
  dimanche_ferie_nuit: number;
}

interface PlanningRdv {
  id: number;
  heure: string;
  heure_fin?: string;
  service: string;
  duree: number;
  heures_nuit?: number; // Minutes travaillées pendant heures de nuit légales (21h-6h)
  hours_breakdown?: HoursBreakdown; // Répartition détaillée des heures
  statut: string;
  prix: number;
  client: string;
  client_tel?: string;
  is_overnight?: boolean;
  overnight_part?: number; // 1 = première partie (soir), 2 = deuxième partie (matin)
  is_sunday?: boolean;
  is_holiday?: boolean;
}

interface PlanningJour {
  rdv: PlanningRdv[];
  absent: boolean;
  type_absence?: string | null;
}

interface ResumeHebdo {
  membre_id: number;
  employe_nom: string;
  semaine_debut: string;
  nb_rdv: number;
  heures_planifiees: number;
  heures_contrat: number;
  pourcentage_remplissage: number;
  heures_disponibles: number;
  statut_charge: 'ok' | 'proche_limite' | 'depassement';
}

interface PlanningData {
  planning: Record<string, PlanningJour>;
  stats: {
    total_rdv: number;
    heures_travaillees: number;
    // Heures normales
    heures_jour?: number;
    heures_nuit?: number;
    // Heures dimanche
    heures_dimanche_jour?: number;
    heures_dimanche_nuit?: number;
    // Heures fériés
    heures_ferie_jour?: number;
    heures_ferie_nuit?: number;
    // Heures dimanche férié (cumul majorations)
    heures_dimanche_ferie_jour?: number;
    heures_dimanche_ferie_nuit?: number;
    ca_realise: number;
    jours_absence: number;
  };
  membre?: {
    id: number;
    nom: string;
    prenom: string;
  };
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('nexus_admin_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// Obtenir les jours de la semaine à partir d'une date
function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(date: Date): string {
  // Formatter sans conversion UTC pour éviter le décalage de timezone
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateFr(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function PlanningEmploye() {
  const [membres, setMembres] = useState<Membre[]>([]);
  const [selectedMembre, setSelectedMembre] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [planning, setPlanning] = useState<PlanningData | null>(null);
  const [resumeHebdo, setResumeHebdo] = useState<ResumeHebdo[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'semaine' | 'equipe'>('semaine');

  // Ref pour tracker la requête en cours et éviter les race conditions
  const requestIdRef = useRef(0);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  // Charger les membres
  useEffect(() => {
    const fetchMembres = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/rh/membres`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setMembres(data.filter((m: Membre) => m.statut === 'actif'));
          if (data.length > 0 && !selectedMembre) {
            setSelectedMembre(data[0].id);
          }
        }
      } catch (error) {
        console.error('Erreur chargement membres:', error);
      }
    };
    fetchMembres();
  }, []);

  // Charger le planning du membre sélectionné
  useEffect(() => {
    if (!selectedMembre) return;

    // Incrémenter l'ID de requête pour tracker la requête courante
    const currentRequestId = ++requestIdRef.current;
    const dateDebut = formatDate(weekDays[0]);
    const dateFin = formatDate(weekDays[6]);

    console.log(`[Planning] Fetch #${currentRequestId}: ${dateDebut} -> ${dateFin}`);

    const fetchPlanning = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/admin/rh/membres/${selectedMembre}/planning?date_debut=${dateDebut}&date_fin=${dateFin}`,
          { headers: getAuthHeaders() }
        );

        // Ignorer si une nouvelle requête a été lancée entre-temps
        if (requestIdRef.current !== currentRequestId) {
          console.log(`[Planning] Ignoring stale response #${currentRequestId} (current: #${requestIdRef.current})`);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          console.log(`[Planning] Setting data from #${currentRequestId}: ${dateDebut} -> ${dateFin}`);
          setPlanning(data);
        }
      } catch (error) {
        console.error('Erreur chargement planning:', error);
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    };

    fetchPlanning();
  }, [selectedMembre, weekDays]);

  // Charger le résumé hebdo de tous les membres
  useEffect(() => {
    const fetchResumeHebdo = async () => {
      try {
        const dateDebut = formatDate(weekDays[0]);
        const res = await fetch(
          `${API_BASE}/admin/rh/planning/resume-hebdo?semaine=${dateDebut}`,
          { headers: getAuthHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          // S'assurer que c'est un tableau
          setResumeHebdo(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Erreur chargement résumé hebdo:', error);
        setResumeHebdo([]);
      }
    };

    fetchResumeHebdo();
  }, [weekDays]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const selectedMembreInfo = membres.find(m => m.id === selectedMembre);

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'ok': return 'bg-green-100 text-green-800';
      case 'proche_limite': return 'bg-orange-100 text-orange-800';
      case 'depassement': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRdvColor = (statut: string) => {
    switch (statut) {
      case 'termine': return 'bg-green-50 border-green-300';
      case 'confirme': return 'bg-blue-50 border-blue-300';
      case 'en_attente': return 'bg-yellow-50 border-yellow-300';
      case 'annule': return 'bg-red-50 border-red-300';
      default: return 'bg-gray-50 border-gray-300';
    }
  };

  // Imprimer le planning
  const handlePrint = () => {
    window.print();
  };

  // Télécharger le planning en PDF
  const handleDownloadPDF = async () => {
    if (!selectedMembre || !selectedMembreInfo) return;

    try {
      const weekNumber = getWeekNumber(weekDays[0]);
      const year = weekDays[0].getFullYear();
      const semaineParam = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

      const res = await fetch(
        `${API_BASE}/admin/rh/planning/${selectedMembre}/pdf?semaine=${semaineParam}`,
        { headers: getAuthHeaders() }
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planning_${selectedMembreInfo.nom}_${selectedMembreInfo.prenom}_${formatDate(weekDays[0])}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        console.error('Erreur téléchargement PDF');
      }
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error);
    }
  };

  // Envoyer le planning par email
  const handleSendEmail = async () => {
    if (!selectedMembre || !selectedMembreInfo) return;

    try {
      const weekNumber = getWeekNumber(weekDays[0]);
      const year = weekDays[0].getFullYear();
      const semaineParam = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

      const res = await fetch(
        `${API_BASE}/admin/rh/planning/${selectedMembre}/envoyer`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ semaine: semaineParam })
        }
      );

      if (res.ok) {
        alert(`Planning envoyé à ${selectedMembreInfo.prenom} ${selectedMembreInfo.nom}`);
      } else {
        alert('Erreur lors de l\'envoi');
      }
    } catch (error) {
      console.error('Erreur envoi email:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Planning Employés
          </h2>

          <div className="flex items-center gap-2 ml-4">
            <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Aujourd'hui
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm text-muted-foreground">
              Semaine du {formatDateFr(weekDays[0])} au {formatDateFr(weekDays[6])}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'semaine' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('semaine')}
          >
            <User className="h-4 w-4 mr-1" />
            Vue Employé
          </Button>
          <Button
            variant={viewMode === 'equipe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('equipe')}
          >
            <Users className="h-4 w-4 mr-1" />
            Vue Équipe
          </Button>

          <div className="border-l pl-2 ml-2 flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              title="Imprimer"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={!selectedMembre}
              title="Télécharger PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendEmail}
              disabled={!selectedMembre}
              title="Envoyer par email"
            >
              <Mail className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'semaine' ? (
        <>
          {/* Sélecteur d'employé - Menu déroulant */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <label htmlFor="employe-select" className="text-sm font-medium whitespace-nowrap">
                <User className="h-4 w-4 inline mr-2" />
                Employé :
              </label>
              <select
                id="employe-select"
                value={selectedMembre || ''}
                onChange={(e) => setSelectedMembre(Number(e.target.value))}
                className="flex-1 max-w-xs px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Sélectionner un employé...</option>
                {membres.map((membre) => (
                  <option key={membre.id} value={membre.id}>
                    {membre.nom} {membre.prenom} ({membre.heures_hebdo || 35}h/sem)
                  </option>
                ))}
              </select>

              {/* Badge heures pour l'employé sélectionné */}
              {selectedMembreInfo && planning && (() => {
                const heuresContrat = selectedMembreInfo.heures_hebdo || 35;
                const heuresTravaillees = planning.stats.heures_travaillees || 0;
                const pourcentage = Math.round((heuresTravaillees / heuresContrat) * 100);
                return (
                  <Badge
                    className={`${
                      pourcentage > 100 ? 'bg-red-500 text-white' :
                      pourcentage > 80 ? 'bg-orange-500 text-white' :
                      'bg-green-500 text-white'
                    }`}
                  >
                    {heuresTravaillees}h / {heuresContrat}h ({pourcentage}%)
                  </Badge>
                );
              })()}

              {loading && (
                <RefreshCw className="h-4 w-4 animate-spin" />
              )}
            </div>
          </Card>

          {/* Résumé semaine */}
          {planning && selectedMembreInfo && (() => {
            const heuresContrat = selectedMembreInfo.heures_hebdo || 35;
            const heuresTravaillees = planning.stats.heures_travaillees || 0;
            return (
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Briefcase className="h-4 w-4" />
                  Prestations cette semaine
                </div>
                <p className="text-2xl font-bold mt-1">{planning.stats.total_rdv}</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-4 w-4" />
                  Heures planifiées
                </div>
                <p className="text-2xl font-bold mt-1">
                  {heuresTravaillees}h
                  <span className="text-sm font-normal text-muted-foreground">
                    / {heuresContrat}h
                  </span>
                </p>
                {/* Répartition détaillée des heures */}
                <div className="mt-2 pt-2 border-t space-y-1 text-xs">
                  {/* Heures normales */}
                  {((planning.stats.heures_jour || 0) > 0 || (planning.stats.heures_nuit || 0) > 0) && (
                    <div className="flex gap-3">
                      <span className="text-gray-600 dark:text-gray-400">Normal:</span>
                      {(planning.stats.heures_jour || 0) > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">☀️ {planning.stats.heures_jour}h</span>
                      )}
                      {(planning.stats.heures_nuit || 0) > 0 && (
                        <span className="text-purple-600 dark:text-purple-400">🌙 {planning.stats.heures_nuit}h</span>
                      )}
                    </div>
                  )}
                  {/* Heures dimanche */}
                  {((planning.stats.heures_dimanche_jour || 0) > 0 || (planning.stats.heures_dimanche_nuit || 0) > 0) && (
                    <div className="flex gap-3">
                      <span className="text-blue-600 dark:text-blue-400">Dimanche:</span>
                      {(planning.stats.heures_dimanche_jour || 0) > 0 && (
                        <span className="text-blue-500">☀️ {planning.stats.heures_dimanche_jour}h</span>
                      )}
                      {(planning.stats.heures_dimanche_nuit || 0) > 0 && (
                        <span className="text-blue-700 dark:text-blue-300">🌙 {planning.stats.heures_dimanche_nuit}h</span>
                      )}
                    </div>
                  )}
                  {/* Heures férié */}
                  {((planning.stats.heures_ferie_jour || 0) > 0 || (planning.stats.heures_ferie_nuit || 0) > 0) && (
                    <div className="flex gap-3">
                      <span className="text-red-600 dark:text-red-400">Férié:</span>
                      {(planning.stats.heures_ferie_jour || 0) > 0 && (
                        <span className="text-red-500">☀️ {planning.stats.heures_ferie_jour}h</span>
                      )}
                      {(planning.stats.heures_ferie_nuit || 0) > 0 && (
                        <span className="text-red-700 dark:text-red-300">🌙 {planning.stats.heures_ferie_nuit}h</span>
                      )}
                    </div>
                  )}
                  {/* Heures dimanche férié (cumul majorations) */}
                  {((planning.stats.heures_dimanche_ferie_jour || 0) > 0 || (planning.stats.heures_dimanche_ferie_nuit || 0) > 0) && (
                    <div className="flex gap-3">
                      <span className="bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent font-semibold">Dim+Férié:</span>
                      {(planning.stats.heures_dimanche_ferie_jour || 0) > 0 && (
                        <span className="bg-gradient-to-r from-blue-500 to-red-500 bg-clip-text text-transparent">☀️ {planning.stats.heures_dimanche_ferie_jour}h</span>
                      )}
                      {(planning.stats.heures_dimanche_ferie_nuit || 0) > 0 && (
                        <span className="bg-gradient-to-r from-blue-700 to-red-700 bg-clip-text text-transparent">🌙 {planning.stats.heures_dimanche_ferie_nuit}h</span>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  {heuresTravaillees > heuresContrat ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  Taux d'occupation
                </div>
                <p className={`text-2xl font-bold mt-1 ${
                  heuresTravaillees > heuresContrat
                    ? 'text-red-600'
                    : heuresTravaillees > heuresContrat * 0.8
                    ? 'text-orange-600'
                    : 'text-green-600'
                }`}>
                  {Math.round((heuresTravaillees / heuresContrat) * 100)}%
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calendar className="h-4 w-4" />
                  Jours d'absence
                </div>
                <p className="text-2xl font-bold mt-1">
                  {planning.stats.jours_absence}
                  {planning.stats.jours_absence > 0 && (
                    <span className="ml-2 text-sm font-normal text-orange-600">
                      cette semaine
                    </span>
                  )}
                </p>
              </Card>
            </div>
            );
          })()}

          {/* Calendrier semaine */}
          <Card className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, index) => {
                const dateStr = formatDate(day);
                const jourData = planning?.planning?.[dateStr];
                const isToday = formatDate(new Date()) === dateStr;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-2 min-h-[200px] ${
                      isWeekend ? 'bg-gray-50' : ''
                    } ${isToday ? 'border-blue-500 border-2' : ''}`}
                  >
                    <div className={`text-center pb-2 border-b mb-2 ${
                      isToday ? 'font-bold text-blue-600' : ''
                    }`}>
                      <div className="text-xs text-muted-foreground">
                        {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                      </div>
                      <div className="text-lg">{day.getDate()}</div>
                    </div>

                    {/* Absence */}
                    {jourData?.absent && (
                      <div className="bg-red-100 text-red-800 text-xs rounded p-1 mb-2 text-center">
                        {jourData.type_absence || 'Absent'}
                      </div>
                    )}

                    {/* RDV */}
                    <div className="space-y-1">
                      {(jourData?.rdv || []).map((rdv, rdvIndex) => {
                        // Utiliser heure_fin si disponible, sinon calculer depuis durée
                        const heureDebut = rdv.heure?.slice(0, 5) || '';
                        let heureFin = rdv.heure_fin?.slice(0, 5) || '';

                        // Nettoyer heure_fin si invalide (> 24h)
                        if (heureFin) {
                          const [hf] = heureFin.split(':').map(Number);
                          if (hf >= 24) {
                            heureFin = `${(hf % 24).toString().padStart(2, '0')}:${heureFin.split(':')[1]}`;
                          }
                        }

                        if (!heureFin) {
                          const dureeMinutes = rdv.duree || 60;
                          const [h, m] = (rdv.heure || '09:00').split(':').map(Number);
                          const finMinutes = h * 60 + m + dureeMinutes;
                          heureFin = `${(Math.floor(finMinutes / 60) % 24).toString().padStart(2, '0')}:${(finMinutes % 60).toString().padStart(2, '0')}`;
                        }

                        const heuresNuit = rdv.heures_nuit ? Math.round(rdv.heures_nuit / 60 * 10) / 10 : 0;

                        return (
                          <div
                            key={rdvIndex}
                            className={`text-xs p-1 rounded border ${getRdvColor(rdv.statut)} ${rdv.is_overnight ? 'border-l-2 border-l-purple-500' : ''} ${rdv.is_holiday ? 'border-l-2 border-l-red-500' : ''} ${rdv.is_sunday && !rdv.is_holiday ? 'border-l-2 border-l-blue-500' : ''}`}
                            title={`${rdv.client} - ${rdv.service}${heuresNuit > 0 ? ` (${heuresNuit}h de nuit)` : ''}${rdv.is_sunday ? ' - Dimanche' : ''}${rdv.is_holiday ? ' - Jour férié' : ''}`}
                          >
                            <div className="font-medium flex items-center gap-1 flex-wrap">
                              {rdv.is_holiday && <span className="text-red-500" title="Jour férié">🎌</span>}
                              {rdv.is_sunday && !rdv.is_holiday && <span className="text-blue-500" title="Dimanche">📅</span>}
                              {heuresNuit > 0 && <span className="text-purple-500">🌙</span>}
                              {heureDebut} - {heureFin}
                              {heuresNuit > 0 && (
                                <span className="ml-auto bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-1 rounded text-[10px]">
                                  {heuresNuit}h nuit
                                </span>
                              )}
                            </div>
                            {/* Service/Activité */}
                            <div className="truncate font-medium text-cyan-700 dark:text-cyan-400">
                              {rdv.service}
                            </div>
                            {/* Client */}
                            <div className="truncate text-muted-foreground">
                              {rdv.client}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total heures jour */}
                    {jourData && jourData.rdv.length > 0 && (() => {
                      const totalMinutes = jourData.rdv.reduce((sum, r) => sum + (r.duree || 60), 0);
                      const totalHeures = Math.round(totalMinutes / 60 * 10) / 10;
                      const totalNuitMinutes = jourData.rdv.reduce((sum, r) => sum + (r.heures_nuit || 0), 0);
                      const totalNuit = Math.round(totalNuitMinutes / 60 * 10) / 10;

                      return (
                        <div className="mt-2 pt-2 border-t text-xs text-center space-y-1">
                          <div className="text-muted-foreground">
                            {totalHeures}h planifiées
                          </div>
                          {totalNuit > 0 && (
                            <div className="text-purple-600 dark:text-purple-400 flex items-center justify-center gap-1">
                              <span>🌙</span>
                              <span>{totalNuit}h de nuit</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : (
        /* Vue équipe */
        <Card className="p-4">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Charge équipe - Semaine du {formatDateFr(weekDays[0])}
          </h3>

          <div className="space-y-2">
            {membres.map((membre) => {
              // Calcul simplifié pour la vue équipe
              const heuresContrat = membre.heures_hebdo || 35;
              // Chercher le résumé pour ce membre et cette semaine
              const resumeMembre = Array.isArray(resumeHebdo)
                ? resumeHebdo.find(r => r.membre_id === membre.id && r.semaine_debut === formatDate(weekDays[0]))
                : undefined;
              const heuresPlanifiees = resumeMembre?.heures_planifiees || 0;
              const pourcentage = Math.min(Math.round((heuresPlanifiees / heuresContrat) * 100), 150);
              const statutCharge =
                pourcentage > 100 ? 'depassement' :
                pourcentage > 80 ? 'proche_limite' : 'ok';

              return (
                <div
                  key={membre.id}
                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedMembre(membre.id);
                    setViewMode('semaine');
                  }}
                >
                  <div className="w-40">
                    <span className="font-medium">{membre.prenom} {membre.nom}</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            statutCharge === 'depassement' ? 'bg-red-500' :
                            statutCharge === 'proche_limite' ? 'bg-orange-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(pourcentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm w-16 text-right">{pourcentage}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {heuresPlanifiees}h / {heuresContrat}h
                    </div>
                  </div>

                  <Badge className={getStatutColor(statutCharge)}>
                    {statutCharge === 'ok' && 'OK'}
                    {statutCharge === 'proche_limite' && 'Attention'}
                    {statutCharge === 'depassement' && 'Surcharge'}
                  </Badge>
                </div>
              );
            })}
          </div>

          {membres.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucun employé actif
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
