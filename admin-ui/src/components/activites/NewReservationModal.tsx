/**
 * NewReservationModal - Modal de création d'une nouvelle prestation
 * Supporte multi-services, multi-membres, modes de tarification,
 * et les types restaurant/hotel/salon/service_domicile
 */

import React from 'react';
import { X, User, Clock, MinusCircle, PlusCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FeatureField } from '@/components/forms';
import type {
  Client, Service, Membre, ServiceLigne, ServiceAffectation,
  NewRdvForm, NewClientForm, Totals,
} from './types';
import { calculateHours, calculateDays, calculateNights } from './types';
import { detectMajoration, majorationBadge } from '@/lib/majorations';

interface ProfileLike {
  id?: string;
  pricing?: { mode?: string };
  duration?: { allowMultiDay?: boolean; allowOvernight?: boolean };
}

interface NewReservationModalProps {
  newRdvForm: NewRdvForm;
  newClientForm: NewClientForm;
  services: Service[];
  membres: Membre[];
  clients: Client[];
  serviceLignes: ServiceLigne[];
  membreIds: number[];
  membresDisponibles: Membre[];
  membresOccupes: (Membre & { raison?: string })[];
  loadingDisponibilites: boolean;
  clientSearch: string;
  showClientDropdown: boolean;
  createNewClient: boolean;
  createLoading: boolean;
  createError: string;
  dropdownRef: React.RefObject<HTMLDivElement>;
  profile: ProfileLike | null;
  businessType: string;
  // Terminologie
  t: (key: string, plural?: boolean) => string;
  isPricingMode: (mode: string) => boolean;
  isBusinessType: (type: 'service_domicile' | 'salon' | 'restaurant' | 'hotel' | 'commerce' | 'security') => boolean;
  // Callbacks
  onNewRdvFormChange: (form: NewRdvForm) => void;
  onNewClientFormChange: (form: NewClientForm) => void;
  onClientSearch: (value: string) => void;
  onSelectClient: (client: Client) => void;
  onSetCreateNewClient: (value: boolean) => void;
  onSetShowClientDropdown: (value: boolean) => void;
  onDateHeureChange: (field: 'date_rdv' | 'heure_rdv', value: string) => void;
  onAddServiceLigne: (serviceId: number) => void;
  onRemoveServiceLigne: (serviceId: number) => void;
  onUpdateServiceQuantite: (serviceId: number, quantite: number) => void;
  onUpdateAffectation: (
    serviceId: number,
    affectationIndex: number,
    field: keyof ServiceAffectation,
    value: number | string | undefined
  ) => void;
  onUpdateServiceLigneField?: (serviceId: number, field: keyof ServiceLigne, value: string | number) => void;
  onCalculateTotals: () => Totals;
  depositEnabled?: boolean;
  requireDeposit?: boolean;
  onRequireDepositChange?: (value: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
  calculateMultiDaySchedule?: (startDate: string, startTime: string, totalMinutes: number) => {
    jours: Array<{ date: string; debut: string; fin: string; minutes: number }>;
    dateFin: string;
  };
}

export default function NewReservationModal({
  newRdvForm,
  newClientForm,
  services,
  membres,
  clients,
  serviceLignes,
  membreIds,
  membresDisponibles,
  membresOccupes,
  loadingDisponibilites,
  clientSearch,
  showClientDropdown,
  createNewClient,
  createLoading,
  createError,
  dropdownRef,
  profile,
  businessType,
  t,
  isPricingMode,
  isBusinessType,
  onNewRdvFormChange,
  onNewClientFormChange,
  onClientSearch,
  onSelectClient,
  onSetCreateNewClient,
  onSetShowClientDropdown,
  onDateHeureChange,
  onAddServiceLigne,
  onRemoveServiceLigne,
  onUpdateServiceQuantite,
  onUpdateAffectation,
  onUpdateServiceLigneField,
  onCalculateTotals,
  depositEnabled,
  requireDeposit,
  onRequireDepositChange,
  onSubmit,
  onClose,
  calculateMultiDaySchedule,
}: NewReservationModalProps) {
  // Min couverts = capacite - 1 (petites tables) ou 75% (grandes)
  // Evite de gaspiller une table de 4 pour 1 personne
  const getTableMinCapacity = (tableId: number) => {
    const table = services.find(s => s.id === tableId);
    if (!table) return 1;
    const cap = (table as any).capacite || 4;
    if (cap <= 2) return 1;
    if (cap <= 4) return cap - 1;
    return Math.ceil(cap * 0.75);
  };

  // Vérifie si un membre a un créneau chevauchant dans la résa en cours
  const getInternalConflict = (membreId: number, currentServiceId: number, currentAffIdx: number): string | null => {
    const currentLigne = serviceLignes.find(sl => sl.service_id === currentServiceId);
    const currentAff = currentLigne?.affectations[currentAffIdx];
    if (!currentAff?.heure_debut || !currentAff?.heure_fin) return null;

    for (const sl of serviceLignes) {
      for (let i = 0; i < sl.affectations.length; i++) {
        if (sl.service_id === currentServiceId && i === currentAffIdx) continue;
        const aff = sl.affectations[i];
        if (aff.membre_id !== membreId || !aff.heure_debut || !aff.heure_fin) continue;
        if (currentAff.heure_debut < aff.heure_fin && currentAff.heure_fin > aff.heure_debut) {
          return `${aff.heure_debut}-${aff.heure_fin} (${sl.service_nom})`;
        }
      }
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {profile?.id === 'security' ? 'Nouvelle mission' : `Nouvelle ${t('reservation', false).toLowerCase()}`}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Toggle Client existant / Nouveau */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSetCreateNewClient(false)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                !createNewClient
                  ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {t('client', false)} existant
            </button>
            <button
              type="button"
              onClick={() => onSetCreateNewClient(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                createNewClient
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              + Nouveau {t('client', false).toLowerCase()}
            </button>
          </div>

          {/* Client existant - Recherche */}
          {!createNewClient && (
            <div className="relative" ref={dropdownRef}>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Rechercher {t('client', false).toLowerCase()} *
              </label>
              <Input
                type="text"
                placeholder="Nom, prénom ou téléphone..."
                value={clientSearch}
                onChange={(e) => onClientSearch(e.target.value)}
                onFocus={() => onSetShowClientDropdown(true)}
              />
              {showClientDropdown && clients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clients.map((client) => {
                    const isPro = client.type_client === 'professionnel' || !!client.raison_sociale;
                    const displayName = isPro && client.raison_sociale
                      ? client.raison_sociale
                      : `${client.prenom} ${client.nom}`;
                    return (
                      <button
                        key={client.id}
                        onClick={() => onSelectClient(client)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {displayName}
                          </p>
                          {isPro && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                          )}
                        </div>
                        {isPro && client.raison_sociale && (
                          <p className="text-xs text-gray-400">Contact: {client.prenom} {client.nom}</p>
                        )}
                        <p className="text-sm text-gray-500">{client.telephone}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Nouveau client - Formulaire */}
          {createNewClient && (
            <div className="space-y-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-xs font-medium text-green-600 dark:text-green-400">Nouveau {t('client', false).toLowerCase()}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Prénom *</label>
                  <Input
                    type="text"
                    placeholder="Marie"
                    value={newClientForm.prenom}
                    onChange={(e) => onNewClientFormChange({ ...newClientForm, prenom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nom *</label>
                  <Input
                    type="text"
                    placeholder="Dupont"
                    value={newClientForm.nom}
                    onChange={(e) => onNewClientFormChange({ ...newClientForm, nom: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Téléphone *</label>
                  <Input
                    type="tel"
                    placeholder="06 12 34 56 78"
                    value={newClientForm.telephone}
                    onChange={(e) => onNewClientFormChange({ ...newClientForm, telephone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Email</label>
                  <Input
                    type="email"
                    placeholder="email@exemple.fr"
                    value={newClientForm.email}
                    onChange={(e) => onNewClientFormChange({ ...newClientForm, email: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* === DATE (avant les prestations pour salon/domicile) === */}
          {!isPricingMode('hourly') && (isBusinessType('salon') || isBusinessType('service_domicile')) && (
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Date *
                </label>
                <Input
                  type="date"
                  value={newRdvForm.date_rdv}
                  onChange={(e) => onDateHeureChange('date_rdv', e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500">
                L'heure sera définie par les affectations ci-dessous
              </p>
            </div>
          )}

          {/* === PÉRIODE (Mode Horaire - avant les services) === */}
          {isPricingMode('hourly') && (
            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                Période de la {t('reservation', false).toLowerCase()} *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Du *</label>
                  <Input
                    type="date"
                    value={newRdvForm.date_rdv}
                    onChange={(e) => onDateHeureChange('date_rdv', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Au *</label>
                  <Input
                    type="date"
                    value={newRdvForm.date_fin || newRdvForm.date_rdv}
                    onChange={(e) => onNewRdvFormChange({ ...newRdvForm, date_fin: e.target.value })}
                    min={newRdvForm.date_rdv}
                  />
                </div>
              </div>
              {newRdvForm.date_rdv && newRdvForm.date_fin && newRdvForm.date_fin !== newRdvForm.date_rdv && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {calculateDays(newRdvForm.date_rdv, newRdvForm.date_fin)} jour(s)
                </p>
              )}
            </div>
          )}

          {/* RESTAURANT: Sélection table + nombre de couverts */}
          {isBusinessType('restaurant') && (
            <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-600">{'\uD83C\uDF7D\uFE0F'}</span>
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Réservation de table</h3>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Table *
                </label>
                <select
                  value={newRdvForm.table_id}
                  onChange={(e) => {
                    const tableId = parseInt(e.target.value) || 0;
                    const table = services.find(s => s.id === tableId);
                    const cap = (table as any)?.capacite || 20;
                    const minCap = getTableMinCapacity(tableId);
                    onNewRdvFormChange({
                      ...newRdvForm,
                      table_id: tableId,
                      nb_couverts: Math.max(Math.min(newRdvForm.nb_couverts, cap), minCap)
                    });
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value={0}>-- Selectionner une table --</option>
                  {services.filter(s => s.actif !== false).map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.nom} ({(table as any).capacite || 4} places)
                      {(table as any).zone && ` - ${(table as any).zone}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Nombre de couverts *
                </label>
                {(() => {
                  const selectedTable = services.find(s => s.id === newRdvForm.table_id);
                  const maxCapacite = (selectedTable as any)?.capacite || 20;
                  const minCapacite = getTableMinCapacity(newRdvForm.table_id);
                  return (
                    <>
                      <Input
                        type="number"
                        min={minCapacite}
                        max={maxCapacite}
                        value={Math.max(Math.min(newRdvForm.nb_couverts, maxCapacite), minCapacite)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || minCapacite;
                          onNewRdvFormChange({ ...newRdvForm, nb_couverts: Math.max(Math.min(val, maxCapacite), minCapacite) });
                        }}
                        placeholder={String(minCapacite)}
                      />
                      {newRdvForm.table_id > 0 && selectedTable && (
                        <p className="text-xs text-amber-600 mt-1">
                          Capacite: {minCapacite}-{maxCapacite} personnes
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Date *
                  </label>
                  <Input
                    type="date"
                    value={newRdvForm.date_rdv}
                    onChange={(e) => onDateHeureChange('date_rdv', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Heure *
                  </label>
                  <select
                    value={newRdvForm.heure_rdv}
                    onChange={(e) => onDateHeureChange('heure_rdv', e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Créneau --</option>
                    <optgroup label="Service midi">
                      {['11:30','11:45','12:00','12:15','12:30','12:45','13:00','13:15','13:30','13:45','14:00','14:15','14:30'].map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Service soir">
                      {['18:30','18:45','19:00','19:15','19:30','19:45','20:00','20:15','20:30','20:45','21:00','21:15','21:30'].map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* HOTEL: Sélection chambre + dates séjour + extras */}
          {isBusinessType('hotel') && (() => {
            // Chambres = services avec type_chambre non null (meme critere que IA et /admin/hotel/chambres)
            const chambres = services.filter(s => s.actif !== false && !!s.type_chambre);
            // Annexes = services actifs SANS type_chambre (petit-dej, parking, lit bebe, etc.)
            const annexes = services.filter(s => s.actif !== false && !s.type_chambre);
            const selectedChambre = chambres.find(c => c.id === newRdvForm.chambre_id);
            const maxPersonnes = selectedChambre?.capacite_max || 10;
            const nbNuits = calculateNights(newRdvForm.date_rdv, newRdvForm.date_checkout);
            // Extras : par_nuit → prix × nb_nuits, forfait → prix × 1
            const nuitsForExtras = Math.max(1, nbNuits);
            const extrasTotal = annexes
              .filter(a => newRdvForm.extras.includes(a.nom))
              .reduce((sum, a) => {
                const mult = a.facturation === 'par_nuit' ? nuitsForExtras : 1;
                return sum + (a.prix || 0) * mult;
              }, 0);
            const totalCents = selectedChambre
              ? (selectedChambre.prix || 0) * Math.max(1, nbNuits) + extrasTotal
              : 0;

            return (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-600">{'\uD83C\uDFE8'}</span>
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Réservation de séjour</h3>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Chambre *
                </label>
                <select
                  value={newRdvForm.chambre_id}
                  onChange={(e) => {
                    const id = parseInt(e.target.value) || 0;
                    const room = chambres.find(c => c.id === id);
                    // Cap nb_personnes a capacite_max de la nouvelle chambre
                    const cap = room?.capacite_max || 10;
                    const nb = Math.min(newRdvForm.nb_personnes || 1, cap);
                    onNewRdvFormChange({ ...newRdvForm, chambre_id: id, nb_personnes: nb });
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>-- Sélectionner une chambre --</option>
                  {chambres.map((chambre) => (
                    <option key={chambre.id} value={chambre.id}>
                      {chambre.nom} ({chambre.capacite_max || 2} pers.) - {(chambre.prix / 100).toFixed(0)}€/nuit
                      {chambre.vue && ` - Vue ${chambre.vue}`}
                    </option>
                  ))}
                </select>
                {chambres.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Aucune chambre configurée. Ajoutez-en dans Configuration.</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Nombre de personnes *
                  {selectedChambre && (
                    <span className="text-xs text-gray-500 ml-2">(max {maxPersonnes} pour cette chambre)</span>
                  )}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={maxPersonnes}
                  value={newRdvForm.nb_personnes}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 1;
                    onNewRdvFormChange({ ...newRdvForm, nb_personnes: Math.min(v, maxPersonnes) });
                  }}
                  placeholder="2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Arrivée (check-in) *
                  </label>
                  <Input
                    type="date"
                    value={newRdvForm.date_rdv}
                    onChange={(e) => onDateHeureChange('date_rdv', e.target.value)}
                  />
                  <Input
                    type="time"
                    value={newRdvForm.heure_checkin}
                    onChange={(e) => onNewRdvFormChange({ ...newRdvForm, heure_checkin: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Départ (check-out) *
                  </label>
                  <Input
                    type="date"
                    value={newRdvForm.date_checkout}
                    onChange={(e) => onNewRdvFormChange({ ...newRdvForm, date_checkout: e.target.value })}
                    min={newRdvForm.date_rdv}
                  />
                  <Input
                    type="time"
                    value={newRdvForm.heure_checkout}
                    onChange={(e) => onNewRdvFormChange({ ...newRdvForm, heure_checkout: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              {nbNuits > 0 && selectedChambre && (
                <p className="text-sm text-blue-600 font-medium">
                  {nbNuits} nuit{nbNuits > 1 ? 's' : ''} × {(selectedChambre.prix / 100).toFixed(0)}€
                  {extrasTotal > 0 && <> + {(extrasTotal / 100).toFixed(0)}€ extras</>}
                  <> = <strong>{(totalCents / 100).toFixed(2)}€</strong></>
                </p>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Prestations annexes
                </label>
                {annexes.length === 0 ? (
                  <p className="text-xs text-gray-500">Aucune prestation configurée. Ajoutez-en dans Configuration.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {annexes.map(extra => (
                      <label key={extra.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <input
                          type="checkbox"
                          checked={newRdvForm.extras.includes(extra.nom)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              onNewRdvFormChange({ ...newRdvForm, extras: [...newRdvForm.extras, extra.nom] });
                            } else {
                              onNewRdvFormChange({ ...newRdvForm, extras: newRdvForm.extras.filter(ex => ex !== extra.nom) });
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex-1">{extra.nom}</span>
                        {extra.prix > 0 && (
                          <span className="text-xs text-gray-500">
                            +{(extra.prix / 100).toFixed(0)}€{extra.facturation === 'par_nuit' ? '/nuit' : ''}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* === MULTI-SERVICES === (Salon/Service domicile/Security) */}
          {(isBusinessType('salon') || isBusinessType('service_domicile') || isBusinessType('security')) && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                {t('service', true)} * <span className="text-gray-400 font-normal">(multi-sélection)</span>
              </label>

              {/* Liste des services ajoutés avec assignation salarié */}
              {serviceLignes.length > 0 && (
                <div className="space-y-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  {serviceLignes.map((ligne) => {
                    const pricingMode = profile?.pricing?.mode || 'fixed';
                    const tauxHoraire = ligne.taux_horaire || ligne.prix_unitaire;
                    const heures = pricingMode === 'hourly' && newRdvForm.heure_rdv && newRdvForm.heure_fin
                      ? calculateHours(newRdvForm.heure_rdv, newRdvForm.heure_fin)
                      : 0;
                    const prixLigne = pricingMode === 'hourly'
                      ? Math.round(tauxHoraire * heures * newRdvForm.nb_agents)
                      : ligne.prix_unitaire * ligne.quantite;

                    return (
                      <div key={ligne.service_id} className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                        {/* Ligne 1: Service + Info tarif */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ligne.service_nom}</p>
                            <p className="text-xs text-gray-500">
                              {pricingMode === 'hourly' ? (
                                <>{(tauxHoraire / 100).toFixed(2)}€/h</>
                              ) : (
                                <>{ligne.duree_minutes}min · {(ligne.prix_unitaire / 100).toFixed(2)}€/unité</>
                              )}
                            </p>
                          </div>
                          {pricingMode !== 'hourly' && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onUpdateServiceQuantite(ligne.service_id, ligne.quantite - 1)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                              >
                                <MinusCircle className="w-4 h-4 text-gray-500" />
                              </button>
                              <span className="w-6 text-center text-sm font-medium">{ligne.quantite}</span>
                              <button
                                type="button"
                                onClick={() => onUpdateServiceQuantite(ligne.service_id, ligne.quantite + 1)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                              >
                                <PlusCircle className="w-4 h-4 text-cyan-500" />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveServiceLigne(ligne.service_id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded ml-2"
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </button>
                          <div className="text-right min-w-[80px]">
                            {pricingMode === 'hourly' && heures > 0 ? (
                              <div>
                                <p className="text-sm font-semibold text-green-600">
                                  {(prixLigne / 100).toFixed(2)}€
                                </p>
                                <p className="text-xs text-gray-400">
                                  {heures}h × {newRdvForm.nb_agents} {t('employee', newRdvForm.nb_agents > 1).toLowerCase()}
                                </p>
                              </div>
                            ) : pricingMode === 'hourly' ? (
                              <p className="text-xs text-amber-600">Saisir les heures</p>
                            ) : (
                              <p className="text-sm font-semibold text-green-600">
                                {(prixLigne / 100).toFixed(2)}€
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Dates par ligne (security / multi-day) */}
                        {profile?.duration?.allowMultiDay && onUpdateServiceLigneField && (
                          <div className="flex items-center gap-2 pt-1">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="date"
                                value={ligne.date_debut || newRdvForm.date_rdv || ''}
                                onChange={(e) => onUpdateServiceLigneField(ligne.service_id, 'date_debut', e.target.value)}
                                className="px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                              <span className="text-gray-400 text-xs">au</span>
                              <input
                                type="date"
                                value={ligne.date_fin || newRdvForm.date_fin || newRdvForm.date_rdv || ''}
                                onChange={(e) => onUpdateServiceLigneField(ligne.service_id, 'date_fin', e.target.value)}
                                min={ligne.date_debut || newRdvForm.date_rdv || ''}
                                className="px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                          </div>
                        )}

                        {/* Affectations multiples (une par quantité) */}
                        {(ligne.affectations || []).map((affectation, affIdx) => (
                          <div key={affIdx} className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                            {ligne.quantite > 1 && (
                              <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                                Affectation #{affIdx + 1}
                              </p>
                            )}

                            {/* Assignation salarié */}
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <select
                                value={affectation.membre_id || ''}
                                onChange={(e) => onUpdateAffectation(
                                  ligne.service_id,
                                  affIdx,
                                  'membre_id',
                                  e.target.value ? parseInt(e.target.value) : undefined
                                )}
                                className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="">-- Assigner {t('employee', false).toLowerCase()} --</option>
                                {newRdvForm.date_rdv && newRdvForm.heure_rdv ? (
                                  <>
                                    {membresDisponibles.length > 0 && (() => {
                                      const libres = membresDisponibles.filter(m => !getInternalConflict(m.id, ligne.service_id, affIdx));
                                      const conflits = membresDisponibles.filter(m => getInternalConflict(m.id, ligne.service_id, affIdx));
                                      return (
                                        <>
                                          {libres.length > 0 && (
                                            <optgroup label="✓ Disponibles">
                                              {libres.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                  {m.prenom} {m.nom} ({m.role})
                                                </option>
                                              ))}
                                            </optgroup>
                                          )}
                                          {conflits.length > 0 && (
                                            <optgroup label="⚠ Chevauchement (cette résa)">
                                              {conflits.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                  {m.prenom} {m.nom} — {getInternalConflict(m.id, ligne.service_id, affIdx)}
                                                </option>
                                              ))}
                                            </optgroup>
                                          )}
                                        </>
                                      );
                                    })()}
                                    {membresOccupes.length > 0 && (
                                      <optgroup label="✗ Occupés">
                                        {membresOccupes.map((m) => (
                                          <option key={m.id} value={m.id} className="text-gray-400">
                                            {m.prenom} {m.nom} - {m.raison}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </>
                                ) : (
                                  (() => {
                                    const libres = membres.filter(m => !getInternalConflict(m.id, ligne.service_id, affIdx));
                                    const conflits = membres.filter(m => getInternalConflict(m.id, ligne.service_id, affIdx));
                                    return (
                                      <>
                                        {libres.map((m) => (
                                          <option key={m.id} value={m.id}>
                                            {m.prenom} {m.nom} ({m.role})
                                          </option>
                                        ))}
                                        {conflits.length > 0 && (
                                          <optgroup label="⚠ Chevauchement (cette résa)">
                                            {conflits.map((m) => (
                                              <option key={m.id} value={m.id}>
                                                {m.prenom} {m.nom} — {getInternalConflict(m.id, ligne.service_id, affIdx)}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                      </>
                                    );
                                  })()
                                )}
                              </select>
                              {affectation.membre_id && (() => {
                                const conflict = getInternalConflict(affectation.membre_id, ligne.service_id, affIdx);
                                return conflict
                                  ? <span className="text-xs text-amber-500" title={`Chevauche ${conflict}`}>⚠</span>
                                  : <span className="text-xs text-green-600 dark:text-green-400">✓</span>;
                              })()}
                            </div>
                            {affectation.membre_id && (() => {
                              const conflict = getInternalConflict(affectation.membre_id, ligne.service_id, affIdx);
                              if (!conflict) return null;
                              return (
                                <p className="text-xs text-amber-600 dark:text-amber-400 pl-6">
                                  ⚠ Chevauche {conflict}
                                </p>
                              );
                            })()}

                            {/* Horaires pour cette affectation */}
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="time"
                                  value={affectation.heure_debut || ''}
                                  onChange={(e) => onUpdateAffectation(
                                    ligne.service_id,
                                    affIdx,
                                    'heure_debut',
                                    e.target.value
                                  )}
                                  className="px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  placeholder="Début"
                                />
                                <span className="text-gray-400 text-sm">&rarr;</span>
                                <input
                                  type="time"
                                  value={affectation.heure_fin || ''}
                                  onChange={(e) => onUpdateAffectation(
                                    ligne.service_id,
                                    affIdx,
                                    'heure_fin',
                                    e.target.value
                                  )}
                                  className="px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  placeholder="Fin"
                                />
                              </div>
                            </div>
                            {/* Badge majoration (security) */}
                            {isBusinessType('security') && affectation.heure_debut && affectation.heure_fin && (() => {
                              const dateRef = ligne.date_debut || newRdvForm.date_rdv;
                              if (!dateRef) return null;
                              const maj = detectMajoration(dateRef, affectation.heure_debut, affectation.heure_fin);
                              if (maj.pourcentage === 0) return null;
                              return (
                                <p className="text-xs ml-6 mt-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                                    {majorationBadge(maj.type)} {maj.label} +{maj.pourcentage}%
                                  </span>
                                </p>
                              );
                            })()}
                            {/* Résumé multi-jours si la prestation dépasse la journée */}
                            {affectation.heure_debut && ligne.duree_minutes > 480 && calculateMultiDaySchedule && newRdvForm.date_rdv && (() => {
                              const schedule = calculateMultiDaySchedule(newRdvForm.date_rdv, affectation.heure_debut, ligne.duree_minutes);
                              if (schedule.jours.length <= 1) return null;
                              const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                              return (
                                <div className="ml-6 mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
                                  <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                                    Prestation sur {schedule.jours.length} jours
                                  </p>
                                  {schedule.jours.map((j, ji) => {
                                    const d = new Date(j.date + 'T12:00:00');
                                    const jourNom = JOURS[d.getDay()];
                                    const h = Math.floor(j.minutes / 60);
                                    const m = j.minutes % 60;
                                    return (
                                      <div key={ji} className="flex justify-between text-blue-600 dark:text-blue-400">
                                        <span>{jourNom} {j.date.slice(8, 10)}/{j.date.slice(5, 7)}</span>
                                        <span>{j.debut} - {j.fin} ({h}h{m > 0 ? `${String(m).padStart(2, '0')}` : ''})</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dropdown pour ajouter un service */}
              <div className="flex gap-2">
                <select
                  id="add-service-select"
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onAddServiceLigne(parseInt(e.target.value));
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">+ Ajouter un {t('service', false).toLowerCase()}...</option>
                  {services.filter(s => s.actif !== false).map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.nom} — {isPricingMode('hourly') && service.taux_horaire
                        ? `${(service.taux_horaire / 100).toFixed(2)}€/h`
                        : `${(service.prix / 100).toFixed(2)}€ — ${service.duree_minutes}min`
                      }
                    </option>
                  ))}
                </select>
              </div>

              {serviceLignes.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sélectionnez au moins un service
                </p>
              )}
            </div>
          )}

          {/* === ADRESSE DE PRESTATION === */}
          <FeatureField feature="clientAddress">
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                {businessType === 'security' ? 'Site client / Adresse de la mission' : 'Adresse de prestation'}
              </label>
              <textarea
                value={newRdvForm.adresse_prestation}
                onChange={(e) => onNewRdvFormChange({ ...newRdvForm, adresse_prestation: e.target.value })}
                rows={2}
                placeholder={businessType === 'service_domicile'
                  ? "Adresse du client..."
                  : businessType === 'security'
                    ? "Ex: 45 Avenue des Champs-Élysées, 75008 Paris"
                    : "Ex: 123 Rue de Paris, 75001 Paris"}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-gray-500">
                {businessType === 'service_domicile'
                  ? "Indiquez l'adresse complète du client pour le déplacement"
                  : businessType === 'security'
                    ? "Adresse du site où aura lieu la mission de sécurité"
                    : "Indiquez l'adresse où aura lieu la prestation"}
              </p>
            </div>
          </FeatureField>

          {/* === ADRESSE DE FACTURATION === (Service domicile/Security uniquement) */}
          {(isBusinessType('service_domicile') || isBusinessType('security')) && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRdvForm.adresse_facturation_identique}
                  onChange={(e) => onNewRdvFormChange({ ...newRdvForm, adresse_facturation_identique: e.target.checked })}
                  className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Adresse de facturation identique à l'adresse de prestation
                </span>
              </label>
              {!newRdvForm.adresse_facturation_identique && (
                <textarea
                  value={newRdvForm.adresse_facturation}
                  onChange={(e) => onNewRdvFormChange({ ...newRdvForm, adresse_facturation: e.target.value })}
                  rows={2}
                  placeholder="Adresse de facturation..."
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              )}
            </div>
          )}

          {/* Info disponibilités */}
          {loadingDisponibilites && (
            <p className="text-xs text-gray-400 text-center">Vérification des disponibilités...</p>
          )}
          {newRdvForm.date_rdv && newRdvForm.heure_rdv && !loadingDisponibilites && serviceLignes.length > 0 && (
            <div className="flex gap-4 text-xs justify-center">
              <span className="text-green-600 dark:text-green-400">
                {membresDisponibles.length} salarié{membresDisponibles.length > 1 ? 's' : ''} disponible{membresDisponibles.length > 1 ? 's' : ''}
              </span>
              {membresOccupes.length > 0 && (
                <span className="text-gray-400">
                  {membresOccupes.length} occupé{membresOccupes.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Date + Heure salon/domicile déplacés en haut du formulaire */}

          {/* Période complète — Security/Commerce/Service domicile multi-jours: date début/fin + heures */}
          {!isPricingMode('hourly') && (isBusinessType('security') || isBusinessType('commerce') || (isBusinessType('service_domicile') && profile?.duration?.allowMultiDay)) && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                Période {isBusinessType('security') ? 'de la mission' : isBusinessType('service_domicile') ? 'du chantier' : 'de la prestation'}
              </label>

              {isPricingMode('daily') ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date début *</label>
                    <Input
                      type="date"
                      value={newRdvForm.date_rdv}
                      onChange={(e) => onDateHeureChange('date_rdv', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date fin</label>
                    <Input
                      type="date"
                      value={newRdvForm.date_fin}
                      onChange={(e) => onNewRdvFormChange({ ...newRdvForm, date_fin: e.target.value })}
                      min={newRdvForm.date_rdv}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Date début *</label>
                      <Input
                        type="date"
                        value={newRdvForm.date_rdv}
                        onChange={(e) => onDateHeureChange('date_rdv', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Heure début *</label>
                      <Input
                        type="time"
                        value={newRdvForm.heure_rdv}
                        onChange={(e) => onDateHeureChange('heure_rdv', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Date fin</label>
                      <Input
                        type="date"
                        value={newRdvForm.date_fin || ''}
                        onChange={(e) => onNewRdvFormChange({ ...newRdvForm, date_fin: e.target.value })}
                        min={newRdvForm.date_rdv}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Heure fin</label>
                      <Input
                        type="time"
                        value={newRdvForm.heure_fin || ''}
                        onChange={(e) => onNewRdvFormChange({ ...newRdvForm, heure_fin: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500">
                Les disponibilités du personnel seront vérifiées automatiquement
              </p>
            </div>
          )}

          {/* === GESTE COMMERCIAL === */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
              Geste commercial
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={newRdvForm.remise_type}
                onChange={(e) => onNewRdvFormChange({ ...newRdvForm, remise_type: e.target.value })}
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Aucune remise</option>
                <option value="pourcentage">Remise %</option>
                <option value="montant">Remise €</option>
              </select>
              {newRdvForm.remise_type && (
                <>
                  <Input
                    type="number"
                    min="0"
                    placeholder={newRdvForm.remise_type === 'pourcentage' ? '10' : '20.00'}
                    value={newRdvForm.remise_valeur || ''}
                    onChange={(e) => onNewRdvFormChange({ ...newRdvForm, remise_valeur: parseFloat(e.target.value) || 0 })}
                  />
                  <select
                    value={newRdvForm.remise_motif}
                    onChange={(e) => onNewRdvFormChange({ ...newRdvForm, remise_motif: e.target.value })}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Motif...</option>
                    <option value="bienvenue">Bienvenue</option>
                    <option value="fidelite">Fidélité</option>
                    <option value="promo">Promotion</option>
                    <option value="parrainage">Parrainage</option>
                    <option value="autre">Autre</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes</label>
            <textarea
              value={newRdvForm.notes}
              onChange={(e) => onNewRdvFormChange({ ...newRdvForm, notes: e.target.value })}
              rows={2}
              placeholder="Notes additionnelles..."
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* === RÉCAPITULATIF === */}
          {serviceLignes.length > 0 && (() => {
            const totals = onCalculateTotals();
            const heures = Math.floor(totals.dureeTotale / 60);
            const minutes = totals.dureeTotale % 60;
            const dureeStr = heures > 0 ? `${heures}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}` : `${minutes}min`;

            return (
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-4 space-y-2 border border-cyan-200 dark:border-cyan-800">
                {totals.pricingMode === 'hourly' && totals.nbAgents > 0 && (
                  <div className="text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30 rounded p-2 mb-2">
                    <span className="font-medium">Mode horaire:</span>{' '}
                    {totals.nbAgents} {t('employee', totals.nbAgents > 1).toLowerCase()} × {totals.nbJours} jour{totals.nbJours > 1 ? 's' : ''}
                    <span className="block mt-1 text-cyan-600 dark:text-cyan-500">
                      Total: {Math.round(totals.dureeTotale / 60)}h de vacation
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Sous-total {t('service', true).toLowerCase()}:
                  </span>
                  <span className="font-medium">{(totals.sousTotalServices / 100).toFixed(2)} EUR</span>
                </div>
                {totals.montantMajorations > 0 && (
                  <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                    <span>Majorations (nuit/dimanche/férié):</span>
                    <span className="font-medium">+{(totals.montantMajorations / 100).toFixed(2)} EUR</span>
                  </div>
                )}
                <FeatureField feature="travelFees">
                  {totals.fraisDeplacement > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Frais déplacement:</span>
                      <span className="font-medium">{(totals.fraisDeplacement / 100).toFixed(2)} EUR</span>
                    </div>
                  )}
                </FeatureField>
                {totals.remise > 0 && (
                  <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                    <span>Remise ({newRdvForm.remise_type === 'pourcentage' ? `${newRdvForm.remise_valeur}%` : 'fixe'}):</span>
                    <span className="font-medium">-{(totals.remise / 100).toFixed(2)} EUR</span>
                  </div>
                )}
                <div className="border-t border-cyan-200 dark:border-cyan-700 pt-2 mt-2 space-y-1">
                  {totals.montantCnaps > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Taxe CNAPS (0.50%):</span>
                      <span className="font-medium">{(totals.montantCnaps / 100).toFixed(2)} EUR</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Montant HT{totals.montantCnaps > 0 ? ' (incl. CNAPS)' : ''}:</span>
                    <span className="font-medium">{(totals.montantHT / 100).toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">TVA (20%):</span>
                    <span className="font-medium">{(totals.tva / 100).toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-semibold text-gray-900 dark:text-white">Total TTC:</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {(totals.totalTTC / 100).toFixed(2)} EUR
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-cyan-200 dark:border-cyan-700">
                  <span className="text-gray-600 dark:text-gray-400">{t('duration') || 'Durée totale'}:</span>
                  <span className="font-medium">{dureeStr}</span>
                </div>
                {membreIds.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {membreIds.length} {t('employee', membreIds.length > 1).toLowerCase()} assigné{membreIds.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Toggle acompte */}
          {depositEnabled && onRequireDepositChange && (
            <label className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={requireDeposit}
                onClick={() => onRequireDepositChange(!requireDeposit)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                  requireDeposit ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  requireDeposit ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`} />
              </button>
              <div>
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Demander l'acompte au client</span>
                <p className="text-xs text-amber-600 dark:text-amber-400">La réservation restera en attente jusqu'au paiement</p>
              </div>
            </label>
          )}

          {createError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {createError}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Annuler
          </Button>
          <Button onClick={onSubmit} disabled={createLoading} className="flex-1">
            {createLoading ? 'Création...' : `Créer ${profile?.id === 'security' ? 'la mission' : t('reservation', false).toLowerCase()}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
