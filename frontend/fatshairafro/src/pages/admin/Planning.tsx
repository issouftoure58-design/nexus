import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { ChevronLeft, ChevronRight, Printer, CalendarRange } from 'lucide-react';

interface Reservation {
  id: number;
  date_rdv: string;
  heure_rdv: string;
  statut: string;
  client: { nom: string; prenom: string } | null;
  service: { nom: string; duree_minutes: number };
}

const CELL_HEIGHT = 64;
const START_HOUR = 7;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function getMonday(offset: number): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getStatusColor(statut: string) {
  switch (statut) {
    case 'confirme':
      return 'bg-green-500/20 border-green-500 text-green-300';
    case 'en_attente':
    case 'demande':
      return 'bg-amber-500/20 border-amber-500 text-amber-300';
    case 'en_attente_paiement':
      return 'bg-blue-500/20 border-blue-500 text-blue-300';
    case 'termine':
      return 'bg-zinc-500/20 border-zinc-500 text-zinc-400';
    case 'annule':
    case 'no_show':
      return 'bg-red-500/20 border-red-500 text-red-300';
    default:
      return 'bg-zinc-500/20 border-zinc-500 text-zinc-300';
  }
}

function formatHeure(h: string): string {
  const [hh, mm] = h.split(':');
  return mm === '00' ? `${parseInt(hh)}h` : `${parseInt(hh)}h${mm}`;
}

function addMinutes(heure: string, minutes: number): string {
  const [hh, mm] = heure.split(':').map(Number);
  const total = hh * 60 + mm + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${nh}:${nm.toString().padStart(2, '0')}`;
}

export default function AdminPlanning() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const monday = useMemo(() => getMonday(weekOffset), [weekOffset]);
  const weekDays = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [monday]);

  const saturday = weekDays[5];

  useEffect(() => {
    const fetchReservations = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch(
          `/api/admin/reservations?date_debut=${formatDate(monday)}&date_fin=${formatDate(saturday)}&sort=date&order=asc&limit=100`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setReservations(data.reservations || []);
      } catch {
        console.error('Erreur chargement planning');
      } finally {
        setLoading(false);
      }
    };
    fetchReservations();
  }, [weekOffset]);

  // Group reservations by date
  const rdvByDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const r of reservations) {
      if (!map[r.date_rdv]) map[r.date_rdv] = [];
      map[r.date_rdv].push(r);
    }
    return map;
  }, [reservations]);

  const weekLabel = `${weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — ${saturday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 planning-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 planning-no-print">
          <div className="flex items-center gap-3">
            <CalendarRange className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Planning</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition text-white text-sm font-medium"
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="text-white/60 text-sm ml-2 hidden sm:inline">{weekLabel}</span>
            <button
              onClick={() => window.print()}
              className="ml-2 flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden planning-print-header">
          <h1 className="text-xl font-bold">Planning — {weekLabel}</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-8 w-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day headers */}
              <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-zinc-700">
                <div className="p-2" />
                {weekDays.map((day, i) => {
                  const isToday = formatDate(day) === formatDate(new Date());
                  return (
                    <div
                      key={i}
                      className={`p-3 text-center border-l border-zinc-700 ${isToday ? 'bg-amber-500/10' : ''}`}
                    >
                      <div className={`text-sm font-medium ${isToday ? 'text-amber-400' : 'text-white/60'}`}>
                        {DAY_LABELS[i]}
                      </div>
                      <div className={`text-lg font-bold ${isToday ? 'text-amber-400' : 'text-white'}`}>
                        {formatDayHeader(day)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid body */}
              <div className="grid grid-cols-[60px_repeat(6,1fr)]">
                {/* Hour labels + grid rows */}
                <div className="relative">
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="h-16 flex items-start justify-end pr-2 pt-0.5 text-xs text-white/40 border-b border-zinc-800"
                    >
                      {h}h
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day, colIdx) => {
                  const dateStr = formatDate(day);
                  const dayRdvs = rdvByDate[dateStr] || [];
                  const isToday = dateStr === formatDate(new Date());

                  return (
                    <div
                      key={colIdx}
                      className={`relative border-l border-zinc-700 ${isToday ? 'bg-amber-500/5' : ''}`}
                    >
                      {/* Hour grid lines */}
                      {HOURS.map(h => (
                        <div key={h} className="h-16 border-b border-zinc-800/50" />
                      ))}

                      {/* RDV blocks */}
                      {dayRdvs.map(rdv => {
                        const [hh, mm] = rdv.heure_rdv.split(':').map(Number);
                        const topPx = (hh - START_HOUR) * CELL_HEIGHT + (mm / 60) * CELL_HEIGHT;
                        const heightPx = Math.max((rdv.service.duree_minutes / 60) * CELL_HEIGHT, 28);
                        const endHeure = addMinutes(rdv.heure_rdv, rdv.service.duree_minutes);
                        const clientName = rdv.client ? rdv.client.prenom : 'Client';
                        const serviceName = rdv.service.nom.length > 18
                          ? rdv.service.nom.substring(0, 16) + '…'
                          : rdv.service.nom;
                        const isSmall = heightPx < 50;

                        return (
                          <div
                            key={rdv.id}
                            className={`absolute left-1 right-1 rounded-lg border-l-4 px-2 py-1 overflow-hidden cursor-default ${getStatusColor(rdv.statut)}`}
                            style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                            title={`${rdv.client?.prenom} ${rdv.client?.nom} — ${rdv.service.nom}\n${formatHeure(rdv.heure_rdv)} - ${formatHeure(endHeure)}`}
                          >
                            {isSmall ? (
                              <p className="text-xs font-medium truncate">
                                {clientName} · {formatHeure(rdv.heure_rdv)}
                              </p>
                            ) : (
                              <>
                                <p className="text-xs font-semibold truncate">{clientName}</p>
                                <p className="text-[10px] opacity-80 truncate">{serviceName}</p>
                                <p className="text-[10px] opacity-60">
                                  {formatHeure(rdv.heure_rdv)} - {formatHeure(endHeure)}
                                </p>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .planning-container, .planning-container * { visibility: visible; }
          .planning-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 16px !important;
          }
          .planning-no-print { display: none !important; }
          .planning-print-header { display: block !important; margin-bottom: 16px; }
          .planning-print-header h1 { color: black; }
          [class*="border-zinc"] { border-color: #ccc !important; }
          [class*="text-white"] { color: black !important; }
          [class*="text-amber"] { color: #b45309 !important; }
          [class*="bg-green"] { background: #dcfce7 !important; border-color: #16a34a !important; }
          [class*="bg-amber"][class*="border-amber"] { background: #fef3c7 !important; border-color: #d97706 !important; }
          [class*="bg-blue"] { background: #dbeafe !important; border-color: #2563eb !important; }
          [class*="bg-zinc"][class*="border-zinc-500"] { background: #e5e7eb !important; border-color: #6b7280 !important; }
          [class*="bg-red"] { background: #fee2e2 !important; border-color: #dc2626 !important; }
          [class*="text-green"], [class*="text-amber-3"], [class*="text-blue"], [class*="text-red"], [class*="text-zinc-4"] { color: black !important; }
          .overflow-x-auto { overflow: visible !important; }
          .min-w-\\[800px\\] { min-width: 0 !important; width: 100% !important; }
        }
      `}</style>
    </AdminLayout>
  );
}
