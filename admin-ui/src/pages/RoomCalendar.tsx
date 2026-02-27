/**
 * RoomCalendar - Calendrier d'occupation des chambres
 * Vue visuelle type hotel calendar / Gantt
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Bed,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  AlertCircle,
  Wrench,
  Lock,
  CheckCircle,
  Clock,
  Euro,
  Info,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Chambre {
  id: number;
  nom: string;
  type_chambre: string;
  capacite: number;
  prix: number;
  actif: boolean;
  occupation: Occupation[];
  reservations: Reservation[];
}

interface Occupation {
  id: number;
  service_id: number;
  date_occupation: string;
  statut: 'reservee' | 'occupee' | 'maintenance' | 'bloquee';
  client_nom?: string;
  nb_personnes?: number;
  reservation_id?: number;
}

interface Reservation {
  id: number;
  client_id: number;
  service_id: number;
  date_debut: string;
  date_fin: string;
  statut: string;
  nb_personnes: number;
  client: {
    prenom: string;
    nom: string;
    telephone: string;
  };
}

interface CalendarData {
  date_debut: string;
  date_fin: string;
  chambres: Chambre[];
}

// Helper pour générer les jours du mois
function getDaysInRange(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// Composant principal
export default function RoomCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // Dates du mois courant
  const dateRange = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    };
  }, [currentMonth]);

  // Fetch occupation data
  const { data: calendarData, isLoading, error } = useQuery<CalendarData>({
    queryKey: ['hotel-occupation', dateRange.start, dateRange.end],
    queryFn: () => api.get<CalendarData>(`/admin/hotel/occupation?date_debut=${dateRange.start}&date_fin=${dateRange.end}`)
  });

  // Fetch stats
  const { data: stats } = useQuery<{
    nb_chambres: number;
    occupees_aujourdhui: number;
    reservations_mois: number;
    tarifs_actifs: number;
    taux_occupation: number;
  }>({
    queryKey: ['hotel-stats'],
    queryFn: () => api.get('/admin/hotel/stats')
  });

  // Jours à afficher
  const days = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    return getDaysInRange(start, end);
  }, [dateRange]);

  // Navigation mois
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Obtenir le statut d'une cellule
  const getCellStatus = (chambre: Chambre, date: Date): {
    statut: string;
    reservation?: Reservation;
    occupation?: Occupation;
  } => {
    const dateStr = date.toISOString().slice(0, 10);

    // Vérifier l'occupation
    const occupation = chambre.occupation.find(o => o.date_occupation === dateStr);
    if (occupation) {
      return { statut: occupation.statut, occupation };
    }

    // Vérifier les réservations
    const reservation = chambre.reservations.find(r =>
      dateStr >= r.date_debut && dateStr < r.date_fin
    );
    if (reservation) {
      return { statut: 'reservee', reservation };
    }

    return { statut: 'libre' };
  };

  // Style de la cellule selon statut
  const getCellStyle = (statut: string, isFirstOfReservation: boolean, isLastOfReservation: boolean) => {
    const baseStyle = 'h-8 border-r border-b border-gray-100 transition-colors cursor-pointer';

    const statusStyles: Record<string, string> = {
      libre: 'bg-green-50 hover:bg-green-100',
      reservee: 'bg-blue-400 text-white',
      occupee: 'bg-orange-400 text-white',
      maintenance: 'bg-yellow-200',
      bloquee: 'bg-gray-300'
    };

    let roundedStyle = '';
    if (isFirstOfReservation) roundedStyle += ' rounded-l';
    if (isLastOfReservation) roundedStyle += ' rounded-r';

    return cn(baseStyle, statusStyles[statut] || 'bg-gray-50', roundedStyle);
  };

  // Icône selon statut
  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case 'reservee': return <Clock className="w-3 h-3" />;
      case 'occupee': return <Users className="w-3 h-3" />;
      case 'maintenance': return <Wrench className="w-3 h-3" />;
      case 'bloquee': return <Lock className="w-3 h-3" />;
      default: return null;
    }
  };

  // Formater le mois
  const monthLabel = currentMonth.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="text-gray-600">Erreur de chargement du calendrier</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-cyan-600" />
            Calendrier des Chambres
          </h1>
          <p className="text-gray-500 mt-1">
            Vue d'occupation et disponibilités
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            icon={Bed}
            label="Chambres"
            value={stats.nb_chambres}
            color="blue"
          />
          <StatCard
            icon={CheckCircle}
            label="Occupées"
            value={stats.occupees_aujourdhui}
            color="orange"
          />
          <StatCard
            icon={Calendar}
            label="Résa ce mois"
            value={stats.reservations_mois}
            color="green"
          />
          <StatCard
            icon={Euro}
            label="Tarifs actifs"
            value={stats.tarifs_actifs}
            color="purple"
          />
          <StatCard
            icon={Users}
            label="Taux occup."
            value={`${stats.taux_occupation}%`}
            color="cyan"
          />
        </div>
      )}

      {/* Navigation du mois */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold capitalize min-w-[180px] text-center">
              {monthLabel}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Aujourd'hui
            </button>

            {/* Légende */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-50 border border-green-200"></span>
                Libre
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-400"></span>
                Réservée
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-orange-400"></span>
                Occupée
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-300"></span>
                Maintenance
              </span>
            </div>
          </div>
        </div>

        {/* Calendrier Grid */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="text-left p-2 bg-gray-50 border-b border-r border-gray-200 sticky left-0 z-10 min-w-[150px]">
                    Chambre
                  </th>
                  {days.map((day, index) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <th
                        key={index}
                        className={cn(
                          'text-center p-1 border-b border-r border-gray-200 text-xs min-w-[30px]',
                          isToday && 'bg-cyan-100',
                          isWeekend && !isToday && 'bg-gray-100'
                        )}
                      >
                        <div className={cn(
                          'font-normal text-gray-500',
                          isToday && 'text-cyan-700'
                        )}>
                          {day.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2)}
                        </div>
                        <div className={cn(
                          'font-semibold',
                          isToday && 'text-cyan-700'
                        )}>
                          {day.getDate()}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {calendarData?.chambres.map((chambre) => (
                  <tr key={chambre.id}>
                    <td className="p-2 border-b border-r border-gray-200 bg-white sticky left-0 z-10">
                      <div className="flex items-center gap-2">
                        <Bed className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-sm">{chambre.nom}</div>
                          <div className="text-xs text-gray-500">
                            {chambre.type_chambre} · {chambre.capacite} pers
                          </div>
                        </div>
                      </div>
                    </td>
                    {days.map((day, index) => {
                      const { statut, reservation, occupation } = getCellStatus(chambre, day);
                      const dateStr = day.toISOString().slice(0, 10);

                      // Déterminer si c'est le début/fin d'une réservation
                      const isFirstOfReservation = reservation && reservation.date_debut === dateStr;
                      const prevDate = new Date(day);
                      prevDate.setDate(prevDate.getDate() - 1);
                      const nextDate = new Date(day);
                      nextDate.setDate(nextDate.getDate() + 1);
                      const nextDateStr = nextDate.toISOString().slice(0, 10);
                      const isLastOfReservation = reservation && (
                        nextDateStr >= reservation.date_fin ||
                        index === days.length - 1
                      );

                      return (
                        <td
                          key={index}
                          className={getCellStyle(statut, !!isFirstOfReservation, !!isLastOfReservation)}
                          onClick={() => {
                            if (reservation) {
                              setSelectedReservation(reservation);
                            }
                          }}
                          title={
                            reservation
                              ? `${reservation.client.prenom} ${reservation.client.nom}`
                              : occupation?.client_nom || statut
                          }
                        >
                          <div className="flex items-center justify-center h-full">
                            {isFirstOfReservation && reservation && (
                              <span className="text-[10px] truncate px-1">
                                {reservation.client.prenom?.slice(0, 1)}.{reservation.client.nom?.slice(0, 3)}
                              </span>
                            )}
                            {!reservation && getStatusIcon(statut)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {(!calendarData?.chambres || calendarData.chambres.length === 0) && (
                  <tr>
                    <td colSpan={days.length + 1} className="p-8 text-center text-gray-500">
                      <Bed className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Aucune chambre configurée</p>
                      <p className="text-sm">Ajoutez des services avec un type de chambre</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal détail réservation */}
      {selectedReservation && (
        <ReservationModal
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}
    </div>
  );
}

// Composant StatCard
function StatCard({
  icon: Icon,
  label,
  value,
  color
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'cyan';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600'
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-2', colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

// Modal détail réservation
function ReservationModal({
  reservation,
  onClose
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const nbNuits = Math.ceil(
    (new Date(reservation.date_fin).getTime() - new Date(reservation.date_debut).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Détails de la réservation</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Client */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
              {reservation.client.prenom?.[0]}{reservation.client.nom?.[0]}
            </div>
            <div>
              <div className="font-medium">
                {reservation.client.prenom} {reservation.client.nom}
              </div>
              <div className="text-sm text-gray-500">{reservation.client.telephone}</div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Arrivée</div>
              <div className="font-medium">
                {new Date(reservation.date_debut).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                })}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Départ</div>
              <div className="font-medium">
                {new Date(reservation.date_fin).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                })}
              </div>
            </div>
          </div>

          {/* Infos */}
          <div className="flex items-center justify-between py-2 border-t border-b">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{nbNuits} nuit{nbNuits > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-4 h-4" />
              <span>{reservation.nb_personnes || 1} personne{(reservation.nb_personnes || 1) > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Statut */}
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              reservation.statut === 'confirmee' && 'bg-green-100 text-green-700',
              reservation.statut === 'en_cours' && 'bg-orange-100 text-orange-700'
            )}>
              {reservation.statut === 'confirmee' ? 'Confirmée' : 'En cours'}
            </span>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export { RoomCalendar };
