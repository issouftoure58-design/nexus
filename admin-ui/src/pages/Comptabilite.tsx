import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { comptaApi, type Invoice, type Expense, type ComptaStats } from '@/lib/api';
import {
  Euro,
  TrendingUp,
  TrendingDown,
  FileText,
  Receipt,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

const INVOICE_STATUS = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  sent: { label: 'Envoyée', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid: { label: 'Payée', color: 'bg-green-50 text-green-700 border-green-200' },
  overdue: { label: 'En retard', color: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const EXPENSE_CATEGORIES = [
  'Fournitures',
  'Matériel',
  'Transport',
  'Marketing',
  'Loyer',
  'Charges',
  'Salaires',
  'Formation',
  'Autre'
];

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function Comptabilite() {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'expenses'>('overview');
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<ComptaStats>({
    queryKey: ['compta-stats'],
    queryFn: comptaApi.getStats,
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => comptaApi.getFactures(),
    enabled: activeTab === 'invoices' || activeTab === 'overview',
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: comptaApi.getDepenses,
    enabled: activeTab === 'expenses' || activeTab === 'overview',
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Group expenses by category for pie chart
  const expensesByCategory = expensesData?.depenses?.reduce((acc, exp) => {
    acc[exp.categorie] = (acc[exp.categorie] || 0) + exp.montant;
    return acc;
  }, {} as Record<string, number>) || {};

  const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value: value / 100
  }));

  return (
    <Layout title="Comptabilité" subtitle="Gestion financière">
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">CA du mois</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {statsLoading ? '...' : formatCurrency(stats?.ca_mois || 0)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Dépenses du mois</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {statsLoading ? '...' : formatCurrency(stats?.depenses_mois || 0)}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Bénéfice net</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    (stats?.benefice_mois || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {statsLoading ? '...' : formatCurrency(stats?.benefice_mois || 0)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Euro className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Factures impayées</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {statsLoading ? '...' : formatCurrency(stats?.factures_impayees || 0)}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <FileText className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {(['overview', 'invoices', 'expenses'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab
                  ? 'border-cyan-500 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab === 'overview' && 'Vue d\'ensemble'}
              {tab === 'invoices' && 'Factures'}
              {tab === 'expenses' && 'Dépenses'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent invoices */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Dernières factures</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('invoices')}>
                  Voir tout
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoicesData?.factures?.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-sm">{invoice.numero}</p>
                          <p className="text-xs text-gray-500">
                            {invoice.clients?.prenom} {invoice.clients?.nom}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(invoice.montant / 100)}</p>
                        <Badge variant="outline" className={INVOICE_STATUS[invoice.statut]?.color}>
                          {INVOICE_STATUS[invoice.statut]?.label}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {(!invoicesData?.factures || invoicesData.factures.length === 0) && (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune facture</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Expenses by category */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Répartition des dépenses</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowNewExpenseModal(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-12">Aucune dépense enregistrée</p>
                )}
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span>{entry.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <Card>
            <CardContent className="p-0">
              {invoicesLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/50">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">N° Facture</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Client</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Montant</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Statut</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Échéance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesData?.factures?.map((invoice) => (
                        <tr key={invoice.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <span className="font-mono text-sm">{invoice.numero}</span>
                          </td>
                          <td className="py-4 px-4">
                            {invoice.clients?.prenom} {invoice.clients?.nom}
                          </td>
                          <td className="py-4 px-4 font-semibold">
                            {formatCurrency(invoice.montant / 100)}
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline" className={INVOICE_STATUS[invoice.statut]?.color}>
                              {INVOICE_STATUS[invoice.statut]?.label}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600">
                            {formatDate(invoice.date_echeance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <>
            <div className="flex justify-end">
              <Button
                onClick={() => setShowNewExpenseModal(true)}
                className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                <Plus className="h-4 w-4" />
                Nouvelle dépense
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {expensesLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50/50">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Catégorie</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Description</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expensesData?.depenses?.map((expense) => (
                          <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-4 px-4 text-sm">{formatDate(expense.date)}</td>
                            <td className="py-4 px-4">
                              <Badge variant="outline">{expense.categorie}</Badge>
                            </td>
                            <td className="py-4 px-4 text-sm text-gray-600">{expense.description}</td>
                            <td className="py-4 px-4 text-right font-semibold text-red-600">
                              -{formatCurrency(expense.montant / 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* New Expense Modal */}
      {showNewExpenseModal && (
        <NewExpenseModal onClose={() => setShowNewExpenseModal(false)} />
      )}
    </Layout>
  );
}

// New Expense Modal
function NewExpenseModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    categorie: EXPENSE_CATEGORIES[0],
    description: '',
    montant: 0,
    date: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      comptaApi.createDepense({
        ...data,
        montant: Math.round(data.montant * 100)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['compta-stats'] });
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
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
              <select
                value={formData.categorie}
                onChange={(e) => setFormData(d => ({ ...d, categorie: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(d => ({ ...d, description: e.target.value }))}
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
                  value={formData.date}
                  onChange={(e) => setFormData(d => ({ ...d, date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Enregistrer'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
