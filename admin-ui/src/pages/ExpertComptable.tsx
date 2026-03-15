import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, comptaApi, type Invoice, type Expense, type EcritureComptable, type BalanceGeneraleResponse, type BalanceAgeeResponse, type GrandLivreResponse, type CompteResultatResponse, type BilanResponse } from '@/lib/api';
import {
  Euro,
  FileText,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Filter,
  Download,
  Scale,
  Clock,
  Calculator,
  Landmark,
  BarChart3,
  Wallet,
  UserCheck,
  Link2,
  Share2,
  Users,
  Mail,
} from 'lucide-react';
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

const AVAILABLE_YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime()) || date.getFullYear() < 2000) return '-';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

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

export default function ExpertComptable({ embedded }: { embedded?: boolean } = {}) {
  // State
  const [selectedJournal, setSelectedJournal] = useState<string>('BQ');
  const [journalPeriode, setJournalPeriode] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [docType, setDocType] = useState<'grand-livre' | 'balance' | 'journaux' | 'balance-agee'>('grand-livre');
  const [compteFilter, setCompteFilter] = useState<string>('');
  const [compteFilterApplied, setCompteFilterApplied] = useState<string>('');
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries pour les documents comptables
  const { data: ecrituresJournalData, isLoading: ecrituresJournalLoading } = useQuery<{ ecritures: EcritureComptable[]; totaux: { debit: number; credit: number; solde: number; solde_banque?: number; solde_caisse?: number } }>({
    queryKey: ['ecritures-journal', selectedJournal, journalPeriode],
    queryFn: () => comptaApi.getEcritures({ journal: selectedJournal, periode: journalPeriode }),
    enabled: docType === 'journaux' && !!selectedJournal,
  });

  const { data: grandLivreData, isLoading: grandLivreLoading } = useQuery<GrandLivreResponse>({
    queryKey: ['grand-livre', statsYear, compteFilterApplied],
    queryFn: () => comptaApi.getGrandLivre({
      exercice: statsYear,
      compte: compteFilterApplied || undefined
    }),
    enabled: docType === 'grand-livre',
  });

  const { data: balanceGeneraleData, isLoading: balanceGeneraleLoading } = useQuery<BalanceGeneraleResponse>({
    queryKey: ['balance-generale', statsYear, compteFilterApplied],
    queryFn: () => comptaApi.getBalanceGenerale({
      exercice: statsYear,
      avec_sous_comptes: true,
      compte: compteFilterApplied || undefined
    }),
    enabled: docType === 'balance',
  });

  const { data: balanceAgeeData, isLoading: balanceAgeeLoading } = useQuery<BalanceAgeeResponse>({
    queryKey: ['balance-agee'],
    queryFn: () => comptaApi.getBalanceAgee(),
    enabled: docType === 'balance-agee',
  });

  // Queries pour les exports
  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => comptaApi.getFactures(),
  });

  const { data: expensesData } = useQuery({
    queryKey: ['expenses'],
    queryFn: comptaApi.getDepenses,
  });

  const { data: compteResultatData } = useQuery<CompteResultatResponse>({
    queryKey: ['compte-resultat', { exercice: statsYear }],
    queryFn: () => comptaApi.getCompteResultat({ exercice: statsYear }),
  });

  const { data: bilanData } = useQuery<BilanResponse>({
    queryKey: ['bilan', { exercice: statsYear }],
    queryFn: () => comptaApi.getBilan({ exercice: statsYear }),
  });

  // Export functions
  const exportGrandLivre = () => {
    const factures = invoicesData?.factures || [];
    const depenses = expensesData?.depenses || [];

    const entries: Array<{date: string; piece: string; compte: string; libelle: string; debit: string; credit: string}> = [];

    factures.forEach((f: Invoice) => {
      entries.push({
        date: f.date_facture,
        piece: f.numero,
        compte: '411 - Clients',
        libelle: `Facture ${f.numero} - ${f.client_nom}`,
        debit: ((f.montant_ttc || 0) / 100).toFixed(2),
        credit: ''
      });
      entries.push({
        date: f.date_facture,
        piece: f.numero,
        compte: '706 - Prestations de services',
        libelle: `Facture ${f.numero} - ${f.client_nom}`,
        debit: '',
        credit: ((f.montant_ht || f.montant_ttc || 0) / 100).toFixed(2)
      });
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

    depenses.forEach((d: Expense) => {
      const compteCharge = COMPTE_PAR_CATEGORIE[d.categorie] || '658 - Charges diverses';
      entries.push({
        date: d.date_depense,
        piece: `DEP-${d.id}`,
        compte: compteCharge,
        libelle: d.libelle || d.categorie,
        debit: ((d.montant || 0) / 100).toFixed(2),
        credit: ''
      });
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
      entries.push({
        date: d.date_depense,
        piece: `DEP-${d.id}`,
        compte: '401 - Fournisseurs',
        libelle: d.libelle || d.categorie,
        debit: '',
        credit: ((d.montant_ttc || d.montant || 0) / 100).toFixed(2)
      });
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

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    exportToCSV(entries, 'grand_livre', ['Date', 'Piece', 'Compte', 'Libelle', 'Debit', 'Credit']);
    setNotification({ type: 'success', message: 'Grand Livre exporté' });
    setTimeout(() => setNotification(null), 3000);
  };

  const exportBalance = () => {
    const factures = invoicesData?.factures || [];
    const depenses = expensesData?.depenses || [];

    const totalFacturesTTC = factures.reduce((sum: number, f: Invoice) => sum + (f.montant_ttc || 0), 0) / 100;
    const totalFacturesHT = factures.reduce((sum: number, f: Invoice) => sum + (f.montant_ht || f.montant_ttc || 0), 0) / 100;
    const totalTVACollectee = factures.reduce((sum: number, f: Invoice) => sum + (f.montant_tva || 0), 0) / 100;
    const totalFacturesPayees = factures.filter((f: Invoice) => f.statut === 'payee').reduce((sum: number, f: Invoice) => sum + (f.montant_ttc || 0), 0) / 100;

    const depensesParCategorie: Record<string, number> = {};
    let totalDepensesHT = 0;
    let totalDepensesTTC = 0;
    let totalTVADeductible = 0;
    let totalDepensesPayees = 0;

    depenses.forEach((d: Expense) => {
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

    const data: Array<{compte: string; debit: string; credit: string; solde: string}> = [];

    data.push({ compte: '411 - Clients', debit: totalFacturesTTC.toFixed(2), credit: totalFacturesPayees.toFixed(2), solde: (totalFacturesTTC - totalFacturesPayees).toFixed(2) });
    data.push({ compte: '401 - Fournisseurs', debit: totalDepensesPayees.toFixed(2), credit: totalDepensesTTC.toFixed(2), solde: (totalDepensesPayees - totalDepensesTTC).toFixed(2) });
    data.push({ compte: '44566 - TVA déductible', debit: totalTVADeductible.toFixed(2), credit: '0.00', solde: totalTVADeductible.toFixed(2) });
    data.push({ compte: '44571 - TVA collectée', debit: '0.00', credit: totalTVACollectee.toFixed(2), solde: (-totalTVACollectee).toFixed(2) });
    data.push({ compte: '512 - Banque', debit: totalFacturesPayees.toFixed(2), credit: totalDepensesPayees.toFixed(2), solde: (totalFacturesPayees - totalDepensesPayees).toFixed(2) });

    Object.entries(depensesParCategorie).sort().forEach(([cat, montant]) => {
      const compte = COMPTE_PAR_CATEGORIE[cat] || '658 - Charges diverses';
      data.push({ compte, debit: montant.toFixed(2), credit: '0.00', solde: montant.toFixed(2) });
    });

    data.push({ compte: '706 - Prestations de services', debit: '0.00', credit: totalFacturesHT.toFixed(2), solde: (-totalFacturesHT).toFixed(2) });

    const totalDebit = data.reduce((s, d) => s + parseFloat(d.debit), 0);
    const totalCredit = data.reduce((s, d) => s + parseFloat(d.credit), 0);
    data.push({ compte: 'TOTAL', debit: totalDebit.toFixed(2), credit: totalCredit.toFixed(2), solde: (totalDebit - totalCredit).toFixed(2) });

    exportToCSV(data, 'balance', ['Compte', 'Debit', 'Credit', 'Solde']);
    setNotification({ type: 'success', message: 'Balance exportée' });
    setTimeout(() => setNotification(null), 3000);
  };

  const exportFacturesToExcel = () => {
    const factures = invoicesData?.factures || [];
    const data = factures.map((f: Invoice) => ({
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
    const data = depenses.map((d: Expense) => ({
      date: d.date_depense,
      categorie: EXPENSE_CATEGORIES[d.categorie] || d.categorie,
      description: d.description || d.libelle,
      montant: ((d.montant || 0) / 100).toFixed(2),
      tva: ((d.montant_tva || 0) / 100).toFixed(2)
    }));
    exportToCSV(data, 'depenses', ['Date', 'Categorie', 'Description', 'Montant', 'TVA']);
  };

  const exportJournalPaie = async () => {
    try {
      const journaux = await api.get<{ periode: string; nb_salaries: number; total_brut: number; total_net: number; total_cotisations_patronales: number; total_cotisations_salariales: number }[]>(`/admin/rh/paie/journal?annee=${statsYear}`);

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

  const exportFEC = () => {
    comptaApi.exportFEC(statsYear);
    setNotification({ type: 'success', message: `FEC ${statsYear} en cours de téléchargement...` });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleInviteExpert = () => {
    setNotification({ type: 'error', message: 'Fonctionnalité en cours de développement' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleGenerateAccessLink = () => {
    setNotification({ type: 'error', message: 'Fonctionnalité en cours de développement' });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className={embedded ? '' : 'p-6'}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expert-Comptable</h1>
            <p className="text-sm text-gray-500">Journaux, grand livre, balance et exports</p>
          </div>
        )}

        {/* Sélecteur d'année */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-2">
          <select
            value={statsYear}
            onChange={(e) => setStatsYear(Number(e.target.value))}
            className="px-2 py-1 border-0 bg-white rounded text-sm"
          >
            {AVAILABLE_YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={cn(
          "mb-6 p-3 rounded-lg flex items-center gap-2",
          notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        )}>
          {notification.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {notification.message}
          <Button variant="ghost" size="sm" onClick={() => setNotification(null)} className="ml-auto h-6 w-6 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

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
                  } catch {
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
                  <Button className="gap-2" onClick={handleInviteExpert} disabled title="Fonctionnalité en cours de développement">
                    <Mail className="h-4 w-4" />
                    Inviter par email
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={handleGenerateAccessLink} disabled title="Fonctionnalité en cours de développement">
                    <Link2 className="h-4 w-4" />
                    Générer un lien d'accès
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
