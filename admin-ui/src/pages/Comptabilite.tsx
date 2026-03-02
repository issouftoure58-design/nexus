import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { comptaApi, type Invoice, type Expense, type ComptaStats, type TVAData, type RelanceFacture, type RelanceStats, type RelanceSettings, type EcritureComptable, type Journal, type BalanceGeneraleResponse, type BalanceAuxiliaireResponse, type BalanceAgeeResponse, type GrandLivreResponse, type CompteDetailResponse, type CompteResultatResponse, type BilanResponse } from '@/lib/api';
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
import { EntityLink } from '@/components/EntityLink';
import { AuxiliaryLedgerModal } from '@/components/modals/AuxiliaryLedgerModal';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'expenses' | 'tva' | 'relances' | 'rapprochement' | 'resultat' | 'bilan' | 'auxiliaires' | 'expert'>('overview');
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);
  const [showExpensePaymentModal, setShowExpensePaymentModal] = useState(false);
  const [pendingExpenseId, setPendingExpenseId] = useState<number | null>(null);
  const [expensePaymentMode, setExpensePaymentMode] = useState('cb');
  // Invoice payment modal
  const [showInvoicePaymentModal, setShowInvoicePaymentModal] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<number | null>(null);
  const [invoicePaymentMode, setInvoicePaymentMode] = useState<'especes' | 'cb' | 'virement' | 'prelevement' | 'cheque'>('cb');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedAuxiliary, setSelectedAuxiliary] = useState<{ type: 'client' | 'fournisseur' | 'personnel'; compte: string; nom: string } | null>(null);
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

  // Filtres rapprochement (à rapprocher)
  const [rapproDateFilter, setRapproDateFilter] = useState<string>('all');
  const [rapproPieceFilter, setRapproPieceFilter] = useState<string>('all');
  const [rapproLibelleFilter, setRapproLibelleFilter] = useState<string>('all');
  const [rapproDebitFilter, setRapproDebitFilter] = useState<string>('all');
  const [rapproCreditFilter, setRapproCreditFilter] = useState<string>('all');

  // Filtres rapprochement (rapprochées)
  const [rapprocheeDateFilter, setRapprocheeDateFilter] = useState<string>('all');
  const [rapprocheePieceFilter, setRapprocheePieceFilter] = useState<string>('all');
  const [rapprocheeLibelleFilter, setRapprocheeLibelleFilter] = useState<string>('all');
  const [rapprocheeDebitFilter, setRapprocheeDebitFilter] = useState<string>('all');
  const [rapprocheeCreditFilter, setRapprocheeCreditFilter] = useState<string>('all');

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // État pour la régénération des écritures
  const [isRegenerating, setIsRegenerating] = useState(false);

  // État pour la consultation des journaux comptables
  const [selectedJournal, setSelectedJournal] = useState<string>('BQ');
  const [journalPeriode, setJournalPeriode] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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

  // Query pour les écritures du journal banque (BQ) pour le rapprochement
  const { data: ecrituresBanqueData, isLoading: ecrituresBanqueLoading, isFetching: ecrituresBanqueFetching, refetch: refetchEcrituresBanque } = useQuery<{ ecritures: EcritureComptable[]; solde_comptable: number }>({
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
  const { data: ecrituresJournalData, isLoading: ecrituresJournalLoading } = useQuery<{ ecritures: EcritureComptable[]; totaux: { debit: number; credit: number; solde: number; solde_banque?: number; solde_caisse?: number } }>({
    queryKey: ['ecritures-journal', selectedJournal, journalPeriode],
    queryFn: () => comptaApi.getEcritures({ journal: selectedJournal, periode: journalPeriode }),
    enabled: activeTab === 'expert' && !!selectedJournal,
  });

  // Documents Comptables - Interface unifiée
  const [docType, setDocType] = useState<'grand-livre' | 'balance' | 'journaux' | 'balance-agee'>('grand-livre');
  const [compteFilter, setCompteFilter] = useState<string>('');
  const [compteFilterApplied, setCompteFilterApplied] = useState<string>('');

  // Query pour le Grand Livre (avec filtre compte optionnel)
  const { data: grandLivreData, isLoading: grandLivreLoading, refetch: refetchGrandLivre } = useQuery<GrandLivreResponse>({
    queryKey: ['grand-livre', statsYear, compteFilterApplied],
    queryFn: () => comptaApi.getGrandLivre({
      exercice: statsYear,
      compte: compteFilterApplied || undefined
    }),
    enabled: activeTab === 'expert' && docType === 'grand-livre',
  });

  // Query pour la Balance Générale (avec sous-comptes)
  const { data: balanceGeneraleData, isLoading: balanceGeneraleLoading, refetch: refetchBalance } = useQuery<BalanceGeneraleResponse>({
    queryKey: ['balance-generale', statsYear, compteFilterApplied],
    queryFn: () => comptaApi.getBalanceGenerale({
      exercice: statsYear,
      avec_sous_comptes: true,
      compte: compteFilterApplied || undefined
    }),
    enabled: activeTab === 'expert' && docType === 'balance',
  });

  // Query pour la Balance Clients
  const { data: balanceClientsData, isLoading: balanceClientsLoading } = useQuery<BalanceAuxiliaireResponse>({
    queryKey: ['balance-clients', statsYear],
    queryFn: () => comptaApi.getBalanceClients(statsYear),
    enabled: activeTab === 'auxiliaires',
  });

  // Query pour la Balance Fournisseurs
  const { data: balanceFournisseursData, isLoading: balanceFournisseursLoading } = useQuery<BalanceAuxiliaireResponse>({
    queryKey: ['balance-fournisseurs', statsYear],
    queryFn: () => comptaApi.getBalanceFournisseurs(statsYear),
    enabled: activeTab === 'auxiliaires',
  });

  // Query pour la Balance Personnel
  const { data: balancePersonnelData, isLoading: balancePersonnelLoading } = useQuery<BalanceAuxiliaireResponse>({
    queryKey: ['balance-personnel', statsYear],
    queryFn: () => comptaApi.getBalancePersonnel(statsYear),
    enabled: activeTab === 'auxiliaires',
  });

  // Query pour la Balance Âgée
  const { data: balanceAgeeData, isLoading: balanceAgeeLoading } = useQuery<BalanceAgeeResponse>({
    queryKey: ['balance-agee'],
    queryFn: () => comptaApi.getBalanceAgee(),
    enabled: activeTab === 'expert' && docType === 'balance-agee',
  });

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

    // Ajouter charges financières si présentes
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

  // Export Bilan
  const exportBilan = () => {
    if (!bilanData) {
      setNotification({ type: 'error', message: 'Données non disponibles' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const data: { categorie: string; poste: string; montant: string }[] = [
      { categorie: 'ACTIF', poste: '', montant: '' },
    ];

    // Immobilisations
    if (bilanData.actif.immobilisations.length > 0) {
      bilanData.actif.immobilisations.forEach(c => {
        data.push({ categorie: 'Actif immobilisé', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    // Stocks
    if (bilanData.actif.stocks.length > 0) {
      bilanData.actif.stocks.forEach(c => {
        data.push({ categorie: 'Stocks', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    // Créances
    if (bilanData.actif.creances.length > 0) {
      bilanData.actif.creances.forEach(c => {
        data.push({ categorie: 'Créances', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    // Trésorerie
    if (bilanData.actif.tresorerie.length > 0) {
      bilanData.actif.tresorerie.forEach(c => {
        data.push({ categorie: 'Trésorerie', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    data.push({ categorie: '', poste: 'TOTAL ACTIF', montant: formatCurrency(bilanData.totaux.actif) });
    data.push({ categorie: '', poste: '', montant: '' });
    data.push({ categorie: 'PASSIF', poste: '', montant: '' });

    // Capitaux propres
    if (bilanData.passif.capitaux.length > 0) {
      bilanData.passif.capitaux.forEach(c => {
        data.push({ categorie: 'Capitaux propres', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    // Dettes
    if (bilanData.passif.dettes.length > 0) {
      bilanData.passif.dettes.forEach(c => {
        data.push({ categorie: 'Dettes', poste: `${c.numero} - ${c.libelle}`, montant: formatCurrency(c.solde) });
      });
    }

    // Découverts bancaires
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

  // Export FEC (Fichier des Écritures Comptables) - Via API backend
  const exportFEC = () => {
    comptaApi.exportFEC(statsYear);
    setNotification({ type: 'success', message: `FEC ${statsYear} en cours de téléchargement...` });
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

  // Calcul des écritures non rapprochées et rapprochées (base)
  const ecrituresNonRapprochees = useMemo(() =>
    (ecrituresBanqueData?.ecritures || []).filter(e => !e.lettrage),
    [ecrituresBanqueData]
  );
  const ecrituresRapprochees = useMemo(() =>
    (ecrituresBanqueData?.ecritures || []).filter(e => e.lettrage),
    [ecrituresBanqueData]
  );

  // Fonction de filtrage montant pour rapprochement
  const matchesRapproMontant = (montant: number, filter: string) => {
    const m = montant / 100;
    switch (filter) {
      case 'all': return true;
      case '0-50': return m <= 50;
      case '50-100': return m > 50 && m <= 100;
      case '100-500': return m > 100 && m <= 500;
      case '500+': return m > 500;
      default: return true;
    }
  };

  // Écritures à rapprocher filtrées
  const filteredEcrituresNonRapprochees = useMemo(() => {
    return ecrituresNonRapprochees.filter(e => {
      if (rapproDateFilter !== 'all' && e.date_ecriture?.slice(0, 7) !== rapproDateFilter) return false;
      if (rapproPieceFilter !== 'all' && e.numero_piece !== rapproPieceFilter) return false;
      if (rapproLibelleFilter !== 'all' && e.libelle !== rapproLibelleFilter) return false;
      if (rapproDebitFilter !== 'all' && !matchesRapproMontant(e.debit || 0, rapproDebitFilter)) return false;
      if (rapproCreditFilter !== 'all' && !matchesRapproMontant(e.credit || 0, rapproCreditFilter)) return false;
      return true;
    });
  }, [ecrituresNonRapprochees, rapproDateFilter, rapproPieceFilter, rapproLibelleFilter, rapproDebitFilter, rapproCreditFilter]);

  // Écritures rapprochées filtrées
  const filteredEcrituresRapprochees = useMemo(() => {
    return ecrituresRapprochees.filter(e => {
      if (rapprocheeDateFilter !== 'all' && e.date_ecriture?.slice(0, 7) !== rapprocheeDateFilter) return false;
      if (rapprocheePieceFilter !== 'all' && e.numero_piece !== rapprocheePieceFilter) return false;
      if (rapprocheeLibelleFilter !== 'all' && e.libelle !== rapprocheeLibelleFilter) return false;
      if (rapprocheeDebitFilter !== 'all' && !matchesRapproMontant(e.debit || 0, rapprocheeDebitFilter)) return false;
      if (rapprocheeCreditFilter !== 'all' && !matchesRapproMontant(e.credit || 0, rapprocheeCreditFilter)) return false;
      return true;
    });
  }, [ecrituresRapprochees, rapprocheeDateFilter, rapprocheePieceFilter, rapprocheeLibelleFilter, rapprocheeDebitFilter, rapprocheeCreditFilter]);

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
          {(['rapprochement', 'resultat', 'bilan', 'auxiliaires', 'expert'] as const).map((tab) => (
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
              {tab === 'auxiliaires' && <><Users className="h-3.5 w-3.5" /> Comptes Auxiliaires</>}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => refetchEcrituresBanque()}
                  disabled={ecrituresBanqueFetching}
                >
                  <RefreshCw className={cn("h-4 w-4", ecrituresBanqueFetching && "animate-spin")} />
                  {ecrituresBanqueFetching ? 'Chargement...' : 'Actualiser'}
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
                  ) : filteredEcrituresNonRapprochees.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      <CheckCircle className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
                      <p className="font-medium text-emerald-600">
                        {ecrituresNonRapprochees.length === 0 ? 'Toutes les écritures sont rapprochées !' : 'Aucune écriture ne correspond aux filtres'}
                      </p>
                      {(rapproDateFilter !== 'all' || rapproPieceFilter !== 'all' || rapproLibelleFilter !== 'all' || rapproDebitFilter !== 'all' || rapproCreditFilter !== 'all') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRapproDateFilter('all');
                            setRapproPieceFilter('all');
                            setRapproLibelleFilter('all');
                            setRapproDebitFilter('all');
                            setRapproCreditFilter('all');
                          }}
                          className="mt-2 text-xs"
                        >
                          Effacer les filtres
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="w-10 py-2 px-3 bg-gray-50">
                              <input
                                type="checkbox"
                                checked={selectedEcrituresForPointage.length === filteredEcrituresNonRapprochees.length && filteredEcrituresNonRapprochees.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEcrituresForPointage(filteredEcrituresNonRapprochees.map(ec => ec.id));
                                  } else {
                                    setSelectedEcrituresForPointage([]);
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                            </th>
                            <th className="text-left py-2 px-3">
                              <select
                                value={rapproDateFilter}
                                onChange={(e) => setRapproDateFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                              >
                                <option value="all">Date ▼</option>
                                {[...new Set(ecrituresNonRapprochees.map(e => e.date_ecriture?.slice(0, 7)).filter(Boolean))].sort().reverse().map(mois => (
                                  <option key={mois} value={mois}>
                                    {new Date(mois + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                                  </option>
                                ))}
                              </select>
                            </th>
                            <th className="text-left py-2 px-3">
                              <select
                                value={rapproPieceFilter}
                                onChange={(e) => setRapproPieceFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                              >
                                <option value="all">Pièce ▼</option>
                                {[...new Set(ecrituresNonRapprochees.map(e => e.numero_piece).filter(Boolean))].sort().map(p => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </th>
                            <th className="text-left py-2 px-3">
                              <select
                                value={rapproLibelleFilter}
                                onChange={(e) => setRapproLibelleFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                              >
                                <option value="all">Libellé ▼</option>
                                {[...new Set(ecrituresNonRapprochees.map(e => e.libelle).filter(Boolean))].sort().map(lib => (
                                  <option key={lib} value={lib}>{lib.length > 30 ? lib.slice(0, 30) + '...' : lib}</option>
                                ))}
                              </select>
                            </th>
                            <th className="text-right py-2 px-3">
                              <select
                                value={rapproDebitFilter}
                                onChange={(e) => setRapproDebitFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-right"
                              >
                                <option value="all">Débit ▼</option>
                                <option value="0-50">0-50€</option>
                                <option value="50-100">50-100€</option>
                                <option value="100-500">100-500€</option>
                                <option value="500+">500€+</option>
                              </select>
                            </th>
                            <th className="text-right py-2 px-3">
                              <select
                                value={rapproCreditFilter}
                                onChange={(e) => setRapproCreditFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-right"
                              >
                                <option value="all">Crédit ▼</option>
                                <option value="0-50">0-50€</option>
                                <option value="50-100">50-100€</option>
                                <option value="100-500">100-500€</option>
                                <option value="500+">500€+</option>
                              </select>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEcrituresNonRapprochees.map((e) => (
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
                            <td colSpan={4} className="py-2 px-3 text-right">
                              Total ({filteredEcrituresNonRapprochees.length} écriture{filteredEcrituresNonRapprochees.length > 1 ? 's' : ''}) :
                            </td>
                            <td className="py-2 px-3 text-right text-green-600">
                              {formatCurrency(filteredEcrituresNonRapprochees.reduce((s, e) => s + (e.debit || 0), 0) / 100)}
                            </td>
                            <td className="py-2 px-3 text-right text-red-600">
                              {formatCurrency(filteredEcrituresNonRapprochees.reduce((s, e) => s + (e.credit || 0), 0) / 100)}
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
                    <span className="text-xs font-normal text-gray-500">
                      ({filteredEcrituresRapprochees.length} écriture{filteredEcrituresRapprochees.length > 1 ? 's' : ''})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredEcrituresRapprochees.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      <Landmark className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p>{ecrituresRapprochees.length === 0 ? 'Aucune écriture rapprochée pour le moment.' : 'Aucune écriture ne correspond aux filtres'}</p>
                      {ecrituresRapprochees.length === 0 && (
                        <p className="text-xs mt-1">Sélectionnez des écritures dans l'onglet "À rapprocher" et cliquez sur "Pointer".</p>
                      )}
                      {(rapprocheeDateFilter !== 'all' || rapprocheePieceFilter !== 'all' || rapprocheeLibelleFilter !== 'all' || rapprocheeDebitFilter !== 'all' || rapprocheeCreditFilter !== 'all') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRapprocheeDateFilter('all');
                            setRapprocheePieceFilter('all');
                            setRapprocheeLibelleFilter('all');
                            setRapprocheeDebitFilter('all');
                            setRapprocheeCreditFilter('all');
                          }}
                          className="mt-2 text-xs"
                        >
                          Effacer les filtres
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left py-2 px-3">
                              <select
                                value={rapprocheeDateFilter}
                                onChange={(e) => setRapprocheeDateFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                              >
                                <option value="all">Date ▼</option>
                                {[...new Set(ecrituresRapprochees.map(e => e.date_ecriture?.slice(0, 7)).filter(Boolean))].sort().reverse().map(mois => (
                                  <option key={mois} value={mois}>
                                    {new Date(mois + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                                  </option>
                                ))}
                              </select>
                            </th>
                            <th className="text-left py-2 px-3">
                              <select
                                value={rapprocheePieceFilter}
                                onChange={(e) => setRapprocheePieceFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                              >
                                <option value="all">Pièce ▼</option>
                                {[...new Set(ecrituresRapprochees.map(e => e.numero_piece).filter(Boolean))].sort().map(p => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </th>
                            <th className="text-left py-2 px-3">
                              <select
                                value={rapprocheeLibelleFilter}
                                onChange={(e) => setRapprocheeLibelleFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600"
                              >
                                <option value="all">Libellé ▼</option>
                                {[...new Set(ecrituresRapprochees.map(e => e.libelle).filter(Boolean))].sort().map(lib => (
                                  <option key={lib} value={lib}>{lib.length > 30 ? lib.slice(0, 30) + '...' : lib}</option>
                                ))}
                              </select>
                            </th>
                            <th className="text-right py-2 px-3">
                              <select
                                value={rapprocheeDebitFilter}
                                onChange={(e) => setRapprocheeDebitFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-right"
                              >
                                <option value="all">Débit ▼</option>
                                <option value="0-50">0-50€</option>
                                <option value="50-100">50-100€</option>
                                <option value="100-500">100-500€</option>
                                <option value="500+">500€+</option>
                              </select>
                            </th>
                            <th className="text-right py-2 px-3">
                              <select
                                value={rapprocheeCreditFilter}
                                onChange={(e) => setRapprocheeCreditFilter(e.target.value)}
                                className="w-full text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:text-cyan-600 text-right"
                              >
                                <option value="all">Crédit ▼</option>
                                <option value="0-50">0-50€</option>
                                <option value="50-100">50-100€</option>
                                <option value="100-500">100-500€</option>
                                <option value="500+">500€+</option>
                              </select>
                            </th>
                            <th className="text-center py-2 px-3 text-gray-600">Code</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEcrituresRapprochees.map((e) => (
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
                            <td colSpan={3} className="py-2 px-3 text-right">
                              Total ({filteredEcrituresRapprochees.length} écriture{filteredEcrituresRapprochees.length > 1 ? 's' : ''}) :
                            </td>
                            <td className="py-2 px-3 text-right text-green-600">
                              {formatCurrency(filteredEcrituresRapprochees.reduce((s, e) => s + (e.debit || 0), 0) / 100)}
                            </td>
                            <td className="py-2 px-3 text-right text-red-600">
                              {formatCurrency(filteredEcrituresRapprochees.reduce((s, e) => s + (e.credit || 0), 0) / 100)}
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

        {/* Comptes Auxiliaires Tab */}
        {activeTab === 'auxiliaires' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Balance Clients */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      Balance Clients (411)
                    </CardTitle>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {balanceClientsData?.comptes?.length || 0} comptes
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {balanceClientsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : balanceClientsData?.comptes && balanceClientsData.comptes.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {balanceClientsData.comptes.map((compte) => (
                        <div
                          key={compte.compte}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedAuxiliary({
                            type: 'client',
                            compte: compte.compte,
                            nom: compte.nom
                          })}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold">
                              {compte.nom.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{compte.nom}</p>
                              <p className="text-xs text-gray-500 font-mono">{compte.compte}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${compte.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(Math.abs(compte.solde))}
                            </p>
                            <p className="text-xs text-gray-500">{compte.solde >= 0 ? 'Débiteur' : 'Créditeur'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 py-8">Aucun compte client auxiliaire</p>
                  )}
                  {balanceClientsData?.totaux && (
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <span className="font-medium text-gray-600">Total Clients</span>
                      <span className={`font-bold ${balanceClientsData.totaux.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(balanceClientsData.totaux.solde))}
                        <span className="text-xs ml-1">{balanceClientsData.totaux.solde >= 0 ? 'D' : 'C'}</span>
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Balance Fournisseurs */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Building2 className="h-5 w-5 text-orange-600" />
                      </div>
                      Balance Fournisseurs (401)
                    </CardTitle>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      {balanceFournisseursData?.comptes?.length || 0} comptes
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {balanceFournisseursLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                    </div>
                  ) : balanceFournisseursData?.comptes && balanceFournisseursData.comptes.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {balanceFournisseursData.comptes.map((compte) => (
                        <div
                          key={compte.compte}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedAuxiliary({
                            type: 'fournisseur',
                            compte: compte.compte,
                            nom: compte.nom
                          })}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-semibold">
                              {compte.nom.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{compte.nom}</p>
                              <p className="text-xs text-gray-500 font-mono">{compte.compte}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${compte.solde < 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(Math.abs(compte.solde))}
                            </p>
                            <p className="text-xs text-gray-500">{compte.solde >= 0 ? 'Débiteur' : 'Créditeur'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 py-8">Aucun compte fournisseur auxiliaire</p>
                  )}
                  {balanceFournisseursData?.totaux && (
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <span className="font-medium text-gray-600">Total Fournisseurs</span>
                      <span className={`font-bold ${balanceFournisseursData.totaux.solde < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(balanceFournisseursData.totaux.solde))}
                        <span className="text-xs ml-1">{balanceFournisseursData.totaux.solde >= 0 ? 'D' : 'C'}</span>
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Balance Personnel */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <UserCheck className="h-5 w-5 text-purple-600" />
                      </div>
                      Balance Personnel (421/431)
                    </CardTitle>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      {balancePersonnelData?.comptes?.length || 0} comptes
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {balancePersonnelLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    </div>
                  ) : balancePersonnelData?.comptes && balancePersonnelData.comptes.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {balancePersonnelData.comptes.map((compte) => (
                        <div
                          key={compte.compte}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-purple-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedAuxiliary({
                            type: 'personnel',
                            compte: compte.compte,
                            nom: compte.nom
                          })}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-semibold">
                              {compte.nom.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{compte.nom}</p>
                              <p className="text-xs text-gray-500 font-mono">{compte.compte}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${compte.solde < 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(Math.abs(compte.solde))}
                            </p>
                            <p className="text-xs text-gray-500">{compte.solde >= 0 ? 'Débiteur' : 'Créditeur'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 py-8">Aucun compte personnel auxiliaire</p>
                  )}
                  {balancePersonnelData?.totaux && (
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <span className="font-medium text-gray-600">Total Personnel</span>
                      <span className={`font-bold ${balancePersonnelData.totaux.solde < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(balancePersonnelData.totaux.solde))}
                        <span className="text-xs ml-1">{balancePersonnelData.totaux.solde >= 0 ? 'D' : 'C'}</span>
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Info */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-700">
              <p className="font-medium mb-1">Comptes Auxiliaires</p>
              <p className="text-purple-600">
                Cliquez sur un compte pour voir le grand livre détaillé avec toutes les écritures et le solde progressif.
                Les comptes 411 correspondent aux clients, 401 aux fournisseurs, et 421/431 au personnel.
              </p>
            </div>
          </div>
        )}

        {/* Auxiliary Ledger Modal */}
        {selectedAuxiliary && (
          <AuxiliaryLedgerModal
            type={selectedAuxiliary.type}
            compte={selectedAuxiliary.compte}
            nom={selectedAuxiliary.nom}
            onClose={() => setSelectedAuxiliary(null)}
          />
        )}

        {/* Expert-Comptable Tab */}
        {activeTab === 'expert' && (
          <div className="space-y-6">
            {/* Documents Comptables - Interface Unifiée */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-500" />
                  Documents Comptables - Exercice {statsYear}
                </CardTitle>
                <p className="text-sm text-gray-500">Consultez et exportez vos documents comptables avec filtrage par compte</p>
              </CardHeader>
              <CardContent>
                {/* Sélecteur de type de document + Filtre compte */}
                <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                  {/* Type de document */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Type de document</label>
                    <div className="flex gap-1 bg-white p-1 rounded-lg border">
                      {[
                        { id: 'grand-livre', label: 'Grand Livre', icon: FileText },
                        { id: 'balance', label: 'Balance', icon: Scale },
                        { id: 'journaux', label: 'Journaux', icon: Calculator },
                        { id: 'balance-agee', label: 'Balance Âgée', icon: Clock },
                      ].map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => {
                            setDocType(doc.id as typeof docType);
                            setCompteFilter('');
                            setCompteFilterApplied('');
                          }}
                          className={cn(
                            "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5",
                            docType === doc.id
                              ? "bg-purple-100 text-purple-700"
                              : "text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          <doc.icon className="h-3.5 w-3.5" />
                          {doc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filtre par compte */}
                  {(docType === 'grand-livre' || docType === 'balance') && (
                    <div className="flex-1 min-w-[400px]">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Filtrer par compte</label>
                      <div className="flex gap-2">
                        <select
                          value={compteFilter}
                          onChange={(e) => {
                            setCompteFilter(e.target.value);
                            if (e.target.value) {
                              setCompteFilterApplied(e.target.value);
                            }
                          }}
                          className="border rounded-lg px-3 py-2 text-sm min-w-[200px]"
                        >
                          <option value="">-- Tous les comptes --</option>
                          <optgroup label="Classes">
                            <option value="1">1 - Capitaux</option>
                            <option value="2">2 - Immobilisations</option>
                            <option value="3">3 - Stocks</option>
                            <option value="4">4 - Tiers</option>
                            <option value="5">5 - Financiers</option>
                            <option value="6">6 - Charges</option>
                            <option value="7">7 - Produits</option>
                          </optgroup>
                          <optgroup label="Tiers">
                            <option value="401">401 - Fournisseurs</option>
                            <option value="411">411 - Clients</option>
                            <option value="421">421 - Personnel</option>
                            <option value="431">431 - Sécurité sociale</option>
                            <option value="445">445 - TVA</option>
                          </optgroup>
                          <optgroup label="Financiers">
                            <option value="512">512 - Banque</option>
                            <option value="530">530 - Caisse</option>
                          </optgroup>
                          <optgroup label="Charges courantes">
                            <option value="601">601 - Achats matières</option>
                            <option value="606">606 - Fournitures</option>
                            <option value="613">613 - Loyers</option>
                            <option value="616">616 - Assurances</option>
                            <option value="626">626 - Télécom</option>
                            <option value="641">641 - Salaires</option>
                            <option value="645">645 - Charges sociales</option>
                          </optgroup>
                          <optgroup label="Produits">
                            <option value="706">706 - Prestations services</option>
                            <option value="707">707 - Ventes marchandises</option>
                          </optgroup>
                        </select>
                        <Input
                          placeholder="Ou saisir un compte..."
                          value={compteFilter}
                          onChange={(e) => setCompteFilter(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setCompteFilterApplied(compteFilter);
                            }
                          }}
                        />
                        <Button
                          onClick={() => setCompteFilterApplied(compteFilter)}
                          className="gap-2"
                        >
                          <Filter className="h-4 w-4" />
                          Filtrer
                        </Button>
                        {compteFilterApplied && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCompteFilter('');
                              setCompteFilterApplied('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {compteFilterApplied && (
                        <p className="text-xs text-purple-600 mt-1">
                          Filtre actif : comptes commençant par "{compteFilterApplied}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Bouton export */}
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        if (docType === 'grand-livre') exportGrandLivre();
                        else if (docType === 'balance') exportBalance();
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Exporter
                    </Button>
                  </div>
                </div>

                {/* Contenu du document sélectionné */}

                {/* Grand Livre */}
                {docType === 'grand-livre' && (
                  <>
                    {grandLivreLoading ? (
                      <div className="py-8 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                        <p className="text-gray-500 mt-2">Chargement du Grand Livre...</p>
                      </div>
                    ) : grandLivreData?.grand_livre && grandLivreData.grand_livre.length > 0 ? (
                      <div className="space-y-4 max-h-[600px] overflow-y-auto">
                        {grandLivreData.grand_livre.map((compte) => (
                          <div key={compte.compte_numero} className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 flex justify-between items-center">
                              <div>
                                <span className="font-mono text-sm bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{compte.compte_numero}</span>
                                <span className="ml-2 font-medium">{compte.compte_libelle}</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-green-600 mr-4">D: {formatCurrency(compte.total_debit)}</span>
                                <span className="text-red-600 mr-4">C: {formatCurrency(compte.total_credit)}</span>
                                <span className={compte.solde >= 0 ? "text-blue-600 font-medium" : "text-orange-600 font-medium"}>
                                  Solde: {formatCurrency(compte.solde)}
                                </span>
                              </div>
                            </div>
                            {compte.mouvements && compte.mouvements.length > 0 && (
                              <div className="max-h-48 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Jnl</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Libellé</th>
                                      <th className="text-right py-2 px-3 font-medium text-gray-600">Débit</th>
                                      <th className="text-right py-2 px-3 font-medium text-gray-600">Crédit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {compte.mouvements.map((e, idx) => (
                                      <tr key={idx} className="border-t hover:bg-gray-50">
                                        <td className="py-1.5 px-3">{formatDate(e.date)}</td>
                                        <td className="py-1.5 px-3 text-xs text-gray-500">{e.journal}</td>
                                        <td className="py-1.5 px-3">{e.libelle}</td>
                                        <td className="py-1.5 px-3 text-right text-green-600">{e.debit > 0 ? formatCurrency(e.debit) : ''}</td>
                                        <td className="py-1.5 px-3 text-right text-red-600">{e.credit > 0 ? formatCurrency(e.credit) : ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="bg-purple-50 rounded-lg p-4 flex justify-between items-center sticky bottom-0">
                          <span className="font-medium text-purple-700">Totaux Grand Livre {compteFilterApplied ? `(${compteFilterApplied}*)` : ''} - {grandLivreData.nb_comptes} compte(s)</span>
                          <div>
                            <span className="text-green-600 mr-6">Total Débit: {formatCurrency(grandLivreData.totaux?.debit || 0)}</span>
                            <span className="text-red-600">Total Crédit: {formatCurrency(grandLivreData.totaux?.credit || 0)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-gray-500">
                        {compteFilterApplied
                          ? `Aucune écriture trouvée pour les comptes commençant par "${compteFilterApplied}"`
                          : 'Aucune écriture trouvée pour cet exercice'
                        }
                      </div>
                    )}
                  </>
                )}

                {/* Balance Générale */}
                {docType === 'balance' && (
                  <>
                    {balanceGeneraleLoading ? (
                      <div className="py-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                      </div>
                    ) : balanceGeneraleData?.balance && balanceGeneraleData.balance.length > 0 ? (
                      <>
                        <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="text-left py-2 px-3 font-medium text-gray-600">Compte</th>
                                <th className="text-left py-2 px-3 font-medium text-gray-600">Libellé</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-600">Mvt Débit</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-600">Mvt Crédit</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-600">Solde D</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-600">Solde C</th>
                              </tr>
                            </thead>
                            <tbody>
                              {balanceGeneraleData.balance.map((c) => (
                                <React.Fragment key={c.numero}>
                                  <tr className="border-t hover:bg-gray-50 font-medium">
                                    <td className="py-2 px-3">
                                      <span className="font-mono bg-gray-100 px-1.5 rounded">{c.numero}</span>
                                    </td>
                                    <td className="py-2 px-3">{c.libelle}</td>
                                    <td className="py-2 px-3 text-right text-green-600">{formatCurrency(c.debit)}</td>
                                    <td className="py-2 px-3 text-right text-red-600">{formatCurrency(c.credit)}</td>
                                    <td className="py-2 px-3 text-right">{c.solde_debiteur > 0 ? formatCurrency(c.solde_debiteur) : ''}</td>
                                    <td className="py-2 px-3 text-right">{c.solde_crediteur > 0 ? formatCurrency(c.solde_crediteur) : ''}</td>
                                  </tr>
                                  {c.sous_comptes?.map((sc) => (
                                    <tr key={sc.numero} className="border-t hover:bg-blue-50 text-sm text-gray-600 bg-gray-50">
                                      <td className="py-1.5 px-3 pl-8">
                                        <span className="font-mono text-xs bg-blue-100 text-blue-700 px-1.5 rounded">{sc.numero}</span>
                                      </td>
                                      <td className="py-1.5 px-3">{sc.libelle}</td>
                                      <td className="py-1.5 px-3 text-right text-green-500">{formatCurrency(sc.debit)}</td>
                                      <td className="py-1.5 px-3 text-right text-red-500">{formatCurrency(sc.credit)}</td>
                                      <td className="py-1.5 px-3 text-right" colSpan={2}>{formatCurrency(sc.solde)}</td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 flex justify-between items-center mt-2">
                          <span className="font-bold text-green-700">TOTAUX {compteFilterApplied ? `(${compteFilterApplied}*)` : ''} - {balanceGeneraleData.nb_comptes} compte(s)</span>
                          <div className="font-bold">
                            <span className="text-green-700 mr-4">D: {formatCurrency(balanceGeneraleData.totaux?.debit || 0)}</span>
                            <span className="text-red-700 mr-4">C: {formatCurrency(balanceGeneraleData.totaux?.credit || 0)}</span>
                            <span className="text-blue-700 mr-4">SD: {formatCurrency(balanceGeneraleData.totaux?.solde_debiteur || 0)}</span>
                            <span className="text-orange-700">SC: {formatCurrency(balanceGeneraleData.totaux?.solde_crediteur || 0)}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-gray-500">
                        {compteFilterApplied
                          ? `Aucun compte trouvé commençant par "${compteFilterApplied}"`
                          : 'Aucune donnée'
                        }
                      </div>
                    )}
                  </>
                )}

                {/* Journaux */}
                {docType === 'journaux' && (
                  <div className="space-y-4">
                    <div className="flex gap-4 items-center flex-wrap">
                      <div className="min-w-[200px]">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Journal</label>
                        <select
                          value={selectedJournal}
                          onChange={(e) => setSelectedJournal(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">-- Choisir un journal --</option>
                          <option value="BQ">BQ - Banque</option>
                          <option value="CA">CA - Caisse</option>
                          <option value="VT">VT - Ventes</option>
                          <option value="AC">AC - Achats</option>
                          <option value="PA">PA - Paie</option>
                          <option value="OD">OD - Opérations Diverses</option>
                          <option value="AN">AN - À-Nouveaux</option>
                        </select>
                      </div>
                      <div className="min-w-[200px]">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Période</label>
                        <select
                          value={journalPeriode}
                          onChange={(e) => setJournalPeriode(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                        >
                          {(() => {
                            const options = [];
                            const now = new Date();
                            // Inclure 6 mois futurs + 24 mois passés
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
                      {selectedJournal && ecrituresJournalData?.ecritures && (
                        <div className="ml-auto text-sm text-gray-600">
                          {ecrituresJournalData.ecritures.length} écriture(s)
                        </div>
                      )}
                    </div>

                    {selectedJournal && (
                      <>
                        {ecrituresJournalLoading ? (
                          <div className="py-8 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                          </div>
                        ) : ecrituresJournalData?.ecritures && ecrituresJournalData.ecritures.length > 0 ? (
                          <>
                            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                  <tr>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Pièce</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Compte</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Libellé</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600">Débit</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600">Crédit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ecrituresJournalData.ecritures.map((e) => (
                                    <tr key={e.id} className="border-t hover:bg-gray-50">
                                      <td className="py-1.5 px-3">{formatDate(e.date_ecriture)}</td>
                                      <td className="py-1.5 px-3 text-xs text-gray-500">{e.numero_piece}</td>
                                      <td className="py-1.5 px-3">
                                        <span className="font-mono text-xs bg-gray-100 px-1 rounded">{e.compte_numero}</span>
                                      </td>
                                      <td className="py-1.5 px-3">{e.libelle}</td>
                                      <td className="py-1.5 px-3 text-right text-green-600">{e.debit > 0 ? formatCurrency(e.debit / 100) : ''}</td>
                                      <td className="py-1.5 px-3 text-right text-red-600">{e.credit > 0 ? formatCurrency(e.credit / 100) : ''}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="bg-gray-100 rounded-lg p-3 flex justify-between items-center">
                              <span className="font-medium text-gray-700">Totaux Journal {selectedJournal}</span>
                              <div className="font-medium flex items-center gap-4">
                                <span className="text-green-700">Débit: {formatCurrency((ecrituresJournalData.totaux?.debit || 0) / 100)}</span>
                                <span className="text-red-700">Crédit: {formatCurrency((ecrituresJournalData.totaux?.credit || 0) / 100)}</span>
                                {selectedJournal === 'BQ' && ecrituresJournalData.totaux?.solde_banque !== undefined && (
                                  <span className={cn(
                                    "px-3 py-1 rounded-lg",
                                    ecrituresJournalData.totaux.solde_banque >= 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                                  )}>
                                    Solde Banque: {formatCurrency(ecrituresJournalData.totaux.solde_banque)}
                                  </span>
                                )}
                                {selectedJournal === 'CA' && ecrituresJournalData.totaux?.solde_caisse !== undefined && (
                                  <span className={cn(
                                    "px-3 py-1 rounded-lg",
                                    ecrituresJournalData.totaux.solde_caisse >= 0 ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"
                                  )}>
                                    Solde Caisse: {formatCurrency(ecrituresJournalData.totaux.solde_caisse)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="py-8 text-center text-gray-500">
                            Aucune écriture pour ce journal sur cette période
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Balance Âgée */}
                {docType === 'balance-agee' && (
                  <>
                    {balanceAgeeLoading ? (
                      <div className="py-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                      </div>
                    ) : balanceAgeeData?.clients && balanceAgeeData.clients.length > 0 ? (
                      <>
                        {/* KPIs */}
                        <div className="grid grid-cols-6 gap-3 mb-6">
                          <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">Total dû</p>
                            <p className="text-lg font-bold text-gray-800">{formatCurrency((balanceAgeeData.totaux?.total_du || 0) / 100)}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-green-600">Non échu</p>
                            <p className="text-lg font-bold text-green-700">{formatCurrency((balanceAgeeData.totaux?.non_echu || 0) / 100)}</p>
                          </div>
                          <div className="bg-yellow-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-yellow-600">0-30 jours</p>
                            <p className="text-lg font-bold text-yellow-700">{formatCurrency((balanceAgeeData.totaux?.echu_0_30 || 0) / 100)}</p>
                          </div>
                          <div className="bg-orange-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-orange-600">31-60 jours</p>
                            <p className="text-lg font-bold text-orange-700">{formatCurrency((balanceAgeeData.totaux?.echu_31_60 || 0) / 100)}</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-red-600">61-90 jours</p>
                            <p className="text-lg font-bold text-red-700">{formatCurrency((balanceAgeeData.totaux?.echu_61_90 || 0) / 100)}</p>
                          </div>
                          <div className="bg-rose-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-rose-600">+90 jours</p>
                            <p className="text-lg font-bold text-rose-700">{formatCurrency((balanceAgeeData.totaux?.echu_plus_90 || 0) / 100)}</p>
                          </div>
                        </div>

                        {/* Tableau */}
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-amber-50">
                              <tr>
                                <th className="text-left py-2 px-3 font-medium text-amber-700">Compte</th>
                                <th className="text-left py-2 px-3 font-medium text-amber-700">Client</th>
                                <th className="text-right py-2 px-3 font-medium text-amber-700">Total dû</th>
                                <th className="text-right py-2 px-3 font-medium text-green-600">Non échu</th>
                                <th className="text-right py-2 px-3 font-medium text-yellow-600">0-30j</th>
                                <th className="text-right py-2 px-3 font-medium text-orange-600">31-60j</th>
                                <th className="text-right py-2 px-3 font-medium text-red-600">61-90j</th>
                                <th className="text-right py-2 px-3 font-medium text-rose-600">+90j</th>
                              </tr>
                            </thead>
                            <tbody>
                              {balanceAgeeData.clients.map((c) => (
                                <tr key={c.client_id} className="border-t hover:bg-amber-50">
                                  <td className="py-2 px-3">
                                    <span className="font-mono text-xs bg-amber-100 text-amber-700 px-1.5 rounded">{c.compte}</span>
                                  </td>
                                  <td className="py-2 px-3">{c.client_nom}</td>
                                  <td className="py-2 px-3 text-right font-medium">{formatCurrency(c.total_du / 100)}</td>
                                  <td className="py-2 px-3 text-right text-green-600">{c.non_echu > 0 ? formatCurrency(c.non_echu / 100) : '-'}</td>
                                  <td className="py-2 px-3 text-right text-yellow-600">{c.echu_0_30 > 0 ? formatCurrency(c.echu_0_30 / 100) : '-'}</td>
                                  <td className="py-2 px-3 text-right text-orange-600">{c.echu_31_60 > 0 ? formatCurrency(c.echu_31_60 / 100) : '-'}</td>
                                  <td className="py-2 px-3 text-right text-red-600">{c.echu_61_90 > 0 ? formatCurrency(c.echu_61_90 / 100) : '-'}</td>
                                  <td className="py-2 px-3 text-right text-rose-600">{c.echu_plus_90 > 0 ? formatCurrency(c.echu_plus_90 / 100) : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-gray-500">
                        Aucune créance client à analyser
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Exports pour Transmission */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-purple-500" />
                  Exports pour Transmission
                </CardTitle>
                <p className="text-sm text-gray-500">Exportez vos données comptables pour votre expert-comptable</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportGrandLivre}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">Grand Livre</h4>
                        <p className="text-xs text-gray-500">Écritures comptables</p>
                      </div>
                      <Download className="h-5 w-5 text-gray-400" />
                    </CardContent>
                  </Card>

                  <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportBalance}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <Scale className="h-6 w-6 text-green-600" />
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
                        <h4 className="font-medium">Journal Ventes</h4>
                        <p className="text-xs text-gray-500">Factures</p>
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
                        <h4 className="font-medium">Journal Achats</h4>
                        <p className="text-xs text-gray-500">Dépenses</p>
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
                        <h4 className="font-medium">Journal Paie</h4>
                        <p className="text-xs text-gray-500">Salaires</p>
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
                        <h4 className="font-medium">Compte Résultat</h4>
                        <p className="text-xs text-gray-500">P&L</p>
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
                        <p className="text-xs text-gray-500">Actif/Passif</p>
                      </div>
                      <Download className="h-5 w-5 text-gray-400" />
                    </CardContent>
                  </Card>

                  <Card className="border hover:shadow-md transition-shadow cursor-pointer" onClick={exportFEC}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="p-3 bg-indigo-100 rounded-lg">
                        <Landmark className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">FEC</h4>
                        <p className="text-xs text-gray-500">Format légal</p>
                      </div>
                      <Download className="h-5 w-5 text-gray-400" />
                    </CardContent>
                  </Card>
                </div>

                {/* Actions */}
                <div className="flex gap-4 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={isRegenerating}
                    onClick={async () => {
                      setIsRegenerating(true);
                      try {
                        const result = await comptaApi.genererToutesEcritures();
                        setNotification({ type: 'success', message: result.message || 'Écritures régénérées' });
                        setTimeout(() => window.location.reload(), 1500);
                      } catch (err) {
                        console.error('[COMPTA] Erreur régénération:', err);
                        setNotification({ type: 'error', message: 'Erreur lors de la régénération' });
                        setIsRegenerating(false);
                        setTimeout(() => setNotification(null), 3000);
                      }
                    }}
                  >
                    <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
                    {isRegenerating ? 'Régénération...' : 'Régénérer les écritures'}
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={async () => {
                      const exercicePrecedent = new Date().getFullYear() - 1;
                      const confirmer = confirm(
                        `Générer les à nouveaux pour ${exercicePrecedent + 1} à partir de l'exercice ${exercicePrecedent} ?\n\n` +
                        `Cette action va reporter les soldes des comptes de bilan et affecter le résultat de l'exercice ${exercicePrecedent}.`
                      );
                      if (!confirmer) return;

                      try {
                        const result = await comptaApi.genererANouveaux(exercicePrecedent);
                        const message = result.resultat !== undefined
                          ? `${result.message}\nRésultat: ${result.resultat?.toFixed(2)}€ (${result.resultat_type})`
                          : result.message;
                        setNotification({ type: 'success', message });
                        window.location.reload();
                      } catch (err: unknown) {
                        const error = err as Error;
                        setNotification({ type: 'error', message: error.message || 'Erreur génération à nouveaux' });
                      }
                      setTimeout(() => setNotification(null), 5000);
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    Générer les À-Nouveaux
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Connexion Expert-Comptable */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-500" />
                  Connexion Expert-Comptable
                </CardTitle>
                <p className="text-sm text-gray-500">Donnez accès à vos données comptables à votre expert</p>
              </CardHeader>
              <CardContent>
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
