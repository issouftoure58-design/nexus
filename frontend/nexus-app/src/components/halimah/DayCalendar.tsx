import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, Loader2 } from 'lucide-react';
import { useChatBooking } from '@/contexts/ChatBookingContext';

export default function DayCalendar() {
  const {
    service,
    weekAvailability,
    weekStartDate,
    fetchWeekAvailability,
    selectDateTime,
    formatDuration,
    formatPrice,
  } = useChatBooking();

  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Calculer la date de debut (lundi de la semaine courante)
  const getWeekStart = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  // Charger les disponibilites au montage
  useEffect(() => {
    if (!weekAvailability) {
      loadAvailability(getWeekStart());
    }
  }, []);

  const loadAvailability = async (startDate: string) => {
    setLoading(true);
    await fetchWeekAvailability(startDate);
    setLoading(false);
  };

  // Filtrer les jours disponibles (pas passes, pas fermes)
  const availableDates = useMemo(() => {
    if (!weekAvailability) return [];
    return Object.keys(weekAvailability)
      .sort()
      .filter(date => {
        const day = weekAvailability[date];
        return !day.isPast && !day.closed && day.slots.length > 0;
      });
  }, [weekAvailability]);

  // Tous les jours de la semaine (pour navigation)
  const allDates = useMemo(() => {
    if (!weekAvailability) return [];
    return Object.keys(weekAvailability).sort();
  }, [weekAvailability]);

  const currentDate = allDates[currentDateIndex];
  const dayData = weekAvailability?.[currentDate];

  // Navigation
  const canGoPrev = currentDateIndex > 0;
  const canGoNext = currentDateIndex < allDates.length - 1;

  const goNext = () => {
    if (canGoNext) setCurrentDateIndex(i => i + 1);
  };

  const goPrev = () => {
    if (canGoPrev) setCurrentDateIndex(i => i - 1);
  };

  // Charger semaine suivante
  const loadNextWeek = async () => {
    if (!weekStartDate) return;
    const start = new Date(weekStartDate);
    start.setDate(start.getDate() + 7);
    const nextWeekStart = start.toISOString().split('T')[0];
    setCurrentDateIndex(0);
    await loadAvailability(nextWeekStart);
  };

  // Selection d'un creneau
  const handleSlotClick = (time: string) => {
    if (currentDate) {
      selectDateTime(currentDate, time);
    }
  };

  // Formater la date pour affichage
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="ml-2 text-zinc-500">Recherche des disponibilites...</span>
        </div>
      </div>
    );
  }

  if (!dayData) {
    return (
      <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
        <div className="text-center py-4 text-zinc-500">
          Aucune disponibilite trouvee
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header avec service */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-zinc-700">Choisissez votre creneau</span>
        </div>
        {service && (
          <div className="mt-1 text-sm text-zinc-500 flex items-center gap-3">
            <span>{service.nom}</span>
            <span className="text-amber-600 font-medium">{formatPrice(service.prix)}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(service.duree)}
            </span>
          </div>
        )}
      </div>

      {/* Navigation jour */}
      <div className="flex items-center justify-between px-2 py-3 border-b border-zinc-100">
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          className={`p-2 rounded-full transition-colors ${
            canGoPrev
              ? 'hover:bg-amber-100 text-zinc-600'
              : 'text-zinc-300 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center flex-1">
          <div className="font-semibold text-zinc-800 capitalize">
            {formatDateDisplay(currentDate)}
          </div>
        </div>

        <button
          onClick={goNext}
          disabled={!canGoNext}
          className={`p-2 rounded-full transition-colors ${
            canGoNext
              ? 'hover:bg-amber-100 text-zinc-600'
              : 'text-zinc-300 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Creneaux */}
      <div className="p-4">
        {dayData.isPast ? (
          <div className="text-center py-4 text-zinc-400">
            Cette date est passee
          </div>
        ) : dayData.closed ? (
          <div className="text-center py-4 text-zinc-400">
            Ferme ce jour
          </div>
        ) : dayData.slots.length === 0 ? (
          <div className="text-center py-4 text-zinc-400">
            Aucun creneau disponible
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {dayData.slots.map((slot) => (
              <button
                key={slot}
                onClick={() => handleSlotClick(slot)}
                className="py-2.5 px-3 text-sm font-medium rounded-lg border border-amber-200
                  bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300
                  transition-all active:scale-95"
              >
                {slot}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Indicateurs jours */}
      <div className="px-4 pb-3">
        <div className="flex justify-center gap-1">
          {allDates.map((date, index) => {
            const d = weekAvailability?.[date];
            const isAvailable = d && !d.isPast && !d.closed && d.slots.length > 0;
            const isCurrent = index === currentDateIndex;

            return (
              <button
                key={date}
                onClick={() => setCurrentDateIndex(index)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-amber-500 text-white'
                    : isAvailable
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-zinc-100 text-zinc-400'
                }`}
                title={formatShortDate(date)}
              >
                {new Date(date).getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Semaine suivante */}
      {currentDateIndex === allDates.length - 1 && (
        <div className="px-4 pb-4">
          <button
            onClick={loadNextWeek}
            className="w-full py-2 text-sm text-amber-600 hover:text-amber-700
              hover:bg-amber-50 rounded-lg transition-colors"
          >
            Voir la semaine suivante
          </button>
        </div>
      )}
    </div>
  );
}
