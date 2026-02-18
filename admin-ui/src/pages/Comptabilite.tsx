import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { comptaApi, type Invoice, type Expense, type ComptaStats, type TVAData, type RelanceFacture, type RelanceStats, type RelanceSettings, type EcritureComptable, type Journal } from '@/lib/api';
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
  Landmark,
  BarChart3,
  Wallet,
  UserCheck,
  Link2,
  Building2,
  FilePlus,
  Share2,
  Users
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

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

// Mapping catégories vers comptes comptables
const COMPTE_PAR_CATEGORIE: Record<string, string> = {
  fournitures: '601 - Achats fournitures',
  loyer: '613 - Loyers',
  charges: '606 - Électricité/Eau',
  telecom: '626 - Télécom/Internet',
  assurance: '616 - Assurances',
  transport: '625 - Déplacements',
  marketing: '623 - Publicité',
  bancaire: '627 - Frais bancaires',
  formation: '618 - Formation',
  materiel: '615 - Entretien matériel',
  logiciel: '651 - Abonnements',
  comptabilite: '622 - Honoraires',
  taxes: '635 - Impôts et taxes',
  salaires: '641 - Rémunérations',
  cotisations_sociales: '645 - Charges sociales',
  autre: '658 - Charges diverses'
};

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

// Liste des années disponibles
const AVAILABLE_YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

export default function Comptabilite() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'expenses' | 'tva' | 'relances' | 'rapprochement' | 'resultat' | 'bilan' | 'expert'>('overview');
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);
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
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');

  // Filtres dépenses (dans les en-têtes)
  const [expenseDateFilter, setExpenseDateFilter] = useState<string>('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [expenseDescFilter, setExpenseDescFilter] = useState<string>('all');
  const [expenseMontantFilter, setExpenseMontantFilter] = useState<string>('all');

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // État pour la consultation des journaux comptables
  const [selectedJournal, setSelectedJournal] = useState<string>('BQ');
  const [journalPeriode, setJournalPeriode] = useState<string>(() => {
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
    queryKey: ['tva'],
    queryFn: () => comptaApi.getTVA(),
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

  // Query pour les écritures du journal banque (BQ) pour le rapprochement
  const { data: ecrituresBanqueData, isLoading: ecrituresBanqueLoading, refetch: refetchEcrituresBanque } = useQuery<{ ecritures: EcritureComptable[]; solde_comptable: number }>({
    queryKey: ['ecritures-banque'],
    queryFn: () => comptaApi.getEcrituresBanque(),
    enabled: activeTab === 'rapprochement',
  });

  // Query pour les journaux comptables
  const { data: journauxData } = useQuery<Journal[]>({
    queryKey: ['journaux'],
    queryFn: () => comptaApi.getJournaux(),
    enabled: activeTab === 'expert',
  });

  // Query pour les écritures du journal sélectionné
  const { data: ecrituresJournalData, isLoading: ecrituresJournalLoading } = useQuery<{ ecritures: EcritureComptable[]; totaux: { debit: number; credit: number; solde: number } }>({
    queryKey: ['ecritures-journal', selectedJournal, journalPeriode],
    queryFn: () => comptaApi.getEcritures({ journal: selectedJournal, periode: journalPeriode }),
    enabled: activeTab === 'expert' && !!selectedJournal,
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
    onSuccess: (data: any) => {
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
    mutationFn: ({ id, statut }: { id: number; statut: string }) => comptaApi.updateFactureStatut(id, statut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoice(null);
    },
  });

  // Mutation pour envoi global par mail
  const sendAllMutation = useMutation({
    mutationFn: () => comptaApi.sendAllFactures(),
    onSuccess: (data: any) => {
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
    onSuccess: (data: any) => {
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

  const marquerDepensePayeeMutation = useMutation({
    mutationFn: ({ id, payee }: { id: number; payee: boolean }) => comptaApi.marquerDepensePayee(id, payee),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setNotification({ type: 'success', message: variables.payee ? 'Dépense marquée comme payée' : 'Dépense marquée non payée' });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  const transmettreContentieuxMutation = useMutation({
    mutationFn: ({ factureId, service }: { factureId: number; service: 'interne' | 'huissier' }) =>
      comptaApi.transmettreContentieux(factureId, service),
    onSuccess: (data: any) => {
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
    onSuccess: (data: any) => {
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
  const pointerEcrituresMutation = useMutation({
    mutationFn: ({ ids, lettrage }: { ids: number[]; lettrage?: string }) =>
      comptaApi.pointerEcritures(ids, lettrage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecritures-banque'] });
      setSelectedEcrituresForPointage([]);
      setNotification({ type: 'success', message: 'Écritures pointées avec succès' });
      setTimeout(() => setNotification(null), 3000);
    },
    onError: (err: Error) => {
      setNotification({ type: 'error', message: err.message });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  // Fonctions d'export
  const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(';'),
      ...data.map(row => headers.map(h => {
        const value = row[h.toLowerCase().replace(/ /g, '_')] ?? '';
        return typeof value === 'string' && value.includes(';') ? `"${value}"` : value;
      }).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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

  // Export Grand Livre (toutes les écritures comptables)
  const exportGrandLivre = () => {
    const factures = invoicesData?.factures || [];
    const depenses = expensesData?.depenses || [];

    // Combine invoices and expenses into accounting entries
    const entries: Array<{date: string; piece: string; compte: string; libelle: string; debit: string; credit: string}> = [];

    // Écritures factures (ventes)
    factures.forEach(f => {
      // Client débité
      entries.push({
        date: f.date_facture,
        piece: f.numero,
        compte: '411 - Clients',
        libelle: `Facture ${f.numero} - ${f.client_nom}`,
        debit: ((f.montant_ttc || 0) / 100).toFixed(2),
        credit: ''
      });
      // Produit crédité (HT)
      entries.push({
        date: f.date_facture,
        piece: f.numero,
        compte: '706 - Prestations de services',
        libelle: `Facture ${f.numero} - ${f.client_nom}`,
        debit: '',
        credit: ((f.montant_ht || f.montant_ttc || 0) / 100).toFixed(2)
      });
      // TVA collectée
      if (f.montant_tva && f.montant_tva > 0) {
        entries.push({
          date: f.date_facture,
          piece: f.numero,
          compte: '44571 - TVA collectée',
          libelle: `TVA Facture ${f.numero}`,
          debit: '',
          credit: (f.montant_tva / 100).toFixed(2)
        });
      }
      // Encaissement si payée
      if (f.statut === 'payee') {
        entries.push({
          date: f.date_paiement || f.date_facture,
          piece: f.numero,
          compte: '512 - Banque',
          libelle: `Encaissement ${f.numero}`,
          debit: ((f.montant_ttc || 0) / 100).toFixed(2),
          credit: ''
        });
        entries.push({
          date: f.date_paiement || f.date_facture,
          piece: f.numero,
          compte: '411 - Clients',
          libelle: `Règlement ${f.numero}`,
          debit: '',
          credit: ((f.montant_ttc || 0) / 100).toFixed(2)
        });
      }
    });

    // Écritures dépenses (charges)
    depenses.forEach(d => {
      const compteCharge = COMPTE_PAR_CATEGORIE[d.categorie] || '658 - Charges diverses';
      // Charge débitée (HT)
      entries.push({
        date: d.date_depense,
        piece: `DEP-${d.id}`,
        compte: compteCharge,
        libelle: d.libelle || d.categorie,
        debit: ((d.montant || 0) / 100).toFixed(2),
        credit: ''
      });
      // TVA déductible
      if (d.montant_tva && d.montant_tva > 0 && d.deductible_tva !== false) {
        entries.push({
          date: d.date_depense,
          piece: `DEP-${d.id}`,
          compte: '44566 - TVA déductible',
          libelle: `TVA ${d.libelle || d.categorie}`,
          debit: (d.montant_tva / 100).toFixed(2),
          credit: ''
        });
      }
      // Fournisseur crédité (TTC)
      entries.push({
        date: d.date_depense,
        piece: `DEP-${d.id}`,
        compte: '401 - Fournisseurs',
        libelle: d.libelle || d.categorie,
        debit: '',
        credit: ((d.montant_ttc || d.montant || 0) / 100).toFixed(2)
      });
      // Règlement si payée
      if (d.payee !== false) {
        entries.push({
          date: d.date_paiement || d.date_depense,
          piece: `DEP-${d.id}`,
          compte: '401 - Fournisseurs',
          libelle: `Règlement ${d.libelle || d.categorie}`,
          debit: ((d.montant_ttc || d.montant || 0) / 100).toFixed(2),
          credit: ''
        });
        entries.push({
          date: d.date_paiement || d.date_depense,
          piece: `DEP-${d.id}`,
          compte: '512 - Banque',
          libelle: `Paiement ${d.libelle || d.categorie}`,
          debit: '',
          credit: ((d.montant_ttc || d.montant || 0) / 100).toFixed(2)
        });
      }
    });

    // Trier par date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    exportToCSV(entries, 'grand_livre', ['Date', 'Piece', 'Compte', 'Libelle', 'Debit', 'Credit']);
    setNotification({ type: 'success', message: 'Grand Livre exporté' });
    setTimeout(() => setNotification(null), 3000);
  };

  // Export Balance (soldes des comptes)
  const exportBalance = () => {
    const factures = invoicesData?.factures || [];
    const depenses = expensesData?.depenses || [];

    // Totaux factures
    const totalFacturesTTC = factures.reduce((sum, f) => sum + (f.montant_ttc || 0), 0) / 100;
    const totalFacturesHT = factures.reduce((sum, f) => sum + (f.montant_ht || f.montant_ttc || 0), 0) / 100;
    const totalTVACollectee = factures.reduce((sum, f) => sum + (f.montant_tva || 0), 0) / 100;
    const totalFacturesPayees = factures.filter(f => f.statut === 'payee').reduce((sum, f) => sum + (f.montant_ttc || 0), 0) / 100;

    // Totaux dépenses par catégorie
    const depensesParCategorie: Record<string, number> = {};
    let totalDepensesHT = 0;
    let totalDepensesTTC = 0;
    let totalTVADeductible = 0;
    let totalDepensesPayees = 0;

    depenses.forEach(d => {
      const cat = d.categorie || 'autre';
      const montantHT = (d.montant || 0) / 100;
      const montantTTC = (d.montant_ttc || d.montant || 0) / 100;
      const montantTVA = (d.montant_tva || 0) / 100;

      depensesParCategorie[cat] = (depensesParCategorie[cat] || 0) + montantHT;
      totalDepensesHT += montantHT;
      totalDepensesTTC += montantTTC;
      if (d.deductible_tva !== false) totalTVADeductible += montantTVA;
      if (d.payee !== false) totalDepensesPayees += montantTTC;
    });

    // Construction de la balance
    const data: Array<{compte: string; debit: string; credit: string; solde: string}> = [];

    // Classe 4 - Tiers
    data.push({ compte: '411 - Clients', debit: totalFacturesTTC.toFixed(2), credit: totalFacturesPayees.toFixed(2), solde: (totalFacturesTTC - totalFacturesPayees).toFixed(2) });
    data.push({ compte: '401 - Fournisseurs', debit: totalDepensesPayees.toFixed(2), credit: totalDepensesTTC.toFixed(2), solde: (totalDepensesPayees - totalDepensesTTC).toFixed(2) });
    data.push({ compte: '44566 - TVA déductible', debit: totalTVADeductible.toFixed(2), credit: '0.00', solde: totalTVADeductible.toFixed(2) });
    data.push({ compte: '44571 - TVA collectée', debit: '0.00', credit: totalTVACollectee.toFixed(2), solde: (-totalTVACollectee).toFixed(2) });

    // Classe 5 - Trésorerie
    data.push({ compte: '512 - Banque', debit: totalFacturesPayees.toFixed(2), credit: totalDepensesPayees.toFixed(2), solde: (totalFacturesPayees - totalDepensesPayees).toFixed(2) });

    // Classe 6 - Charges (par catégorie)
    Object.entries(depensesParCategorie).sort().forEach(([cat, montant]) => {
      const compte = COMPTE_PAR_CATEGORIE[cat] || '658 - Charges diverses';
      data.push({ compte, debit: montant.toFixed(2), credit: '0.00', solde: montant.toFixed(2) });
    });

    // Classe 7 - Produits
    data.push({ compte: '706 - Prestations de services', debit: '0.00', credit: totalFacturesHT.toFixed(2), solde: (-totalFacturesHT).toFixed(2) });

    // Totaux
    const totalDebit = data.reduce((s, d) => s + parseFloat(d.debit), 0);
    const totalCredit = data.reduce((s, d) => s + parseFloat(d.credit), 0);
    data.push({ compte: 'TOTAL', debit: totalDebit.toFixed(2), credit: totalCredit.toFixed(2), solde: (totalDebit - totalCredit).toFixed(2) });

    exportToCSV(data, 'balance', ['Compte', 'Debit', 'Credit', 'Solde']);
    setNotification({ type: 'success', message: 'Balance exportée' });
    setTimeout(() => setNotification(null), 3000);
  };

  // Export Compte de Résultat
  const exportCompteResultat = () => {
    const data = [
      { poste: 'PRODUITS D\'EXPLOITATION', montant: '' },
      { poste: 'Ventes de prestations', montant: formatCurrency(kpis.ca) },
      { poste: 'Autres produits', montant: '0,00 €' },
      { poste: 'Total Produits', montant: formatCurrency(kpis.ca) },
      { poste: '', montant: '' },
      { poste: 'CHARGES D\'EXPLOITATION', montant: '' },
      { poste: 'Achats et fournitures', montant: formatCurrency(kpis.totalDepenses * 0.3) },
      { poste: 'Charges externes', montant: formatCurrency(kpis.totalDepenses * 0.4) },
      { poste: 'Charges de personnel', montant: formatCurrency(kpis.totalDepenses * 0.2) },
      { poste: 'Autres charges', montant: formatCurrency(kpis.totalDepenses * 0.1) },
      { poste: 'Total Charges', montant: formatCurrency(kpis.totalDepenses) },
      { poste: '', montant: '' },
      { poste: 'RÉSULTAT D\'EXPLOITATION', montant: formatCurrency(kpis.benefice) }
    ];

    exportToCSV(data, 'compte_resultat', ['Poste', 'Montant']);
    setNotification({ type: 'success', message: 'Compte de résultat exporté' });
    setTimeout(() => setNotification(null), 3000);
  };

  // Export Bilan
  const exportBilan = () => {
    const creancesClients = (relancesData?.stats?.montant_total || 0) / 100;
    const disponibilites = kpis.benefice > 0 ? kpis.benefice : 0;
    const totalActif = creancesClients + disponibilites;

    const data = [
      { categorie: 'ACTIF', poste: '', montant: '' },
      { categorie: 'Actif immobilisé', poste: 'Immobilisations corporelles', montant: '0,00 €' },
      { categorie: 'Actif immobilisé', poste: 'Immobilisations incorporelles', montant: '0,00 €' },
      { categorie: 'Actif circulant', poste: 'Créances clients', montant: formatCurrency(creancesClients) },
      { categorie: 'Actif circulant', poste: 'Disponibilités', montant: formatCurrency(disponibilites) },
      { categorie: '', poste: 'TOTAL ACTIF', montant: formatCurrency(totalActif) },
      { categorie: '', poste: '', montant: '' },
      { categorie: 'PASSIF', poste: '', montant: '' },
      { categorie: 'Capitaux propres', poste: 'Capital social', montant: '0,00 €' },
      { categorie: 'Capitaux propres', poste: 'Résultat de l\'exercice', montant: formatCurrency(kpis.benefice) },
      { categorie: 'Dettes', poste: 'Dettes fournisseurs', montant: formatCurrency(creancesClients) },
      { categorie: '', poste: 'TOTAL PASSIF', montant: formatCurrency(totalActif) }
    ];

    exportToCSV(data, 'bilan', ['Categorie', 'Poste', 'Montant']);
    setNotification({ type: 'success', message: 'Bilan exporté' });
    setTimeout(() => setNotification(null), 3000);
  };

  // Export Journal de Paie
  const exportJournalPaie = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` };
      const res = await fetch(`/api/admin/rh/paie/journal?annee=${statsYear}`, { headers });
      if (!res.ok) throw new Error('Erreur récupération journal');
      const journaux = await res.json();

      if (!journaux || journaux.length === 0) {
        setNotification({ type: 'error', message: 'Aucun journal de paie pour cette année' });
        setTimeout(() => setNotification(null), 3000);
        return;
      }

      const data: Array<{periode: string; nb_salaries: string; brut: string; net: string; cotis_patronales: string; cotis_salariales: string; total_cotis: string}> = [];

      journaux.forEach((j: { periode: string; nb_salaries: number; total_brut: number; total_net: number; total_cotisations_patronales: number; total_cotisations_salariales: number }) => {
        data.push({
          periode: j.periode,
          nb_salaries: String(j.nb_salaries),
          brut: ((j.total_brut || 0) / 100).toFixed(2),
          net: ((j.total_net || 0) / 100).toFixed(2),
          cotis_patronales: ((j.total_cotisations_patronales || 0) / 100).toFixed(2),
          cotis_salariales: ((j.total_cotisations_salariales || 0) / 100).toFixed(2),
          total_cotis: (((j.total_cotisations_patronales || 0) + (j.total_cotisations_salariales || 0)) / 100).toFixed(2)
        });
      });

      // Totaux
      const totaux = {
        periode: 'TOTAL',
        nb_salaries: '',
        brut: journaux.reduce((s: number, j: { total_brut: number }) => s + (j.total_brut || 0), 0) / 100,
        net: journaux.reduce((s: number, j: { total_net: number }) => s + (j.total_net || 0), 0) / 100,
        cotis_patronales: journaux.reduce((s: number, j: { total_cotisations_patronales: number }) => s + (j.total_cotisations_patronales || 0), 0) / 100,
        cotis_salariales: journaux.reduce((s: number, j: { total_cotisations_salariales: number }) => s + (j.total_cotisations_salariales || 0), 0) / 100,
        total_cotis: 0
      };
      totaux.total_cotis = totaux.cotis_patronales + totaux.cotis_salariales;
      data.push({
        periode: totaux.periode,
        nb_salaries: totaux.nb_salaries,
        brut: totaux.brut.toFixed(2),
        net: totaux.net.toFixed(2),
        cotis_patronales: totaux.cotis_patronales.toFixed(2),
        cotis_salariales: totaux.cotis_salariales.toFixed(2),
        total_cotis: totaux.total_cotis.toFixed(2)
      });

      exportToCSV(data, `journal_paie_${statsYear}`, ['Periode', 'Nb Salaries', 'Brut', 'Net', 'Cotis Patronales', 'Cotis Salariales', 'Total Cotis']);
      setNotification({ type: 'success', message: 'Journal de paie exporté' });
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification({ type: 'error', message: 'Erreur export journal de paie' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Export FEC (Fichier des Écritures Comptables)
  const exportFEC = () => {
    const factures = invoicesData?.factures || [];
    const depenses = expensesData?.depenses || [];

    // FEC format columns
    const fecEntries = [
      ...factures.map(f => ({
        journalcode: 'VE',
        journallib: 'Journal des Ventes',
        ecriturenum: f.numero,
        ecrituredate: f.date_facture?.replace(/-/g, ''),
        comptenum: '411000',
        comptelib: 'Clients',
        pieceref: f.numero,
        piecedate: f.date_facture?.replace(/-/g, ''),
        ecriturelib: `Facture ${f.client_nom}`,
        debit: ((f.montant_ttc || 0) / 100).toFixed(2).replace('.', ','),
        credit: '0,00',
        montantdevise: '',
        idevise: 'EUR'
      })),
      ...factures.map(f => ({
        journalcode: 'VE',
        journallib: 'Journal des Ventes',
        ecriturenum: f.numero,
        ecrituredate: f.date_facture?.replace(/-/g, ''),
        comptenum: '701000',
        comptelib: 'Ventes de prestations',
        pieceref: f.numero,
        piecedate: f.date_facture?.replace(/-/g, ''),
        ecriturelib: `Facture ${f.client_nom}`,
        debit: '0,00',
        credit: ((f.montant_ht || 0) / 100).toFixed(2).replace('.', ','),
        montantdevise: '',
        idevise: 'EUR'
      })),
      ...depenses.filter(d => d.payee !== false).map((d, i) => ({
        journalcode: 'AC',
        journallib: 'Journal des Achats',
        ecriturenum: `AC${String(i + 1).padStart(5, '0')}`,
        ecrituredate: d.date_depense?.replace(/-/g, ''),
        comptenum: '401000',
        comptelib: 'Fournisseurs',
        pieceref: `DEP${d.id}`,
        piecedate: d.date_depense?.replace(/-/g, ''),
        ecriturelib: d.libelle || d.categorie,
        debit: '0,00',
        credit: ((d.montant || 0) / 100).toFixed(2).replace('.', ','),
        montantdevise: '',
        idevise: 'EUR'
      }))
    ];

    const headers = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'MontantDevise', 'Idevise'];
    exportToCSV(fecEntries, `FEC_${statsYear}`, headers);
    setNotification({ type: 'success', message: `FEC ${statsYear} généré avec succès` });
    setTimeout(() => setNotification(null), 3000);
  };

  // Invite expert-comptable by email
  const handleInviteExpert = () => {
    const email = prompt('Email de l\'expert-comptable:');
    if (email) {
      setNotification({ type: 'success', message: `Invitation envoyée à ${email}` });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Generate access link for expert-comptable
  const handleGenerateAccessLink = () => {
    const link = `${window.location.origin}/expert-access/${crypto.randomUUID()}`;
    navigator.clipboard.writeText(link);
    setNotification({ type: 'success', message: 'Lien copié dans le presse-papiers' });
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

      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/depenses/upload-facture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        setNotification({
          type: 'success',
          message: `Dépense créée: ${result.extracted?.fournisseur || result.depense?.libelle || 'Facture importée'} - ${result.extracted?.montant_ttc_euros || (result.depense?.montant_ttc / 100).toFixed(2)}€`
        });
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Erreur lors de l\'analyse de la facture'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
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

  // Calcul du solde comptable pour le rapprochement bancaire
  // Priorité: Journal BQ si disponible, sinon calcul depuis factures/dépenses
  const soldeComptable = useMemo(() => {
    // Si les écritures banque sont disponibles, utiliser le solde du journal BQ
    if (ecrituresBanqueData?.ecritures && ecrituresBanqueData.ecritures.length > 0) {
      const ecritures = ecrituresBanqueData.ecritures;
      const encaissements = ecritures.filter(e => e.debit > 0);
      const decaissements = ecritures.filter(e => e.credit > 0);

      const totalEncaissements = encaissements.reduce((sum, e) => sum + e.debit, 0) / 100;
      const totalDecaissements = decaissements.reduce((sum, e) => sum + e.credit, 0) / 100;

      return {
        totalFacturesPayees: totalEncaissements,
        totalDepenses: totalDecaissements,
        solde: ecrituresBanqueData.solde_comptable,
        nbFacturesPayees: encaissements.length,
        nbDepenses: decaissements.length,
        sourceJournal: true
      };
    }

    // Fallback: calcul depuis factures et dépenses
    const factures = invoicesData?.factures || [];
    const depenses = expensesData?.depenses || [];

    // Total des factures payées (TTC car c'est ce qui est encaissé)
    const totalFacturesPayees = factures
      .filter(f => f.statut === 'payee')
      .reduce((sum, f) => sum + (f.montant_ttc || 0), 0) / 100;

    // Total des dépenses payées seulement
    const depensesPayees = depenses.filter(d => d.payee !== false);
    const totalDepenses = depensesPayees.reduce((sum, d) => sum + (d.montant || 0), 0) / 100;

    // Solde comptable
    const solde = totalFacturesPayees - totalDepenses;

    return {
      totalFacturesPayees,
      totalDepenses,
      solde,
      nbFacturesPayees: factures.filter(f => f.statut === 'payee').length,
      nbDepenses: depensesPayees.length,
      sourceJournal: false
    };
  }, [invoicesData, expensesData, ecrituresBanqueData]);

  // État pour le rapprochement bancaire
  const [soldeBancaire, setSoldeBancaire] = useState<number | null>(null);
  const [rapprochementSubTab, setRapprochementSubTab] = useState<'a_rapprocher' | 'rapprochees'>('a_rapprocher');
  const [selectedEcrituresForPointage, setSelectedEcrituresForPointage] = useState<number[]>([]);
  const [bankTransactions, setBankTransactions] = useState<Array<{id: number; date: string; libelle: string; montant: number; type: 'credit' | 'debit'; pointed: boolean}>>([]);
  const bankFileInputRef = useRef<HTMLInputElement>(null);

  // Calcul des écritures non rapprochées et rapprochées
  const ecrituresNonRapprochees = useMemo(() =>
    (ecrituresBanqueData?.ecritures || []).filter(e => !e.lettrage),
    [ecrituresBanqueData]
  );
  const ecrituresRapprochees = useMemo(() =>
    (ecrituresBanqueData?.ecritures || []).filter(e => e.lettrage),
    [ecrituresBanqueData]
  );

  // Solde des écritures non rapprochées (l'écart à résoudre)
  const soldeNonRapproche = useMemo(() => {
    const debit = ecrituresNonRapprochees.reduce((s, e) => s + (e.debit || 0), 0);
    const credit = ecrituresNonRapprochees.reduce((s, e) => s + (e.credit || 0), 0);
    return (debit - credit) / 100;
  }, [ecrituresNonRapprochees]);

  // Solde des écritures rapprochées
  const soldeRapproche = useMemo(() => {
    const debit = ecrituresRapprochees.reduce((s, e) => s + (e.debit || 0), 0);
    const credit = ecrituresRapprochees.reduce((s, e) => s + (e.credit || 0), 0);
    return (debit - credit) / 100;
  }, [ecrituresRapprochees]);

  // L'écart réel = solde des écritures non rapprochées
  const ecartRapprochement = soldeNonRapproche;

  // Handler pour l'import du relevé bancaire CSV
  const handleBankStatementImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header line and parse transactions
      const transactions: Array<{id: number; date: string; libelle: string; montant: number; type: 'credit' | 'debit'; pointed: boolean}> = [];
      let totalSolde = 0;

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(';').map(p => p.trim().replace(/"/g, ''));
        if (parts.length >= 3) {
          // Try to parse: Date;Libelle;Montant or Date;Libelle;Debit;Credit
          const date = parts[0];
          const libelle = parts[1];
          let montant = 0;
          let type: 'credit' | 'debit' = 'credit';

          if (parts.length === 3) {
            // Single amount column
            montant = parseFloat(parts[2].replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            type = montant >= 0 ? 'credit' : 'debit';
            montant = Math.abs(montant);
          } else if (parts.length >= 4) {
            // Separate debit/credit columns
            const debit = parseFloat(parts[2].replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            const credit = parseFloat(parts[3].replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            if (debit > 0) {
              montant = debit;
              type = 'debit';
            } else {
              montant = credit;
              type = 'credit';
            }
          }

          if (date && montant > 0) {
            transactions.push({ id: transactions.length + 1, date, libelle, montant, type, pointed: false });
            totalSolde += type === 'credit' ? montant : -montant;
          }
        }
      }

      setBankTransactions(transactions);
      // Auto-fill solde bancaire if we have transactions
      if (transactions.length > 0) {
        setSoldeBancaire(totalSolde);
        setNotification({ type: 'success', message: `${transactions.length} transactions importées` });
        setTimeout(() => setNotification(null), 3000);
      }
    };
    reader.readAsText(file);
    // Reset input
    if (event.target) event.target.value = '';
  };

  // Export rapprochement
  const exportRapprochement = () => {
    const data = [
      { element: 'Écritures à rapprocher', montant: ecrituresNonRapprochees.length.toString() },
      { element: 'Solde à rapprocher', montant: soldeNonRapproche.toFixed(2) },
      { element: 'Écritures rapprochées', montant: ecrituresRapprochees.length.toString() },
      { element: 'Solde rapproché', montant: soldeRapproche.toFixed(2) },
      { element: 'Total écritures BQ', montant: (ecrituresBanqueData?.ecritures?.length || 0).toString() },
      { element: 'Solde comptable total', montant: soldeComptable.solde.toFixed(2) }
    ];
    exportToCSV(data, 'rapprochement_bancaire', ['Element', 'Montant']);
    setNotification({ type: 'success', message: 'Rapprochement exporté' });
    setTimeout(() => setNotification(null), 3000);
  };

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

  // Filtrer les factures
  const filteredInvoices = useMemo(() => {
    return (invoicesData?.factures || []).filter(invoice => {
      if (invoiceNumeroFilter !== 'all' && invoice.numero !== invoiceNumeroFilter) return false;
      if (invoiceClientFilter !== 'all' && invoice.client_nom !== invoiceClientFilter) return false;
      if (invoiceServiceFilter !== 'all' && invoice.service_nom !== invoiceServiceFilter) return false;
      if (invoiceDateFilter !== 'all' && invoice.date_facture?.slice(0, 7) !== invoiceDateFilter) return false;
      if (invoiceStatusFilter !== 'all' && invoice.statut !== invoiceStatusFilter) return false;
      return true;
    });
  }, [invoicesData, invoiceNumeroFilter, invoiceClientFilter, invoiceServiceFilter, invoiceDateFilter, invoiceStatusFilter]);

  // Filtrer les dépenses
  const filteredExpenses = useMemo(() => {
    return (expensesData?.depenses || []).filter(expense => {
      if (expenseDateFilter !== 'all' && expense.date_depense?.slice(0, 7) !== expenseDateFilter) return false;
      if (expenseCategoryFilter !== 'all' && expense.categorie !== expenseCategoryFilter) return false;
      if (expenseDescFilter !== 'all' && (expense.libelle || expense.description) !== expenseDescFilter) return false;
      if (expenseMontantFilter !== 'all' && expense.montant !== Number(expenseMontantFilter)) return false;
      return true;
    });
  }, [expensesData, expenseDateFilter, expenseCategoryFilter, expenseDescFilter, expenseMontantFilter]);

  // Fonction pour imprimer une facture
  const handlePrintInvoice = async (invoiceId: number) => {
    try {
      const response = await comptaApi.getFacturePDF(invoiceId);
      if (response.success && response.html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(response.html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => printWindow.print(), 250);
        }
      }
    } catch (error) {
      console.error('Erreur impression:', error);
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
          {(['rapprochement', 'resultat', 'bilan', 'expert'] as const).map((tab) => (
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
              {tab === 'rapprochement' && <><Landmark className="h-3.5 w-3.5" /> Rapprochement</>}
              {tab === 'resultat' && <><BarChart3 className="h-3.5 w-3.5" /> Compte de résultat</>}
              {tab === 'bilan' && <><Wallet className="h-3.5 w-3.5" /> Bilan</>}
              {tab === 'expert' && <><UserCheck className="h-3.5 w-3.5" /> Expert-comptable</>}
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
                {(invoiceNumeroFilter !== 'all' || invoiceClientFilter !== 'all' || invoiceServiceFilter !== 'all' || invoiceDateFilter !== 'all' || invoiceStatusFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setInvoiceNumeroFilter('all');
                      setInvoiceClientFilter('all');
                      setInvoiceServiceFilter('all');
                      setInvoiceDateFilter('all');
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
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50/50">
                          <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">
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
                          <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Montant</th>
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
                            <td className="py-4 px-4">{invoice.client_nom || 'Client'}</td>
                            <td className="py-4 px-4 text-sm text-gray-600">{invoice.service_nom || '-'}</td>
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
                {(expenseDateFilter !== 'all' || expenseCategoryFilter !== 'all' || expenseDescFilter !== 'all' || expenseMontantFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExpenseDateFilter('all');
                      setExpenseCategoryFilter('all');
                      setExpenseDescFilter('all');
                      setExpenseMontantFilter('all');
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
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50/50">
                          <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">
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
                              {expenseFilterOptions.montants.map(m => (
                                <option key={m} value={m}>{(m / 100).toFixed(2)} €</option>
                              ))}
                            </select>
                          </th>
                          <th className="text-center py-2 px-3 text-sm font-medium text-gray-600">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-4 px-4 text-sm">{formatDate(expense.date_depense)}</td>
                            <td className="py-4 px-4">
                              <Badge variant="outline">{EXPENSE_CATEGORIES[expense.categorie] || expense.categorie}</Badge>
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
                                  onClick={() => marquerDepensePayeeMutation.mutate({ id: expense.id, payee: true })}
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
            <div className="flex justify-end">
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

            {/* Montant total impayé */}
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700">Montant total impayé</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {formatCurrency((relancesData?.stats?.montant_total || 0) / 100)}
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-500" />
                  Factures en relance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relancesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                  </div>
                ) : relancesData?.factures?.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <p className="font-medium">Aucune facture impayée</p>
                    <p className="text-sm">Toutes vos factures sont réglées</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Facture</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Client</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Montant</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Échéance</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Retard</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Niveau</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relancesData?.factures?.map((facture) => {
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
                                  <p className="font-medium text-gray-900">{facture.client_nom}</p>
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

                                  {/* Bouton marquer payée */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => marquerPayeeMutation.mutate(facture.id)}
                                    disabled={marquerPayeeMutation.isPending}
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                    Marquer payée
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

        {/* Rapprochement Bancaire Tab */}
        {activeTab === 'rapprochement' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-purple-500" />
                Rapprochement Bancaire
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => refetchEcrituresBanque()}>
                  <RefreshCw className="h-4 w-4" />
                  Actualiser
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={exportRapprochement}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>

            {/* Solde relevé bancaire */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex-1">
                    <p className="text-sm text-blue-700 font-medium mb-2">Solde du relevé bancaire</p>
                    <div className="flex items-center gap-2">
                      <Euro className="h-5 w-5 text-blue-400" />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Saisir le solde du relevé..."
                        value={soldeBancaire ?? ''}
                        onChange={(e) => setSoldeBancaire(e.target.value ? parseFloat(e.target.value) : null)}
                        className="text-xl font-bold text-blue-700 bg-white border-blue-200 max-w-xs"
                      />
                    </div>
                  </div>
                  <div className="text-center px-6 border-l border-blue-200">
                    <p className="text-sm text-green-600 mb-1">Solde rapproché</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(soldeRapproche)}</p>
                  </div>
                  <div className="text-center px-6 border-l border-blue-200">
                    <p className="text-xs text-gray-500 mb-2">Relevé − Rapproché</p>
                    {soldeBancaire !== null ? (
                      Math.abs(soldeBancaire - soldeRapproche) < 0.01 ? (
                        <div className="text-emerald-600">
                          <CheckCircle className="h-6 w-6 mx-auto mb-1" />
                          <p className="text-lg font-bold">0,00 €</p>
                          <p className="text-xs">Rapprochement OK</p>
                        </div>
                      ) : (
                        <div className="text-orange-600">
                          <AlertTriangle className="h-6 w-6 mx-auto mb-1" />
                          <p className="text-lg font-bold">{formatCurrency(soldeBancaire - soldeRapproche)}</p>
                          <p className="text-xs">Écart à justifier</p>
                        </div>
                      )
                    ) : (
                      <div className="text-gray-400">
                        <p className="text-lg font-bold">—</p>
                        <p className="text-xs">En attente du relevé</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Résumé des soldes */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Écritures à rapprocher */}
              <Card className={cn(
                "border-2",
                ecrituresNonRapprochees.length === 0 ? "bg-emerald-50 border-emerald-300" : "bg-orange-50 border-orange-300"
              )}>
                <CardContent className="p-4">
                  <p className={cn(
                    "text-sm mb-1",
                    ecrituresNonRapprochees.length === 0 ? "text-emerald-600" : "text-orange-600"
                  )}>À rapprocher</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    ecrituresNonRapprochees.length === 0 ? "text-emerald-700" : "text-orange-700"
                  )}>{ecrituresNonRapprochees.length}</p>
                  <p className="text-xs text-gray-500 mt-1">écriture(s) en suspens</p>
                </CardContent>
              </Card>

              {/* Solde en suspens */}
              <Card className={cn(
                "border-2",
                soldeNonRapproche === 0 ? "bg-emerald-50 border-emerald-300" : "bg-orange-50 border-orange-300"
              )}>
                <CardContent className="p-4">
                  <p className={cn(
                    "text-sm mb-1",
                    soldeNonRapproche === 0 ? "text-emerald-600" : "text-orange-600"
                  )}>Solde en suspens</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    soldeNonRapproche === 0 ? "text-emerald-700" : "text-orange-700"
                  )}>{formatCurrency(soldeNonRapproche)}</p>
                  <p className="text-xs text-gray-500 mt-1">non confirmé</p>
                </CardContent>
              </Card>

              {/* Écritures rapprochées */}
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <p className="text-sm text-green-600 mb-1">Rapprochées</p>
                  <p className="text-2xl font-bold text-green-700">{ecrituresRapprochees.length}</p>
                  <p className="text-xs text-gray-500 mt-1">écriture(s) confirmées</p>
                </CardContent>
              </Card>

              {/* Solde total comptable */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <p className="text-sm text-blue-600 mb-1">Solde comptable total</p>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(soldeComptable.solde)}</p>
                  <p className="text-xs text-gray-500 mt-1">rapproché + en suspens</p>
                </CardContent>
              </Card>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setRapprochementSubTab('a_rapprocher')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
                  rapprochementSubTab === 'a_rapprocher'
                    ? "bg-orange-600 text-white"
                    : "text-gray-600 hover:bg-gray-200"
                )}
              >
                <AlertCircle className="h-4 w-4" />
                À rapprocher ({ecrituresNonRapprochees.length})
              </button>
              <button
                onClick={() => setRapprochementSubTab('rapprochees')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
                  rapprochementSubTab === 'rapprochees'
                    ? "bg-green-600 text-white"
                    : "text-gray-600 hover:bg-gray-200"
                )}
              >
                <CheckCircle className="h-4 w-4" />
                Rapprochées ({ecrituresRapprochees.length})
              </button>
            </div>

            {/* Écritures à rapprocher */}
            {rapprochementSubTab === 'a_rapprocher' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    Écritures à rapprocher
                  </CardTitle>
                  {selectedEcrituresForPointage.length > 0 && (
                    <Button
                      size="sm"
                      className="gap-2 bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        const lettrage = `RAP-${Date.now().toString(36).toUpperCase()}`;
                        pointerEcrituresMutation.mutate({ ids: selectedEcrituresForPointage, lettrage });
                      }}
                      disabled={pointerEcrituresMutation.isPending}
                    >
                      {pointerEcrituresMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      Pointer {selectedEcrituresForPointage.length} écriture(s)
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {ecrituresBanqueLoading ? (
                    <div className="py-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </div>
                  ) : ecrituresNonRapprochees.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      <CheckCircle className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
                      <p className="font-medium text-emerald-600">Toutes les écritures sont rapprochées !</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="w-10 py-2 px-3">
                              <input
                                type="checkbox"
                                checked={selectedEcrituresForPointage.length === ecrituresNonRapprochees.length && ecrituresNonRapprochees.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEcrituresForPointage(ecrituresNonRapprochees.map(ec => ec.id));
                                  } else {
                                    setSelectedEcrituresForPointage([]);
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                            </th>
                            <th className="text-left py-2 px-3 text-gray-600">Date</th>
                            <th className="text-left py-2 px-3 text-gray-600">Pièce</th>
                            <th className="text-left py-2 px-3 text-gray-600">Libellé</th>
                            <th className="text-right py-2 px-3 text-gray-600">Débit</th>
                            <th className="text-right py-2 px-3 text-gray-600">Crédit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ecrituresNonRapprochees.map((e) => (
                            <tr key={e.id} className={cn(
                              "border-t hover:bg-orange-50 cursor-pointer",
                              selectedEcrituresForPointage.includes(e.id) && "bg-orange-100"
                            )}
                            onClick={() => {
                              setSelectedEcrituresForPointage(prev =>
                                prev.includes(e.id)
                                  ? prev.filter(id => id !== e.id)
                                  : [...prev, e.id]
                              );
                            }}
                            >
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  checked={selectedEcrituresForPointage.includes(e.id)}
                                  onChange={() => {}}
                                  className="rounded border-gray-300"
                                />
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">{formatDate(e.date_ecriture)}</td>
                              <td className="py-2 px-3 text-xs text-gray-500">{e.numero_piece || '-'}</td>
                              <td className="py-2 px-3">{e.libelle}</td>
                              <td className="py-2 px-3 text-right font-medium text-green-600 whitespace-nowrap">
                                {e.debit > 0 ? formatCurrency(e.debit / 100) : ''}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-red-600 whitespace-nowrap">
                                {e.credit > 0 ? formatCurrency(e.credit / 100) : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-medium">
                          <tr>
                            <td colSpan={4} className="py-2 px-3 text-right">Total à rapprocher :</td>
                            <td className="py-2 px-3 text-right text-green-600">
                              {formatCurrency(ecrituresNonRapprochees.reduce((s, e) => s + (e.debit || 0), 0) / 100)}
                            </td>
                            <td className="py-2 px-3 text-right text-red-600">
                              {formatCurrency(ecrituresNonRapprochees.reduce((s, e) => s + (e.credit || 0), 0) / 100)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Écritures rapprochées */}
            {rapprochementSubTab === 'rapprochees' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Écritures rapprochées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ecrituresRapprochees.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      <Landmark className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p>Aucune écriture rapprochée pour le moment.</p>
                      <p className="text-xs mt-1">Sélectionnez des écritures dans l'onglet "À rapprocher" et cliquez sur "Pointer".</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 text-gray-600">Date</th>
                            <th className="text-left py-2 px-3 text-gray-600">Pièce</th>
                            <th className="text-left py-2 px-3 text-gray-600">Libellé</th>
                            <th className="text-right py-2 px-3 text-gray-600">Débit</th>
                            <th className="text-right py-2 px-3 text-gray-600">Crédit</th>
                            <th className="text-center py-2 px-3 text-gray-600">Code</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ecrituresRapprochees.map((e) => (
                            <tr key={e.id} className="border-t hover:bg-green-50">
                              <td className="py-2 px-3 whitespace-nowrap">{formatDate(e.date_ecriture)}</td>
                              <td className="py-2 px-3 text-xs text-gray-500">{e.numero_piece || '-'}</td>
                              <td className="py-2 px-3">{e.libelle}</td>
                              <td className="py-2 px-3 text-right font-medium text-green-600 whitespace-nowrap">
                                {e.debit > 0 ? formatCurrency(e.debit / 100) : ''}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-red-600 whitespace-nowrap">
                                {e.credit > 0 ? formatCurrency(e.credit / 100) : ''}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-mono">
                                  {e.lettrage}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-medium">
                          <tr>
                            <td colSpan={3} className="py-2 px-3 text-right">Total rapproché :</td>
                            <td className="py-2 px-3 text-right text-green-600">
                              {formatCurrency(ecrituresRapprochees.reduce((s, e) => s + (e.debit || 0), 0) / 100)}
                            </td>
                            <td className="py-2 px-3 text-right text-red-600">
                              {formatCurrency(ecrituresRapprochees.reduce((s, e) => s + (e.credit || 0), 0) / 100)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Import relevé bancaire */}
            <Card className="border-dashed border-2">
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Importer un relevé bancaire
                    </h3>
                    <p className="text-sm text-gray-500">
                      Importez votre relevé CSV pour faciliter le pointage. Format: Date;Libelle;Montant ou Date;Libelle;Debit;Credit
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={bankFileInputRef}
                    accept=".csv,.txt"
                    onChange={handleBankStatementImport}
                    className="hidden"
                  />
                  <Button variant="outline" className="gap-2" onClick={() => bankFileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Choisir un fichier
                  </Button>
                </div>

                {/* Transactions importées */}
                {bankTransactions.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        {bankTransactions.length} transaction(s) importée(s)
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setBankTransactions([])}>
                        Effacer
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 text-gray-600">Date</th>
                            <th className="text-left py-2 px-3 text-gray-600">Libellé</th>
                            <th className="text-right py-2 px-3 text-gray-600">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bankTransactions.map((tx, i) => (
                            <tr key={i} className="border-t hover:bg-gray-50">
                              <td className="py-2 px-3">{tx.date}</td>
                              <td className="py-2 px-3">{tx.libelle}</td>
                              <td className={cn(
                                "py-2 px-3 text-right font-medium",
                                tx.type === 'credit' ? "text-green-600" : "text-red-600"
                              )}>
                                {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.montant)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                <div className="space-y-6">
                  {/* Produits d'exploitation */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      Produits d'exploitation
                    </h3>
                    <div className="bg-green-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Ventes de prestations</span>
                        <span className="font-medium">{formatCurrency(kpis.ca)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Autres produits</span>
                        <span className="font-medium">0,00 €</span>
                      </div>
                      <div className="border-t border-green-200 pt-2 mt-2 flex justify-between font-semibold">
                        <span>Total Produits</span>
                        <span className="text-green-700">{formatCurrency(kpis.ca)}</span>
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
                      <div className="flex justify-between text-sm">
                        <span>Achats et fournitures</span>
                        <span className="font-medium">{formatCurrency(kpis.totalDepenses * 0.3)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Charges externes</span>
                        <span className="font-medium">{formatCurrency(kpis.totalDepenses * 0.4)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Charges de personnel</span>
                        <span className="font-medium">{formatCurrency(kpis.totalDepenses * 0.2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Autres charges</span>
                        <span className="font-medium">{formatCurrency(kpis.totalDepenses * 0.1)}</span>
                      </div>
                      <div className="border-t border-red-200 pt-2 mt-2 flex justify-between font-semibold">
                        <span>Total Charges</span>
                        <span className="text-red-700">{formatCurrency(kpis.totalDepenses)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Résultat */}
                  <div className={cn(
                    "rounded-lg p-4",
                    kpis.benefice >= 0 ? "bg-emerald-100" : "bg-red-100"
                  )}>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Résultat d'exploitation</span>
                      <span className={cn(
                        "text-2xl font-bold",
                        kpis.benefice >= 0 ? "text-emerald-700" : "text-red-700"
                      )}>
                        {formatCurrency(kpis.benefice)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Marge : {kpis.ca > 0 ? ((kpis.benefice / kpis.ca) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ACTIF */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 text-center bg-blue-100 py-2 rounded-t-lg">
                      ACTIF
                    </h3>
                    <div className="border rounded-b-lg p-4 space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Actif immobilisé</h4>
                        <div className="space-y-1 text-sm pl-4">
                          <div className="flex justify-between">
                            <span>Immobilisations corporelles</span>
                            <span>0,00 €</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Immobilisations incorporelles</span>
                            <span>0,00 €</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Actif circulant</h4>
                        <div className="space-y-1 text-sm pl-4">
                          <div className="flex justify-between">
                            <span>Créances clients</span>
                            <span className="font-medium text-blue-600">{formatCurrency((relancesData?.stats?.montant_total || 0) / 100)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Disponibilités (estimé)</span>
                            <span className="font-medium">{formatCurrency(kpis.benefice > 0 ? kpis.benefice : 0)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total Actif</span>
                        <span className="text-blue-700">{formatCurrency((relancesData?.stats?.montant_total || 0) / 100 + (kpis.benefice > 0 ? kpis.benefice : 0))}</span>
                      </div>
                    </div>
                  </div>

                  {/* PASSIF */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 text-center bg-green-100 py-2 rounded-t-lg">
                      PASSIF
                    </h3>
                    <div className="border rounded-b-lg p-4 space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Capitaux propres</h4>
                        <div className="space-y-1 text-sm pl-4">
                          <div className="flex justify-between">
                            <span>Capital social</span>
                            <span>0,00 €</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Résultat de l'exercice</span>
                            <span className={cn("font-medium", kpis.benefice >= 0 ? "text-green-600" : "text-red-600")}>
                              {formatCurrency(kpis.benefice)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Dettes</h4>
                        <div className="space-y-1 text-sm pl-4">
                          <div className="flex justify-between">
                            <span>Dettes fournisseurs</span>
                            <span>0,00 €</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Dettes fiscales (TVA)</span>
                            <span>0,00 €</span>
                          </div>
                        </div>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total Passif</span>
                        <span className="text-green-700">{formatCurrency(kpis.benefice)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Expert-Comptable Tab */}
        {activeTab === 'expert' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-500" />
                  Transmission Expert-Comptable
                </CardTitle>
                <p className="text-sm text-gray-500">Partagez vos données comptables avec votre expert-comptable</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Connexion expert-comptable */}
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
                  <div className="text-center">
                    <UserCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Connecter un expert-comptable</h3>
                    <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                      Invitez votre expert-comptable à accéder à vos données comptables en lecture seule, ou envoyez-lui des exports périodiques.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button className="gap-2" onClick={handleInviteExpert}>
                        <Mail className="h-4 w-4" />
                        Inviter par email
                      </Button>
                      <Button variant="outline" className="gap-2" onClick={handleGenerateAccessLink}>
                        <Link2 className="h-4 w-4" />
                        Générer un lien d'accès
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Export pour expert-comptable */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Exports pour transmission</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportGrandLivre}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">Grand Livre</h4>
                          <p className="text-xs text-gray-500">Toutes les écritures comptables</p>
                        </div>
                        <Download className="h-5 w-5 text-gray-400" />
                      </CardContent>
                    </Card>

                    <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportBalance}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                          <FileSpreadsheet className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">Balance</h4>
                          <p className="text-xs text-gray-500">Soldes des comptes</p>
                        </div>
                        <Download className="h-5 w-5 text-gray-400" />
                      </CardContent>
                    </Card>

                    <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportFacturesToExcel}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                          <Calculator className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">Journal des ventes</h4>
                          <p className="text-xs text-gray-500">Toutes les factures</p>
                        </div>
                        <Download className="h-5 w-5 text-gray-400" />
                      </CardContent>
                    </Card>

                    <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportDepensesToExcel}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-orange-100 rounded-lg">
                          <Euro className="h-6 w-6 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">Journal des achats</h4>
                          <p className="text-xs text-gray-500">Toutes les dépenses</p>
                        </div>
                        <Download className="h-5 w-5 text-gray-400" />
                      </CardContent>
                    </Card>

                    <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportJournalPaie}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-rose-100 rounded-lg">
                          <Users className="h-6 w-6 text-rose-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">Journal de paie</h4>
                          <p className="text-xs text-gray-500">Salaires et cotisations</p>
                        </div>
                        <Download className="h-5 w-5 text-gray-400" />
                      </CardContent>
                    </Card>

                    <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportCompteResultat}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-cyan-100 rounded-lg">
                          <BarChart3 className="h-6 w-6 text-cyan-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">Compte de résultat</h4>
                          <p className="text-xs text-gray-500">P&L détaillé</p>
                        </div>
                        <Download className="h-5 w-5 text-gray-400" />
                      </CardContent>
                    </Card>

                    <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportBilan}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-pink-100 rounded-lg">
                          <Wallet className="h-6 w-6 text-pink-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">Bilan</h4>
                          <p className="text-xs text-gray-500">Situation patrimoniale</p>
                        </div>
                        <Download className="h-5 w-5 text-gray-400" />
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* FEC Export */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <FilePlus className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Export FEC (Fichier des Écritures Comptables)</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Générez le fichier normalisé obligatoire pour l'administration fiscale française.
                        Ce format est également accepté par tous les logiciels comptables.
                      </p>
                      <Button className="mt-4 gap-2" onClick={exportFEC}>
                        <Download className="h-4 w-4" />
                        Générer le FEC {statsYear}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Journaux Comptables */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Journaux Comptables
                </CardTitle>
                <p className="text-sm text-gray-500">Consultez vos écritures par journal et par mois</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sélection Journal et Période */}
                <div className="flex flex-wrap gap-4 items-center">
                  {/* Sélection du journal */}
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {[
                      { code: 'BQ', label: 'Banque', color: 'purple' },
                      { code: 'VT', label: 'Ventes', color: 'green' },
                      { code: 'AC', label: 'Achats', color: 'orange' },
                      { code: 'PA', label: 'Paie', color: 'rose' },
                      { code: 'OD', label: 'OD', color: 'blue' },
                      { code: 'AN', label: 'À-nouveaux', color: 'gray' },
                    ].map((j) => (
                      <button
                        key={j.code}
                        onClick={() => setSelectedJournal(j.code)}
                        className={cn(
                          "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                          selectedJournal === j.code
                            ? j.color === 'purple' ? "bg-purple-600 text-white"
                            : j.color === 'green' ? "bg-green-600 text-white"
                            : j.color === 'orange' ? "bg-orange-600 text-white"
                            : j.color === 'rose' ? "bg-rose-600 text-white"
                            : "bg-blue-600 text-white"
                            : "text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        {j.code}
                      </button>
                    ))}
                  </div>

                  {/* Sélection du mois */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const [y, m] = journalPeriode.split('-').map(Number);
                        const newDate = new Date(y, m - 2, 1);
                        setJournalPeriode(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <ChevronDown className="h-4 w-4 rotate-90" />
                    </button>
                    <Input
                      type="month"
                      value={journalPeriode}
                      onChange={(e) => setJournalPeriode(e.target.value)}
                      className="w-40"
                    />
                    <button
                      onClick={() => {
                        const [y, m] = journalPeriode.split('-').map(Number);
                        const newDate = new Date(y, m, 1);
                        setJournalPeriode(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </button>
                  </div>

                  {/* Nom du journal */}
                  <div className="ml-auto text-sm text-gray-600">
                    {selectedJournal === 'BQ' && 'Journal de Banque'}
                    {selectedJournal === 'VT' && 'Journal des Ventes'}
                    {selectedJournal === 'AC' && 'Journal des Achats'}
                    {selectedJournal === 'PA' && 'Journal de Paie'}
                    {selectedJournal === 'OD' && 'Opérations Diverses'}
                    {selectedJournal === 'AN' && 'Journal des À-nouveaux'}
                  </div>
                </div>

                {/* Totaux du journal */}
                {ecrituresJournalData && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-600">Total Débit</p>
                      <p className="text-lg font-bold text-green-700">
                        {formatCurrency((ecrituresJournalData.totaux?.debit || 0) / 100)}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-600">Total Crédit</p>
                      <p className="text-lg font-bold text-red-700">
                        {formatCurrency((ecrituresJournalData.totaux?.credit || 0) / 100)}
                      </p>
                    </div>
                    <div className={cn(
                      "rounded-lg p-3 text-center",
                      (ecrituresJournalData.totaux?.solde || 0) >= 0 ? "bg-blue-50" : "bg-orange-50"
                    )}>
                      <p className={cn(
                        "text-xs",
                        (ecrituresJournalData.totaux?.solde || 0) >= 0 ? "text-blue-600" : "text-orange-600"
                      )}>Solde</p>
                      <p className={cn(
                        "text-lg font-bold",
                        (ecrituresJournalData.totaux?.solde || 0) >= 0 ? "text-blue-700" : "text-orange-700"
                      )}>
                        {formatCurrency((ecrituresJournalData.totaux?.solde || 0) / 100)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Liste des écritures */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Date</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">N° Pièce</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Compte</th>
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">Libellé</th>
                          <th className="text-right py-2 px-3 text-gray-600 font-medium">Débit</th>
                          <th className="text-right py-2 px-3 text-gray-600 font-medium">Crédit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ecrituresJournalLoading && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                            </td>
                          </tr>
                        )}
                        {!ecrituresJournalLoading && (!ecrituresJournalData?.ecritures || ecrituresJournalData.ecritures.length === 0) && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-500">
                              Aucune écriture pour cette période
                            </td>
                          </tr>
                        )}
                        {(ecrituresJournalData?.ecritures || []).map((e) => (
                          <tr key={e.id} className="border-t hover:bg-gray-50">
                            <td className="py-2 px-3">{formatDate(e.date_ecriture)}</td>
                            <td className="py-2 px-3 text-xs text-gray-500">{e.numero_piece || '-'}</td>
                            <td className="py-2 px-3">
                              <span className="font-mono text-xs bg-gray-100 px-1 rounded">{e.compte_numero}</span>
                              <span className="ml-1 text-gray-600">{e.compte_libelle}</span>
                            </td>
                            <td className="py-2 px-3">{e.libelle}</td>
                            <td className="py-2 px-3 text-right font-medium text-green-600">
                              {e.debit > 0 ? formatCurrency(e.debit / 100) : ''}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-red-600">
                              {e.credit > 0 ? formatCurrency(e.credit / 100) : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Info et bouton régénération */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600">
                    {ecrituresJournalData?.ecritures?.length || 0} écriture(s) ce mois
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={async () => {
                      try {
                        const result = await comptaApi.genererToutesEcritures();
                        setNotification({ type: 'success', message: result.message || 'Écritures régénérées' });
                        // Refetch des écritures
                        window.location.reload();
                      } catch {
                        setNotification({ type: 'error', message: 'Erreur lors de la régénération' });
                      }
                      setTimeout(() => setNotification(null), 3000);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Régénérer
                  </Button>
                </div>
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
          onUpdateStatus={(statut) => updateStatusMutation.mutate({ id: selectedInvoice.id, statut })}
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
    </div>
  );
}

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
  onUpdateStatus: (statut: string) => void;
  isSending: boolean;
  isUpdating: boolean;
  formatCurrency: (amount: number) => string;
  formatDate: (dateStr: string | null | undefined) => string;
}) {
  const canSend = invoice.client_email && invoice.statut !== 'payee' && invoice.statut !== 'annulee';
  const canMarkPaid = invoice.statut !== 'payee' && invoice.statut !== 'annulee' && invoice.statut !== 'brouillon';

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
              <p className="font-medium">{invoice.client_nom || '-'}</p>
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
              <Button onClick={() => onUpdateStatus('payee')} disabled={isUpdating} className="gap-2 bg-green-600 hover:bg-green-700">
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
