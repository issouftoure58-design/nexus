import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Printer, Calendar, Users, Building2, ChevronDown, Loader2, CheckCircle, ClipboardList } from 'lucide-react';
import { api } from '../lib/api';
import { splitHoursSegments, computeHoursTotals, TOTALS_LABELS, type HoursTotals } from '../lib/majorations';
import CloturerPeriodeModal from '../components/activites/CloturerPeriodeModal';
import PointageModal from '../components/planning/PointageModal';

// ── Types ───────────────────────────────────────────────────────────────────

interface ServiceLigne {
  nom: string;
  duree: number;
  heure_debut: string | null;
  heure_fin: string | null;
  prix: number;
  membre_id: number | null;
}

interface PlanningRDV {
  id: number;
  heure: string;
  service: string;
  services: ServiceLigne[];
  duree: number;
  statut: string;
  prix: number;
  client: string;
  client_id: number | null;
  client_tel: string;
  adresse: string;
  employe: string;
  employe_id: number | null;
  employes: { id: number; nom: string; prenom: string; role: string }[];
  is_forfait?: boolean;
  forfait_periode_id?: number;
}

interface PlanningResponse {
  planning: Record<string, PlanningRDV[]>;
  stats: { total_rdv: number; total_heures: number; ca_potentiel: number };
}

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  statut: string;
}

type ViewMode = 'equipe' | 'client';
type PrintMode = 'interne' | 'externe';

// ── Helpers ─────────────────────────────────────────────────────────────────

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const STATUT_COLORS: Record<string, string> = {
  confirme: 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
  en_attente: 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300',
  termine: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
  annule: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
  no_show: 'bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300',
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getPrintRangeLabel(dateDebut: string, dateFin: string): string {
  const d1 = new Date(dateDebut + 'T12:00');
  const d2 = new Date(dateFin + 'T12:00');
  const days = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
  if (days === 1) return d1.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (days <= 7) return `Sem. ${getWeekNumber(d1)}/${d1.getFullYear()}`;
  if (days <= 62) {
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return `${d1.toLocaleDateString('fr-FR', opts)} — ${d2.toLocaleDateString('fr-FR', opts)}`;
  }
  return `${d1.getFullYear()}`;
}

function getRangeDays(dateDebut: string, dateFin: string): number {
  const d1 = new Date(dateDebut + 'T12:00');
  const d2 = new Date(dateFin + 'T12:00');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

function getWeeksInRange(dateDebut: string, dateFin: string): Date[][] {
  const weeks: Date[][] = [];
  let monday = getMonday(new Date(dateDebut + 'T12:00'));
  const end = new Date(dateFin + 'T12:00');
  while (monday <= end) {
    weeks.push(getWeekDates(monday));
    const next = new Date(monday);
    next.setDate(next.getDate() + 7);
    monday = next;
  }
  return weeks;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Planning() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('equipe');
  const [filterClientId, setFilterClientId] = useState<number | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>('interne');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const [printDateDebut, setPrintDateDebut] = useState('');
  const [printDateFin, setPrintDateFin] = useState('');
  const [printData, setPrintData] = useState<PlanningResponse | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);
  const [showCloturerModal, setShowCloturerModal] = useState(false);
  const [showPointageModal, setShowPointageModal] = useState(false);

  // Close print dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (printDropdownRef.current && !printDropdownRef.current.contains(e.target as Node)) {
        setPrintDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const dateDebut = formatDate(weekDates[0]);
  const dateFin = formatDate(weekDates[6]);

  // Sync print dates to current week when navigating
  useEffect(() => {
    setPrintDateDebut(dateDebut);
    setPrintDateFin(dateFin);
  }, [dateDebut, dateFin]);

  // Navigation semaine
  const goToday = useCallback(() => setWeekStart(getMonday(new Date())), []);
  const goPrev = useCallback(() => setWeekStart(prev => {
    const d = new Date(prev);
    d.setDate(d.getDate() - 7);
    return d;
  }), []);
  const goNext = useCallback(() => setWeekStart(prev => {
    const d = new Date(prev);
    d.setDate(d.getDate() + 7);
    return d;
  }), []);

  // Fetch equipe
  const { data: membresRaw } = useQuery<Membre[]>({
    queryKey: ['equipe-planning'],
    queryFn: async () => {
      const raw = await api.get<any>('/admin/services/equipe');
      return Array.isArray(raw) ? raw : (raw as any).data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const membres = useMemo(() => membresRaw || [], [membresRaw]);

  // Fetch planning
  const { data: planningData, isLoading } = useQuery<PlanningResponse>({
    queryKey: ['planning-global', dateDebut, dateFin],
    queryFn: () => api.get<PlanningResponse>(`/admin/rh/planning?date_debut=${dateDebut}&date_fin=${dateFin}`),
  });

  // Pivot: grille equipe [membreId][dateStr] → RDV[]
  const grille = useMemo(() => {
    const map: Record<number, Record<string, PlanningRDV[]>> = {};
    if (!planningData?.planning) return map;

    Object.entries(planningData.planning).forEach(([dateStr, rdvs]) => {
      rdvs.forEach(rdv => {
        const employeIds: number[] = [];
        if (rdv.employe_id) employeIds.push(rdv.employe_id);
        (rdv.employes || []).forEach(e => {
          if (!employeIds.includes(e.id)) employeIds.push(e.id);
        });
        if (employeIds.length === 0) employeIds.push(0);

        employeIds.forEach(eid => {
          if (!map[eid]) map[eid] = {};
          if (!map[eid][dateStr]) map[eid][dateStr] = [];
          map[eid][dateStr].push(rdv);
        });
      });
    });
    return map;
  }, [planningData]);

  // Pivot: grille client [clientId][dateStr] → RDV[]
  const grilleClient = useMemo(() => {
    const map: Record<number, Record<string, PlanningRDV[]>> = {};
    if (!planningData?.planning) return map;

    Object.entries(planningData.planning).forEach(([dateStr, rdvs]) => {
      rdvs.forEach(rdv => {
        const cid = rdv.client_id || 0;
        if (!map[cid]) map[cid] = {};
        if (!map[cid][dateStr]) map[cid][dateStr] = [];
        if (!map[cid][dateStr].some(r => r.id === rdv.id)) {
          map[cid][dateStr].push(rdv);
        }
      });
    });
    return map;
  }, [planningData]);

  // Liste clients unique
  const displayClients = useMemo(() => {
    const seen = new Map<number, string>();
    if (!planningData?.planning) return [];

    Object.values(planningData.planning).forEach(rdvs => {
      rdvs.forEach(rdv => {
        const cid = rdv.client_id || 0;
        if (!seen.has(cid)) {
          seen.set(cid, cid === 0 ? 'Client inconnu' : rdv.client);
        }
      });
    });

    return Array.from(seen.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [planningData]);

  // Membres a afficher
  const displayMembres = useMemo(() => {
    const membreIds = new Set(membres.map(m => m.id));
    const list: { id: number; label: string }[] = membres.map(m => ({
      id: m.id,
      label: `${m.prenom} ${m.nom}`,
    }));
    Object.keys(grille).forEach(idStr => {
      const id = Number(idStr);
      if (id !== 0 && !membreIds.has(id)) {
        const firstRdv = Object.values(grille[id]!)[0]?.[0];
        const emp = firstRdv?.employes?.find(e => e.id === id);
        list.push({ id, label: emp ? `${emp.prenom} ${emp.nom}` : `Employé #${id}` });
      }
    });
    if (grille[0]) {
      list.push({ id: 0, label: 'Non assigné' });
    }
    return list;
  }, [membres, grille]);

  // Clients filtres pour affichage
  const filteredClients = useMemo(() => {
    if (filterClientId === null) return displayClients;
    return displayClients.filter(c => c.id === filterClientId);
  }, [displayClients, filterClientId]);

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  // Range label
  const rangeLabel = `${formatShortDate(weekDates[0])} — ${formatShortDate(weekDates[6])} ${weekDates[6].getFullYear()}`;

  const handlePrint = async (mode: PrintMode) => {
    setPrintMode(mode);
    setPrintDropdownOpen(false);

    // If the selected range matches the loaded week, print directly
    if (printDateDebut === dateDebut && printDateFin === dateFin && planningData) {
      setPrintData(null);
      setIsPrinting(true);
      setTimeout(() => { window.print(); setIsPrinting(false); }, 100);
      return;
    }

    setPrintLoading(true);
    try {
      const data = await api.get<PlanningResponse>(
        `/admin/rh/planning?date_debut=${printDateDebut}&date_fin=${printDateFin}`
      );
      setPrintData(data);
      setIsPrinting(true);
      setTimeout(() => { window.print(); setPrintLoading(false); setIsPrinting(false); }, 150);
    } catch {
      setPrintLoading(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderRdvCard = (rdv: PlanningRDV, context: { showAgent: boolean; showAdresse: boolean; membreId?: number }) => {
    const colors = STATUT_COLORS[rdv.statut] || STATUT_COLORS.en_attente;

    let displayServices = rdv.services || [];
    if (context.membreId !== undefined && rdv.services?.length > 1) {
      const filtered = rdv.services.filter(s => !s.membre_id || s.membre_id === context.membreId);
      if (filtered.length > 0) displayServices = filtered;
    }

    const dureeMembre = displayServices.reduce((sum, s) => sum + (s.duree || 0), 0);
    const sorted = displayServices.filter(s => s.heure_fin).sort((a, b) => (a.heure_fin! > b.heure_fin! ? 1 : -1));
    const lastService = sorted[sorted.length - 1];
    const heureFin = lastService?.heure_fin?.slice(0, 5);
    const heureDebut = displayServices.find(s => s.heure_debut)?.heure_debut?.slice(0, 5) || rdv.heure?.slice(0, 5);

    return (
      <div key={rdv.id} className={`p-1.5 rounded border text-xs ${colors}`}>
        <div className="font-semibold">
          {heureDebut}{heureFin ? ` → ${heureFin}` : ` · ${dureeMembre || rdv.duree}min`}
        </div>
        {displayServices.map((s, si) => (
          <div key={si} className="truncate">
            {s.heure_debut && s.heure_fin
              ? <><span className="opacity-60">{s.heure_debut.slice(0, 5)}</span> {s.nom}</>
              : s.nom
            }
          </div>
        ))}
        {context.membreId !== undefined && (
          <div className="truncate opacity-75 mt-0.5">{rdv.client}</div>
        )}
        {context.showAdresse && rdv.adresse && (
          <div className="truncate opacity-60 mt-0.5 italic">{rdv.adresse}</div>
        )}
        {context.showAgent && rdv.employe && (
          <div className="truncate opacity-75 mt-0.5">{rdv.employe}</div>
        )}
      </div>
    );
  };

  // ── Shared table parts ────────────────────────────────────────────────

  const renderTableHeader = (firstColLabel: string) => (
    <thead>
      <tr>
        <th className="w-40 p-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 sticky left-0 z-10">
          {firstColLabel}
        </th>
        {weekDates.map((d, i) => (
          <th
            key={i}
            className={`p-3 text-center text-xs font-semibold uppercase tracking-wider border-b border-l border-gray-200 dark:border-gray-800 ${
              isToday(d)
                ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                : 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'
            }`}
          >
            <div>{JOURS[i]}</div>
            <div className={`text-sm font-bold ${isToday(d) ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {d.getDate()}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );

  // ── Print template ────────────────────────────────────────────────────

  const renderPrintTemplate = () => {
    const pDebut = printDateDebut || dateDebut;
    const pFin = printDateFin || dateFin;
    const rangeDays = getRangeDays(pDebut, pFin);
    const rangeLabel = getPrintRangeLabel(pDebut, pFin);
    const isExterne = printMode === 'externe';
    const sourceData = printData || planningData;
    if (!sourceData?.planning) return null;

    // Build pivots from source data
    const pGrille: Record<number, Record<string, PlanningRDV[]>> = {};
    const pGrilleClient: Record<number, Record<string, PlanningRDV[]>> = {};

    Object.entries(sourceData.planning).forEach(([dateStr, rdvs]) => {
      rdvs.forEach(rdv => {
        const employeIds: number[] = [];
        if (rdv.employe_id) employeIds.push(rdv.employe_id);
        (rdv.employes || []).forEach(e => { if (!employeIds.includes(e.id)) employeIds.push(e.id); });
        if (employeIds.length === 0) employeIds.push(0);
        employeIds.forEach(eid => {
          if (!pGrille[eid]) pGrille[eid] = {};
          if (!pGrille[eid][dateStr]) pGrille[eid][dateStr] = [];
          pGrille[eid][dateStr].push(rdv);
        });
        const cid = rdv.client_id || 0;
        if (!pGrilleClient[cid]) pGrilleClient[cid] = {};
        if (!pGrilleClient[cid][dateStr]) pGrilleClient[cid][dateStr] = [];
        if (!pGrilleClient[cid][dateStr].some(r => r.id === rdv.id)) {
          pGrilleClient[cid][dateStr].push(rdv);
        }
      });
    });

    // Determine rows and grid
    let rows: { id: number; label: string }[];
    let gridData: Record<number, Record<string, PlanningRDV[]>>;
    if (viewMode === 'client') {
      const cm = new Map<number, string>();
      Object.values(sourceData.planning).forEach(rdvs => rdvs.forEach(rdv => {
        const cid = rdv.client_id || 0;
        if (!cm.has(cid)) cm.set(cid, cid === 0 ? 'Client inconnu' : rdv.client);
      }));
      let cl = Array.from(cm.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
      if (filterClientId !== null) cl = cl.filter(c => c.id === filterClientId);
      rows = cl;
      gridData = pGrilleClient;
    } else {
      if (printData) {
        const membreIds = new Set(membres.map(m => m.id));
        const list: { id: number; label: string }[] = membres.map(m => ({ id: m.id, label: `${m.prenom} ${m.nom}` }));
        Object.keys(pGrille).forEach(idStr => {
          const id = Number(idStr);
          if (id !== 0 && !membreIds.has(id)) {
            const firstRdv = Object.values(pGrille[id]!)[0]?.[0];
            const emp = firstRdv?.employes?.find(e => e.id === id);
            list.push({ id, label: emp ? `${emp.prenom} ${emp.nom}` : `Employé #${id}` });
          }
        });
        if (pGrille[0]) list.push({ id: 0, label: 'Non assigné' });
        rows = list;
      } else {
        rows = displayMembres;
      }
      gridData = pGrille;
    }

    const pHoursTotals = computeHoursTotals(sourceData.planning, viewMode === 'client' ? filterClientId : null);

    // Print title
    const titlePrefix = viewMode === 'equipe'
      ? 'Planning Équipe'
      : filterClientId !== null
        ? `Planning Client — ${rows.find(r => r.id === filterClientId)?.label || ''}`
        : 'Planning Clients';
    const title = `${titlePrefix} — ${rangeLabel}`;

    // Render RDV cell content
    const renderPrintRdv = (rdv: PlanningRDV, dateStr: string, rowId: number) => {
      let ds = rdv.services || [];
      if (viewMode === 'equipe' && rdv.services?.length > 1) {
        const filtered = rdv.services.filter(s => !s.membre_id || s.membre_id === rowId);
        if (filtered.length > 0) ds = filtered;
      }
      const heureDebut = ds.find(s => s.heure_debut)?.heure_debut?.slice(0, 5) || rdv.heure?.slice(0, 5);
      const sorted = ds.filter(s => s.heure_fin).sort((a, b) => (a.heure_fin! > b.heure_fin! ? 1 : -1));
      const heureFin = sorted[sorted.length - 1]?.heure_fin?.slice(0, 5);
      const dur = ds.reduce((sum, s) => sum + (s.duree || 0), 0) || rdv.duree;
      const segments = (heureDebut && heureFin) ? splitHoursSegments(dateStr, heureDebut, heureFin) : [];
      const majLabels = segments.filter(s => s.type !== 'jour').map(s => `${TOTALS_LABELS[s.type as keyof typeof TOTALS_LABELS]} ${Math.round(s.hours * 10) / 10}h`);

      return (
        <div key={rdv.id} className="print-rdv">
          <div className="print-rdv-time">
            {heureDebut}{heureFin ? ` → ${heureFin}` : ''} ({Math.round(dur / 60 * 10) / 10}h)
            {majLabels.length > 0 && <span className="print-maj"> [{majLabels.join(', ')}]</span>}
          </div>
          {ds.map((s, si) => <div key={si} className="print-rdv-service">{s.nom}</div>)}
          {viewMode === 'equipe' && <div className="print-rdv-client">{rdv.client}</div>}
          {rdv.adresse && <div className="print-rdv-adresse">{rdv.adresse}</div>}
          {!isExterne && rdv.employe && viewMode === 'client' && <div className="print-rdv-agent">{rdv.employe}</div>}
        </div>
      );
    };

    // Render totals table
    const renderTotals = (totals: HoursTotals) => {
      if (totals.total <= 0) return null;
      return (
        <div className="print-totals">
          <h3>Récapitulatif heures</h3>
          <table className="print-totals-table">
            <thead><tr>
              {(Object.keys(TOTALS_LABELS) as Array<keyof typeof TOTALS_LABELS>).map(key => <th key={key}>{TOTALS_LABELS[key]}</th>)}
              <th className="print-totals-total">TOTAL</th>
            </tr></thead>
            <tbody><tr>
              {(Object.keys(TOTALS_LABELS) as Array<keyof typeof TOTALS_LABELS>).map(key => (
                <td key={key}>{totals[key] > 0 ? `${Math.round(totals[key] * 10) / 10}h` : '-'}</td>
              ))}
              <td className="print-totals-total">{Math.round(totals.total * 10) / 10}h</td>
            </tr></tbody>
          </table>
        </div>
      );
    };

    // Week grid (reusable for semaine & mois)
    const renderWeekGrid = (wDates: Date[], weekLabel?: string) => (
      <div className="print-week-block" key={weekLabel}>
        {weekLabel && <div className="print-week-separator">{weekLabel}</div>}
        <table className="print-table">
          <thead><tr>
            <th className="print-col-label">{viewMode === 'client' ? 'Client' : 'Employé'}</th>
            {wDates.map((d, i) => (
              <th key={i} className="print-col-day">
                {JOURS_FULL[i]} {d.getDate()}/{String(d.getMonth() + 1).padStart(2, '0')}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td className="print-cell-label">{row.label}</td>
                {wDates.map((d, i) => {
                  const dateStr = formatDate(d);
                  const rdvs = gridData[row.id]?.[dateStr] || [];
                  return <td key={i} className="print-cell">{rdvs.map(rdv => renderPrintRdv(rdv, dateStr, row.id))}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    // ── 1 jour : tableau simple ──
    if (rangeDays === 1) {
      const dateStr = pDebut;
      return (
        <div className="print-template">
          <div className="print-header">
            <h1>{title}</h1>
            {isExterne && <p className="print-subtitle">Document justificatif</p>}
          </div>
          <table className="print-table">
            <thead><tr>
              <th className="print-col-label">{viewMode === 'client' ? 'Client' : 'Employé'}</th>
              <th className="print-col-day" style={{ width: 'auto' }}>Prestations</th>
            </tr></thead>
            <tbody>
              {rows.map(row => {
                const rdvs = gridData[row.id]?.[dateStr] || [];
                return (
                  <tr key={row.id}>
                    <td className="print-cell-label">{row.label}</td>
                    <td className="print-cell">{rdvs.map(rdv => renderPrintRdv(rdv, dateStr, row.id))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {renderTotals(pHoursTotals)}
          <div className="print-footer">Imprimé le {new Date().toLocaleDateString('fr-FR')} — NEXUS Platform</div>
        </div>
      );
    }

    // ── ≤ 7 jours : grille semaine unique ──
    if (rangeDays <= 7) {
      const wDates = getWeeksInRange(pDebut, pFin)[0] || weekDates;
      return (
        <div className="print-template">
          <div className="print-header">
            <h1>{title}</h1>
            <p>Période : du {pDebut.split('-').reverse().join('/')} au {pFin.split('-').reverse().join('/')}</p>
            {isExterne && <p className="print-subtitle">Document justificatif</p>}
          </div>
          {renderWeekGrid(wDates)}
          {renderTotals(pHoursTotals)}
          <div className="print-footer">Imprimé le {new Date().toLocaleDateString('fr-FR')} — NEXUS Platform</div>
        </div>
      );
    }

    // ── ≤ 62 jours : grilles semaine détaillées ──
    if (rangeDays <= 62) {
      const weeks = getWeeksInRange(pDebut, pFin);
      return (
        <div className="print-template">
          <div className="print-header">
            <h1>{title}</h1>
            <p>Période : du {pDebut.split('-').reverse().join('/')} au {pFin.split('-').reverse().join('/')}</p>
            {isExterne && <p className="print-subtitle">Document justificatif</p>}
          </div>
          {weeks.map((wDates) => renderWeekGrid(wDates, `Semaine ${getWeekNumber(wDates[0])}`))}
          {renderTotals(pHoursTotals)}
          <div className="print-footer">Imprimé le {new Date().toLocaleDateString('fr-FR')} — NEXUS Platform</div>
        </div>
      );
    }

    // ── > 62 jours : récapitulatif mensuel ──
    const d1 = new Date(pDebut + 'T12:00');
    const d2 = new Date(pFin + 'T12:00');
    const months: { label: string; totals: HoursTotals }[] = [];
    let cur = new Date(d1.getFullYear(), d1.getMonth(), 1);
    while (cur <= d2) {
      const monthPlanning: Record<string, PlanningRDV[]> = {};
      Object.entries(sourceData.planning).forEach(([ds, rdvs]) => {
        const dd = new Date(ds + 'T12:00');
        if (dd.getMonth() === cur.getMonth() && dd.getFullYear() === cur.getFullYear()) {
          monthPlanning[ds] = rdvs;
        }
      });
      months.push({
        label: cur.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        totals: computeHoursTotals(monthPlanning, viewMode === 'client' ? filterClientId : null),
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }

    const yearTotals: HoursTotals = { jour: 0, nuit: 0, dimanche_jour: 0, dimanche_nuit: 0, ferie_jour: 0, ferie_nuit: 0, total: 0 };
    months.forEach(m => {
      (Object.keys(TOTALS_LABELS) as Array<keyof typeof TOTALS_LABELS>).forEach(key => { yearTotals[key] += m.totals[key]; });
      yearTotals.total += m.totals.total;
    });

    return (
      <div className="print-template">
        <div className="print-header">
          <h1>{title}</h1>
          <p>Période : du {pDebut.split('-').reverse().join('/')} au {pFin.split('-').reverse().join('/')}</p>
          {isExterne && <p className="print-subtitle">Document justificatif</p>}
        </div>
        <table className="print-table">
          <thead><tr>
            <th className="print-col-label">Mois</th>
            {(Object.keys(TOTALS_LABELS) as Array<keyof typeof TOTALS_LABELS>).map(key => (
              <th key={key} className="print-col-day">{TOTALS_LABELS[key]}</th>
            ))}
            <th className="print-col-day" style={{ fontWeight: 700 }}>TOTAL</th>
          </tr></thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={i}>
                <td className="print-cell-label" style={{ textTransform: 'capitalize' }}>{m.label}</td>
                {(Object.keys(TOTALS_LABELS) as Array<keyof typeof TOTALS_LABELS>).map(key => (
                  <td key={key} className="print-cell" style={{ textAlign: 'center' }}>
                    {m.totals[key] > 0 ? `${Math.round(m.totals[key] * 10) / 10}h` : '-'}
                  </td>
                ))}
                <td className="print-cell" style={{ textAlign: 'center', fontWeight: 700 }}>
                  {m.totals.total > 0 ? `${Math.round(m.totals.total * 10) / 10}h` : '-'}
                </td>
              </tr>
            ))}
            <tr>
              <td className="print-cell-label" style={{ fontWeight: 700 }}>TOTAL</td>
              {(Object.keys(TOTALS_LABELS) as Array<keyof typeof TOTALS_LABELS>).map(key => (
                <td key={key} className="print-cell" style={{ textAlign: 'center', fontWeight: 700 }}>
                  {yearTotals[key] > 0 ? `${Math.round(yearTotals[key] * 10) / 10}h` : '-'}
                </td>
              ))}
              <td className="print-cell" style={{ textAlign: 'center', fontWeight: 700 }}>
                {Math.round(yearTotals.total * 10) / 10}h
              </td>
            </tr>
          </tbody>
        </table>
        <div className="print-footer">Imprimé le {new Date().toLocaleDateString('fr-FR')} — NEXUS Platform</div>
      </div>
    );
  };

  return (
    <div className="print-planning">
      {/* ══════════ ECRAN (no-print) ══════════ */}
      <div className="no-print">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-cyan-500" />
              Planning
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{rangeLabel}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => { setViewMode('equipe'); setFilterClientId(null); }}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'equipe'
                    ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <Users className="w-4 h-4" />
                Équipe
              </button>
              <button
                onClick={() => setViewMode('client')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors border-l border-gray-200 dark:border-gray-700 ${
                  viewMode === 'client'
                    ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Client
              </button>
            </div>

            {/* Client filter */}
            {viewMode === 'client' && displayClients.length > 0 && (
              <select
                value={filterClientId ?? ''}
                onChange={e => setFilterClientId(e.target.value === '' ? null : Number(e.target.value))}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
              >
                <option value="">Tous les clients</option>
                {displayClients.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            )}

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

            {/* Week nav */}
            <button onClick={goPrev} aria-label="Semaine précédente" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-sm font-medium bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
            >
              Aujourd'hui
            </button>
            <button onClick={goNext} aria-label="Semaine suivante" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            {/* Print date range */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={printDateDebut}
                onChange={e => setPrintDateDebut(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-[120px]"
              />
              <span className="text-xs text-gray-400">→</span>
              <input
                type="date"
                value={printDateFin}
                onChange={e => setPrintDateFin(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-[120px]"
              />
            </div>

            {/* Print dropdown */}
            <div className="relative" ref={printDropdownRef}>
              <button
                onClick={() => setPrintDropdownOpen(!printDropdownOpen)}
                className="ml-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1"
                title="Imprimer"
                aria-label="Options d'impression"
                disabled={printLoading}
              >
                {printLoading
                  ? <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
                  : <Printer className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                }
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {printDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 min-w-[200px]">
                  <button
                    onClick={() => handlePrint('interne')}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-lg"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">Interne</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Avec agents affectés</div>
                  </button>
                  <button
                    onClick={() => handlePrint('externe')}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 rounded-b-lg border-t border-gray-100 dark:border-gray-800"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">Externe</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Justificatif client (sans agents)</div>
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

            {/* Pointage */}
            <button
              onClick={() => setShowPointageModal(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1.5"
              title="Pointage des heures"
              aria-label="Pointage des heures"
            >
              <ClipboardList className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 hidden lg:inline">Pointage</span>
            </button>

            {/* Clôturer période */}
            <button
              onClick={() => setShowCloturerModal(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1.5"
              title="Clôturer une période"
              aria-label="Clôturer une période"
            >
              <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 hidden lg:inline">Cloturer</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        {planningData?.stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">RDV cette semaine</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{planningData.stats.total_rdv}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Heures planifiées</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{planningData.stats.total_heures}h</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">CA potentiel</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{planningData.stats.ca_potentiel.toFixed(0)}€</p>
            </div>
          </div>
        )}

        {/* Grille planning — écran */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewMode === 'equipe' ? (
            displayMembres.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Aucun membre d'équipe</p>
                <p className="text-sm mt-1">Ajoutez des membres dans la page Équipe pour voir le planning.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px]">
                  {renderTableHeader('Employé')}
                  <tbody>
                    {displayMembres.map(membre => (
                      <tr key={membre.id} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                        <td className="p-3 font-medium text-sm text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 sticky left-0 z-10 align-top">
                          {membre.label}
                        </td>
                        {weekDates.map((d, i) => {
                          const dateStr = formatDate(d);
                          const rdvs = grille[membre.id]?.[dateStr] || [];
                          return (
                            <td key={i} className={`p-1.5 border-l border-gray-100 dark:border-gray-800 align-top min-h-[60px] ${isToday(d) ? 'bg-cyan-50/30 dark:bg-cyan-900/10' : ''}`}>
                              <div className="space-y-1">
                                {rdvs.map(rdv => renderRdvCard(rdv, { showAgent: false, showAdresse: false, membreId: membre.id }))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            filteredClients.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Aucune mission cette semaine</p>
                <p className="text-sm mt-1">Aucun client avec des prestations sur cette période.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px]">
                  {renderTableHeader('Client')}
                  <tbody>
                    {filteredClients.map(client => {
                      return (
                      <tr key={client.id} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                        <td className="p-3 font-medium text-sm text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 sticky left-0 z-10 align-top">
                          <span>{client.label}</span>
                        </td>
                        {weekDates.map((d, i) => {
                          const dateStr = formatDate(d);
                          const rdvs = grilleClient[client.id]?.[dateStr] || [];
                          return (
                            <td key={i} className={`p-1.5 border-l border-gray-100 dark:border-gray-800 align-top min-h-[60px] ${isToday(d) ? 'bg-cyan-50/30 dark:bg-cyan-900/10' : ''}`}>
                              <div className="space-y-1">
                                {rdvs.map(rdv => renderRdvCard(rdv, { showAgent: true, showAdresse: true }))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* ══════════ PRINT TEMPLATE (print-only) ══════════ */}
      {isPrinting && renderPrintTemplate()}

      {/* Modal Clôturer Période (global) */}
      {showCloturerModal && (
        <CloturerPeriodeModal
          onClose={() => setShowCloturerModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {/* Modal Pointage */}
      {showPointageModal && (
        <PointageModal
          onClose={() => setShowPointageModal(false)}
          membres={membres}
        />
      )}
    </div>
  );
}
