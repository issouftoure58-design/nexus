import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Devis } from '@/lib/api';
import { X, Printer, Download, Send, Edit2, Check, XCircle, Play, Clock, User, MapPin, Phone, Mail, Calendar, FileText } from 'lucide-react';
import { formatMontant, formatDateLong, STATUT_LABELS, StatutDevis } from './types';
import { useProfile } from '@/contexts/ProfileContext';

export interface DevisDetailModalProps {
  devisId: string;
  onClose: () => void;
  onEdit: (devis: Devis) => void;
  onSend: (id: string) => void;
  onAccept: (devis: Devis) => void;
  onReject: (devis: Devis) => void;
  onExecute: (devis: Devis) => void;
}

export default function DevisDetailModal({ devisId, onClose, onEdit, onSend, onAccept, onReject, onExecute }: DevisDetailModalProps) {
  const { t } = useProfile();
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch devis details
  const { data, isLoading, error } = useQuery({
    queryKey: ['devis-detail', devisId],
    queryFn: () => api.get<{ devis: Devis; historique: Array<{ id: number; action: string; notes: string; created_at: string; changed_by: string }> }>(`/admin/devis/${devisId}`),
  });

  const devis: Devis | null = data?.devis || null;
  const historique = data?.historique || [];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Devis ${devis?.numero}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
          .devis-number { font-size: 28px; color: #2563eb; margin-bottom: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-box { background: #f8fafc; padding: 20px; border-radius: 8px; }
          .info-box h3 { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 10px; }
          .info-box p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 30px 0; }
          th { background: #2563eb; color: white; padding: 12px; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          .totals { margin-left: auto; width: 300px; }
          .totals .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .totals .row.total { font-size: 18px; font-weight: bold; color: #2563eb; border-top: 2px solid #2563eb; border-bottom: none; padding-top: 15px; }
          .validity { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 30px 0; text-align: center; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportPDF = async () => {
    // Ouvrir l'apercu HTML du devis dans un nouvel onglet
    window.open(`/api/admin/devis/${devisId}/pdf`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !devis) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
        <div className="bg-white rounded-lg p-8 max-w-md">
          <p className="text-red-600 text-center">Erreur lors du chargement du devis</p>
          <button onClick={onClose} className="mt-4 w-full px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const statutConfig = STATUT_LABELS[devis.statut as StatutDevis];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header avec actions */}
        <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Devis {devis.numero}
            </h2>
            <p className="text-blue-100 text-sm mt-1">{devis.client_nom}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Statut */}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statutConfig?.bg} ${statutConfig?.color}`}>
              {statutConfig?.label}
            </span>
            <button onClick={onClose} className="p-2 hover:bg-blue-500 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barre d'actions */}
        <div className="p-3 border-b bg-gray-50 flex flex-wrap gap-2">
          {/* Actions de visualisation */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm"
          >
            <Download className="w-4 h-4" />
            Exporter PDF
          </button>

          <div className="flex-1" />

          {/* Actions selon statut */}
          {devis.statut === 'brouillon' && (
            <>
              <button
                onClick={() => onEdit(devis)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={() => onSend(devis.id)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Send className="w-4 h-4" />
                Envoyer
              </button>
            </>
          )}

          {devis.statut === 'envoye' && (
            <>
              <button
                onClick={() => onAccept(devis)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Check className="w-4 h-4" />
                Accepter
              </button>
              <button
                onClick={() => onReject(devis)}
                className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
              >
                <XCircle className="w-4 h-4" />
                Rejeter
              </button>
            </>
          )}

          {devis.statut === 'accepte' && (
            <button
              onClick={() => onExecute(devis)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              <Play className="w-4 h-4" />
              Executer
            </button>
          )}
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Zone imprimable */}
          <div ref={printRef} className="p-6">
            {/* En-tete du devis */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-blue-600">
              <div>
                <div className="text-3xl font-bold text-blue-600">DEVIS</div>
                <div className="text-lg text-gray-600 mt-1">N{'\u00B0'} {devis.numero}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Date d'emission</div>
                <div className="font-medium">{formatDateLong(devis.date_devis)}</div>
                <div className="text-sm text-gray-500 mt-2">Valide jusqu'au</div>
                <div className="font-medium">{devis.date_expiration ? formatDateLong(devis.date_expiration) : '-'}</div>
              </div>
            </div>

            {/* Informations client et details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Client */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="text-xs uppercase text-gray-500 font-semibold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {t('client')}
                </h3>
                <div className="space-y-2">
                  <p className="font-semibold text-lg">{devis.client_nom || '-'}</p>
                  {devis.client_telephone && (
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {devis.client_telephone}
                    </p>
                  )}
                  {devis.client_email && (
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {devis.client_email}
                    </p>
                  )}
                  {devis.client_adresse && (
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {devis.client_adresse}
                    </p>
                  )}
                </div>
              </div>

              {/* Details prestation */}
              <div className="bg-blue-50 rounded-lg p-5">
                <h3 className="text-xs uppercase text-gray-500 font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {t('service')}
                </h3>
                <div className="space-y-2">
                  {devis.lieu && (
                    <p className="text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span className="font-medium capitalize">{devis.lieu}</span>
                    </p>
                  )}
                  {devis.duree_minutes && (
                    <p className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>Duree: {Math.floor(devis.duree_minutes / 60)}h{devis.duree_minutes % 60 > 0 ? ` ${devis.duree_minutes % 60}min` : ''}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tableau des prestations */}
            <div className="mb-8">
              <table className="w-full">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="text-left p-3 rounded-tl-lg">Description</th>
                    <th className="text-right p-3 w-32">Duree</th>
                    <th className="text-right p-3 w-32 rounded-tr-lg">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-4">
                      <div className="font-medium">{devis.service_nom || t('service')}</div>
                      {devis.service_description && (
                        <div className="text-sm text-gray-500 mt-1">{devis.service_description}</div>
                      )}
                    </td>
                    <td className="p-4 text-right text-gray-600">
                      {devis.duree_minutes ? `${devis.duree_minutes} min` : '-'}
                    </td>
                    <td className="p-4 text-right font-medium">
                      {formatMontant(devis.montant_ht)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totaux */}
            <div className="flex justify-end mb-8">
              <div className="w-72 space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Sous-total HT</span>
                  <span className="font-medium">{formatMontant(devis.montant_ht || 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">TVA ({devis.taux_tva || 20}%)</span>
                  <span className="font-medium">{formatMontant(devis.montant_tva || 0)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-blue-600">
                  <span className="text-lg font-bold">Total TTC</span>
                  <span className="text-lg font-bold text-blue-600">{formatMontant(devis.montant_ttc)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {devis.notes && (
              <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                <p className="text-sm text-gray-600">{devis.notes}</p>
              </div>
            )}

            {/* Validite */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-amber-800">
                <strong>Ce devis est valable {devis.validite_jours || 30} jours</strong> a compter de sa date d'emission.
              </p>
            </div>
          </div>

          {/* Historique (non imprime) */}
          {historique.length > 0 && (
            <div className="p-6 border-t bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Historique</h3>
              <div className="space-y-2">
                {historique.map((item: { id: number; action: string; notes: string; created_at: string; changed_by: string }) => (
                  <div key={item.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                    <div>
                      <span className="font-medium">{item.action}</span>
                      {item.notes && <span className="text-gray-500"> - {item.notes}</span>}
                      <div className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString('fr-FR')} par {item.changed_by}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
