import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, comptaApi, type Invoice, type Expense, type ComptaStats, type TVAData, type RelanceFacture, type RelanceStats, type RelanceSettings, type CompteResultatResponse, type BilanResponse } from '@/lib/api';
import {
  Euro,
  TrendingUp,
  TrendingDown,
  FileText,
  Plus,
  X,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  CheckCircle,
  Printer,
  Mail,
  Eye,
  RefreshCw,
  ChevronDown,
  Filter,
  Download,
  FileSpreadsheet,
  Upload,
  Sparkles,
  Bell,
  AlertTriangle,
  Scale,
  Clock,
  Send,
  History,
  Gavel,
  Settings,
  Save,
  BarChart3,
  Wallet,
  FilePlus
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { EntityLink } from '@/components/EntityLink';

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  generee: { label: 'Confirmée', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  envoyee: { label: 'Envoyée', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  payee: { label: 'Payée', color: 'bg-green-50 text-green-700 border-green-200' },
  annulee: { label: 'Annulée', color: 'bg-gray-100 text-gray-500 border-gray-200 line-through' },
};

const EXPENSE_CATEGORIES: Record<string, string> = {
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

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

// Liste des années disponibles
const AVAILABLE_YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

export default function Comptabilite() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'expenses' | 'tva' | 'relances' | 'resultat' | 'bilan'>('overview');
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);
  const [showExpensePaymentModal, setShowExpensePaymentModal] = useState(false);
  const [pendingExpenseId, setPendingExpenseId] = useState<number | null>(null);
  const [expensePaymentMode, setExpensePaymentMode] = useState('cb');
  // Invoice payment modal
  const [showInvoicePaymentModal, setShowInvoicePaymentModal] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<number | null>(null);
  const [invoicePaymentMode, setInvoicePaymentMode] = useState<'especes' | 'cb' | 'virement' | 'prelevement' | 'cheque'>('cb');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isUploadingExpense, setIsUploadingExpense] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRelanceSettings, setShowRelanceSettings] = useState(false);
  const [relanceDelays, setRelanceDelays] = useState({
    r1: -7, // 7 jours avant
    r2: 0,  // jour d'échéance
    r3: 7,  // +7 jours
    r4: 15, // +15 jours
    r5: 21, // +21 jours (mise en demeure)
    contentieux: 30 // +30 jours
  });

  // Période globale pour tous les KPIs
  const [statsPeriod, setStatsPeriod] = useState<'jour' | 'mois' | 'annee'>('mois');
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState<number>(new Date().getMonth() + 1);
  const [statsDay, setStatsDay] = useState<number>(new Date().getDate());

  // Filtres factures (dans les en-têtes)
  const [invoiceNumeroFilter, setInvoiceNumeroFilter] = useState<string>('all');
  const [invoiceClientFilter, setInvoiceClientFilter] = useState<string>('all');
  const [invoiceServiceFilter, setInvoiceServiceFilter] = useState<string>('all');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState<string>('all');
  const [invoiceMontantFilter, setInvoiceMontantFilter] = useState<string>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');

  // Filtres dépenses (dans les en-têtes)
  const [expenseDateFilter, setExpenseDateFilter] = useState<string>('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [expenseDescFilter, setExpenseDescFilter] = useState<string>('all');
  const [expenseMontantFilter, setExpenseMontantFilter] = useState<string>('all');
  const [expensePayeeFilter, setExpensePayeeFilter] = useState<string>('all');
  const [expenseTVAFilter, setExpenseTVAFilter] = useState<string>('all');

  // Filtres relances
  const [relancesPeriod, setRelancesPeriod] = useState<'jour' | 'mois' | 'annee' | 'all'>('all');
  const [relancesYear, setRelancesYear] = useState<number>(new Date().getFullYear());
  const [relancesMonth, setRelancesMonth] = useState<number>(new Date().getMonth() + 1);
  const [relancesDay, setRelancesDay] = useState<number>(new Date().getDate());
  const [relanceNumeroFilter, setRelanceNumeroFilter] = useState<string>('all');
  const [relanceClientFilter, setRelanceClientFilter] = useState<string>('all');
  const [relanceMontantFilter, setRelanceMontantFilter] = useState<string>('all');
  const [relanceEcheanceFilter, setRelanceEcheanceFilter] = useState<string>('all');
  const [relanceRetardFilter, setRelanceRetardFilter] = useState<string>('all');
  const [relanceNiveauFilter, setRelanceNiveauFilter] = useState<string>('all');



  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // État pour la régénération des écritures

  // État pour la période TVA
  const [tvaPeriode, setTvaPeriode] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Queries - toujours charger les données
  const { data: invoicesData, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => comptaApi.getFactures(),
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: comptaApi.getDepenses,
  });

  const { data: tvaData, isLoading: tvaLoading } = useQuery<TVAData>({
    queryKey: ['tva', tvaPeriode],
    queryFn: () => comptaApi.getTVA(tvaPeriode),
    enabled: activeTab === 'tva',
  });

  const { data: relancesData, isLoading: relancesLoading } = useQuery<{ success: boolean; factures: RelanceFacture[]; stats: RelanceStats }>({
    queryKey: ['relances'],
    queryFn: () => comptaApi.getRelances(),
    enabled: activeTab === 'relances',
  });

  // Query pour les settings de relance
  const { data: relanceSettingsData } = useQuery<{ success: boolean; settings: RelanceSettings }>({
    queryKey: ['relance-settings'],
    queryFn: () => comptaApi.getRelanceSettings(),
    enabled: activeTab === 'relances',
  });


  // Query pour les journaux comptables

  // Query pour les écritures du journal sélectionné

  // Documents Comptables - Interface unifiée

  // Query pour le Grand Livre (avec filtre compte optionnel)

  // Query pour la Balance Générale (avec sous-comptes)




  // Query pour la Balance Âgée

  // Paramètres de période pour les requêtes comptables
  const comptaPeriodeParams = useMemo(() => {
    if (statsPeriod === 'jour') {
      // Mode jour: filtre jusqu'à cette date
      const date_fin = `${statsYear}-${String(statsMonth).padStart(2, '0')}-${String(statsDay).padStart(2, '0')}`;
      return { exercice: statsYear, date_fin };
    } else if (statsPeriod === 'mois') {
      // Mode mois: filtre jusqu'à fin du mois
      const periode = `${statsYear}-${String(statsMonth).padStart(2, '0')}`;
      return { exercice: statsYear, periode };
    } else {
      // Mode année: tout l'exercice
      return { exercice: statsYear };
    }
  }, [statsPeriod, statsYear, statsMonth, statsDay]);

  // Query pour le Compte de Résultat
  const { data: compteResultatData, isLoading: compteResultatLoading } = useQuery<CompteResultatResponse>({
    queryKey: ['compte-resultat', comptaPeriodeParams],
    queryFn: () => comptaApi.getCompteResultat(comptaPeriodeParams),
    enabled: activeTab === 'resultat',
  });

  // Query pour le Bilan
  const { data: bilanData, isLoading: bilanLoading } = useQuery<BilanResponse>({
    queryKey: ['bilan', comptaPeriodeParams],
    queryFn: () => comptaApi.getBilan(comptaPeriodeParams),
    enabled: activeTab === 'bilan',
  });

  // Effect pour mettre à jour les délais quand les settings sont chargés
  useEffect(() => {
    if (relanceSettingsData?.settings) {
      setRelanceDelays(relanceSettingsData.settings);
    }
  }, [relanceSettingsData]);

  // Mutation pour synchroniser les factures
  const syncMutation = useMutation({
    mutationFn: () => comptaApi.syncFactures(),
    onSuccess: (data: { nb_creees?: number; nb_mises_a_jour?: number; nb_echecs?: number; total_reservations?: number }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      const nbEchecs = data.nb_echecs || 0;
      const message = nbEchecs > 0
        ? `${data.nb_creees || 0} créée(s), ${data.nb_mises_a_jour || 0} mise(s) à jour, ${nbEchecs} échec(s)`
        : `${data.nb_creees || 0} facture(s) créée(s), ${data.nb_mises_a_jour || 0} mise(s) à jour (${data.total_reservations} réservations)`;
      setNotification({
        type: nbEchecs > 0 ? 'error' : 'success',
        message
      });
      setTimeout(() => setNotification(null), 8000);
    },
    onError: (err: Error) => {
      setNotification({
        type: 'error',
        message: `Erreur: ${err.message}`
      });
      setTimeout(() => setNotification(null), 8000);
    }
  });

  // Mutation pour envoyer une facture
  const sendInvoiceMutation = useMutation({
    mutationFn: (id: number) => comptaApi.sendFacture(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoice(null);
    },
  });

  // Mutation pour changer le statut
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, statut, mode_paiement }: { id: number; statut: string; mode_paiement?: string }) =>
      comptaApi.updateFactureStatut(id, statut, mode_paiement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoice(null);
    },
  });

  // Mutation pour envoi global par mail
  const sendAllMutation = useMutation({
    mutationFn: () => comptaApi.sendAllFactures(),
    onSuccess: (data: { nb_envoyees?: number }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setNotification({
        type: 'success',
        message: `${data.nb_envoyees || 0} facture(s) envoyée(s) par email`
      });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (err: Error) => {
      setNotification({
        type: 'error',
        message: `Erreur: ${err.message}`
      });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  // Mutations pour les relances
  const envoyerRelanceMutation = useMutation({
    mutationFn: ({ factureId, niveau }: { factureId: number; niveau: number }) =>
      comptaApi.envoyerRelance(factureId, niveau),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['relances'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setNotification({ type: 'success', message: data.message || 'Relance envoyée' });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (err: Error) => {
      setNotification({ type: 'error', message: err.message });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  const marquerPayeeMutation = useMutation({
    mutationFn: (factureId: number) => comptaApi.marquerPayee(factureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relances'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setNotification({ type: 'success', message: 'Facture marquée comme payée' });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  // Nouvelle mutation pour enregistrer un paiement avec mode de paiement
  const enregistrerPaiementMutation = useMutation({
    mutationFn: ({ factureId, mode_paiement }: { factureId: number; mode_paiement: 'especes' | 'cb' | 'virement' | 'prelevement' | 'cheque' }) =>
      comptaApi.enregistrerPaiement(factureId, { mode_paiement }),
    onSuccess: (data: { success: boolean; facture: Invoice; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ['relances'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setNotification({ type: 'success', message: data.message || 'Paiement enregistré' });
      setTimeout(() => setNotification(null), 5000);
      setShowInvoicePaymentModal(false);
      setPendingInvoiceId(null);
    },
    onError: (err: Error) => {
      setNotification({ type: 'error', message: err.message });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  const marquerDepensePayeeMutation = useMutation({
    mutationFn: ({ id, payee, mode_paiement }: { id: number; payee: boolean; mode_paiement?: string }) =>
      comptaApi.marquerDepensePayee(id, payee, mode_paiement),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setNotification({ type: 'success', message: variables.payee ? 'Dépense marquée comme payée' : 'Dépense marquée non payée' });
      setTimeout(() => setNotification(null), 5000);
      setShowExpensePaymentModal(false);
      setPendingExpenseId(null);
    },
    onError: (err: Error) => {
      setNotification({ type: 'error', message: err.message });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  const transmettreContentieuxMutation = useMutation({
    mutationFn: ({ factureId, service }: { factureId: number; service: 'interne' | 'huissier' }) =>
      comptaApi.transmettreContentieux(factureId, service),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['relances'] });
      setNotification({ type: 'success', message: data.message || 'Dossier transmis au contentieux' });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (err: Error) => {
      setNotification({ type: 'error', message: err.message });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  const saveRelanceSettingsMutation = useMutation({
    mutationFn: (settings: RelanceSettings) => comptaApi.saveRelanceSettings(settings),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['relance-settings'] });
      setShowRelanceSettings(false);
      setNotification({ type: 'success', message: data.message || 'Délais de relance mis à jour' });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (err: Error) => {
      setNotification({ type: 'error', message: err.message });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  // Mutation pour pointer les écritures

  // Fonctions d'export
  const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  const exportToCSV = (data: Record<string, unknown>[], filename: string, headers: string[]) => {
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

  const exportFacturesToExcel = () => {
    const factures = invoicesData?.factures || [];
    const data = factures.map(f => ({
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

  const exportDepensesToExcel = () => {
    const depenses = expensesData?.depenses || [];
    const data = depenses.map(d => ({
      date: d.date_depense,
      categorie: EXPENSE_CATEGORIES[d.categorie] || d.categorie,
      description: d.description || d.libelle,
      montant: ((d.montant || 0) / 100).toFixed(2),
      tva: ((d.montant_tva || 0) / 100).toFixed(2)
    }));
    exportToCSV(data, 'depenses', ['Date', 'Categorie', 'Description', 'Montant', 'TVA']);
  };

  const exportTVAToExcel = () => {
    if (!tvaData?.tva) return;
    const tva = tvaData.tva;
    const tvaAPayer = (tva.collectee?.tva || 0) - (tva.deductible?.tva || 0);
    const data = [
      { type: 'TVA Collectée', base_ht: tva.collectee?.base_ht_euros || '0.00', montant: tva.collectee?.tva_euros || '0.00' },
      { type: 'TVA Déductible', base_ht: tva.deductible?.base_ht_euros || '0.00', montant: tva.deductible?.tva_euros || '0.00' },
      { type: 'TVA à Payer', base_ht: '-', montant: (tvaAPayer / 100).toFixed(2) }
    ];
    exportToCSV(data, 'tva', ['Type', 'Base HT', 'Montant']);
  };



  const exportCompteResultat = () => {
    if (!compteResultatData) {
      setNotification({ type: 'error', message: 'Données non disponibles' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const data: { poste: string; montant: string }[] = [
      { poste: 'PRODUITS D\'EXPLOITATION', montant: '' },
      ...compteResultatData.produits.exploitation.map(c => ({
        poste: `${c.numero} - ${c.libelle}`,
        montant: formatCurrency(c.montant)
      })),
      { poste: 'Total Produits d\'exploitation', montant: formatCurrency(compteResultatData.totaux.produits.exploitation) },
      { poste: '', montant: '' },
      { poste: 'CHARGES D\'EXPLOITATION', montant: '' },
      ...compteResultatData.charges.exploitation.map(c => ({
        poste: `${c.numero} - ${c.libelle}`,
        montant: formatCurrency(c.montant)
      })),
      { poste: 'Total Charges d\'exploitation', montant: formatCurrency(compteResultatData.totaux.charges.exploitation) },
    ];

    if (compteResultatData.charges.financieres.length > 0) {
      data.push({ poste: '', montant: '' });
      data.push({ poste: 'CHARGES FINANCIERES', montant: '' });
      compteResultatData.charges.financieres.forEach(c => {
        data.push({ poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.montant) });
      });
      data.push({ poste: 'Total Charges financières', montant: formatCurrency(compteResultatData.totaux.charges.financieres) });
    }

    data.push({ poste: '', montant: '' });
    data.push({ poste: 'RÉSULTAT D\'EXPLOITATION', montant: formatCurrency(compteResultatData.totaux.resultats.exploitation) });
    data.push({ poste: 'RÉSULTAT NET', montant: formatCurrency(compteResultatData.totaux.resultats.net) });

    exportToCSV(data, 'compte_resultat', ['Poste', 'Montant']);
    setNotification({ type: 'success', message: 'Compte de résultat exporté' });
    setTimeout(() => setNotification(null), 3000);
  };

  const exportBilan = () => {
    if (!bilanData) {
      setNotification({ type: 'error', message: 'Données non disponibles' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const data: { categorie: string; poste: string; montant: string }[] = [
      { categorie: 'ACTIF', poste: '', montant: '' },
    ];

    if (bilanData.actif.immobilisations.length > 0) {
      bilanData.actif.immobilisations.forEach(c => {
        data.push({ categorie: 'Actif immobilisé', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.actif.stocks.length > 0) {
      bilanData.actif.stocks.forEach(c => {
        data.push({ categorie: 'Stocks', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.actif.creances.length > 0) {
      bilanData.actif.creances.forEach(c => {
        data.push({ categorie: 'Créances', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.actif.tresorerie.length > 0) {
      bilanData.actif.tresorerie.forEach(c => {
        data.push({ categorie: 'Trésorerie', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    data.push({ categorie: '', poste: 'TOTAL ACTIF', montant: formatCurrency(bilanData.totaux.actif) });
    data.push({ categorie: '', poste: '', montant: '' });
    data.push({ categorie: 'PASSIF', poste: '', montant: '' });

    if (bilanData.passif.capitaux.length > 0) {
      bilanData.passif.capitaux.forEach(c => {
        data.push({ categorie: 'Capitaux propres', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.passif.dettes.length > 0) {
      bilanData.passif.dettes.forEach(c => {
        data.push({ categorie: 'Dettes', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    if (bilanData.passif.decouvertsBancaires && bilanData.passif.decouvertsBancaires.length > 0) {
      bilanData.passif.decouvertsBancaires.forEach(c => {
        data.push({ categorie: 'Dettes financières', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    data.push({ categorie: '', poste: 'TOTAL PASSIF', montant: formatCurrency(bilanData.totaux.passif) });

    exportToCSV(data, 'bilan', ['Categorie', 'Poste', 'Montant']);
    setNotification({ type: 'success', message: 'Bilan exporté' });
    setTimeout(() => setNotification(null), 3000);
  };

  // Upload et analyse de facture de dépense avec IA
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
        setNotification({
          type: 'success',
          message: `Dépense créée: ${result.extracted?.fournisseur || result.depense?.libelle || 'Facture importée'} - ${result.extracted?.montant_ttc_euros || ((result.depense?.montant_ttc ?? 0) / 100).toFixed(2)}€`
        });
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Erreur lors de l\'analyse de la facture'
        });
      }
    } catch (error) {
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de l\'upload'
      });
    } finally {
      setIsUploadingExpense(false);
      // Reset input pour permettre de réuploader le même fichier
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Fonction pour vérifier si une date correspond à la période sélectionnée
  const matchesPeriod = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    if (statsPeriod === 'jour') {
      return date.getFullYear() === statsYear &&
             date.getMonth() + 1 === statsMonth &&
             date.getDate() === statsDay;
    } else if (statsPeriod === 'mois') {
      return date.getFullYear() === statsYear && date.getMonth() + 1 === statsMonth;
    } else {
      return date.getFullYear() === statsYear;
    }
  };

  // Calculs des KPIs selon la période
  const kpis = useMemo(() => {
    const factures = invoicesData?.factures || [];
    const depenses = expensesData?.depenses || [];

    // Factures de la période (hors annulées)
    const facturesPeriode = factures.filter(f => matchesPeriod(f.date_facture) && f.statut !== 'annulee');

    // CA = toutes les factures HT (hors annulées)
    const ca = facturesPeriode.reduce((sum, f) => sum + (f.montant_ht || 0), 0) / 100;

    // Dépenses de la période
    const depensesPeriode = depenses.filter(d => matchesPeriod(d.date_depense));
    const totalDepenses = depensesPeriode.reduce((sum, d) => sum + (d.montant || 0), 0) / 100;

    // Bénéfice
    const benefice = ca - totalDepenses;

    // Factures impayées de la période (hors brouillon et annulée)
    const impayees = facturesPeriode.filter(
      f => f.statut !== 'payee' && f.statut !== 'annulee' && f.statut !== 'brouillon'
    );
    const montantImpaye = impayees.reduce((sum, f) => sum + (f.montant_ttc || 0), 0) / 100;

    return { ca, totalDepenses, benefice, montantImpaye, nbImpayees: impayees.length };
  }, [invoicesData, expensesData, statsPeriod, statsYear, statsMonth, statsDay]);











  // Options de filtres pour factures (valeurs uniques)
  const invoiceFilterOptions = useMemo(() => {
    const factures = invoicesData?.factures || [];
    const numeros = [...new Set(factures.map(f => f.numero).filter((v): v is string => Boolean(v)))].sort();
    const clients = [...new Set(factures.map(f => f.client_nom).filter((v): v is string => Boolean(v)))].sort();
    const services = [...new Set(factures.map(f => f.service_nom).filter((v): v is string => Boolean(v)))].sort();
    const dates = [...new Set(factures.map(f => f.date_facture?.slice(0, 7)).filter((v): v is string => Boolean(v)))].sort().reverse();
    return { numeros, clients, services, dates };
  }, [invoicesData]);

  // Options de filtres pour dépenses (valeurs uniques)
  const expenseFilterOptions = useMemo(() => {
    const depenses = expensesData?.depenses || [];
    const dates = [...new Set(depenses.map(d => d.date_depense?.slice(0, 7)).filter((d): d is string => Boolean(d)))].sort().reverse();
    const descriptions = [...new Set(depenses.map(d => d.libelle || d.description).filter((d): d is string => Boolean(d)))].sort();
    const montants = [...new Set(depenses.map(d => d.montant))].sort((a, b) => a - b);
    return { dates, descriptions, montants };
  }, [expensesData]);

  // Helper pour filtrer par tranche de montant
  const matchesMontantRange = (montantCentimes: number, range: string): boolean => {
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

  // Filtrer les factures
  const filteredInvoices = useMemo(() => {
    return (invoicesData?.factures || []).filter(invoice => {
      if (invoiceNumeroFilter !== 'all' && invoice.numero !== invoiceNumeroFilter) return false;
      if (invoiceClientFilter !== 'all' && invoice.client_nom !== invoiceClientFilter) return false;
      if (invoiceServiceFilter !== 'all' && invoice.service_nom !== invoiceServiceFilter) return false;
      if (invoiceDateFilter !== 'all' && invoice.date_facture?.slice(0, 7) !== invoiceDateFilter) return false;
      if (!matchesMontantRange(invoice.montant_ttc || 0, invoiceMontantFilter)) return false;
      if (invoiceStatusFilter !== 'all' && invoice.statut !== invoiceStatusFilter) return false;
      return true;
    });
  }, [invoicesData, invoiceNumeroFilter, invoiceClientFilter, invoiceServiceFilter, invoiceDateFilter, invoiceMontantFilter, invoiceStatusFilter]);

  // Filtrer les dépenses
  const filteredExpenses = useMemo(() => {
    return (expensesData?.depenses || []).filter(expense => {
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
  }, [expensesData, expenseDateFilter, expenseCategoryFilter, expenseDescFilter, expenseMontantFilter, expensePayeeFilter, expenseTVAFilter]);

  // Filtrer les relances
  const filteredRelances = useMemo(() => {
    const relances = relancesData?.factures || [];

    // Fonction de matching période pour relances
    const matchesRelancesPeriod = (dateStr: string | null | undefined) => {
      if (relancesPeriod === 'all') return true;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;

      if (relancesPeriod === 'jour') {
        return date.getFullYear() === relancesYear &&
               date.getMonth() + 1 === relancesMonth &&
               date.getDate() === relancesDay;
      } else if (relancesPeriod === 'mois') {
        return date.getFullYear() === relancesYear && date.getMonth() + 1 === relancesMonth;
      } else {
        return date.getFullYear() === relancesYear;
      }
    };

    // Fonction pour matcher le retard
    const matchesRetard = (joursRetard: number, filter: string) => {
      switch (filter) {
        case 'all': return true;
        case 'avenir': return joursRetard < 0;
        case 'aujourdhui': return joursRetard === 0;
        case '1-7': return joursRetard >= 1 && joursRetard <= 7;
        case '8-15': return joursRetard >= 8 && joursRetard <= 15;
        case '16-30': return joursRetard >= 16 && joursRetard <= 30;
        case '30+': return joursRetard > 30;
        default: return true;
      }
    };

    return relances.filter(facture => {
      // Filtre période (basé sur date_echeance)
      if (!matchesRelancesPeriod(facture.date_echeance)) return false;
      // Filtre numéro
      if (relanceNumeroFilter !== 'all' && facture.numero !== relanceNumeroFilter) return false;
      // Filtre client
      if (relanceClientFilter !== 'all' && facture.client_nom !== relanceClientFilter) return false;
      // Filtre montant
      if (!matchesMontantRange(facture.montant_ttc || 0, relanceMontantFilter)) return false;
      // Filtre échéance (mois)
      if (relanceEcheanceFilter !== 'all' && facture.date_echeance?.slice(0, 7) !== relanceEcheanceFilter) return false;
      // Filtre retard
      if (!matchesRetard(facture.jours_retard || 0, relanceRetardFilter)) return false;
      // Filtre niveau
      if (relanceNiveauFilter !== 'all' && String(facture.niveau_relance) !== relanceNiveauFilter) return false;
      return true;
    });
  }, [relancesData, relancesPeriod, relancesYear, relancesMonth, relancesDay, relanceNumeroFilter, relanceClientFilter, relanceMontantFilter, relanceEcheanceFilter, relanceRetardFilter, relanceNiveauFilter]);

  // Stats filtrées pour relances
  const filteredRelancesStats = useMemo(() => {
    const stats = {
      total: filteredRelances.length,
      montant: filteredRelances.reduce((sum, f) => sum + (f.montant_ttc || 0), 0) / 100
    };
    return stats;
  }, [filteredRelances]);

  // Fonction pour imprimer une facture (safe: utilise DOMParser + srcdoc au lieu de document.write)
  const handlePrintInvoice = async (invoiceId: number) => {
    try {
      const response = await comptaApi.getFacturePDF(invoiceId);
      if (response.success && response.html) {
        // Sanitize: parse le HTML pour éliminer les scripts injectés
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
      setNotification({ type: 'error', message: 'Erreur lors de l\'impression' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) return '-';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Données pour le pie chart des dépenses
  const pieData = useMemo(() => {
    const byCategory = (expensesData?.depenses || []).reduce((acc, exp) => {
      acc[exp.categorie] = (acc[exp.categorie] || 0) + exp.montant;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(byCategory).map(([name, value]) => ({ name, value: value / 100 }));
  }, [expensesData]);

  // Label de la période
  const periodLabel = statsPeriod === 'jour'
    ? `${statsDay}/${statsMonth}/${statsYear}`
    : statsPeriod === 'mois'
      ? `${String(statsMonth).padStart(2, '0')}/${statsYear}`
      : String(statsYear);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-sm text-gray-500">Gestion financière</p>
        </div>

        {/* Sélecteur de période global */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-2">
          <select
            value={statsPeriod}
            onChange={(e) => setStatsPeriod(e.target.value as 'jour' | 'mois' | 'annee')}
            className="px-2 py-1 border-0 bg-white rounded text-sm"
          >
            <option value="jour">Jour</option>
            <option value="mois">Mois</option>
            <option value="annee">Année</option>
          </select>

          {/* Sélecteur d'année */}
          <select
            value={statsYear}
            onChange={(e) => setStatsYear(Number(e.target.value))}
            className="px-2 py-1 border-0 bg-white rounded text-sm"
          >
            {AVAILABLE_YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          {/* Sélecteur de mois (si pas année) */}
          {statsPeriod !== 'annee' && (
            <select
              value={statsMonth}
              onChange={(e) => setStatsMonth(Number(e.target.value))}
              className="px-2 py-1 border-0 bg-white rounded text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleDateString('fr-FR', { month: 'short' })}
                </option>
              ))}
            </select>
          )}

          {/* Sélecteur de jour (si jour) */}
          {statsPeriod === 'jour' && (
            <select
              value={statsDay}
              onChange={(e) => setStatsDay(Number(e.target.value))}
              className="px-2 py-1 border-0 bg-white rounded text-sm"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CA */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">CA ({periodLabel})</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {invoicesLoading ? '...' : formatCurrency(kpis.ca)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dépenses */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Dépenses ({periodLabel})</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {expensesLoading ? '...' : formatCurrency(kpis.totalDepenses)}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bénéfice */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Bénéfice ({periodLabel})</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    kpis.benefice >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {invoicesLoading || expensesLoading ? '...' : formatCurrency(kpis.benefice)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Euro className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Factures impayées */}
          <Card className="relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('invoices')}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Impayées ({periodLabel})</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {invoicesLoading ? '...' : formatCurrency(kpis.montantImpaye)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {kpis.nbImpayees} facture{kpis.nbImpayees > 1 ? 's' : ''}
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
        <div className="flex gap-1 border-b overflow-x-auto">
          {/* Onglets principaux */}
          {(['overview', 'invoices', 'expenses', 'tva', 'relances'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tab
                  ? 'border-cyan-500 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
                tab === 'relances' && kpis.nbImpayees > 0 && 'relative'
              )}
            >
              {tab === 'overview' && 'Vue d\'ensemble'}
              {tab === 'invoices' && 'Factures'}
              {tab === 'expenses' && 'Dépenses'}
              {tab === 'tva' && 'Calcul TVA'}
              {tab === 'relances' && (
                <>
                  Relances
                  {kpis.nbImpayees > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded-full">
                      {kpis.nbImpayees}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}

          {/* Séparateur */}
          <div className="border-l border-gray-200 mx-2 my-1" />

          {/* Onglets comptabilité avancée */}
          {(['resultat', 'bilan'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5',
                activeTab === tab
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab === 'resultat' && <><BarChart3 className="h-3.5 w-3.5" /> Compte de résultat</>}
              {tab === 'bilan' && <><Wallet className="h-3.5 w-3.5" /> Bilan</>}
            </button>
          ))}
        </div>

        {/* Notification */}
        {notification && (
          <div className={cn(
            "p-3 rounded-lg flex items-center gap-2",
            notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          )}>
            {notification.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {notification.message}
            <Button variant="ghost" size="sm" onClick={() => setNotification(null)} className="ml-auto h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  {(!invoicesData?.factures || invoicesData.factures.length === 0) && (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune facture</p>
                  )}
                </div>
              </CardContent>
            </Card>

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
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {filteredInvoices.length} facture{filteredInvoices.length > 1 ? 's' : ''}
                {(invoiceNumeroFilter !== 'all' || invoiceClientFilter !== 'all' || invoiceServiceFilter !== 'all' || invoiceDateFilter !== 'all' || invoiceMontantFilter !== 'all' || invoiceStatusFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setInvoiceNumeroFilter('all');
                      setInvoiceClientFilter('all');
                      setInvoiceServiceFilter('all');
                      setInvoiceDateFilter('all');
                      setInvoiceMontantFilter('all');
                      setInvoiceStatusFilter('all');
                    }}
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
                {invoicesLoading ? (
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
                              {invoiceNumeroFilter !== 'all' || invoiceClientFilter !== 'all' || invoiceServiceFilter !== 'all' || invoiceDateFilter !== 'all' || invoiceStatusFilter !== 'all'
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
          </>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''}
                {(expenseDateFilter !== 'all' || expenseCategoryFilter !== 'all' || expenseDescFilter !== 'all' || expenseMontantFilter !== 'all' || expensePayeeFilter !== 'all' || expenseTVAFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExpenseDateFilter('all');
                      setExpenseCategoryFilter('all');
                      setExpenseDescFilter('all');
                      setExpenseMontantFilter('all');
                      setExpensePayeeFilter('all');
                      setExpenseTVAFilter('all');
                    }}
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
                {expensesLoading ? (
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
          </>
        )}

        {/* TVA Tab */}
        {activeTab === 'tva' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-600">Période :</label>
                <select
                  value={tvaPeriode}
                  onChange={(e) => setTvaPeriode(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {(() => {
                    const options = [];
                    const now = new Date();
                    for (let i = -6; i < 24; i++) {
                      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                      options.push(<option key={value} value={value}>{label}</option>);
                    }
                    return options;
                  })()}
                </select>
              </div>
              <Button
                variant="outline"
                onClick={exportTVAToExcel}
                className="gap-2"
                disabled={!tvaData}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </Button>
            </div>
            {tvaLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
              </div>
            ) : tvaData?.tva ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <ArrowUpRight className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">TVA Collectée</p>
                          <p className="text-xs text-gray-400">(sur ventes)</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{tvaData.tva.collectee.tva_euros} €</p>
                      <p className="text-sm text-gray-500 mt-1">Base HT: {tvaData.tva.collectee.base_ht_euros} €</p>
                      <p className="text-xs text-gray-400">{tvaData.tva.collectee.nb_operations} opération(s)</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <ArrowDownRight className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">TVA Déductible</p>
                          <p className="text-xs text-gray-400">(sur achats)</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{tvaData.tva.deductible.tva_euros} €</p>
                      <p className="text-sm text-gray-500 mt-1">Base HT: {tvaData.tva.deductible.base_ht_euros} €</p>
                      <p className="text-xs text-gray-400">{tvaData.tva.deductible.nb_operations} opération(s)</p>
                    </CardContent>
                  </Card>

                  <Card className={tvaData.tva.solde.a_payer ? 'border-orange-200' : 'border-green-200'}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn("p-2 rounded-lg", tvaData.tva.solde.a_payer ? 'bg-orange-100' : 'bg-green-100')}>
                          <Calculator className={cn("h-5 w-5", tvaData.tva.solde.a_payer ? 'text-orange-600' : 'text-green-600')} />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">{tvaData.tva.solde.a_payer ? 'TVA à payer' : 'Crédit TVA'}</p>
                          <p className="text-xs text-gray-400">Solde du mois</p>
                        </div>
                      </div>
                      <p className={cn("text-2xl font-bold", tvaData.tva.solde.a_payer ? 'text-orange-600' : 'text-green-600')}>
                        {tvaData.tva.solde.montant_euros} €
                      </p>
                      <Badge className={cn("mt-2", tvaData.tva.solde.a_payer ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}>
                        {tvaData.tva.solde.a_payer ? 'À déclarer' : 'Report possible'}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        Détail TVA Collectée
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {tvaData.tva.collectee.detail_par_taux.length > 0 ? (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 text-sm text-gray-600">Taux</th>
                              <th className="text-right py-2 text-sm text-gray-600">Base HT</th>
                              <th className="text-right py-2 text-sm text-gray-600">TVA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tvaData.tva.collectee.detail_par_taux.map((item, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="py-2"><Badge variant="outline">{item.taux}%</Badge></td>
                                <td className="py-2 text-right text-sm">{item.base_ht_euros} €</td>
                                <td className="py-2 text-right font-medium text-green-600">{item.tva_euros} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">Aucune vente ce mois</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-blue-600" />
                        Détail TVA Déductible
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {tvaData.tva.deductible.detail_par_taux.length > 0 ? (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 text-sm text-gray-600">Taux</th>
                              <th className="text-right py-2 text-sm text-gray-600">Base HT</th>
                              <th className="text-right py-2 text-sm text-gray-600">TVA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tvaData.tva.deductible.detail_par_taux.map((item, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="py-2"><Badge variant="outline">{item.taux}%</Badge></td>
                                <td className="py-2 text-right text-sm">{item.base_ht_euros} €</td>
                                <td className="py-2 text-right font-medium text-blue-600">{item.tva_euros} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">Aucune dépense ce mois</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucune donnée TVA disponible</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Relances Tab */}
        {activeTab === 'relances' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { label: 'Total impayées', value: relancesData?.stats?.total_impayees || 0, color: 'gray', icon: FileText },
                { label: 'R1 Préventive', value: relancesData?.stats?.r1_preventive || 0, color: 'blue', icon: Bell },
                { label: 'R2 Échéance', value: relancesData?.stats?.r2_echeance || 0, color: 'cyan', icon: Clock },
                { label: 'R3 +7j', value: relancesData?.stats?.r3_plus7 || 0, color: 'yellow', icon: AlertTriangle },
                { label: 'R4 +15j', value: relancesData?.stats?.r4_plus15 || 0, color: 'orange', icon: AlertTriangle },
                { label: 'R5 Mise en demeure', value: relancesData?.stats?.r5_mise_demeure || 0, color: 'red', icon: Scale },
                { label: 'Contentieux', value: relancesData?.stats?.contentieux || 0, color: 'purple', icon: Gavel },
              ].map((stat, idx) => (
                <Card key={idx} className={cn(
                  "relative overflow-hidden",
                  stat.value > 0 && stat.color !== 'gray' && `ring-2 ring-${stat.color}-200`
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <stat.icon className={cn("h-4 w-4", `text-${stat.color}-500`)} />
                      <span className="text-xs text-gray-500">{stat.label}</span>
                    </div>
                    <p className={cn("text-2xl font-bold", stat.value > 0 ? `text-${stat.color}-600` : 'text-gray-400')}>
                      {stat.value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Montant total impayé - dynamique selon filtres */}
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700">
                      Montant impayé {relancesPeriod !== 'all' || relanceNumeroFilter !== 'all' || relanceClientFilter !== 'all' || relanceMontantFilter !== 'all' || relanceEcheanceFilter !== 'all' || relanceRetardFilter !== 'all' || relanceNiveauFilter !== 'all' ? '(filtré)' : ''}
                    </p>
                    <p className="text-3xl font-bold text-orange-600">
                      {formatCurrency(filteredRelancesStats.montant)}
                    </p>
                    <p className="text-xs text-orange-500 mt-1">
                      {filteredRelancesStats.total} facture{filteredRelancesStats.total > 1 ? 's' : ''}
                    </p>
                  </div>
                  <AlertTriangle className="h-12 w-12 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            {/* Paramètres des relances */}
            <Card className="border-2 border-dashed border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-500" />
                  Paramètres de relance automatique
                </CardTitle>
                <Button
                  variant={showRelanceSettings ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                  onClick={() => setShowRelanceSettings(!showRelanceSettings)}
                >
                  <Settings className="h-3 w-3" />
                  {showRelanceSettings ? 'Masquer' : 'Modifier les délais'}
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {!showRelanceSettings ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span><strong>R1:</strong> {relanceDelays.r1}j {relanceDelays.r1 < 0 ? 'avant' : 'après'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                      <span><strong>R2:</strong> Jour d'échéance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span><strong>R3:</strong> +{relanceDelays.r3}j</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span><strong>R4:</strong> +{relanceDelays.r4}j</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span><strong>R5:</strong> Mise en demeure +{relanceDelays.r5}j</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span><strong>Contentieux:</strong> +{relanceDelays.contentieux}j</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          R1 Préventive
                        </label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={Math.abs(relanceDelays.r1)}
                            onChange={(e) => setRelanceDelays(d => ({ ...d, r1: -Math.abs(parseInt(e.target.value) || 0) }))}
                            className="h-8 w-16 text-center bg-white"
                            min={1}
                            max={30}
                          />
                          <span className="text-xs text-gray-500">j avant</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                          R2 Échéance
                        </label>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-400">Jour J (fixe)</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          R3 1ère relance
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">+</span>
                          <Input
                            type="number"
                            value={relanceDelays.r3}
                            onChange={(e) => setRelanceDelays(d => ({ ...d, r3: parseInt(e.target.value) || 0 }))}
                            className="h-8 w-16 text-center bg-white"
                            min={1}
                            max={30}
                          />
                          <span className="text-xs text-gray-500">jours</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                          R4 2ème relance
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">+</span>
                          <Input
                            type="number"
                            value={relanceDelays.r4}
                            onChange={(e) => setRelanceDelays(d => ({ ...d, r4: parseInt(e.target.value) || 0 }))}
                            className="h-8 w-16 text-center bg-white"
                            min={1}
                            max={60}
                          />
                          <span className="text-xs text-gray-500">jours</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          R5 Mise en demeure
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">+</span>
                          <Input
                            type="number"
                            value={relanceDelays.r5}
                            onChange={(e) => setRelanceDelays(d => ({ ...d, r5: parseInt(e.target.value) || 0 }))}
                            className="h-8 w-16 text-center bg-white"
                            min={1}
                            max={90}
                          />
                          <span className="text-xs text-gray-500">jours</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                          Contentieux
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">+</span>
                          <Input
                            type="number"
                            value={relanceDelays.contentieux}
                            onChange={(e) => setRelanceDelays(d => ({ ...d, contentieux: parseInt(e.target.value) || 0 }))}
                            className="h-8 w-16 text-center bg-white"
                            min={1}
                            max={120}
                          />
                          <span className="text-xs text-gray-500">jours</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                      <Button variant="outline" size="sm" onClick={() => setShowRelanceSettings(false)}>
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={saveRelanceSettingsMutation.isPending}
                        onClick={() => saveRelanceSettingsMutation.mutate(relanceDelays)}
                      >
                        {saveRelanceSettingsMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Liste des factures impayées */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-500" />
                  Factures en relance
                  <span className="text-sm font-normal text-gray-500">
                    ({filteredRelancesStats.total} facture{filteredRelancesStats.total > 1 ? 's' : ''} - {formatCurrency(filteredRelancesStats.montant)})
                  </span>
                </CardTitle>
                {/* Filtres période */}
                <div className="flex items-center gap-2">
                  <select
                    value={relancesPeriod}
                    onChange={(e) => setRelancesPeriod(e.target.value as 'jour' | 'mois' | 'annee' | 'all')}
                    className="text-sm border rounded-md px-2 py-1"
                  >
                    <option value="all">Toutes les échéances</option>
                    <option value="jour">Jour</option>
                    <option value="mois">Mois</option>
                    <option value="annee">Année</option>
                  </select>
                  {relancesPeriod !== 'all' && (
                    <>
                      <select
                        value={relancesYear}
                        onChange={(e) => setRelancesYear(parseInt(e.target.value))}
                        className="text-sm border rounded-md px-2 py-1"
                      >
                        {AVAILABLE_YEARS.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      {(relancesPeriod === 'mois' || relancesPeriod === 'jour') && (
                        <select
                          value={relancesMonth}
                          onChange={(e) => setRelancesMonth(parseInt(e.target.value))}
                          className="text-sm border rounded-md px-2 py-1"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>
                              {new Date(2000, m - 1).toLocaleDateString('fr-FR', { month: 'long' })}
                            </option>
                          ))}
                        </select>
                      )}
                      {relancesPeriod === 'jour' && (
                        <select
                          value={relancesDay}
                          onChange={(e) => setRelancesDay(parseInt(e.target.value))}
                          className="text-sm border rounded-md px-2 py-1"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      )}
                    </>
                  )}
                  {(relancesPeriod !== 'all' || relanceNumeroFilter !== 'all' || relanceClientFilter !== 'all' || relanceMontantFilter !== 'all' || relanceEcheanceFilter !== 'all' || relanceRetardFilter !== 'all' || relanceNiveauFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRelancesPeriod('all');
                        setRelanceNumeroFilter('all');
                        setRelanceClientFilter('all');
                        setRelanceMontantFilter('all');
                        setRelanceEcheanceFilter('all');
                        setRelanceRetardFilter('all');
                        setRelanceNiveauFilter('all');
                      }}
                      className="text-xs text-gray-500"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Effacer filtres
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {relancesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                  </div>
                ) : filteredRelances.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <p className="font-medium">
                      {relancesData?.factures?.length === 0 ? 'Aucune facture impayée' : 'Aucune facture ne correspond aux filtres'}
                    </p>
                    <p className="text-sm">
                      {relancesData?.factures?.length === 0 ? 'Toutes vos factures sont réglées' : 'Modifiez vos critères de recherche'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-2 px-3">
                            <select
                              value={relanceNumeroFilter}
                              onChange={(e) => setRelanceNumeroFilter(e.target.value)}
                              className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                            >
                              <option value="all">Facture ▼</option>
                              {[...new Set((relancesData?.factures || []).map(f => f.numero))].sort().map(num => (
                                <option key={num} value={num}>{num}</option>
                              ))}
                            </select>
                          </th>
                          <th className="text-left py-2 px-3">
                            <select
                              value={relanceClientFilter}
                              onChange={(e) => setRelanceClientFilter(e.target.value)}
                              className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                            >
                              <option value="all">Client ▼</option>
                              {[...new Set((relancesData?.factures || []).map(f => f.client_nom).filter(Boolean))].sort().map(nom => (
                                <option key={nom} value={nom}>{nom}</option>
                              ))}
                            </select>
                          </th>
                          <th className="text-right py-2 px-3">
                            <select
                              value={relanceMontantFilter}
                              onChange={(e) => setRelanceMontantFilter(e.target.value)}
                              className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-right"
                            >
                              <option value="all">Montant ▼</option>
                              <option value="0-50">0 - 50€</option>
                              <option value="50-100">50 - 100€</option>
                              <option value="100-200">100 - 200€</option>
                              <option value="200-500">200 - 500€</option>
                              <option value="500+">500€+</option>
                            </select>
                          </th>
                          <th className="text-center py-2 px-3">
                            <select
                              value={relanceEcheanceFilter}
                              onChange={(e) => setRelanceEcheanceFilter(e.target.value)}
                              className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-center"
                            >
                              <option value="all">Échéance ▼</option>
                              {[...new Set((relancesData?.factures || []).map(f => f.date_echeance?.slice(0, 7)).filter(Boolean))].sort().reverse().map(mois => (
                                <option key={mois} value={mois}>
                                  {new Date(mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                                </option>
                              ))}
                            </select>
                          </th>
                          <th className="text-center py-2 px-3">
                            <select
                              value={relanceRetardFilter}
                              onChange={(e) => setRelanceRetardFilter(e.target.value)}
                              className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-center"
                            >
                              <option value="all">Retard ▼</option>
                              <option value="avenir">À venir</option>
                              <option value="aujourdhui">Aujourd'hui</option>
                              <option value="1-7">1-7 jours</option>
                              <option value="8-15">8-15 jours</option>
                              <option value="16-30">16-30 jours</option>
                              <option value="30+">+30 jours</option>
                            </select>
                          </th>
                          <th className="text-center py-2 px-3">
                            <select
                              value={relanceNiveauFilter}
                              onChange={(e) => setRelanceNiveauFilter(e.target.value)}
                              className="w-full text-sm font-medium text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-center"
                            >
                              <option value="all">Niveau ▼</option>
                              <option value="0">À venir</option>
                              <option value="1">R1 Préventive</option>
                              <option value="2">R2 Échéance</option>
                              <option value="3">R3 +7j</option>
                              <option value="4">R4 +15j</option>
                              <option value="5">R5 Mise en demeure</option>
                              <option value="6">Contentieux</option>
                            </select>
                          </th>
                          <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRelances.map((facture) => {
                          const niveauConfig: Record<number, { label: string; color: string; bg: string }> = {
                            0: { label: 'À venir', color: 'text-gray-600', bg: 'bg-gray-100' },
                            1: { label: 'R1 Préventive', color: 'text-blue-600', bg: 'bg-blue-100' },
                            2: { label: 'R2 Échéance', color: 'text-cyan-600', bg: 'bg-cyan-100' },
                            3: { label: 'R3 +7j', color: 'text-yellow-600', bg: 'bg-yellow-100' },
                            4: { label: 'R4 +15j', color: 'text-orange-600', bg: 'bg-orange-100' },
                            5: { label: 'R5 Mise en demeure', color: 'text-red-600', bg: 'bg-red-100' },
                            6: { label: 'Contentieux', color: 'text-purple-600', bg: 'bg-purple-100' },
                          };
                          const config = niveauConfig[facture.niveau_relance] || niveauConfig[0];

                          return (
                            <tr key={facture.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <span className="font-mono text-sm">{facture.numero}</span>
                              </td>
                              <td className="py-3 px-4">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    <EntityLink
                                      type="client"
                                      entity={{
                                        id: facture.client_id,
                                        nom: facture.client_nom?.split(' ').slice(-1)[0] || '',
                                        prenom: facture.client_nom?.split(' ').slice(0, -1).join(' ') || '',
                                        telephone: facture.client_telephone || ''
                                      }}
                                      label={facture.client_nom || 'Client'}
                                    />
                                  </p>
                                  <p className="text-xs text-gray-500">{facture.client_email}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-medium">
                                {formatCurrency(facture.montant_ttc / 100)}
                              </td>
                              <td className="py-3 px-4 text-center text-sm">
                                {facture.date_echeance ? new Date(facture.date_echeance).toLocaleDateString('fr-FR') : '-'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium",
                                  facture.jours_retard > 21 ? 'bg-red-100 text-red-700' :
                                  facture.jours_retard > 7 ? 'bg-orange-100 text-orange-700' :
                                  facture.jours_retard > 0 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                                )}>
                                  {facture.jours_retard > 0 ? `+${facture.jours_retard}j` : facture.jours_retard < 0 ? `${facture.jours_retard}j` : 'Jour J'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge className={cn(config.bg, config.color, 'border-0')}>
                                  {config.label}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-end gap-2">
                                  {/* Bouton relance */}
                                  {facture.niveau_relance < 5 && !facture.en_contentieux && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1"
                                      onClick={() => envoyerRelanceMutation.mutate({
                                        factureId: facture.id,
                                        niveau: facture.niveau_relance + 1
                                      })}
                                      disabled={envoyerRelanceMutation.isPending}
                                    >
                                      <Send className="h-3 w-3" />
                                      R{facture.niveau_relance + 1}
                                    </Button>
                                  )}

                                  {/* Bouton mise en demeure */}
                                  {facture.niveau_relance === 5 && !facture.en_contentieux && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                      onClick={() => {
                                        if (confirm('Transmettre ce dossier au contentieux ?')) {
                                          transmettreContentieuxMutation.mutate({
                                            factureId: facture.id,
                                            service: 'interne'
                                          });
                                        }
                                      }}
                                      disabled={transmettreContentieuxMutation.isPending}
                                    >
                                      <Gavel className="h-3 w-3" />
                                      Contentieux
                                    </Button>
                                  )}

                                  {/* Bouton enregistrer paiement */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => {
                                      setPendingInvoiceId(facture.id);
                                      setInvoicePaymentMode('cb');
                                      setShowInvoicePaymentModal(true);
                                    }}
                                    disabled={enregistrerPaiementMutation.isPending}
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                    Enregistrer paiement
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}


        {/* Compte de Résultat Tab */}
        {activeTab === 'resultat' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                    Compte de Résultat
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Période : {statsPeriod === 'jour'
                      ? `${statsDay}/${statsMonth}/${statsYear}`
                      : statsPeriod === 'mois'
                        ? `${new Date(statsYear, statsMonth - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
                        : statsYear}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  {/* Sélecteur de période */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                    <select
                      value={statsPeriod}
                      onChange={(e) => setStatsPeriod(e.target.value as 'jour' | 'mois' | 'annee')}
                      className="px-2 py-1 border-0 bg-white rounded text-xs"
                    >
                      <option value="jour">Jour</option>
                      <option value="mois">Mois</option>
                      <option value="annee">Année</option>
                    </select>
                    <select
                      value={statsYear}
                      onChange={(e) => setStatsYear(Number(e.target.value))}
                      className="px-2 py-1 border-0 bg-white rounded text-xs"
                    >
                      {AVAILABLE_YEARS.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    {statsPeriod !== 'annee' && (
                      <select
                        value={statsMonth}
                        onChange={(e) => setStatsMonth(Number(e.target.value))}
                        className="px-2 py-1 border-0 bg-white rounded text-xs"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <option key={month} value={month}>
                            {new Date(2000, month - 1).toLocaleDateString('fr-FR', { month: 'short' })}
                          </option>
                        ))}
                      </select>
                    )}
                    {statsPeriod === 'jour' && (
                      <select
                        value={statsDay}
                        onChange={(e) => setStatsDay(Number(e.target.value))}
                        className="px-2 py-1 border-0 bg-white rounded text-xs"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1" onClick={exportCompteResultat}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {compteResultatLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  </div>
                ) : compteResultatData ? (
                <div className="space-y-6">
                  {/* Produits d'exploitation */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      Produits d'exploitation
                    </h3>
                    <div className="bg-green-50 rounded-lg p-4 space-y-2">
                      {compteResultatData.produits.exploitation.length > 0 ? (
                        compteResultatData.produits.exploitation.map((compte, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{compte.numero} - {compte.libelle}</span>
                            <span className="font-medium">{formatCurrency(compte.montant)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>Aucun produit</span>
                          <span>0,00 €</span>
                        </div>
                      )}
                      <div className="border-t border-green-200 pt-2 mt-2 flex justify-between font-semibold">
                        <span>Total Produits d'exploitation</span>
                        <span className="text-green-700">{formatCurrency(compteResultatData.totaux.produits.exploitation)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Charges d'exploitation */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      Charges d'exploitation
                    </h3>
                    <div className="bg-red-50 rounded-lg p-4 space-y-2">
                      {compteResultatData.charges.exploitation.length > 0 ? (
                        compteResultatData.charges.exploitation.map((compte, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{compte.numero} - {compte.libelle}</span>
                            <span className="font-medium">{formatCurrency(compte.montant)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>Aucune charge</span>
                          <span>0,00 €</span>
                        </div>
                      )}
                      <div className="border-t border-red-200 pt-2 mt-2 flex justify-between font-semibold">
                        <span>Total Charges d'exploitation</span>
                        <span className="text-red-700">{formatCurrency(compteResultatData.totaux.charges.exploitation)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Charges financières (si présentes) */}
                  {compteResultatData.charges.financieres.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                        Charges financières
                      </h3>
                      <div className="bg-orange-50 rounded-lg p-4 space-y-2">
                        {compteResultatData.charges.financieres.map((compte, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{compte.numero} - {compte.libelle}</span>
                            <span className="font-medium">{formatCurrency(compte.montant)}</span>
                          </div>
                        ))}
                        <div className="border-t border-orange-200 pt-2 mt-2 flex justify-between font-semibold">
                          <span>Total Charges financières</span>
                          <span className="text-orange-700">{formatCurrency(compteResultatData.totaux.charges.financieres)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Résultat */}
                  <div className={cn(
                    "rounded-lg p-4",
                    compteResultatData.totaux.resultats.net >= 0 ? "bg-emerald-100" : "bg-red-100"
                  )}>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Résultat d'exploitation</span>
                      <span className={cn(
                        "text-2xl font-bold",
                        compteResultatData.totaux.resultats.exploitation >= 0 ? "text-emerald-700" : "text-red-700"
                      )}>
                        {formatCurrency(compteResultatData.totaux.resultats.exploitation)}
                      </span>
                    </div>
                    {compteResultatData.totaux.charges.financieres !== 0 && (
                      <div className="flex justify-between items-center mt-2 text-sm">
                        <span>Résultat financier</span>
                        <span className={cn(
                          "font-medium",
                          compteResultatData.totaux.resultats.financier >= 0 ? "text-emerald-600" : "text-red-600"
                        )}>
                          {formatCurrency(compteResultatData.totaux.resultats.financier)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between items-center">
                      <span className="text-lg font-semibold">Résultat Net</span>
                      <span className={cn(
                        "text-2xl font-bold",
                        compteResultatData.totaux.resultats.net >= 0 ? "text-emerald-700" : "text-red-700"
                      )}>
                        {formatCurrency(compteResultatData.totaux.resultats.net)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Marge : {compteResultatData.totaux.produits.total > 0
                        ? ((compteResultatData.totaux.resultats.net / compteResultatData.totaux.produits.total) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Aucune donnée comptable pour cette période
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bilan Tab */}
        {activeTab === 'bilan' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-purple-500" />
                    Bilan Comptable
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Au {statsPeriod === 'jour'
                      ? `${statsDay}/${statsMonth}/${statsYear}`
                      : statsPeriod === 'mois'
                        ? `fin ${new Date(statsYear, statsMonth - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
                        : `31/12/${statsYear}`}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  {/* Sélecteur de période */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                    <select
                      value={statsPeriod}
                      onChange={(e) => setStatsPeriod(e.target.value as 'jour' | 'mois' | 'annee')}
                      className="px-2 py-1 border-0 bg-white rounded text-xs"
                    >
                      <option value="jour">Jour</option>
                      <option value="mois">Mois</option>
                      <option value="annee">Année</option>
                    </select>
                    <select
                      value={statsYear}
                      onChange={(e) => setStatsYear(Number(e.target.value))}
                      className="px-2 py-1 border-0 bg-white rounded text-xs"
                    >
                      {AVAILABLE_YEARS.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    {statsPeriod !== 'annee' && (
                      <select
                        value={statsMonth}
                        onChange={(e) => setStatsMonth(Number(e.target.value))}
                        className="px-2 py-1 border-0 bg-white rounded text-xs"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <option key={month} value={month}>
                            {new Date(2000, month - 1).toLocaleDateString('fr-FR', { month: 'short' })}
                          </option>
                        ))}
                      </select>
                    )}
                    {statsPeriod === 'jour' && (
                      <select
                        value={statsDay}
                        onChange={(e) => setStatsDay(Number(e.target.value))}
                        className="px-2 py-1 border-0 bg-white rounded text-xs"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1" onClick={exportBilan}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {bilanLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  </div>
                ) : bilanData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ACTIF */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 text-center bg-blue-100 py-2 rounded-t-lg">
                      ACTIF
                    </h3>
                    <div className="border rounded-b-lg p-4 space-y-4">
                      {/* Actif immobilisé */}
                      {bilanData.actif.immobilisations.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Actif immobilisé</h4>
                          <div className="space-y-1 text-sm pl-4">
                            {bilanData.actif.immobilisations.map((c, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{c.numero} - {c.libelle}</span>
                                <span className="font-medium">{formatCurrency(c.solde)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stocks */}
                      {bilanData.actif.stocks.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Stocks</h4>
                          <div className="space-y-1 text-sm pl-4">
                            {bilanData.actif.stocks.map((c, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{c.numero} - {c.libelle}</span>
                                <span className="font-medium">{formatCurrency(c.solde)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Créances */}
                      {bilanData.actif.creances.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Créances</h4>
                          <div className="space-y-1 text-sm pl-4">
                            {bilanData.actif.creances.map((c, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{c.numero} - {c.libelle}</span>
                                <span className="font-medium text-blue-600">{formatCurrency(c.solde)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Trésorerie */}
                      {bilanData.actif.tresorerie.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Trésorerie</h4>
                          <div className="space-y-1 text-sm pl-4">
                            {bilanData.actif.tresorerie.map((c, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{c.numero} - {c.libelle}</span>
                                <span className="font-medium text-green-600">{formatCurrency(c.solde)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message si aucun actif */}
                      {bilanData.actif.immobilisations.length === 0 &&
                       bilanData.actif.stocks.length === 0 &&
                       bilanData.actif.creances.length === 0 &&
                       bilanData.actif.tresorerie.length === 0 && (
                        <div className="text-sm text-gray-400 text-center py-4">
                          Aucun actif comptabilisé
                        </div>
                      )}

                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total Actif</span>
                        <span className="text-blue-700">{formatCurrency(bilanData.totaux.actif)}</span>
                      </div>
                    </div>
                  </div>

                  {/* PASSIF */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 text-center bg-green-100 py-2 rounded-t-lg">
                      PASSIF
                    </h3>
                    <div className="border rounded-b-lg p-4 space-y-4">
                      {/* Capitaux propres */}
                      {bilanData.passif.capitaux.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Capitaux propres</h4>
                          <div className="space-y-1 text-sm pl-4">
                            {bilanData.passif.capitaux.map((c, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{c.numero} - {c.libelle}</span>
                                <span className={cn(
                                  "font-medium",
                                  c.numero === '120' ? "text-green-600" : c.numero === '129' ? "text-red-600" : ""
                                )}>
                                  {formatCurrency(c.solde)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dettes */}
                      {bilanData.passif.dettes.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Dettes</h4>
                          <div className="space-y-1 text-sm pl-4">
                            {bilanData.passif.dettes.map((c, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{c.numero} - {c.libelle}</span>
                                <span className="font-medium text-orange-600">{formatCurrency(c.solde)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Découverts bancaires */}
                      {bilanData.passif.decouvertsBancaires && bilanData.passif.decouvertsBancaires.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Dettes financières</h4>
                          <div className="space-y-1 text-sm pl-4">
                            {bilanData.passif.decouvertsBancaires.map((c, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{c.numero} - {c.libelle}</span>
                                <span className="font-medium text-red-600">{formatCurrency(c.solde)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message si aucun passif */}
                      {bilanData.passif.capitaux.length === 0 &&
                       bilanData.passif.dettes.length === 0 &&
                       (!bilanData.passif.decouvertsBancaires || bilanData.passif.decouvertsBancaires.length === 0) && (
                        <div className="text-sm text-gray-400 text-center py-4">
                          Aucun passif comptabilisé
                        </div>
                      )}

                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total Passif</span>
                        <span className="text-green-700">{formatCurrency(bilanData.totaux.passif)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Aucune donnée comptable pour cet exercice
                  </div>
                )}

                {/* Indicateur d'équilibre */}
                {bilanData && (
                  <div className={cn(
                    "mt-4 p-3 rounded-lg text-center text-sm font-medium",
                    bilanData.totaux.equilibre ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}>
                    {bilanData.totaux.equilibre
                      ? "Le bilan est équilibré"
                      : `Déséquilibre de ${formatCurrency(Math.abs(bilanData.totaux.actif - bilanData.totaux.passif))}`
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}




      </div>

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
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}

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

      {/* Invoice Payment Modal */}
      {showInvoicePaymentModal && pendingInvoiceId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Enregistrer le paiement</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setShowInvoicePaymentModal(false); setPendingInvoiceId(null); }} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Sélectionnez le mode de paiement pour cette facture.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {MODES_PAIEMENT.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setInvoicePaymentMode(mode.value as 'especes' | 'cb' | 'virement' | 'prelevement' | 'cheque')}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      invoicePaymentMode === mode.value
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{mode.icon}</span>
                    <span className={`text-sm font-medium ${
                      invoicePaymentMode === mode.value ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      {mode.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => { setShowInvoicePaymentModal(false); setPendingInvoiceId(null); }}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => enregistrerPaiementMutation.mutate({ factureId: pendingInvoiceId, mode_paiement: invoicePaymentMode })}
                  disabled={enregistrerPaiementMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                >
                  {enregistrerPaiementMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Confirmer le paiement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Modes de paiement disponibles
const MODES_PAIEMENT = [
  { value: 'cb', label: 'Carte bancaire', icon: '💳' },
  { value: 'especes', label: 'Espèces', icon: '💵' },
  { value: 'virement', label: 'Virement', icon: '🏦' },
  { value: 'cheque', label: 'Chèque', icon: '📝' },
  { value: 'prelevement', label: 'Prélèvement', icon: '🔄' },
];

// Invoice Detail Modal
function InvoiceDetailModal({
  invoice,
  onClose,
  onPrint,
  onSend,
  onUpdateStatus,
  isSending,
  isUpdating,
  formatCurrency,
  formatDate,
}: {
  invoice: Invoice;
  onClose: () => void;
  onPrint: () => void;
  onSend: () => void;
  onUpdateStatus: (statut: string, modePaiement?: string) => void;
  isSending: boolean;
  isUpdating: boolean;
  formatCurrency: (amount: number) => string;
  formatDate: (dateStr: string | null | undefined) => string;
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

// New Expense Modal
function NewExpenseModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    categorie: 'fournitures',
    libelle: '',
    montant: 0,
    date_depense: new Date().toISOString().split('T')[0],
    a_credit: false, // false = comptant, true = crédit
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
                  💵 Comptant
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
                  📋 À crédit
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
