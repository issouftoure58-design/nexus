import { X } from 'lucide-react';
import type { Devis } from '@/lib/api';

export interface AcceptDevisModalProps {
  devis: Devis;
  onClose: () => void;
  onAccept: () => void;
  isLoading: boolean;
}

export default function AcceptDevisModal({ devis, onClose, onAccept, isLoading }: AcceptDevisModalProps) {
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
          <h2 className="text-xl font-bold text-green-600">Accepter le devis</h2>
          <p className="text-sm text-gray-500 mt-1">
            Devis {devis.numero} - {devis.client_nom}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <strong>Confirmation d'acceptation</strong>
            </p>
            <p className="text-sm text-green-700 mt-2">
              Le devis sera marque comme accepte. Vous pourrez ensuite l'executer pour creer les reservations et affecter le personnel.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Service:</span>
              <span className="font-medium">{devis.service_nom}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Client:</span>
              <span className="font-medium">{devis.client_nom}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Montant:</span>
              <span className="font-medium text-blue-600">{(devis.montant_ttc / 100).toFixed(2)} EUR</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              onClick={onAccept}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Acceptation...' : 'Confirmer l\'acceptation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
