/**
 * DetailModal - Modal de détail d'une prestation
 */

import { Clock, X } from 'lucide-react';
import { EntityLink } from '@/components/EntityLink';
import { useProfile } from '@/contexts/ProfileContext';
import type { Reservation, ReservationMembre } from './types';
import { STATUS_CONFIG, formatDate, formatCurrency } from './types';

interface DetailModalProps {
  reservation: Reservation;
  onClose: () => void;
}

export default function DetailModal({ reservation, onClose }: DetailModalProps) {
  const { t } = useProfile();
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Détails prestation #{reservation.id}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Date/Heure + Statut */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-600" />
              <span className="font-medium text-gray-900 dark:text-white">
                {formatDate(reservation.date || reservation.date_rdv || '')} à {reservation.heure || reservation.heure_rdv}
              </span>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded ${STATUS_CONFIG[reservation.statut]?.bgColor} ${STATUS_CONFIG[reservation.statut]?.color}`}>
              {STATUS_CONFIG[reservation.statut]?.label || reservation.statut}
            </span>
          </div>

          {/* Client */}
          {reservation.client && (() => {
            const isPro = reservation.client.type_client === 'professionnel' || !!reservation.client.raison_sociale;
            const displayName = isPro && reservation.client.raison_sociale
              ? reservation.client.raison_sociale
              : `${reservation.client.prenom} ${reservation.client.nom}`;
            const initials = isPro && reservation.client.raison_sociale
              ? reservation.client.raison_sociale.substring(0, 2).toUpperCase()
              : `${reservation.client.prenom?.[0] || ''}${reservation.client.nom?.[0] || ''}`;
            return (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isPro ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'}`}>
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <EntityLink
                        type="client"
                        entity={{
                          id: reservation.client.id,
                          nom: reservation.client.nom,
                          prenom: reservation.client.prenom,
                          telephone: reservation.client.telephone,
                          email: reservation.client.email || undefined
                        }}
                        label={displayName}
                        className="font-medium"
                      />
                      {isPro && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                      )}
                    </div>
                    {isPro && reservation.client.raison_sociale && (
                      <p className="text-xs text-gray-400">Contact: {reservation.client.prenom} {reservation.client.nom}</p>
                    )}
                    <p className="text-sm text-gray-500">{reservation.client.telephone}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Services avec salariés assignés */}
          <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg space-y-2">
            <p className="text-xs text-cyan-600 dark:text-cyan-400 mb-2">{t('service', true)} & {t('employee', true)}</p>
            {reservation.services && reservation.services.length > 0 ? (
              <>
                {reservation.services.map((s, idx) => (
                  <div key={s.id || idx} className="flex items-center justify-between py-1 border-b border-cyan-100 dark:border-cyan-800 last:border-0">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 dark:text-white">{s.service_nom}</span>
                      {s.quantite > 1 && <span className="text-xs text-gray-500 ml-1">x{s.quantite}</span>}
                      {s.membre && (
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          &rarr; {s.membre.prenom} {s.membre.nom}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-green-600">{formatCurrency(s.prix_total || 0)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-cyan-200 dark:border-cyan-700">
                  <span className="text-sm text-gray-500">
                    Durée totale: {reservation.duree_totale || reservation.duree || 60} min
                  </span>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(reservation.prix || reservation.prix_total || 0)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{reservation.service_nom || '-'}</span>
                  {reservation.duree && <p className="text-xs text-gray-500">{reservation.duree} min</p>}
                </div>
                <span className="text-xl font-bold text-green-600">{formatCurrency(reservation.prix || reservation.prix_total || 0)}</span>
              </div>
            )}
          </div>

          {/* Tous les employés assignés */}
          {reservation.membres && reservation.membres.length > 0 ? (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">{t('employee', true)} ({reservation.membres.length})</p>
              <div className="space-y-1">
                {reservation.membres.map((m: ReservationMembre, idx: number) => (
                  <div key={m.id || idx} className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {m.prenom} {m.nom}
                    </span>
                    <span className="text-sm text-gray-500">({m.role})</span>
                    {m.assignment_role === 'principal' && (
                      <span className="text-xs bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-1.5 rounded">Principal</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : reservation.membre && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Employé assigné</p>
              <EntityLink
                type="employee"
                entity={{
                  id: reservation.membre.id,
                  nom: reservation.membre.nom,
                  prenom: reservation.membre.prenom,
                  role: reservation.membre.role
                }}
                label={`${reservation.membre.prenom} ${reservation.membre.nom}`}
                className="font-medium"
              />
              <span className="text-sm text-gray-500 ml-2">({reservation.membre.role})</span>
            </div>
          )}

          {/* Notes */}
          {reservation.notes && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Notes</p>
              <p className="text-gray-700 dark:text-gray-300 text-sm">{reservation.notes}</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Créée via {reservation.created_via || 'admin'}
          </p>
        </div>
      </div>
    </div>
  );
}
