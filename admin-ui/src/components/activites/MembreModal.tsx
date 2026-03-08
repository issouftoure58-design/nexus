/**
 * MembreModal - Modal d'affectation du personnel (obligatoire pour terminer)
 */

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Reservation, Membre } from './types';

interface MembreModalProps {
  reservation: Reservation;
  membres: Membre[];
  selectedMembreId: number;
  membreLoading: boolean;
  onSelectMembre: (membreId: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function MembreModal({
  reservation,
  membres,
  selectedMembreId,
  membreLoading,
  onSelectMembre,
  onConfirm,
  onClose,
}: MembreModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Affectation du personnel</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Vous devez affecter un membre de l'equipe avant de terminer cette prestation.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Service:</strong> {reservation.service_nom || (typeof reservation.service === 'string' ? reservation.service : (reservation.service as { nom?: string })?.nom || 'Service')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Client:</strong> {reservation.clients?.prenom} {reservation.clients?.nom}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Personnel assigne *
            </label>
            <select
              value={selectedMembreId}
              onChange={(e) => onSelectMembre(parseInt(e.target.value))}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value={0}>-- Selectionnez un membre --</option>
              {membres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.prenom} {m.nom} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={onConfirm}
              disabled={membreLoading || !selectedMembreId}
              className="flex-1"
            >
              {membreLoading ? 'Validation...' : 'Terminer la prestation'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
