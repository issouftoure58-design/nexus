import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Invoice, Expense } from '@/lib/api';
import { INVOICE_STATUS, EXPENSE_CATEGORIES, COLORS, formatCurrency } from './constants';

export interface ComptaOverviewProps {
  invoices: Invoice[];
  expenses: Expense[];
  onNavigateInvoices: () => void;
  onNewExpense: () => void;
}

export default function ComptaOverview({
  invoices,
  expenses,
  onNavigateInvoices,
  onNewExpense,
}: ComptaOverviewProps) {
  const pieData = useMemo(() => {
    const byCategory = expenses.reduce((acc, exp) => {
      acc[exp.categorie] = (acc[exp.categorie] || 0) + exp.montant;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(byCategory).map(([name, value]) => ({ name, value: value / 100 }));
  }, [expenses]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Dernières factures</CardTitle>
          <Button variant="ghost" size="sm" onClick={onNavigateInvoices}>
            Voir tout
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoices.slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-sm">{invoice.numero}</p>
                    <p className="text-xs text-gray-500">{invoice.client_nom || 'Client'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency((invoice.montant_ttc || 0) / 100)}</p>
                  <Badge variant="outline" className={INVOICE_STATUS[invoice.statut]?.color || 'bg-gray-100'}>
                    {INVOICE_STATUS[invoice.statut]?.label || invoice.statut}
                  </Badge>
                </div>
              </div>
            ))}
            {invoices.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Aucune facture</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Répartition des dépenses</CardTitle>
          <Button variant="ghost" size="sm" onClick={onNewExpense}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {pieData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">Aucune dépense</p>
          )}
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span>{EXPENSE_CATEGORIES[entry.name] || entry.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
