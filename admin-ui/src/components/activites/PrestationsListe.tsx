/**
 * PrestationsListe - Liste des prestations (planning et historique)
 * Inclut stats, filtres, tableau desktop, vue mobile, pagination
 */

import {
  Calendar, Plus, ChevronLeft, ChevronRight, Clock, User,
  Filter, RefreshCw, Edit, Trash2, Download, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EntityLink } from '@/components/EntityLink';
import type { Reservation, ReservationService, ReservationMembre, Filters, Stats } from './types';
import { STATUS_CONFIG, formatDate, formatCurrency, DEFAULT_FILTERS } from './types';

interface PrestationsListeProps {
  reservations: Reservation[];
  filters: Filters;
  stats: Stats;
  page: number;
  totalPages: number;
  loading: boolean;
  currentTab: string;
  onFiltersChange: (filters: Filters) => void;
  onPageChange: (page: number) => void;
  onOpenDetail: (rdv: Reservation) => void;
  onOpenEdit: (rdv: Reservation) => void;
  onDelete: (rdvId: number) => void;
  onChangeStatut: (rdvId: number, statut: string) => void;
  onExportCSV: () => void;
  onOpenNew: () => void;
}

export default function PrestationsListe({
  reservations,
  filters,
  stats,
  page,
  totalPages,
  loading,
  currentTab,
  onFiltersChange,
  onPageChange,
  onOpenDetail,
  onOpenEdit,
  onDelete,
  onChangeStatut,
  onExportCSV,
  onOpenNew,
}: PrestationsListeProps) {
  const resetFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
    onPageChange(1);
  };

  return (
    <div className="space-y-6">
      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">Aujourd'hui</p>
          <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stats.aujourd_hui}</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">Cette semaine</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.semaine}</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">En attente</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.en_attente}</p>
        </div>
      </div>

      {/* En-tête selon l'onglet */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {currentTab === 'historique' ? 'Historique des prestations' : 'Prestations à venir'}
        </h2>
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />

          {/* Période - seulement pour le planning */}
          {currentTab !== 'historique' && (
            <select
              value={filters.periode}
              onChange={(e) => { onFiltersChange({ ...filters, periode: e.target.value }); onPageChange(1); }}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="tous">Toutes les prestations</option>
              <option value="aujourd_hui">Aujourd'hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois">Ce mois</option>
              <option value="personnalise">Personnalisé</option>
            </select>
          )}

          {/* Statut */}
          <select
            value={filters.statut}
            onChange={(e) => { onFiltersChange({ ...filters, statut: e.target.value }); onPageChange(1); }}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="tous">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="confirme">Confirmé</option>
            <option value="termine">Terminé</option>
            <option value="annule">Annulé</option>
          </select>

          {/* Service */}
          <Input
            type="text"
            placeholder="Filtrer par service..."
            value={filters.service}
            onChange={(e) => { onFiltersChange({ ...filters, service: e.target.value }); onPageChange(1); }}
            className="w-48"
          />

          <Button onClick={resetFilters} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>

          <Button onClick={onExportCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>

        {/* Dates personnalisées - seulement pour le planning */}
        {currentTab !== 'historique' && filters.periode === 'personnalise' && (
          <div className="flex items-center gap-2 mt-3">
            <Input
              type="date"
              value={filters.date_debut}
              onChange={(e) => onFiltersChange({ ...filters, date_debut: e.target.value })}
              className="w-40"
            />
            <span className="text-gray-500">à</span>
            <Input
              type="date"
              value={filters.date_fin}
              onChange={(e) => onFiltersChange({ ...filters, date_fin: e.target.value })}
              className="w-40"
            />
          </div>
        )}
      </div>

      {/* Liste des réservations */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500">Chargement...</p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
          <Calendar className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500">Aucune prestation trouvée</p>
          <Button onClick={onOpenNew} variant="ghost" className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Créer une prestation
          </Button>
        </div>
      ) : (
        <>
          {/* Vue Desktop - Tableau */}
          <div className="hidden md:block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Heure</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {reservations.map((rdv) => {
                  const statusConfig = STATUS_CONFIG[rdv.statut] || STATUS_CONFIG.demande;
                  return (
                    <tr
                      key={rdv.id}
                      onClick={() => onOpenDetail(rdv)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(rdv.date || '')}</div>
                            <div className="text-sm text-gray-500">{rdv.heure || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {rdv.client ? (() => {
                          const isPro = rdv.client.type_client === 'professionnel' || !!rdv.client.raison_sociale;
                          const displayName = isPro && rdv.client.raison_sociale
                            ? rdv.client.raison_sociale
                            : `${rdv.client.prenom} ${rdv.client.nom}`;
                          return (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <EntityLink
                                    type="client"
                                    entity={{
                                      id: rdv.client.id,
                                      nom: rdv.client.nom,
                                      prenom: rdv.client.prenom,
                                      telephone: rdv.client.telephone,
                                      email: rdv.client.email || undefined
                                    }}
                                    label={displayName}
                                    className="text-sm font-medium"
                                  />
                                  {isPro && (
                                    <span className="px-1 py-0.5 text-[9px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                                  )}
                                </div>
                                {isPro && rdv.client.raison_sociale && (
                                  <div className="text-xs text-gray-400">{rdv.client.prenom} {rdv.client.nom}</div>
                                )}
                                <div className="text-sm text-gray-500">{rdv.client.telephone}</div>
                              </div>
                            </div>
                          );
                        })() : (
                          <span className="text-sm text-gray-400">Client inconnu</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {rdv.services && rdv.services.length > 0 ? (
                          <div className="space-y-1">
                            {rdv.services.map((s: ReservationService, idx: number) => (
                              <div key={s.id || idx}>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {s.service_nom}
                                  </span>
                                  {s.quantite > 1 && <span className="text-xs text-gray-500">x{s.quantite}</span>}
                                </div>
                                {s.membre && (
                                  <span className="text-xs text-cyan-600">
                                    &rarr; {s.membre.prenom} {s.membre.nom}
                                  </span>
                                )}
                              </div>
                            ))}
                            <div className="text-xs text-gray-500 pt-1">{rdv.duree_totale || rdv.duree || 60} min</div>
                          </div>
                        ) : (
                          <>
                            {rdv.service_id ? (
                              <EntityLink
                                type="service"
                                entity={{
                                  id: rdv.service_id,
                                  nom: rdv.service_nom || '',
                                  prix: (rdv.prix || 0) * 100,
                                  duree: rdv.duree || 60
                                }}
                                label={rdv.service_nom || ''}
                                className="text-sm"
                              />
                            ) : (
                              <span className="text-sm">{rdv.service_nom || '-'}</span>
                            )}
                            {rdv.duree && <div className="text-xs text-gray-500">{rdv.duree} min</div>}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {rdv.membres && rdv.membres.length > 0 ? (
                          <div className="space-y-1">
                            {rdv.membres.map((m: ReservationMembre, idx: number) => (
                              <div key={m.id || idx} className="flex items-center gap-1">
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {m.prenom} {m.nom}
                                </span>
                                {m.assignment_role === 'principal' && (
                                  <span className="text-xs text-cyan-600">●</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : rdv.membre ? (
                          <EntityLink
                            type="employee"
                            entity={{
                              id: rdv.membre.id,
                              nom: rdv.membre.nom,
                              prenom: rdv.membre.prenom,
                              role: rdv.membre.role
                            }}
                            label={`${rdv.membre.prenom} ${rdv.membre.nom}`}
                            className="text-sm"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">Non assigné</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(rdv.prix || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenEdit(rdv)}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(rdv.id)}
                            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 hover:text-red-700"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {rdv.statut !== 'annule' && (
                            <select
                              value={rdv.statut}
                              onChange={(e) => onChangeStatut(rdv.id, e.target.value)}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none"
                            >
                              <option value="en_attente">En attente</option>
                              <option value="confirme">Confirmé</option>
                              <option value="termine">Terminé</option>
                              <option value="annule">Annulé</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vue Mobile - Cartes */}
          <div className="md:hidden space-y-3">
            {reservations.map((rdv) => {
              const statusConfig = STATUS_CONFIG[rdv.statut] || STATUS_CONFIG.demande;
              return (
                <div
                  key={rdv.id}
                  onClick={() => onOpenDetail(rdv)}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 cursor-pointer hover:border-cyan-500"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-600" />
                      <span className="font-medium text-gray-900 dark:text-white">{formatDate(rdv.date || '')}</span>
                      <span className="text-gray-500">à {rdv.heure}</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      {rdv.client ? (() => {
                        const isPro = rdv.client.type_client === 'professionnel' || !!rdv.client.raison_sociale;
                        const displayName = isPro && rdv.client.raison_sociale
                          ? rdv.client.raison_sociale
                          : `${rdv.client.prenom} ${rdv.client.nom}`;
                        return (
                          <div className="flex items-center gap-1.5">
                            <EntityLink
                              type="client"
                              entity={{
                                id: rdv.client.id,
                                nom: rdv.client.nom,
                                prenom: rdv.client.prenom,
                                telephone: rdv.client.telephone,
                                email: rdv.client.email || undefined
                              }}
                              label={displayName}
                            />
                            {isPro && (
                              <span className="px-1 py-0.5 text-[9px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                            )}
                          </div>
                        );
                      })() : (
                        <span className="text-gray-400">Client inconnu</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      {rdv.service_id ? (
                        <EntityLink
                          type="service"
                          entity={{
                            id: rdv.service_id,
                            nom: rdv.service_nom || '',
                            prix: (rdv.prix || 0) * 100,
                            duree: rdv.duree || 60
                          }}
                          label={rdv.service_nom || ''}
                          className="text-sm text-gray-600 dark:text-gray-400"
                        />
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-gray-400">{rdv.service_nom || '-'}</span>
                      )}
                      <span className="font-medium text-green-600">{formatCurrency(rdv.prix || 0)}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => onOpenEdit(rdv)}>
                      <Edit className="w-3 h-3 mr-1" />
                      Modifier
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(rdv.id)}>
                      <Trash2 className="w-3 h-3 mr-1" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">Page {page} sur {totalPages}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Précédent
                </Button>
                <Button
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
