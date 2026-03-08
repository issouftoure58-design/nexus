import React, { useState, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Plus,
  X,
  CheckCircle,
  FileSpreadsheet,
  Upload,
  Sparkles,
} from 'lucide-react';
import { api, comptaApi, type Expense } from '@/lib/api';
import { EntityLink } from '@/components/EntityLink';
import {
  EXPENSE_CATEGORIES,
  MODES_PAIEMENT,
  formatCurrency,
  formatDate,
  matchesMontantRange,
  exportToCSV,
} from './constants';

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------
export interface ComptaExpensesProps {
  expenses: Expense[];
  isLoading: boolean;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
export default function ComptaExpenses({
  expenses,
  isLoading,
  onNotify,
}: ComptaExpensesProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingExpense, setIsUploadingExpense] = useState(false);
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);

  // Payment modal state
  const [showExpensePaymentModal, setShowExpensePaymentModal] = useState(false);
  const [pendingExpenseId, setPendingExpenseId] = useState<number | null>(null);
  const [expensePaymentMode, setExpensePaymentMode] = useState('cb');

  // Filter state
  const [expenseDateFilter, setExpenseDateFilter] = useState<string>('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [expenseDescFilter, setExpenseDescFilter] = useState<string>('all');
  const [expenseMontantFilter, setExpenseMontantFilter] = useState<string>('all');
  const [expensePayeeFilter, setExpensePayeeFilter] = useState<string>('all');
  const [expenseTVAFilter, setExpenseTVAFilter] = useState<string>('all');

  // ----------------------------------------------------------------
  // Mutations
  // ----------------------------------------------------------------
  const marquerDepensePayeeMutation = useMutation({
    mutationFn: ({ id, payee, mode_paiement }: { id: number; payee: boolean; mode_paiement?: string }) =>
      comptaApi.marquerDepensePayee(id, payee, mode_paiement),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onNotify('success', variables.payee ? 'Dépense marquée comme payée' : 'Dépense marquée non payée');
      setShowExpensePaymentModal(false);
      setPendingExpenseId(null);
    },
    onError: (err: Error) => onNotify('error', err.message),
  });

  // ----------------------------------------------------------------
  // Filter options
  // ----------------------------------------------------------------
  const expenseFilterOptions = useMemo(() => {
    const dates = [...new Set(expenses.map(d => d.date_depense?.slice(0, 7)).filter((d): d is string => Boolean(d)))].sort().reverse();
    const descriptions = [...new Set(expenses.map(d => d.libelle || d.description).filter((d): d is string => Boolean(d)))].sort();
    const montants = [...new Set(expenses.map(d => d.montant))].sort((a, b) => a - b);
    return { dates, descriptions, montants };
  }, [expenses]);

  // ----------------------------------------------------------------
  // Filtered list
  // ----------------------------------------------------------------
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      if (expenseDateFilter !== 'all' && expense.date_depense?.slice(0, 7) !== expenseDateFilter) return false;
      if (expenseCategoryFilter !== 'all' && expense.categorie !== expenseCategoryFilter) return false;
      if (expenseDescFilter !== 'all' && (expense.libelle || expense.description) !== expenseDescFilter) return false;
      if (!matchesMontantRange(expense.montant_ttc || expense.montant || 0, expenseMontantFilter)) return false;
      if (expensePayeeFilter !== 'all') {
        const isPayee = expense.payee !== false;
        if (expensePayeeFilter === 'oui' && !isPayee) return false;
        if (expensePayeeFilter === 'non' && isPayee) return false;
      }
      if (expenseTVAFilter !== 'all') {
        const isTVA = expense.deductible_tva !== false && (expense.montant_tva || 0) > 0;
        if (expenseTVAFilter === 'oui' && !isTVA) return false;
        if (expenseTVAFilter === 'non' && isTVA) return false;
      }
      return true;
    });
  }, [expenses, expenseDateFilter, expenseCategoryFilter, expenseDescFilter, expenseMontantFilter, expensePayeeFilter, expenseTVAFilter]);

  const hasActiveFilters = expenseDateFilter !== 'all' || expenseCategoryFilter !== 'all' || expenseDescFilter !== 'all' || expenseMontantFilter !== 'all' || expensePayeeFilter !== 'all' || expenseTVAFilter !== 'all';

  const clearFilters = () => {
    setExpenseDateFilter('all');
    setExpenseCategoryFilter('all');
    setExpenseDescFilter('all');
    setExpenseMontantFilter('all');
    setExpensePayeeFilter('all');
    setExpenseTVAFilter('all');
  };

  // ----------------------------------------------------------------
  // Upload handler
  // ----------------------------------------------------------------
  const handleExpenseUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingExpense(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await api.upload<{ success: boolean; extracted?: { fournisseur?: string; montant_ttc_euros?: string }; depense?: { libelle?: string; montant_ttc?: number }; error?: string }>('/depenses/upload-facture', formData);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        onNotify(
          'success',
          `Dépense créée: ${result.extracted?.fournisseur || result.depense?.libelle || 'Facture importée'} - ${result.extracted?.montant_ttc_euros || ((result.depense?.montant_ttc ?? 0) / 100).toFixed(2)}€`
        );
      } else {
        onNotify('error', result.error || 'Erreur lors de l\'analyse de la facture');
      }
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Erreur lors de l\'upload');
    } finally {
      setIsUploadingExpense(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ----------------------------------------------------------------
  // Export
  // ----------------------------------------------------------------
  const exportDepensesToExcel = () => {
    const data = expenses.map(d => ({
      date: d.date_depense,
      categorie: EXPENSE_CATEGORIES[d.categorie] || d.categorie,
      description: d.description || d.libelle,
      montant: ((d.montant || 0) / 100).toFixed(2),
      tva: ((d.montant_tva || 0) / 100).toFixed(2)
    }));
    exportToCSV(data, 'depenses', ['Date', 'Categorie', 'Description', 'Montant', 'TVA']);
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">
          {filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''}
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
          onClick={exportDepensesToExcel}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleExpenseUpload}
            className="hidden"
            disabled={isUploadingExpense}
          />
          <Button
            variant="outline"
            className="gap-2 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:from-purple-100 hover:to-pink-100"
            disabled={isUploadingExpense}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploadingExpense ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4 text-purple-600" />
                <Sparkles className="h-3 w-3 text-pink-500" />
              </>
            )}
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-medium">
              {isUploadingExpense ? 'Analyse IA...' : 'Scanner facture'}
            </span>
          </Button>
        </>
        <Button onClick={() => setShowNewExpenseModal(true)} className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="h-4 w-4" />
          Nouvelle dépense
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
                        value={expenseDateFilter}
                        onChange={(e) => setExpenseDateFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium"
                      >
                        <option value="all">Date</option>
                        {expenseFilterOptions.dates.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">
                      <select
                        value={expenseCategoryFilter}
                        onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium"
                      >
                        <option value="all">Catégorie</option>
                        {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">
                      <select
                        value={expenseDescFilter}
                        onChange={(e) => setExpenseDescFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium"
                      >
                        <option value="all">Description</option>
                        {expenseFilterOptions.descriptions.map(d => (
                          <option key={d} value={d}>{d && d.length > 30 ? d.slice(0, 30) + '...' : d}</option>
                        ))}
                      </select>
                    </th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">
                      <select
                        value={expenseMontantFilter}
                        onChange={(e) => setExpenseMontantFilter(e.target.value)}
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
                    <th className="text-center py-2 px-3 text-sm font-medium text-gray-600">
                      <select
                        value={expensePayeeFilter}
                        onChange={(e) => setExpensePayeeFilter(e.target.value)}
                        className="w-full h-8 text-xs px-2 border rounded bg-white font-medium"
                      >
                        <option value="all">Statut</option>
                        <option value="oui">Payée</option>
                        <option value="non">Non payée</option>
                      </select>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-4 px-4 text-sm">{formatDate(expense.date_depense)}</td>
                      <td className="py-4 px-4">
                        <EntityLink
                          type="categorie"
                          entity={expense.categorie}
                          label={EXPENSE_CATEGORIES[expense.categorie] || expense.categorie}
                        />
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">{expense.libelle || expense.description || '-'}</td>
                      <td className="py-4 px-4 text-right font-semibold text-red-600">-{formatCurrency((expense.montant || 0) / 100)}</td>
                      <td className="py-4 px-4 text-center">
                        {expense.payee !== false ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer" onClick={() => marquerDepensePayeeMutation.mutate({ id: expense.id, payee: false })}>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Payée
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => {
                              setPendingExpenseId(expense.id);
                              setExpensePaymentMode('cb');
                              setShowExpensePaymentModal(true);
                            }}
                            disabled={marquerDepensePayeeMutation.isPending}
                          >
                            Marquer payée
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        {expenseDateFilter !== 'all' || expenseCategoryFilter !== 'all' || expenseDescFilter !== 'all' || expenseMontantFilter !== 'all'
                          ? 'Aucune dépense ne correspond aux filtres'
                          : 'Aucune dépense'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Expense Modal */}
      {showNewExpenseModal && (
        <NewExpenseModal onClose={() => setShowNewExpenseModal(false)} />
      )}

      {/* Expense Payment Modal */}
      {showExpensePaymentModal && pendingExpenseId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mode de paiement</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setShowExpensePaymentModal(false); setPendingExpenseId(null); }} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Sélectionnez le mode de paiement pour cette dépense.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {MODES_PAIEMENT.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setExpensePaymentMode(mode.value)}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      expensePaymentMode === mode.value
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{mode.icon}</span>
                    <span className={`text-sm font-medium ${
                      expensePaymentMode === mode.value ? 'text-cyan-700' : 'text-gray-700'
                    }`}>
                      {mode.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => { setShowExpensePaymentModal(false); setPendingExpenseId(null); }}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => marquerDepensePayeeMutation.mutate({ id: pendingExpenseId, payee: true, mode_paiement: expensePaymentMode })}
                  disabled={marquerDepensePayeeMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                >
                  {marquerDepensePayeeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Confirmer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

// -------------------------------------------------------------------
// New Expense Modal (private sub-component)
// -------------------------------------------------------------------
function NewExpenseModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    categorie: 'fournitures',
    libelle: '',
    montant: 0,
    date_depense: new Date().toISOString().split('T')[0],
    a_credit: false,
    mode_paiement: 'cb',
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      comptaApi.createDepense({
        categorie: data.categorie,
        libelle: data.libelle,
        description: data.libelle,
        montant: Math.round(data.montant * 100),
        date: data.date_depense,
        a_credit: data.a_credit,
        mode_paiement: data.a_credit ? undefined : data.mode_paiement,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Nouvelle dépense</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
              <select
                value={formData.categorie}
                onChange={(e) => setFormData(d => ({ ...d, categorie: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              >
                {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
              <Input
                value={formData.libelle}
                onChange={(e) => setFormData(d => ({ ...d, libelle: e.target.value }))}
                placeholder="Ex: Achat de shampoings"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€) *</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.montant}
                  onChange={(e) => setFormData(d => ({ ...d, montant: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <Input
                  type="date"
                  value={formData.date_depense}
                  onChange={(e) => setFormData(d => ({ ...d, date_depense: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Type de paiement: Comptant ou Crédit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de paiement *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(d => ({ ...d, a_credit: false }))}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    !formData.a_credit
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {'💵'} Comptant
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(d => ({ ...d, a_credit: true }))}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    formData.a_credit
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {'📋'} À crédit
                </button>
              </div>
            </div>

            {/* Mode de paiement (si comptant) */}
            {!formData.a_credit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mode de paiement *</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODES_PAIEMENT.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, mode_paiement: mode.value }))}
                      className={`p-2 rounded-lg border-2 text-center transition-all ${
                        formData.mode_paiement === mode.value
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg block">{mode.icon}</span>
                      <span className={`text-xs font-medium ${
                        formData.mode_paiement === mode.value ? 'text-cyan-700' : 'text-gray-600'
                      }`}>
                        {mode.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
