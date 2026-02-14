/**
 * Reservations - Page des réservations avec tabs horizontaux
 * Design inspiré GitHub
 */

import { useState } from 'react';
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, User, Phone, CheckCircle, XCircle, AlertCircle, Filter, MoreHorizontal } from 'lucide-react';
import { ServiceLayout } from '../components/layout/ServiceLayout';

// Tabs de navigation
const tabs = [
  { label: 'Planning', path: '/reservations' },
  { label: 'Historique', path: '/reservations/historique' },
  { label: 'Paramètres', path: '/reservations/parametres' },
];

// Mock data
const mockReservations = [
  {
    id: 1,
    heure: '09:00',
    duree: 45,
    service: 'Coupe + Brushing',
    client: { nom: 'Marie', prenom: 'Dupont', telephone: '06 12 34 56 78' },
    statut: 'confirme',
    prix: 4500,
  },
  {
    id: 2,
    heure: '10:00',
    duree: 30,
    service: 'Coupe homme',
    client: { nom: 'Jean', prenom: 'Martin', telephone: '06 98 76 54 32' },
    statut: 'en_attente',
    prix: 2500,
  },
  {
    id: 3,
    heure: '11:30',
    duree: 120,
    service: 'Coloration + Mèches',
    client: { nom: 'Sophie', prenom: 'Bernard', telephone: '06 11 22 33 44' },
    statut: 'confirme',
    prix: 12000,
  },
  {
    id: 4,
    heure: '14:00',
    duree: 60,
    service: 'Brushing',
    client: { nom: 'Léa', prenom: 'Petit', telephone: '06 55 66 77 88' },
    statut: 'demande',
    prix: 3500,
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  demande: { label: 'Demande', color: 'text-gray-700 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  en_attente: { label: 'En attente', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  confirme: { label: 'Confirmé', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  termine: { label: 'Terminé', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  annule: { label: 'Annulé', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

export default function Reservations() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState('');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
  };

  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const filteredReservations = selectedStatus
    ? mockReservations.filter(r => r.statut === selectedStatus)
    : mockReservations;

  // Group by hour
  const groupedByHour = filteredReservations.reduce((acc, rdv) => {
    const hour = rdv.heure.split(':')[0];
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(rdv);
    return acc;
  }, {} as Record<string, typeof mockReservations>);

  return (
    <ServiceLayout
      title="Réservations"
      icon={Calendar}
      tabs={tabs}
      actions={
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Nouveau RDV
        </button>
      }
    >
      <div className="space-y-6">
        {/* Date Navigation + Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={goToNextDay}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              Aujourd'hui
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400 capitalize ml-2">
              {formatDate(selectedDate)}
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Tous les statuts</option>
              <option value="demande">Demandes</option>
              <option value="confirme">Confirmés</option>
              <option value="en_attente">En attente</option>
              <option value="termine">Terminés</option>
              <option value="annule">Annulés</option>
            </select>
            <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
              <Filter className="w-4 h-4" />
              Plus de filtres
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = mockReservations.filter(r => r.statut === status).length;
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(selectedStatus === status ? '' : status)}
                className={`p-3 rounded-lg border transition-all text-left ${
                  selectedStatus === status
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Planning Timeline */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Planning du jour
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filteredReservations.length} rendez-vous
            </span>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {Object.keys(groupedByHour).length > 0 ? (
              Object.entries(groupedByHour)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([hour, reservations]) => (
                  <div key={hour} className="flex">
                    {/* Time column */}
                    <div className="w-20 flex-shrink-0 py-4 px-4 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-800">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">{hour}:00</span>
                    </div>

                    {/* Reservations column */}
                    <div className="flex-1 p-4 space-y-3">
                      {reservations.map((rdv) => {
                        const statusConfig = STATUS_CONFIG[rdv.statut];
                        return (
                          <div
                            key={rdv.id}
                            className={`p-4 rounded-lg border-l-4 bg-gray-50 dark:bg-gray-800/50 ${
                              rdv.statut === 'confirme' ? 'border-l-blue-500' :
                              rdv.statut === 'termine' ? 'border-l-green-500' :
                              rdv.statut === 'annule' ? 'border-l-red-500' :
                              rdv.statut === 'en_attente' ? 'border-l-amber-500' :
                              'border-l-gray-400'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                                    {statusConfig.label}
                                  </span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {rdv.heure} - {rdv.duree} min
                                  </span>
                                </div>
                                <h4 className="font-medium text-gray-900 dark:text-white">{rdv.service}</h4>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {rdv.client.prenom} {rdv.client.nom}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {rdv.client.telephone}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(rdv.prix)}
                                </span>

                                {/* Quick actions */}
                                <div className="flex gap-1">
                                  {rdv.statut === 'demande' && (
                                    <button className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                                      Confirmer
                                    </button>
                                  )}
                                  {rdv.statut === 'confirme' && (
                                    <button className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                                      Terminer
                                    </button>
                                  )}
                                  {['demande', 'confirme', 'en_attente'].includes(rdv.statut) && (
                                    <button className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                                      Annuler
                                    </button>
                                  )}
                                  <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Aucune réservation pour cette date</p>
                <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                  <Plus className="w-4 h-4" />
                  Ajouter un rendez-vous
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ServiceLayout>
  );
}
