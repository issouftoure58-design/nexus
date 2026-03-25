import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Phone } from 'lucide-react';
import { employeePortalApi, type PlanningResponse, type PlanningJour, type PlanningRdv } from '../../lib/employeeApi';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_COMPLET = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateFr(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

export default function EmployeePlanning() {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [data, setData] = useState<PlanningResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const dateDebut = formatDate(currentMonday);
  const sunday = new Date(currentMonday);
  sunday.setDate(currentMonday.getDate() + 6);
  const dateFin = formatDate(sunday);

  const fetchPlanning = useCallback(async () => {
    setLoading(true);
    try {
      const result = await employeePortalApi.getPlanning(dateDebut, dateFin);
      setData(result);
    } catch (err) {
      console.error('Erreur planning:', err);
    } finally {
      setLoading(false);
    }
  }, [dateDebut, dateFin]);

  useEffect(() => {
    fetchPlanning();
  }, [fetchPlanning]);

  const prevWeek = () => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() - 7);
    setCurrentMonday(d);
  };

  const nextWeek = () => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + 7);
    setCurrentMonday(d);
  };

  const today = () => setCurrentMonday(getMonday(new Date()));

  // Generer les 7 jours de la semaine
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + i);
    return formatDate(d);
  });

  const isToday = (dateStr: string) => dateStr === formatDate(new Date());

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mon Planning</h1>
        {data && (
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {data.stats.total_rdv} RDV
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {data.stats.heures_travaillees}h
            </span>
          </div>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-xl border border-gray-200 p-3">
        <button onClick={prevWeek} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-900">
            {formatDateFr(dateDebut)} — {formatDateFr(dateFin)}
          </span>
          <button
            onClick={today}
            className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition"
          >
            Aujourd'hui
          </button>
        </div>
        <button onClick={nextWeek} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop: grille 7 colonnes */}
          <div className="hidden md:grid grid-cols-7 gap-2">
            {weekDays.map((dateStr, i) => {
              const jour: PlanningJour = data?.planning?.[dateStr] || { rdv: [], absent: false, type_absence: null };
              return (
                <div
                  key={dateStr}
                  className={`rounded-xl border p-3 min-h-[180px] ${
                    isToday(dateStr)
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : jour.absent
                      ? 'border-red-200 bg-red-50/50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-center mb-2">
                    <div className="text-xs text-gray-500">{JOURS[i]}</div>
                    <div
                      className={`text-lg font-bold ${
                        isToday(dateStr) ? 'text-emerald-600' : 'text-gray-900'
                      }`}
                    >
                      {dateStr.split('-')[2]}
                    </div>
                  </div>

                  {jour.absent && (
                    <div className="text-xs bg-red-100 text-red-700 rounded px-2 py-1 text-center mb-2">
                      {jour.type_absence === 'conge' ? 'Conge' : jour.type_absence || 'Absent'}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {jour.rdv.map((rdv) => (
                      <RdvCard key={rdv.id} rdv={rdv} compact />
                    ))}
                  </div>

                  {!jour.absent && jour.rdv.length === 0 && (
                    <p className="text-xs text-gray-400 text-center mt-4">Aucun RDV</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: liste */}
          <div className="md:hidden space-y-3">
            {weekDays.map((dateStr, i) => {
              const jour: PlanningJour = data?.planning?.[dateStr] || { rdv: [], absent: false, type_absence: null };
              if (jour.rdv.length === 0 && !jour.absent) return null;

              return (
                <div key={dateStr} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div
                    className={`px-4 py-2 flex items-center justify-between ${
                      isToday(dateStr) ? 'bg-emerald-50 border-b border-emerald-200' : 'bg-gray-50 border-b'
                    }`}
                  >
                    <span className={`font-medium ${isToday(dateStr) ? 'text-emerald-700' : 'text-gray-900'}`}>
                      {JOURS_COMPLET[i]} {dateStr.split('-')[2]}
                    </span>
                    {jour.absent && (
                      <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                        {jour.type_absence || 'Absent'}
                      </span>
                    )}
                    {!jour.absent && (
                      <span className="text-xs text-gray-500">{jour.rdv.length} RDV</span>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    {jour.rdv.map((rdv) => (
                      <RdvCard key={rdv.id} rdv={rdv} />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Si aucun jour n'a de RDV */}
            {weekDays.every((d) => {
              const j = data?.planning?.[d];
              return !j || (j.rdv.length === 0 && !j.absent);
            }) && (
              <div className="text-center py-12 text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucun rendez-vous cette semaine</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RdvCard({ rdv, compact }: { rdv: PlanningRdv; compact?: boolean }) {
  const statusColor = rdv.statut === 'confirme' ? 'bg-emerald-500' : rdv.statut === 'en_attente' ? 'bg-amber-500' : 'bg-gray-400';

  if (compact) {
    return (
      <div className="bg-gray-50 rounded-lg p-2 text-xs">
        <div className="flex items-center gap-1 mb-0.5">
          <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
          <span className="font-medium text-gray-900">{rdv.heure}</span>
        </div>
        <p className="text-gray-600 truncate">{rdv.service_nom}</p>
        <p className="text-gray-400 truncate">{rdv.client_nom}</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
      <div className={`w-1 h-full min-h-[40px] rounded-full ${statusColor} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{rdv.heure}</span>
          <span className="text-xs text-gray-400">{rdv.duree_minutes}min</span>
        </div>
        <p className="text-sm text-gray-700 font-medium truncate">{rdv.service_nom}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <User className="w-3 h-3" />
          <span className="truncate">{rdv.client_nom}</span>
          {rdv.client_telephone && (
            <a href={`tel:${rdv.client_telephone}`} className="flex items-center gap-1 text-emerald-600">
              <Phone className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
