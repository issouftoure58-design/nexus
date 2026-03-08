/** Constantes partagees entre les composants comptabilite */

export const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  generee: { label: 'Confirmée', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  envoyee: { label: 'Envoyée', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  payee: { label: 'Payée', color: 'bg-green-50 text-green-700 border-green-200' },
  annulee: { label: 'Annulée', color: 'bg-gray-100 text-gray-500 border-gray-200 line-through' },
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  fournitures: 'Fournitures',
  loyer: 'Loyer',
  charges: 'Charges',
  telecom: 'Télécom',
  assurance: 'Assurances',
  transport: 'Transport',
  marketing: 'Marketing',
  bancaire: 'Frais bancaires',
  formation: 'Formation',
  materiel: 'Matériel',
  logiciel: 'Logiciels',
  comptabilite: 'Comptabilité',
  taxes: 'Taxes',
  salaires: 'Salaires',
  cotisations_sociales: 'Cotisations sociales',
  autre: 'Autre'
};

export const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export const MODES_PAIEMENT = [
  { value: 'cb', label: 'Carte bancaire', icon: '💳' },
  { value: 'especes', label: 'Espèces', icon: '💵' },
  { value: 'virement', label: 'Virement', icon: '🏦' },
  { value: 'cheque', label: 'Chèque', icon: '📝' },
  { value: 'prelevement', label: 'Prélèvement', icon: '🔄' },
];

export const AVAILABLE_YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

/** Formatte un montant en euros */
export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

/** Formatte une date en fr-FR */
export const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime()) || date.getFullYear() < 2000) return '-';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Helper pour filtrer par tranche de montant */
export const matchesMontantRange = (montantCentimes: number, range: string): boolean => {
  if (range === 'all') return true;
  const montant = montantCentimes / 100;
  switch (range) {
    case '0-50': return montant >= 0 && montant <= 50;
    case '50-100': return montant > 50 && montant <= 100;
    case '100-200': return montant > 100 && montant <= 200;
    case '200-500': return montant > 200 && montant <= 500;
    case '500+': return montant > 500;
    default: return true;
  }
};

/** Export CSV generique */
export const exportToCSV = (data: Record<string, unknown>[], filename: string, headers: string[]) => {
  const csvContent = [
    headers.join(';'),
    ...data.map(row => headers.map(h => {
      const value = row[h.toLowerCase().replace(/ /g, '_')] ?? '';
      return typeof value === 'string' && value.includes(';') ? `"${value}"` : value;
    }).join(';'))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(objectUrl);
};
