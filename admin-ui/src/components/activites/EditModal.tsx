/**
 * EditModal - Modal de modification d'une prestation
 * Adapte au type de business (salon, restaurant, hotel)
 */

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Reservation, EditForm, EditLigne, Service, Membre } from './types';
import type { BusinessType } from '@/contexts/ProfileContext';

interface EditModalProps {
  reservation: Reservation;
  editForm: EditForm;
  editLignes: EditLigne[];
  services: Service[];
  membres: Membre[];
  editLoading: boolean;
  editError: string;
  businessType?: BusinessType;
  isBusinessType?: (type: BusinessType) => boolean;
  onEditFormChange: (form: EditForm) => void;
  onEditLignesChange: (lignes: EditLigne[]) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function EditModal({
  reservation,
  editForm,
  editLignes,
  services,
  membres,
  editLoading,
  editError,
  isBusinessType,
  onEditFormChange,
  onEditLignesChange,
  onSave,
  onClose,
}: EditModalProps) {
  const handleClose = () => {
    onClose();
  };

  const isRestaurant = isBusinessType?.('restaurant') ?? false;
  const isHotel = isBusinessType?.('hotel') ?? false;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Modifier {isRestaurant ? 'reservation' : isHotel ? 'sejour' : 'prestation'} #{reservation.id}
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Client info */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            {reservation.client ? (() => {
              const isPro = reservation.client.type_client === 'professionnel' || !!reservation.client.raison_sociale;
              const displayName = isPro && reservation.client.raison_sociale
                ? reservation.client.raison_sociale
                : `${reservation.client.prenom} ${reservation.client.nom}`;
              return (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {displayName} — {reservation.client.telephone}
                  </p>
                  {isPro && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                  )}
                </div>
              );
            })() : (
              <p className="text-sm text-gray-400">Client inconnu</p>
            )}
          </div>

          {/* RESTAURANT: Table + couverts */}
          {isRestaurant && (
            <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-600">{'\uD83C\uDF7D\uFE0F'}</span>
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Reservation de table</h3>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Table</label>
                <select
                  value={editForm.table_id || 0}
                  onChange={(e) => {
                    const tableId = parseInt(e.target.value) || 0;
                    const table = services.find(s => s.id === tableId);
                    const cap = (table as any)?.capacite || 20;
                    onEditFormChange({
                      ...editForm,
                      table_id: tableId,
                      nb_couverts: Math.min(editForm.nb_couverts || 2, cap)
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
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nombre de couverts</label>
                {(() => {
                  const selectedTable = services.find(s => s.id === editForm.table_id);
                  const maxCapacite = (selectedTable as any)?.capacite || 20;
                  return (
                    <>
                      <Input
                        type="number"
                        min={1}
                        max={maxCapacite}
                        value={Math.min(editForm.nb_couverts || 2, maxCapacite)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          onEditFormChange({ ...editForm, nb_couverts: Math.min(val, maxCapacite) });
                        }}
                      />
                      {editForm.table_id && editForm.table_id > 0 && selectedTable && (
                        <p className="text-xs text-amber-600 mt-1">
                          Capacite max: {maxCapacite} personnes
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Date</label>
                  <Input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => onEditFormChange({ ...editForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Heure</label>
                  <Input
                    type="time"
                    value={editForm.heure}
                    onChange={(e) => onEditFormChange({ ...editForm, heure: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* HOTEL: Chambre + dates sejour */}
          {isHotel && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-600">{'\uD83C\uDFE8'}</span>
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Reservation de sejour</h3>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Chambre</label>
                <select
                  value={editForm.chambre_id || 0}
                  onChange={(e) => onEditFormChange({ ...editForm, chambre_id: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>-- Selectionner une chambre --</option>
                  {services.filter(s => s.actif !== false).map((chambre) => (
                    <option key={chambre.id} value={chambre.id}>
                      {chambre.nom} ({(chambre as any).capacite_max || 2} pers.) - {(chambre.prix / 100).toFixed(0)}/nuit
                      {(chambre as any).vue && ` - Vue ${(chambre as any).vue}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nombre de personnes</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={editForm.nb_personnes || 2}
                  onChange={(e) => onEditFormChange({ ...editForm, nb_personnes: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Check-in</label>
                  <Input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => onEditFormChange({ ...editForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Check-out</label>
                  <Input
                    type="date"
                    value={editForm.date_checkout || ''}
                    onChange={(e) => onEditFormChange({ ...editForm, date_checkout: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Heure arrivee</label>
                  <Input
                    type="time"
                    value={editForm.heure}
                    onChange={(e) => onEditFormChange({ ...editForm, heure: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Heure depart</label>
                  <Input
                    type="time"
                    value={editForm.heure_checkout || ''}
                    onChange={(e) => onEditFormChange({ ...editForm, heure_checkout: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* GENERIQUE (salon, services, etc.): Date + heures salaries */}
          {!isRestaurant && !isHotel && (
            <>
              {/* Date */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Date</label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => onEditFormChange({ ...editForm, date: e.target.value })}
                />
              </div>

              {/* Lignes de service avec heures par salarie */}
              {editLignes.length > 0 ? (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                    Heures effectives par salarie
                  </label>
                  {editLignes.map((ligne, idx) => (
                    <div key={ligne.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {ligne.service_nom}
                        </span>
                        {ligne.membre && (
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                            {ligne.membre.prenom} {ligne.membre.nom}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 mb-1 block">Debut</label>
                          <Input
                            type="time"
                            value={ligne.heure_debut}
                            onChange={(e) => {
                              const newLignes = [...editLignes];
                              newLignes[idx] = { ...newLignes[idx], heure_debut: e.target.value };
                              onEditLignesChange(newLignes);
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 mb-1 block">Fin</label>
                          <Input
                            type="time"
                            value={ligne.heure_fin}
                            onChange={(e) => {
                              const newLignes = [...editLignes];
                              newLignes[idx] = { ...newLignes[idx], heure_fin: e.target.value };
                              onEditLignesChange(newLignes);
                            }}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      {ligne.heure_debut && ligne.heure_fin && (() => {
                        const [startH, startM] = ligne.heure_debut.split(':').map(Number);
                        const [endH, endM] = ligne.heure_fin.split(':').map(Number);
                        let dureeMins = (endH * 60 + endM) - (startH * 60 + startM);
                        if (dureeMins < 0) dureeMins += 24 * 60;
                        const heures = Math.floor(dureeMins / 60);
                        const mins = dureeMins % 60;
                        return (
                          <p className="text-xs text-gray-500">
                            Duree: {heures}h{mins > 0 ? mins.toString().padStart(2, '0') : ''}
                          </p>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Service (ancienne vue si pas de lignes) */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Service</label>
                    <select
                      value={editForm.service_nom}
                      onChange={(e) => onEditFormChange({ ...editForm, service_nom: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {services.filter(s => s.actif !== false).map((s) => (
                        <option key={s.id} value={s.nom}>
                          {s.nom} — {(s.prix / 100).toFixed(0)}€ ({s.duree_minutes}min)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Heure */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Heure</label>
                    <Input
                      type="time"
                      value={editForm.heure}
                      onChange={(e) => onEditFormChange({ ...editForm, heure: e.target.value })}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Statut */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Statut</label>
            <select
              value={editForm.statut}
              onChange={(e) => onEditFormChange({ ...editForm, statut: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="demande">Demande</option>
              <option value="en_attente">En attente</option>
              <option value="confirme">Confirme</option>
              <option value="termine">Termine</option>
              <option value="annule">Annule</option>
            </select>
          </div>

          {/* Employe assigne (pas pour restaurant) */}
          {!isRestaurant && membres.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Employe assigne</label>
              <select
                value={editForm.membre_id}
                onChange={(e) => onEditFormChange({ ...editForm, membre_id: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value={0}>Non assigne</option>
                {membres.map((membre) => (
                  <option key={membre.id} value={membre.id}>
                    {membre.prenom} {membre.nom} ({membre.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => onEditFormChange({ ...editForm, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {editError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {editError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleClose} variant="outline" className="flex-1">
              Annuler
            </Button>
            <Button onClick={onSave} disabled={editLoading} className="flex-1">
              {editLoading ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
