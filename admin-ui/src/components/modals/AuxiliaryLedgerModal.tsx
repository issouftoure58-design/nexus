import { useQuery } from '@tanstack/react-query';
import { X, Loader2, FileText, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { comptaApi, type CompteDetailResponse } from '@/lib/api';

interface AuxiliaryLedgerModalProps {
  type: 'client' | 'fournisseur';
  id: number;
  nom: string;
  onClose: () => void;
}

export function AuxiliaryLedgerModal({ type, id, nom, onClose }: AuxiliaryLedgerModalProps) {
  // Build the auxiliary account number
  const compteNumero = type === 'client'
    ? `411${String(id).padStart(5, '0')}`
    : `401${String(id).padStart(5, '0')}`;

  const { data, isLoading } = useQuery({
    queryKey: ['grand-livre-auxiliaire', compteNumero],
    queryFn: () => comptaApi.getGrandLivreCompte(compteNumero),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col print:max-w-none print:max-h-none print:shadow-none" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b print:border-b-2">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${type === 'client' ? 'bg-blue-100' : 'bg-orange-100'}`}>
              <FileText className={`h-6 w-6 ${type === 'client' ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Grand Livre Auxiliaire</CardTitle>
              <p className="text-sm text-gray-500">
                {nom} - Compte {compteNumero}
              </p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimer
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className={`rounded-lg p-4 text-center ${type === 'client' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                  <p className={`text-xl font-bold ${type === 'client' ? 'text-blue-700' : 'text-orange-700'}`}>
                    {formatCurrency(data.totaux.debit)}
                  </p>
                  <p className={`text-xs ${type === 'client' ? 'text-blue-600' : 'text-orange-600'}`}>Total Débit</p>
                </div>
                <div className={`rounded-lg p-4 text-center ${type === 'client' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                  <p className={`text-xl font-bold ${type === 'client' ? 'text-blue-700' : 'text-orange-700'}`}>
                    {formatCurrency(data.totaux.credit)}
                  </p>
                  <p className={`text-xs ${type === 'client' ? 'text-blue-600' : 'text-orange-600'}`}>Total Crédit</p>
                </div>
                <div className={`rounded-lg p-4 text-center ${data.totaux.solde >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-xl font-bold ${data.totaux.solde >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(Math.abs(data.totaux.solde))}
                  </p>
                  <p className={`text-xs ${data.totaux.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Solde {data.totaux.solde >= 0 ? 'Débiteur' : 'Créditeur'}
                  </p>
                </div>
              </div>

              {/* Movements Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Journal</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Pièce</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Libellé</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Débit</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Crédit</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Solde</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Let.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ecritures.map((ecriture) => (
                      <tr key={ecriture.id} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-600">{formatDate(ecriture.date_ecriture)}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="font-mono text-xs">
                            {ecriture.journal_code}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-600">{ecriture.numero_piece || '-'}</td>
                        <td className="py-3 px-4 text-gray-900 max-w-xs truncate">{ecriture.libelle}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {ecriture.debit > 0 ? formatCurrency(ecriture.debit / 100) : ''}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {ecriture.credit > 0 ? formatCurrency(ecriture.credit / 100) : ''}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-medium ${(ecriture.solde_progressif || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs((ecriture.solde_progressif || 0) / 100))}
                          <span className="text-xs ml-1">{(ecriture.solde_progressif || 0) >= 0 ? 'D' : 'C'}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {ecriture.lettrage && (
                            <Badge variant="secondary" className="text-xs font-mono">
                              {ecriture.lettrage}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data.ecritures.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400">
                          Aucun mouvement pour ce compte
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {data.ecritures.length > 0 && (
                    <tfoot className="bg-gray-100 font-semibold">
                      <tr>
                        <td colSpan={4} className="py-3 px-4 text-right">TOTAUX</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(data.totaux.debit)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(data.totaux.credit)}</td>
                        <td className={`py-3 px-4 text-right font-mono ${data.totaux.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(data.totaux.solde))}
                          <span className="text-xs ml-1">{data.totaux.solde >= 0 ? 'D' : 'C'}</span>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <p className="text-xs text-gray-400 text-right">
                {data.ecritures.length} écriture{data.ecritures.length > 1 ? 's' : ''}
              </p>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Erreur de chargement</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AuxiliaryLedgerModal;
