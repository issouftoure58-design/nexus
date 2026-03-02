/**
 * Agenda - Gestion des RDV business de l'entrepreneur
 * Calendrier personnel pour meetings, rappels, tâches
 */

import { useState, useEffect } from 'react';
import {
  Calendar, Plus, ChevronLeft, ChevronRight, Clock, User,
  X, Edit, Trash2, Check, Bell, MapPin, Video, Phone,
  MoreHorizontal, RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Types
interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time?: string;
  type: 'meeting' | 'call' | 'task' | 'reminder';
  location?: string;
  attendees?: string;
  completed?: boolean;
  color?: string;
}

const EVENT_TYPES = {
  meeting: { label: 'Réunion', icon: User, color: 'bg-blue-500' },
  call: { label: 'Appel', icon: Phone, color: 'bg-green-500' },
  task: { label: 'Tâche', icon: Check, color: 'bg-purple-500' },
  reminder: { label: 'Rappel', icon: Bell, color: 'bg-amber-500' },
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8h à 19h

// Helper pour obtenir les headers avec tenant_id
const getAuthHeaders = () => {
  const token = localStorage.getItem('nexus_admin_token');
  let tenantId = '';
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tenantId = payload.tenant_id?.toString() || '';
    } catch (e) { /* ignore */ }
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId
  };
};

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Helper pour obtenir la date locale au format YYYY-MM-DD (évite le bug timezone UTC)
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const startOfWeek = getStartOfWeek(currentDate);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      const response = await fetch(
        `/api/agenda/events?start=${formatLocalDate(startOfWeek)}&end=${formatLocalDate(endOfWeek)}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data.data || []);
      }
    } catch (err) {
      console.error('Fetch events error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getWeekDays = () => {
    const start = getStartOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = formatLocalDate(date);
    return events.filter(e => e.date === dateStr);
  };

  const handleAddEvent = (date?: string) => {
    setSelectedEvent(null);
    setSelectedDate(date || formatLocalDate(new Date()));
    setShowModal(true);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setSelectedDate(event.date);
    setShowModal(true);
  };

  const handleSaveEvent = async (eventData: Partial<Event>) => {
    try {
      const method = selectedEvent ? 'PUT' : 'POST';
      const url = selectedEvent
        ? `/api/agenda/events/${selectedEvent.id}`
        : '/api/agenda/events';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(eventData)
      });

      const data = await response.json();

      if (response.ok) {
        setShowModal(false);
        fetchEvents();
      } else {
        alert(`Erreur: ${data.error || 'Impossible de créer l\'événement'}`);
      }
    } catch (err) {
      console.error('Save event error:', err);
      alert('Erreur de connexion au serveur');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Supprimer cet événement ?')) return;

    try {
      await fetch(`/api/agenda/events/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      fetchEvents();
    } catch (err) {
      console.error('Delete event error:', err);
    }
  };

  const weekDays = getWeekDays();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agenda</h1>
          <p className="text-gray-600 dark:text-gray-400">Gérez vos rendez-vous business</p>
        </div>
        <Button onClick={() => handleAddEvent()}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau RDV
        </Button>
      </div>

      {/* Navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Aujourd'hui
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateWeek(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="ml-4 text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {formatMonthYear(currentDate)}
            </span>
          </div>
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as const).map((v) => (
              <Button
                key={v}
                variant={view === v ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView(v)}
              >
                {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Calendar Grid - Week View */}
      {view === 'week' && (
        <Card className="overflow-hidden">
          {/* Days Header */}
          <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
            <div className="p-3 text-center text-xs text-gray-500 border-r border-gray-200 dark:border-gray-700">
              {/* Empty corner */}
            </div>
            {weekDays.map((day, i) => (
              <div
                key={i}
                className={`p-3 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                  isToday(day) ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''
                }`}
              >
                <div className={`text-xs uppercase ${isToday(day) ? 'text-cyan-600 font-semibold' : 'text-gray-500'}`}>
                  {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-semibold ${isToday(day) ? 'text-cyan-600' : 'text-gray-900 dark:text-white'}`}>
                  {day.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="max-h-[600px] overflow-y-auto">
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-100 dark:border-gray-800">
                <div className="p-2 text-xs text-gray-400 text-right pr-3 border-r border-gray-200 dark:border-gray-700">
                  {hour}:00
                </div>
                {weekDays.map((day, i) => {
                  const dateStr = formatLocalDate(day);
                  const dayEvents = events.filter(
                    e => e.date === dateStr && parseInt(e.start_time?.split(':')[0] || '0') === hour
                  );

                  return (
                    <div
                      key={i}
                      className={`p-1 min-h-[60px] border-r border-gray-100 dark:border-gray-800 last:border-r-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer ${
                        isToday(day) ? 'bg-cyan-50/50 dark:bg-cyan-900/10' : ''
                      }`}
                      onClick={() => handleAddEvent(dateStr)}
                    >
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEvent(event);
                          }}
                          className={`p-1 rounded text-xs text-white mb-1 cursor-pointer hover:opacity-80 ${
                            EVENT_TYPES[event.type]?.color || 'bg-gray-500'
                          }`}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="text-white/80">{event.start_time}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Simple Day/Month views placeholder */}
      {view === 'day' && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">
            {currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div className="space-y-2">
            {getEventsForDate(currentDate).length > 0 ? (
              getEventsForDate(currentDate).map((event) => (
                <EventCard key={event.id} event={event} onEdit={handleEditEvent} onDelete={handleDeleteEvent} />
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">Aucun événement ce jour</p>
            )}
          </div>
        </Card>
      )}

      {view === 'month' && (
        <Card className="p-6">
          <div className="grid grid-cols-7 gap-1">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-semibold text-gray-500">
                {d}
              </div>
            ))}
            {Array.from({ length: 35 }, (_, i) => {
              const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
              const startOffset = (firstDay.getDay() + 6) % 7;
              const day = new Date(firstDay);
              day.setDate(1 - startOffset + i);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const dayEvents = getEventsForDate(day);

              return (
                <div
                  key={i}
                  onClick={() => handleAddEvent(formatLocalDate(day))}
                  className={`p-2 min-h-[80px] border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    isCurrentMonth ? '' : 'opacity-40'
                  } ${isToday(day) ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' : 'border-gray-100 dark:border-gray-800'}`}
                >
                  <div className={`text-sm font-medium ${isToday(day) ? 'text-cyan-600' : ''}`}>
                    {day.getDate()}
                  </div>
                  {dayEvents.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className={`text-xs truncate rounded px-1 text-white mt-1 ${EVENT_TYPES[e.type]?.color || 'bg-gray-500'}`}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-400 mt-1">+{dayEvents.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Event Modal */}
      {showModal && (
        <EventModal
          event={selectedEvent}
          date={selectedDate}
          onClose={() => setShowModal(false)}
          onSave={handleSaveEvent}
          onDelete={selectedEvent ? () => handleDeleteEvent(selectedEvent.id) : undefined}
        />
      )}
    </div>
  );
}

// Event Card Component
function EventCard({
  event,
  onEdit,
  onDelete
}: {
  event: Event;
  onEdit: (e: Event) => void;
  onDelete: (id: string) => void;
}) {
  const type = EVENT_TYPES[event.type];
  const Icon = type?.icon || Calendar;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
      <div className={`p-2 rounded-lg ${type?.color || 'bg-gray-500'}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-gray-900 dark:text-white">{event.title}</div>
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          {event.start_time}
          {event.end_time && ` - ${event.end_time}`}
          {event.location && (
            <>
              <MapPin className="w-3 h-3 ml-2" />
              {event.location}
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => onEdit(event)}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(event.id)}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

// Event Modal Component
function EventModal({
  event,
  date,
  onClose,
  onSave,
  onDelete
}: {
  event: Event | null;
  date: string | null;
  onClose: () => void;
  onSave: (data: Partial<Event>) => void;
  onDelete?: () => void;
}) {
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    date: event?.date || date || new Date().toISOString().split('T')[0],
    start_time: event?.start_time || '09:00',
    end_time: event?.end_time || '10:00',
    type: event?.type || 'meeting' as Event['type'],
    location: event?.location || '',
    attendees: event?.attendees || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            {event ? 'Modifier' : 'Nouveau'} rendez-vous
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Titre *</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Réunion client"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(EVENT_TYPES) as Event['type'][]).map((t) => {
                const type = EVENT_TYPES[t];
                const Icon = type.icon;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t })}
                    className={`p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                      formData.type === t
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${formData.type === t ? 'text-cyan-600' : 'text-gray-500'}`} />
                    <span className="text-xs">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">Début</label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fin</label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Lieu</label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Bureau, Visio, Téléphone..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Participants</label>
            <Input
              value={formData.attendees}
              onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
              placeholder="Ex: Jean Dupont, Marie Martin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              rows={3}
              placeholder="Notes ou ordre du jour..."
            />
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            {onDelete && (
              <Button type="button" variant="outline" onClick={onDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit">
                {event ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
