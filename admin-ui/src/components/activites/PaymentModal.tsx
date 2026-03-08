/**
 * PaymentModal - Modal de sélection du mode de paiement
 */

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MODES_PAIEMENT } from './types';

interface PaymentModalProps {
  selectedModePaiement: string;
  paymentLoading: boolean;
  onSelectMode: (mode: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function PaymentModal({
  selectedModePaiement,
  paymentLoading,
  onSelectMode,
  onConfirm,
  onClose,
}: PaymentModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mode de paiement</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sélectionnez le mode de paiement pour marquer cette activité comme terminée.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {MODES_PAIEMENT.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => onSelectMode(mode.value)}
                className={`p-4 rounded-lg border-2 transition-all text-center ${
                  selectedModePaiement === mode.value
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="text-2xl block mb-1">{mode.icon}</span>
                <span className={`text-sm font-medium ${
                  selectedModePaiement === mode.value
                    ? 'text-cyan-700 dark:text-cyan-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {mode.label}
                </span>
              </button>
            ))}
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
              disabled={paymentLoading}
              className="flex-1"
            >
              {paymentLoading ? 'Validation...' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
