import { useState } from 'react';
import { X } from 'lucide-react';
import type { Devis } from '@/lib/api';

export interface RejectDevisModalProps {
  devis: Devis;
  onClose: () => void;
  onReject: (raison?: string) => void;
  isLoading: boolean;
}

export default function RejectDevisModal({ devis, onClose, onReject, isLoading }: RejectDevisModalProps) {
  const [raison, setRaison] = useState('');

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full">
          <X className="w-5 h-5 text-gray-500" />
        </button>
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-red-600">Rejeter le devis</h2>
          <p className="text-sm text-gray-500 mt-1">
            Devis {devis.numero} - {devis.client_nom}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif du rejet (optionnel)</label>
            <textarea
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
              rows={3}
              placeholder="Ex: Prix trop eleve, Date non disponible..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              onClick={() => onReject(raison || undefined)}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? 'Rejet...' : 'Rejeter le devis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
