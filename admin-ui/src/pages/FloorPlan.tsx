import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Users, Sun, Moon, RefreshCw, Eye, EyeOff,
  Maximize2, Grid3X3, List, Clock, CheckCircle, XCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Table {
  id: number;
  nom: string;
  capacite: number;
  zone: string;
  service_dispo: string;
  actif: boolean;
}

interface Reservation {
  id: number;
  service_id: number;
  client_nom: string;
  date: string;
  heure: string;
  nb_personnes: number;
  statut: string;
}

type ViewMode = 'grid' | 'list';
type ServiceFilter = 'all' | 'midi' | 'soir';

// Couleurs par zone
const ZONE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  interieur: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
  terrasse: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' },
  prive: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700' },
  bar: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700' },
};

// Statut couleurs
const STATUS_CONFIG = {
  libre: { color: 'bg-green-500', label: 'Libre', icon: CheckCircle },
  reservee: { color: 'bg-blue-500', label: 'Réservée', icon: Clock },
  occupee: { color: 'bg-orange-500', label: 'Occupée', icon: Users },
  indisponible: { color: 'bg-gray-400', label: 'Indisponible', icon: XCircle },
};

export default function FloorPlanPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Récupérer les tables (services de type restaurant)
  const { data: tablesData, isLoading: loadingTables, refetch } = useQuery<{ services: Table[] }>({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await fetch('/api/admin/services', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) throw new Error('Erreur');
      return res.json();
    }
  });

  // Récupérer les réservations du jour
  const today = new Date().toISOString().split('T')[0];
  const { data: reservationsData, isLoading: loadingReservations } = useQuery<{ reservations: Reservation[] }>({
    queryKey: ['reservations-today', today],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reservations?date=${today}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) throw new Error('Erreur');
      return res.json();
    }
  });

  // Déterminer le service actuel (midi ou soir)
  const currentHour = new Date().getHours();
  const currentService: 'midi' | 'soir' = currentHour < 15 ? 'midi' : 'soir';

  // Mapper les réservations par table
  const reservationsByTable = useMemo(() => {
    const map: Record<number, Reservation[]> = {};
    (reservationsData?.reservations || []).forEach(r => {
      if (!map[r.service_id]) map[r.service_id] = [];
      map[r.service_id].push(r);
    });
    return map;
  }, [reservationsData]);

  // Déterminer le statut d'une table
  const getTableStatus = (table: Table): keyof typeof STATUS_CONFIG => {
    if (!table.actif) return 'indisponible';

    const tableReservations = reservationsByTable[table.id] || [];
    const now = new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Vérifier les réservations en cours
    const activeReservation = tableReservations.find(r => {
      if (r.statut === 'annule') return false;
      if (r.date !== today) return false;

      // Simple check: si l'heure de réservation est proche de maintenant
      const resvHour = parseInt(r.heure.split(':')[0]);
      if (Math.abs(resvHour - currentHour) <= 2) {
        if (r.statut === 'en_cours' || r.statut === 'termine') return false;
        return true;
      }
      return false;
    });

    if (activeReservation) {
      if (activeReservation.statut === 'en_cours') return 'occupee';
      return 'reservee';
    }

    // Vérifier s'il y a des réservations à venir
    const upcomingReservation = tableReservations.find(r => {
      if (r.statut === 'annule') return false;
      if (r.date !== today) return false;
      return r.heure > currentTimeStr;
    });

    if (upcomingReservation) return 'reservee';

    return 'libre';
  };

  // Filtrer les tables
  const filteredTables = useMemo(() => {
    if (!tablesData?.services) return [];

    return tablesData.services.filter(table => {
      // Filtre actif/inactif
      if (!showInactive && !table.actif) return false;

      // Filtre zone
      if (zoneFilter !== 'all' && table.zone !== zoneFilter) return false;

      // Filtre service (midi/soir)
      if (serviceFilter !== 'all') {
        const dispo = table.service_dispo || 'midi_soir';
        if (serviceFilter === 'midi' && dispo === 'soir') return false;
        if (serviceFilter === 'soir' && dispo === 'midi') return false;
      }

      return true;
    });
  }, [tablesData?.services, showInactive, zoneFilter, serviceFilter]);

  // Grouper par zone
  const tablesByZone = useMemo(() => {
    const groups: Record<string, Table[]> = {};
    filteredTables.forEach(table => {
      const zone = table.zone || 'interieur';
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(table);
    });
    return groups;
  }, [filteredTables]);

  // Compter les stats
  const stats = useMemo(() => {
    const result = { total: 0, libres: 0, reservees: 0, occupees: 0, capacite: 0 };
    filteredTables.forEach(table => {
      result.total++;
      result.capacite += table.capacite || 0;
      const status = getTableStatus(table);
      if (status === 'libre') result.libres++;
      else if (status === 'reservee') result.reservees++;
      else if (status === 'occupee') result.occupees++;
    });
    return result;
  }, [filteredTables, reservationsByTable]);

  // Zones uniques
  const zones = useMemo(() => {
    const set = new Set<string>();
    (tablesData?.services || []).forEach(t => set.add(t.zone || 'interieur'));
    return Array.from(set);
  }, [tablesData?.services]);

  const isLoading = loadingTables || loadingReservations;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Grid3X3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Plan de salle</h1>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' - Service '}
                <Badge variant="outline" className={currentService === 'midi' ? 'bg-yellow-50 text-yellow-700' : 'bg-indigo-50 text-indigo-700'}>
                  {currentService === 'midi' ? <Sun className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                  {currentService === 'midi' ? 'Midi' : 'Soir'}
                </Badge>
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{stats.total}</p>
            <p className="text-sm text-gray-500">Tables</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{stats.libres}</p>
            <p className="text-sm text-green-600">Libres</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.reservees}</p>
            <p className="text-sm text-blue-600">Réservées</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-700">{stats.occupees}</p>
            <p className="text-sm text-orange-600">Occupées</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Vue */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Service */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <Button
                size="sm"
                variant={serviceFilter === 'all' ? 'default' : 'ghost'}
                onClick={() => setServiceFilter('all')}
              >
                Tous
              </Button>
              <Button
                size="sm"
                variant={serviceFilter === 'midi' ? 'default' : 'ghost'}
                onClick={() => setServiceFilter('midi')}
                className="gap-1"
              >
                <Sun className="h-3 w-3" />
                Midi
              </Button>
              <Button
                size="sm"
                variant={serviceFilter === 'soir' ? 'default' : 'ghost'}
                onClick={() => setServiceFilter('soir')}
                className="gap-1"
              >
                <Moon className="h-3 w-3" />
                Soir
              </Button>
            </div>

            {/* Zone */}
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">Toutes zones</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>
                  {zone.charAt(0).toUpperCase() + zone.slice(1)}
                </option>
              ))}
            </select>

            {/* Afficher inactives */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInactive(!showInactive)}
              className={cn(showInactive && 'bg-gray-200')}
            >
              {showInactive ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
              {showInactive ? 'Masquer inactives' : 'Voir inactives'}
            </Button>

            {/* Légende */}
            <div className="flex gap-3 ml-auto text-sm">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className={cn('w-3 h-3 rounded-full', config.color)} />
                  <span className="text-gray-600">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenu principal */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : viewMode === 'grid' ? (
        /* Vue Grille par zone */
        <div className="space-y-8">
          {Object.entries(tablesByZone).map(([zone, tables]) => {
            const zoneStyle = ZONE_COLORS[zone] || ZONE_COLORS.interieur;
            return (
              <div key={zone}>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className={cn('h-5 w-5', zoneStyle.text)} />
                  <h2 className="text-lg font-semibold text-gray-800">
                    {zone.charAt(0).toUpperCase() + zone.slice(1)}
                  </h2>
                  <Badge variant="secondary">{tables.length} tables</Badge>
                </div>

                <div className={cn(
                  'p-6 rounded-xl border-2',
                  zoneStyle.bg,
                  zoneStyle.border
                )}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {tables.map(table => {
                      const status = getTableStatus(table);
                      const statusConfig = STATUS_CONFIG[status];
                      const tableReservations = reservationsByTable[table.id] || [];
                      const nextReservation = tableReservations.find(r => r.statut !== 'annule' && r.date === today);

                      return (
                        <div
                          key={table.id}
                          onClick={() => setSelectedTable(table)}
                          className={cn(
                            'relative bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-105',
                            'border-2',
                            status === 'libre' && 'border-green-300',
                            status === 'reservee' && 'border-blue-300',
                            status === 'occupee' && 'border-orange-300',
                            status === 'indisponible' && 'border-gray-300 opacity-50'
                          )}
                        >
                          {/* Indicateur de statut */}
                          <div className={cn(
                            'absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center',
                            statusConfig.color
                          )}>
                            <statusConfig.icon className="h-3 w-3 text-white" />
                          </div>

                          {/* Nom de la table */}
                          <p className="font-bold text-gray-900 text-center mb-2">
                            {table.nom}
                          </p>

                          {/* Capacité */}
                          <div className="flex items-center justify-center gap-1 text-gray-600 mb-2">
                            <Users className="h-4 w-4" />
                            <span className="text-sm">{table.capacite}</span>
                          </div>

                          {/* Prochaine réservation */}
                          {nextReservation && status !== 'indisponible' && (
                            <div className="text-xs text-center text-blue-600 bg-blue-50 rounded px-2 py-1">
                              {nextReservation.heure} - {nextReservation.client_nom?.split(' ')[0] || 'Client'}
                            </div>
                          )}

                          {/* Disponibilité service */}
                          <div className="flex justify-center gap-1 mt-2">
                            {(table.service_dispo === 'midi' || table.service_dispo === 'midi_soir') && (
                              <Sun className="h-3 w-3 text-yellow-500" />
                            )}
                            {(table.service_dispo === 'soir' || table.service_dispo === 'midi_soir') && (
                              <Moon className="h-3 w-3 text-indigo-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredTables.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Grid3X3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucune table trouvée</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Vue Liste */
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-700">Table</th>
                  <th className="text-left p-4 font-medium text-gray-700">Zone</th>
                  <th className="text-center p-4 font-medium text-gray-700">Capacité</th>
                  <th className="text-center p-4 font-medium text-gray-700">Service</th>
                  <th className="text-center p-4 font-medium text-gray-700">Statut</th>
                  <th className="text-left p-4 font-medium text-gray-700">Prochaine résa</th>
                </tr>
              </thead>
              <tbody>
                {filteredTables.map(table => {
                  const status = getTableStatus(table);
                  const statusConfig = STATUS_CONFIG[status];
                  const tableReservations = reservationsByTable[table.id] || [];
                  const nextReservation = tableReservations.find(r => r.statut !== 'annule' && r.date === today);
                  const zoneStyle = ZONE_COLORS[table.zone] || ZONE_COLORS.interieur;

                  return (
                    <tr
                      key={table.id}
                      className={cn(
                        'border-b hover:bg-gray-50 cursor-pointer',
                        !table.actif && 'opacity-50'
                      )}
                      onClick={() => setSelectedTable(table)}
                    >
                      <td className="p-4 font-medium">{table.nom}</td>
                      <td className="p-4">
                        <Badge variant="outline" className={cn(zoneStyle.bg, zoneStyle.text, zoneStyle.border)}>
                          {table.zone}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4 text-gray-400" />
                          {table.capacite}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-1">
                          {(table.service_dispo === 'midi' || table.service_dispo === 'midi_soir') && (
                            <Sun className="h-4 w-4 text-yellow-500" />
                          )}
                          {(table.service_dispo === 'soir' || table.service_dispo === 'midi_soir') && (
                            <Moon className="h-4 w-4 text-indigo-500" />
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={cn('gap-1', statusConfig.color, 'text-white')}>
                          <statusConfig.icon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {nextReservation ? (
                          <span className="text-sm">
                            {nextReservation.heure} - {nextReservation.client_nom || 'Client'} ({nextReservation.nb_personnes} pers.)
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Modal détail table */}
      {selectedTable && (
        <TableDetailModal
          table={selectedTable}
          reservations={reservationsByTable[selectedTable.id] || []}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}

// Modal de détail d'une table
function TableDetailModal({ table, reservations, onClose }: {
  table: Table;
  reservations: Reservation[];
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const todayReservations = reservations.filter(r => r.date === today && r.statut !== 'annule');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {table.nom.split(' ')[1] || table.nom.charAt(0)}
            </div>
            {table.nom}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Infos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Users className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold">{table.capacite}</p>
              <p className="text-xs text-gray-500">places</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <MapPin className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold capitalize">{table.zone}</p>
              <p className="text-xs text-gray-500">zone</p>
            </div>
          </div>

          {/* Disponibilité */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Disponibilité</p>
            <div className="flex gap-2">
              {(table.service_dispo === 'midi' || table.service_dispo === 'midi_soir') && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <Sun className="h-3 w-3 mr-1" />
                  Midi
                </Badge>
              )}
              {(table.service_dispo === 'soir' || table.service_dispo === 'midi_soir') && (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  <Moon className="h-3 w-3 mr-1" />
                  Soir
                </Badge>
              )}
            </div>
          </div>

          {/* Réservations du jour */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Réservations aujourd'hui ({todayReservations.length})
            </p>
            {todayReservations.length > 0 ? (
              <div className="space-y-2">
                {todayReservations.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{r.client_nom || 'Client'}</p>
                      <p className="text-xs text-gray-500">{r.nb_personnes} personnes</p>
                    </div>
                    <Badge variant="outline" className="bg-white">
                      <Clock className="h-3 w-3 mr-1" />
                      {r.heure}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Aucune réservation</p>
            )}
          </div>

          <Button variant="outline" onClick={onClose} className="w-full">
            Fermer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
