import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  RefreshCw,
  Mail,
  Eye,
  Printer,
  FileSpreadsheet,
  FileText,
  X,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { comptaApi, type Invoice } from '@/lib/api';
import { EntityLink } from '@/components/EntityLink';
import {
  INVOICE_STATUS,
  MODES_PAIEMENT,
  formatCurrency,
  formatDate,
  matchesMontantRange,
  exportToCSV,
} from './constants';
import { Wallet } from 'lucide-react';

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------
export interface ComptaInvoicesProps {
  invoices: Invoice[];
  isLoading: boolean;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
export default function ComptaInvoices({
  invoices,
  isLoading,
  onNotify,
}: ComptaInvoicesProps) {
  const queryClient = useQueryClient();

  // Filter state
  const [invoiceNumeroFilter, setInvoiceNumeroFilter] = useState<string>('all');
  const [invoiceClientFilter, setInvoiceClientFilter] = useState<string>('all');
  const [invoiceServiceFilter, setInvoiceServiceFilter] = useState<string>('all');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState<string>('all');
  const [invoiceMontantFilter, setInvoiceMontantFilter] = useState<string>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');

  // Selected invoice for detail modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // ----------------------------------------------------------------
  // Mutations
  // ----------------------------------------------------------------
  const syncMutation = useMutation({
    mutationFn: () => comptaApi.syncFactures(),
    onSuccess: (data: { nb_creees?: number; nb_mises_a_jour?: number; nb_echecs?: number; total_reservations?: number }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      const nbEchecs = data.nb_echecs || 0;
      const message = nbEchecs > 0
        ? `${data.nb_creees || 0} créée(s), ${data.nb_mises_a_jour || 0} mise(s) à jour, ${nbEchecs} échec(s)`
        : `${data.nb_creees || 0} facture(s) créée(s), ${data.nb_mises_a_jour || 0} mise(s) à jour (${data.total_reservations} réservations)`;
      onNotify(nbEchecs > 0 ? 'error' : 'success', message);
    },
    onError: (err: Error) => onNotify('error', `Erreur: ${err.message}`),
  });

  const sendInvoiceMutation = useMutation({
    mutationFn: (id: number) => comptaApi.sendFacture(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoice(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, statut, mode_paiement }: { id: number; statut: string; mode_paiement?: string }) =>
      comptaApi.updateFactureStatut(id, statut, mode_paiement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoice(null);
    },
  });

  const sendAllMutation = useMutation({
    mutationFn: () => comptaApi.sendAllFactures(),
    onSuccess: (data: { nb_envoyees?: number }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onNotify('success', `${data.nb_envoyees || 0} facture(s) envoyée(s) par email`);
    },
    onError: (err: Error) => onNotify('error', `Erreur: ${err.message}`),
  });

  // ----------------------------------------------------------------
  // Filter options (unique values)
  // ----------------------------------------------------------------
  const invoiceFilterOptions = useMemo(() => {
    const numeros = [...new Set(invoices.map(f => f.numero).filter((v): v is string => Boolean(v)))].sort();
    const clients = [...new Set(invoices.map(f => f.client_nom).filter((v): v is string => Boolean(v)))].sort();
    const services = [...new Set(invoices.map(f => f.service_nom).filter((v): v is string => Boolean(v)))].sort();
    const dates = [...new Set(invoices.map(f => f.date_facture?.slice(0, 7)).filter((v): v is string => Boolean(v)))].sort().reverse();
    return { numeros, clients, services, dates };
  }, [invoices]);

  // ----------------------------------------------------------------
  // Filtered list
  // ----------------------------------------------------------------
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      if (invoiceNumeroFilter !== 'all' && invoice.numero !== invoiceNumeroFilter) return false;
      if (invoiceClientFilter !== 'all' && invoice.client_nom !== invoiceClientFilter) return false;
      if (invoiceServiceFilter !== 'all' && invoice.service_nom !== invoiceServiceFilter) return false;
      if (invoiceDateFilter !== 'all' && invoice.date_facture?.slice(0, 7) !== invoiceDateFilter) return false;
      if (!matchesMontantRange(invoice.montant_ttc || 0, invoiceMontantFilter)) return false;
      if (invoiceStatusFilter !== 'all' && invoice.statut !== invoiceStatusFilter) return false;
      return true;
    });
  }, [invoices, invoiceNumeroFilter, invoiceClientFilter, invoiceServiceFilter, invoiceDateFilter, invoiceMontantFilter, invoiceStatusFilter]);

  const hasActiveFilters = invoiceNumeroFilter !== 'all' || invoiceClientFilter !== 'all' || invoiceServiceFilter !== 'all' || invoiceDateFilter !== 'all' || invoiceMontantFilter !== 'all' || invoiceStatusFilter !== 'all';

  const clearFilters = () => {
    setInvoiceNumeroFilter('all');
    setInvoiceClientFilter('all');
    setInvoiceServiceFilter('all');
    setInvoiceDateFilter('all');
    setInvoiceMontantFilter('all');
    setInvoiceStatusFilter('all');
  };

  // ----------------------------------------------------------------
  // Print handler
  // ----------------------------------------------------------------
  const handlePrintInvoice = async (invoiceId: number) => {
    try {
      const response = await comptaApi.getFacturePDF(invoiceId);
      if (response.success && response.html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.html, 'text/html');
        doc.querySelectorAll('script').forEach(s => s.remove());
        const sanitizedHtml = doc.documentElement.outerHTML;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(sanitizedHtml);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => printWindow.print(), 250);
        }
      }
    } catch {
      onNotify('error', 'Erreur lors de l\'impression');
    }
  };

  // ----------------------------------------------------------------
  // Export
  // ----------------------------------------------------------------
  const exportFacturesToExcel = () => {
    const data = invoices.map(f => ({
      numero: f.numero,
      date: f.date_facture,
      client: f.client_nom,
      service: f.service_nom,
      montant_ht: ((f.montant_ht || 0) / 100).toFixed(2),
      tva: ((f.montant_tva || 0) / 100).toFixed(2),
      montant_ttc: ((f.montant_ttc || 0) / 100).toFixed(2),
      statut: INVOICE_STATUS[f.statut]?.label || f.statut
    }));
    exportToCSV(data, 'factures', ['Numero', 'Date', 'Client', 'Service', 'Montant_HT', 'TVA', 'Montant_TTC', 'Statut']);
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">
          {filteredInvoices.length} facture{filteredInvoices.length > 1 ? 's' : ''}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-2 text-xs h-6"
            >
              Effacer filtres
            </Button>
          )}
        </span>
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="gap-2"
        >
          {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync réservations
        </Button>
        <Button
          variant="outline"
          onClick={() => sendAllMutation.mutate()}
          disabled={sendAllMutation.isPending}
          className="gap-2"
        >
          {sendAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Envoyer tout
        </Button>
        <Button
          variant="outline"
          onClick={exportFacturesToExcel}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b bg-gray-50/50">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50/50">
                      <select
                        value={invoiceNumeroFilter}
                        onChange={(e) => setInvoiceNumeroFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium"
                      >
                        <option value="all">N° Facture</option>
                        {invoiceFilterOptions.numeros.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">
                      <select
                        value={invoiceClientFilter}
                        onChange={(e) => setInvoiceClientFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium"
                      >
                        <option value="all">Client</option>
                        {invoiceFilterOptions.clients.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">
                      <select
                        value={invoiceServiceFilter}
                        onChange={(e) => setInvoiceServiceFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium"
                      >
                        <option value="all">Service</option>
                        {invoiceFilterOptions.services.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">
                      <select
                        value={invoiceDateFilter}
                        onChange={(e) => setInvoiceDateFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium"
                      >
                        <option value="all">Date</option>
                        {invoiceFilterOptions.dates.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">
                      <select
                        value={invoiceMontantFilter}
                        onChange={(e) => setInvoiceMontantFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium text-right"
                      >
                        <option value="all">Montant</option>
                        <option value="0-50">0 - 50€</option>
                        <option value="50-100">50 - 100€</option>
                        <option value="100-200">100 - 200€</option>
                        <option value="200-500">200 - 500€</option>
                        <option value="500+">500€+</option>
                      </select>
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">
                      <select
                        value={invoiceStatusFilter}
                        onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium"
                      >
                        <option value="all">Statut</option>
                        {Object.entries(INVOICE_STATUS).slice(0, 5).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-4 px-4"><span className="font-mono text-sm">{invoice.numero}</span></td>
                      <td className="py-4 px-4">
                        <EntityLink
                          type="client"
                          entity={{
                            id: invoice.client_id,
                            nom: invoice.client_nom?.split(' ').slice(-1)[0] || '',
                            prenom: invoice.client_nom?.split(' ').slice(0, -1).join(' ') || '',
                            telephone: invoice.client_telephone || ''
                          }}
                          label={invoice.client_nom || 'Client'}
                        />
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {invoice.service_id ? (
                          <EntityLink
                            type="service"
                            entity={{
                              id: invoice.service_id,
                              nom: invoice.service_nom || '',
                              prix: invoice.montant_ttc || 0,
                              duree: 60
                            }}
                            label={invoice.service_nom || '-'}
                          />
                        ) : (
                          invoice.service_nom || '-'
                        )}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">{formatDate(invoice.date_facture)}</td>
                      <td className="py-4 px-4 text-right font-semibold">{formatCurrency((invoice.montant_ttc || 0) / 100)}</td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className={INVOICE_STATUS[invoice.statut]?.color || 'bg-gray-100'}>
                          {INVOICE_STATUS[invoice.statut]?.label || invoice.statut}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(invoice)} className="h-8 w-8 p-0" title="Voir">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handlePrintInvoice(invoice.id)} className="h-8 w-8 p-0" title="Imprimer">
                            <Printer className="h-4 w-4" />
                          </Button>
                          {invoice.statut !== 'annulee' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => sendInvoiceMutation.mutate(invoice.id)}
                              disabled={sendInvoiceMutation.isPending || !invoice.client_email}
                              className="h-8 w-8 p-0"
                              title={invoice.client_email ? "Email" : "Pas d'email"}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        {hasActiveFilters
                          ? 'Aucune facture ne correspond aux filtres'
                          : 'Aucune facture'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPrint={() => handlePrintInvoice(selectedInvoice.id)}
          onSend={() => sendInvoiceMutation.mutate(selectedInvoice.id)}
          onUpdateStatus={(statut, mode_paiement) => updateStatusMutation.mutate({ id: selectedInvoice.id, statut, mode_paiement })}
          isSending={sendInvoiceMutation.isPending}
          isUpdating={updateStatusMutation.isPending}
        />
      )}
    </>
  );
}

// -------------------------------------------------------------------
// Invoice Detail Modal (private sub-component)
// -------------------------------------------------------------------
function InvoiceDetailModal({
  invoice,
  onClose,
  onPrint,
  onSend,
  onUpdateStatus,
  isSending,
  isUpdating,
}: {
  invoice: Invoice;
  onClose: () => void;
  onPrint: () => void;
  onSend: () => void;
  onUpdateStatus: (statut: string, modePaiement?: string) => void;
  isSending: boolean;
  isUpdating: boolean;
}) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('cb');

  const canSend = invoice.client_email && invoice.statut !== 'payee' && invoice.statut !== 'annulee';
  const canMarkPaid = invoice.statut !== 'payee' && invoice.statut !== 'annulee' && invoice.statut !== 'brouillon';

  const handleMarkPaid = () => {
    onUpdateStatus('payee', selectedPaymentMode);
    setShowPaymentModal(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10 border-b">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-600" />
              Facture {invoice.numero}
            </CardTitle>
            <Badge variant="outline" className={cn("mt-2", INVOICE_STATUS[invoice.statut]?.color || 'bg-gray-100')}>
              {INVOICE_STATUS[invoice.statut]?.label || invoice.statut}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Client</h3>
              <EntityLink
                type="client"
                entity={{
                  id: invoice.client_id,
                  nom: invoice.client_nom?.split(' ').slice(-1)[0] || '',
                  prenom: invoice.client_nom?.split(' ').slice(0, -1).join(' ') || '',
                  telephone: invoice.client_telephone || '',
                  email: invoice.client_email || undefined
                }}
                label={invoice.client_nom || '-'}
                className="font-medium"
              />
              {invoice.client_email && <p className="text-sm text-gray-600">{invoice.client_email}</p>}
              {invoice.client_telephone && <p className="text-sm text-gray-600">{invoice.client_telephone}</p>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Dates</h3>
              <p className="text-sm"><span className="text-gray-500">Facture :</span> {formatDate(invoice.date_facture)}</p>
              <p className="text-sm"><span className="text-gray-500">Prestation :</span> {formatDate(invoice.date_prestation)}</p>
              {invoice.date_paiement && (
                <p className="text-sm text-green-600"><span className="text-gray-500">Payée le :</span> {formatDate(invoice.date_paiement)}</p>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Prestation</h3>
            <p className="font-medium">{invoice.service_nom || '-'}</p>
            {invoice.service_description && <p className="text-sm text-gray-600 mt-1">{invoice.service_description}</p>}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody>
                <tr className="border-b">
                  <td className="p-3 text-gray-600">Montant HT</td>
                  <td className="p-3 text-right font-medium">{formatCurrency((invoice.montant_ht || 0) / 100)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 text-gray-600">TVA ({invoice.taux_tva || 20}%)</td>
                  <td className="p-3 text-right font-medium">{formatCurrency((invoice.montant_tva || 0) / 100)}</td>
                </tr>
                <tr className="bg-cyan-50">
                  <td className="p-3 font-semibold">Total TTC</td>
                  <td className="p-3 text-right font-bold text-lg text-cyan-700">{formatCurrency((invoice.montant_ttc || 0) / 100)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onPrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimer / PDF
            </Button>
            {canSend && (
              <Button variant="outline" onClick={onSend} disabled={isSending} className="gap-2">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Envoyer par email
              </Button>
            )}
            {canMarkPaid && (
              <Button onClick={() => setShowPaymentModal(true)} disabled={isUpdating} className="gap-2 bg-green-600 hover:bg-green-700">
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Marquer payée
              </Button>
            )}
            {invoice.statut !== 'annulee' && invoice.statut !== 'payee' && (
              <Button variant="outline" onClick={() => onUpdateStatus('annulee')} disabled={isUpdating} className="gap-2 text-red-600 hover:bg-red-50">
                <X className="h-4 w-4" />
                Annuler
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal sélection mode de paiement */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-green-600" />
                Mode de paiement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Sélectionnez le mode de paiement pour la facture {invoice.numero}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {MODES_PAIEMENT.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setSelectedPaymentMode(mode.value)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                      selectedPaymentMode === mode.value
                        ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <span className="text-xl">{mode.icon}</span>
                    <span className="font-medium">{mode.label}</span>
                    {selectedPaymentMode === mode.value && (
                      <CheckCircle className="h-5 w-5 text-green-600 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)} className="flex-1">
                  Annuler
                </Button>
                <Button onClick={handleMarkPaid} disabled={isUpdating} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Confirmer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
