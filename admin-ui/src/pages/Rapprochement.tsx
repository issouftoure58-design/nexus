import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, comptaApi, type EcritureComptable } from '@/lib/api';
import {
  Euro,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  Landmark,
  X,
  Zap,
  FileText,
  Printer,
  PlusCircle,
  HelpCircle,
  Calendar,
  Save,
  Lock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOIS_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DEBUT_EXERCICE = { mois: 11, annee: 2025 }; // Novembre 2025

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

export default function Rapprochement({ embedded }: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient();

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

  // Période sélectionnée (obligatoire avant toute action)
  const [periodeMois, setPeriodeMois] = useState<number | null>(null);
  const [periodeAnnee, setPeriodeAnnee] = useState<number | null>(null);
  const periodeSelectionnee = periodeMois !== null && periodeAnnee !== null;
  const periodeISO = periodeSelectionnee ? `${periodeAnnee}-${String(periodeMois).padStart(2, '0')}` : null;
  const periodeLabel = periodeSelectionnee ? `${MOIS_LABELS[periodeMois! - 1]} ${periodeAnnee}` : '';

  // Sauvegarde rapprochement
  const [sauvegardePending, setSauvegardePending] = useState(false);

  // État pour le rapprochement bancaire
  const [soldeBancaire, setSoldeBancaire] = useState<number | null>(null);
  const [rapprochementSubTab, setRapprochementSubTab] = useState<'a_rapprocher' | 'rapprochees'>('a_rapprocher');
  const [selectedEcrituresForPointage, setSelectedEcrituresForPointage] = useState<number[]>([]);
  const [bankTransactions, setBankTransactions] = useState<Array<{id: number; date: string; libelle: string; montant: number; type: 'credit' | 'debit'; pointed: boolean}>>([]);
  const bankFileInputRef = useRef<HTMLInputElement>(null);

  // Query pour les écritures du journal banque (BQ) filtrées par période
  const { data: ecrituresBanqueData, isLoading: ecrituresBanqueLoading, isFetching: ecrituresBanqueFetching, refetch: refetchEcrituresBanque } = useQuery<{ ecritures: EcritureComptable[]; solde_comptable: number; mouvement_mois?: { debit: number; credit: number; solde: number } }>({
    queryKey: ['ecritures-banque', periodeISO],
    queryFn: () => comptaApi.getEcrituresBanque(periodeISO ? { periode: periodeISO } : undefined),
    enabled: periodeSelectionnee,
  });

  // Query rapprochement sauvegardé de la période courante
  const { data: rapprochementSauvegarde } = useQuery({
    queryKey: ['rapprochement-sauvegarde', periodeISO],
    queryFn: () => comptaApi.getRapprochement(periodeISO!),
    enabled: !!periodeISO,
  });

  // Query rapprochement du mois précédent (chaînage)
  const periodePrecedente = useMemo(() => {
    if (!periodeSelectionnee) return null;
    const m = periodeMois! - 1;
    if (m < 1) return `${periodeAnnee! - 1}-12`;
    return `${periodeAnnee}-${String(m).padStart(2, '0')}`;
  }, [periodeMois, periodeAnnee, periodeSelectionnee]);

  const { data: rapprochementPrecedent } = useQuery({
    queryKey: ['rapprochement-precedent', periodePrecedente],
    queryFn: () => comptaApi.getRapprochement(periodePrecedente!),
    enabled: !!periodePrecedente,
  });

  const periodeVerrouillee = rapprochementSauvegarde?.rapprochement?.valide === true;

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

  // Calcul du solde comptable pour le rapprochement bancaire
  const soldeComptable = useMemo(() => {
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

    return {
      totalFacturesPayees: 0,
      totalDepenses: 0,
      solde: 0,
      nbFacturesPayees: 0,
      nbDepenses: 0,
      sourceJournal: false
    };
  }, [ecrituresBanqueData]);

  // Calcul des écritures non rapprochées et rapprochées
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

  // Solde des écritures non rapprochées
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

  const [releveLoading, setReleveLoading] = useState(false);
  const [releveBanque, setReleveBanque] = useState<string | null>(null);
  const [relevePeriode, setRelevePeriode] = useState<string | null>(null);
  const [releveSoldeDebut, setReleveSoldeDebut] = useState<number | null>(null);

  // Rapport rapprochement auto
  type RapprochementRapport = Awaited<ReturnType<typeof comptaApi.rapprochementAuto>>['rapport'];
  const [rapport, setRapport] = useState<RapprochementRapport | null>(null);
  const [rapportTab, setRapportTab] = useState<'pointees' | 'creees' | 'regulariser_471' | 'non_matchees'>('pointees');
  const [rapprochementAutoLoading, setRapprochementAutoLoading] = useState(false);

  // État pour l'édition inline des écritures proposées
  const [editingEntry, setEditingEntry] = useState<{ index: number; source: 'creees' | '471' } | null>(null);
  const [editCompte, setEditCompte] = useState('');
  const [editCompteLibelle, setEditCompteLibelle] = useState('');
  const [editLibelle, setEditLibelle] = useState('');
  const [editMontant, setEditMontant] = useState('');
  const [nbModifications, setNbModifications] = useState(0);
  const [nbSuppressions, setNbSuppressions] = useState(0);

  // Matching forcé avec écart de régularisation (658/758)
  const [matchingEntry, setMatchingEntry] = useState<{ index: number; source: 'creees' | '471'; lettrage: string; montant: number; type: string; date: string; libelle: string } | null>(null);

  // Supprimer une écriture proposée (avant validation)
  const supprimerProposee = (lettrage: string, source: 'creees' | '471') => {
    if (!rapport) return;
    const newRapport = { ...rapport };

    if (source === 'creees') {
      newRapport.ecritures_creees = (newRapport.ecritures_creees || []).filter(e => e.lettrage !== lettrage);
      newRapport.resume = { ...newRapport.resume, nb_ecritures_creees: newRapport.ecritures_creees.length };
    } else {
      newRapport.regulariser_471 = (newRapport.regulariser_471 || []).filter(e => e.lettrage !== lettrage);
      newRapport.resume = { ...newRapport.resume, nb_regulariser_471: newRapport.regulariser_471.length };
    }

    // Retirer la paire d'écritures de proposed_ecritures (identifiées par _group)
    newRapport.proposed_ecritures = (newRapport.proposed_ecritures || []).filter(
      (e: Record<string, unknown>) => e._group !== lettrage
    );

    setRapport(newRapport);
    setNbSuppressions(n => n + 1);
  };

  // Démarrer l'édition inline
  const startEdit = (index: number, source: 'creees' | '471') => {
    if (!rapport) return;
    const entry = source === 'creees'
      ? (rapport.ecritures_creees || [])[index]
      : (rapport.regulariser_471 || [])[index];
    if (!entry) return;

    setEditingEntry({ index, source });
    setEditCompte(entry.compte || '471');
    setEditCompteLibelle(entry.compte_libelle || 'Compte d\'attente');
    setEditLibelle(entry.libelle);
    setEditMontant(String(entry.montant));
  };

  // Sauvegarder la modification inline
  const saveEdit = () => {
    if (!rapport || !editingEntry) return;
    const { index, source } = editingEntry;
    const newRapport = { ...rapport };
    const newMontant = parseFloat(editMontant) || 0;

    if (source === 'creees') {
      const arr = [...(newRapport.ecritures_creees || [])];
      const old = arr[index];
      if (!old) return;
      const oldLettrage = old.lettrage;

      arr[index] = { ...old, compte: editCompte, compte_libelle: editCompteLibelle, libelle: editLibelle, montant: newMontant };
      newRapport.ecritures_creees = arr;

      // Mettre à jour proposed_ecritures correspondantes
      newRapport.proposed_ecritures = (newRapport.proposed_ecritures || []).map((e: Record<string, unknown>) => {
        if (e._group !== oldLettrage) return e;
        if (e.compte_numero === '512') {
          // Côté banque : mettre à jour montant et libellé
          return { ...e, libelle: editLibelle, debit: e.debit ? Math.round(newMontant * 100) : 0, credit: e.credit ? Math.round(newMontant * 100) : 0 };
        } else {
          // Côté contrepartie : mettre à jour compte, libellé, montant
          return { ...e, compte_numero: editCompte, compte_libelle: editCompteLibelle, libelle: editLibelle, debit: e.debit ? Math.round(newMontant * 100) : 0, credit: e.credit ? Math.round(newMontant * 100) : 0 };
        }
      });
    } else {
      const arr = [...(newRapport.regulariser_471 || [])];
      const old = arr[index];
      if (!old) return;
      const oldLettrage = old.lettrage;

      arr[index] = { ...old, compte: editCompte, compte_libelle: editCompteLibelle, libelle: editLibelle, montant: newMontant };
      newRapport.regulariser_471 = arr;

      // Mettre à jour proposed_ecritures correspondantes
      newRapport.proposed_ecritures = (newRapport.proposed_ecritures || []).map((e: Record<string, unknown>) => {
        if (e._group !== oldLettrage) return e;
        if (e.compte_numero === '512') {
          return { ...e, libelle: editLibelle, debit: e.debit ? Math.round(newMontant * 100) : 0, credit: e.credit ? Math.round(newMontant * 100) : 0 };
        } else {
          return { ...e, compte_numero: editCompte, compte_libelle: editCompteLibelle, libelle: editLibelle, debit: e.debit ? Math.round(newMontant * 100) : 0, credit: e.credit ? Math.round(newMontant * 100) : 0 };
        }
      });
    }

    setRapport(newRapport);
    setEditingEntry(null);
    setNbModifications(n => n + 1);
  };

  // Ouvrir le picker de matching forcé
  const openMatchingPicker = (index: number, source: 'creees' | '471') => {
    if (!rapport) return;
    const entry = source === 'creees'
      ? (rapport.ecritures_creees || [])[index]
      : (rapport.regulariser_471 || [])[index];
    if (!entry) return;
    setMatchingEntry({ index, source, lettrage: entry.lettrage, montant: entry.montant, type: entry.type, date: entry.date, libelle: entry.libelle });
  };

  // Recalcul dynamique des deux tableaux (se met à jour quand le rapport est modifié)
  const deuxTableaux = useMemo(() => {
    if (!rapport?.deux_tableaux) return null;
    const dt = rapport.deux_tableaux;
    const nonMatchees = rapport.non_matchees_compta || [];
    const proposed = (rapport.proposed_ecritures || []) as Array<Record<string, unknown>>;

    // Côté banque : solde relevé + suspens compta (non matchées)
    const suspensDebit = nonMatchees.filter(e => e.type === 'debit').reduce((s, e) => s + e.montant, 0);
    const suspensCredit = nonMatchees.filter(e => e.type === 'credit').reduce((s, e) => s + e.montant, 0);
    const soldeRapprocheBanque = dt.cote_banque.solde_releve + suspensDebit - suspensCredit;

    // Côté compta : calculer depuis proposed_ecritures sur compte 512
    // Inclut créées + régularisations matching forcé (658/758) automatiquement
    const proposed512 = proposed.filter(e => String(e.compte_numero) === '512');
    // 512 debit (compta) = argent entrant = crédit banque → ajouter au côté compta
    const creditsHors = proposed512.reduce((s, e) => s + (Number(e.debit) || 0), 0) / 100;
    // 512 credit (compta) = argent sortant = débit banque → soustraire du côté compta
    const debitsHors = proposed512.reduce((s, e) => s + (Number(e.credit) || 0), 0) / 100;
    const soldeRapprochéCompta = dt.cote_compta.solde_512 + creditsHors - debitsHors;

    return {
      cote_banque: {
        solde_releve: dt.cote_banque.solde_releve,
        plus_debits_compta_hors_releve: Math.round(suspensDebit * 100) / 100,
        moins_credits_compta_hors_releve: Math.round(suspensCredit * 100) / 100,
        solde_rapproche: Math.round(soldeRapprocheBanque * 100) / 100
      },
      cote_compta: {
        solde_512: dt.cote_compta.solde_512,
        plus_credits_releve_hors_compta: Math.round(creditsHors * 100) / 100,
        moins_debits_releve_hors_compta: Math.round(debitsHors * 100) / 100,
        solde_rapproche: Math.round(soldeRapprochéCompta * 100) / 100
      }
    };
  }, [rapport]);

  // Écritures compta compatibles pour le matching forcé (triées par proximité de montant)
  const matchingCandidates = useMemo(() => {
    if (!matchingEntry || !rapport) return [];
    const nonMatchees = rapport.non_matchees_compta || [];
    // Types inversés : débit banque (argent sort) = crédit 512 compta, et vice versa
    return nonMatchees
      .map((e, idx) => {
        const ecart = matchingEntry.montant - e.montant;
        // Credit banque (argent reçu) : bank > compta → gain (758), bank < compta → perte (658)
        // Debit banque (argent payé) : bank > compta → perte (658), bank < compta → gain (758)
        const estPerte = matchingEntry.type === 'credit' ? ecart < 0 : ecart > 0;
        return { ...e, originalIndex: idx, ecart, ecartAbs: Math.abs(ecart), estPerte };
      })
      .filter(e => e.type !== matchingEntry.type) // sens opposé : débit banque ↔ crédit 512
      .sort((a, b) => a.ecartAbs - b.ecartAbs);
  }, [matchingEntry, rapport]);

  // Forcer le match entre une entrée créée/471 et une écriture compta non matchée
  const forcerMatch = (targetIdx: number) => {
    if (!rapport || !matchingEntry) return;
    const target = (rapport.non_matchees_compta || [])[targetIdx];
    if (!target) return;

    const newRapport = { ...rapport };
    const bankMontant = matchingEntry.montant;
    const comptaMontant = target.montant;
    const ecart = Math.abs(bankMontant - comptaMontant);
    const ecartCentimes = Math.round(ecart * 100);
    const lettrage = matchingEntry.lettrage;

    // Déterminer perte (658) ou gain (758)
    const estPerte = matchingEntry.type === 'credit' ? bankMontant < comptaMontant : bankMontant > comptaMontant;

    // 1. Retirer l'entrée de creees ou regulariser_471
    if (matchingEntry.source === 'creees') {
      newRapport.ecritures_creees = (newRapport.ecritures_creees || []).filter(e => e.lettrage !== lettrage);
      newRapport.resume = { ...newRapport.resume, nb_ecritures_creees: newRapport.ecritures_creees.length };
    } else {
      newRapport.regulariser_471 = (newRapport.regulariser_471 || []).filter(e => e.lettrage !== lettrage);
      newRapport.resume = { ...newRapport.resume, nb_regulariser_471: newRapport.regulariser_471.length };
    }

    // 2. Retirer les écritures correspondantes de proposed_ecritures (par _group)
    newRapport.proposed_ecritures = (newRapport.proposed_ecritures || []).filter(
      (e: Record<string, unknown>) => e._group !== lettrage
    );

    // 3. Ajouter le pointage de l'écriture compta existante
    newRapport.proposed_pointages = [
      ...(newRapport.proposed_pointages || []),
      { ecriture_id: target.id, lettrage, date_lettrage: new Date().toISOString().split('T')[0] }
    ];

    // 4. Ajouter dans pointees
    newRapport.pointees = [
      ...(newRapport.pointees || []),
      {
        date: matchingEntry.date,
        libelle_releve: matchingEntry.libelle,
        libelle_compta: target.libelle,
        montant: comptaMontant,
        type: matchingEntry.type,
        lettrage,
        ecart_regul: ecart > 0.001 ? (estPerte ? `-${ecart.toFixed(2)}€ (658)` : `+${ecart.toFixed(2)}€ (758)`) : undefined
      }
    ];
    newRapport.resume = { ...newRapport.resume, nb_pointees: (newRapport.pointees || []).length };

    // 5. Si écart ≠ 0 : ajouter la paire d'écritures de régularisation
    if (ecartCentimes > 0) {
      const dateEcriture = matchingEntry.date.includes('/')
        ? matchingEntry.date.split('/').reverse().join('-')
        : matchingEntry.date;
      const periodeEc = dateEcriture.slice(0, 7);
      const exercice = parseInt(dateEcriture.slice(0, 4)) || new Date().getFullYear();
      const groupRegul = `${lettrage}-R`;

      const regulEntries: Record<string, unknown>[] = estPerte
        ? [
            { journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: 'RA-REG', compte_numero: '658', compte_libelle: 'Charges diverses gestion courante', libelle: `Écart règlement — ${matchingEntry.libelle}`, debit: ecartCentimes, credit: 0, periode: periodeEc, exercice, _group: groupRegul },
            { journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: 'RA-REG', compte_numero: '512', compte_libelle: 'Banque', libelle: `Écart règlement — ${matchingEntry.libelle}`, debit: 0, credit: ecartCentimes, lettrage: groupRegul, date_lettrage: new Date().toISOString().split('T')[0], periode: periodeEc, exercice, _group: groupRegul }
          ]
        : [
            { journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: 'RA-REG', compte_numero: '512', compte_libelle: 'Banque', libelle: `Écart règlement — ${matchingEntry.libelle}`, debit: ecartCentimes, credit: 0, lettrage: groupRegul, date_lettrage: new Date().toISOString().split('T')[0], periode: periodeEc, exercice, _group: groupRegul },
            { journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: 'RA-REG', compte_numero: '758', compte_libelle: 'Produits divers gestion courante', libelle: `Écart règlement — ${matchingEntry.libelle}`, debit: 0, credit: ecartCentimes, periode: periodeEc, exercice, _group: groupRegul }
          ];

      newRapport.proposed_ecritures = [...(newRapport.proposed_ecritures || []), ...regulEntries];
    }

    // 6. Retirer la cible de non_matchees_compta
    newRapport.non_matchees_compta = (newRapport.non_matchees_compta || []).filter((_, i) => i !== targetIdx);
    newRapport.resume = { ...newRapport.resume, nb_non_matchees_compta: newRapport.non_matchees_compta.length };

    setRapport(newRapport);
    setMatchingEntry(null);
    setNbModifications(n => n + 1);
    setNotification({ type: 'success', message: `Match forcé : ${matchingEntry.libelle} ↔ ${target.libelle}${ecart > 0.001 ? ` — Écart ${ecart.toFixed(2)}€ (${estPerte ? '658 charge' : '758 produit'})` : ''}` });
    setTimeout(() => setNotification(null), 6000);
  };

  // Handler pour l'import du relevé bancaire (CSV local ou PDF/image via IA)
  const handleBankStatementImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.type === 'text/csv';
    const isHTML = file.name.endsWith('.html') || file.name.endsWith('.htm') || file.type === 'text/html';

    if (isHTML) {
      // Parsing HTML local avec DOMParser
      const reader = new FileReader();
      reader.onload = (e) => {
        const htmlText = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // Extraire métadonnées depuis l'en-tête
        const titulaire = doc.querySelector('.compte-info .col span')?.textContent?.trim() || '';
        const sousTitre = doc.querySelector('.sous-titre')?.textContent || '';
        const periodeExtrait = sousTitre.match(/Période du (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/);

        // Extraire soldes
        const soldeBoxes = doc.querySelectorAll('.solde-box .montant');
        let soldeDebut: number | null = null;
        let soldeFin: number | null = null;
        if (soldeBoxes.length >= 3) {
          const parseMontant = (el: Element) => {
            const txt = el.textContent?.replace(/[^\d,.-]/g, '').replace(',', '.') || '0';
            const val = parseFloat(txt);
            return isNaN(val) ? 0 : val;
          };
          soldeDebut = parseMontant(soldeBoxes[0]);
          soldeFin = parseMontant(soldeBoxes[2]);
        }

        // Extraire transactions depuis le tableau
        const rows = doc.querySelectorAll('table tbody tr');
        const transactions: Array<{id: number; date: string; libelle: string; montant: number; type: 'credit' | 'debit'; pointed: boolean}> = [];
        const annee = periodeExtrait ? periodeExtrait[2].slice(6) : String(new Date().getFullYear());

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 5) return;
          // Ignorer "Solde précédent" et "TOTAUX"
          if (row.classList.contains('totaux-row')) return;
          const dateCell = cells[0]?.textContent?.trim();
          if (!dateCell || dateCell === '') return;

          // Date format "DD/MM" → "DD/MM/YYYY"
          const dateStr = dateCell.includes('/') && dateCell.length <= 5 ? `${dateCell}/${annee}` : dateCell;
          const libelleEl = cells[2] || cells[1];
          // Prendre uniquement le texte principal, pas le span détail
          const libelleNode = libelleEl?.childNodes[0];
          const libelle = (libelleNode?.textContent || libelleEl?.textContent || '').trim();

          const debitText = cells[3]?.textContent?.replace(/[^\d,.-]/g, '').replace(',', '.') || '';
          const creditText = cells[4]?.textContent?.replace(/[^\d,.-]/g, '').replace(',', '.') || '';
          const debitVal = parseFloat(debitText) || 0;
          const creditVal = parseFloat(creditText) || 0;

          if (debitVal > 0) {
            transactions.push({ id: transactions.length + 1, date: dateStr, libelle, montant: debitVal, type: 'debit', pointed: false });
          } else if (creditVal > 0) {
            transactions.push({ id: transactions.length + 1, date: dateStr, libelle, montant: creditVal, type: 'credit', pointed: false });
          }
        });

        if (transactions.length > 0) {
          setBankTransactions(transactions);
          setSoldeBancaire(soldeFin);
          setReleveSoldeDebut(soldeDebut);
          setReleveBanque(titulaire ? `BNP Paribas — ${titulaire}` : 'BNP Paribas');
          if (periodeExtrait) setRelevePeriode(`${periodeExtrait[1]} - ${periodeExtrait[2]}`);
          setRapport(null);
          setNotification({ type: 'success', message: `${transactions.length} transactions importées (HTML)${soldeFin != null ? ` — Solde fin: ${formatCurrency(soldeFin)}` : ''}` });
          setTimeout(() => setNotification(null), 5000);
        } else {
          setNotification({ type: 'error', message: 'Aucune transaction trouvée dans le fichier HTML' });
          setTimeout(() => setNotification(null), 5000);
        }
      };
      reader.readAsText(file);
    } else if (isCSV) {
      // Parsing CSV local (ancien comportement)
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        const transactions: Array<{id: number; date: string; libelle: string; montant: number; type: 'credit' | 'debit'; pointed: boolean}> = [];
        let totalSolde = 0;

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(';').map(p => p.trim().replace(/"/g, ''));
          if (parts.length >= 3) {
            const date = parts[0];
            const libelle = parts[1];
            let montant = 0;
            let type: 'credit' | 'debit' = 'credit';

            if (parts.length === 3) {
              montant = parseFloat(parts[2].replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
              type = montant >= 0 ? 'credit' : 'debit';
              montant = Math.abs(montant);
            } else if (parts.length >= 4) {
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
        if (transactions.length > 0) {
          setSoldeBancaire(totalSolde);
          setNotification({ type: 'success', message: `${transactions.length} transactions importées (CSV)` });
          setTimeout(() => setNotification(null), 3000);
        }
      };
      reader.readAsText(file);
    } else {
      // PDF ou image → envoi au backend pour analyse IA
      setReleveLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const result = await api.upload<{
          success: boolean;
          transactions: Array<{id: number; date: string; libelle: string; debit: number; credit: number; montant: number; type: string}>;
          solde_fin: number | null;
          count: number;
          banque: string | null;
          error?: string;
        }>('/depenses/upload-releve', formData);

        if (result.success && result.transactions.length > 0) {
          const txs = result.transactions.map((tx, i) => ({
            id: i + 1,
            date: tx.date,
            libelle: tx.libelle,
            montant: Math.abs(tx.montant),
            type: (tx.type as 'credit' | 'debit'),
            pointed: false
          }));
          setBankTransactions(txs);
          const solde = txs.reduce((s, t) => s + (t.type === 'credit' ? t.montant : -t.montant), 0);
          setSoldeBancaire(result.solde_fin ?? solde);
          setReleveBanque(result.banque || null);
          // Déduire la période à partir des dates des transactions
          if (txs.length > 0) {
            const premiereDate = txs[0].date;
            const derniereDate = txs[txs.length - 1].date;
            setRelevePeriode(`${premiereDate} - ${derniereDate}`);
          }
          setRapport(null); // Reset rapport si on re-importe
          setNotification({ type: 'success', message: `${txs.length} transactions extraites du relevé${result.banque ? ` (${result.banque})` : ''}` });
          setTimeout(() => setNotification(null), 5000);
        } else {
          setNotification({ type: 'error', message: result.error || 'Aucune transaction trouvée dans le relevé' });
          setTimeout(() => setNotification(null), 5000);
        }
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message || 'Erreur lors de l\'analyse du relevé' });
        setTimeout(() => setNotification(null), 5000);
      } finally {
        setReleveLoading(false);
      }
    }

    if (event.target) event.target.value = '';
  };

  // Lancer le rapprochement automatique
  const lancerRapprochementAuto = async () => {
    if (bankTransactions.length === 0) return;
    setRapprochementAutoLoading(true);
    try {
      const txForApi = bankTransactions.map(tx => ({
        date: tx.date,
        libelle: tx.libelle,
        debit: tx.type === 'debit' ? tx.montant : 0,
        credit: tx.type === 'credit' ? tx.montant : 0,
        montant: tx.montant,
        type: tx.type,
      }));
      const result = await comptaApi.rapprochementAuto({
        transactions: txForApi,
        solde_debut: releveSoldeDebut,
        solde_fin: soldeBancaire,
        banque: releveBanque,
        periode: periodeISO || relevePeriode,
      });
      if (result.success && result.rapport) {
        setRapport(result.rapport);
        setRapportTab('pointees');
        setNbModifications(0);
        setNbSuppressions(0);
        setEditingEntry(null);
        setMatchingEntry(null);
        const r = result.rapport.resume;
        setNotification({
          type: 'success',
          message: `Rapprochement terminé : ${r.nb_pointees} pointée(s), ${r.nb_ecritures_creees} créée(s), ${r.nb_regulariser_471} en 471, ${r.nb_non_matchees_compta} non matchée(s)`
        });
        setTimeout(() => setNotification(null), 8000);
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erreur rapprochement automatique' });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setRapprochementAutoLoading(false);
    }
  };

  // Sauvegarder le rapprochement
  const sauverRapprochement = async () => {
    if (!rapport || !periodeISO) return;
    setSauvegardePending(true);
    try {
      await comptaApi.sauverRapprochement(periodeISO, rapport as unknown as Record<string, unknown>);
      queryClient.invalidateQueries({ queryKey: ['rapprochement-sauvegarde', periodeISO] });
      queryClient.invalidateQueries({ queryKey: ['ecritures-banque'] });
      setNotification({ type: 'success', message: `Rapprochement ${periodeLabel} validé et sauvegardé — ${(rapport as any).proposed_ecritures?.length || 0} écritures créées` });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erreur sauvegarde' });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setSauvegardePending(false);
    }
  };

  // Annuler un rapprochement validé
  const annulerRapprochement = async () => {
    if (!periodeISO) return;
    try {
      await comptaApi.annulerRapprochement(periodeISO);
      queryClient.invalidateQueries({ queryKey: ['rapprochement-sauvegarde', periodeISO] });
      setNotification({ type: 'success', message: `Rapprochement ${periodeLabel} déverrouillé` });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erreur annulation' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Navigation entre périodes
  const naviguerPeriode = useCallback((direction: 'prev' | 'next') => {
    if (!periodeSelectionnee) return;
    let m = periodeMois!;
    let a = periodeAnnee!;
    if (direction === 'prev') {
      m--;
      if (m < 1) { m = 12; a--; }
    } else {
      m++;
      if (m > 12) { m = 1; a++; }
    }
    setPeriodeMois(m);
    setPeriodeAnnee(a);
    // Reset état à chaque changement de période
    setBankTransactions([]);
    setRapport(null);
    setReleveBanque(null);
    setRelevePeriode(null);
    setReleveSoldeDebut(null);
    setSoldeBancaire(null);
  }, [periodeMois, periodeAnnee, periodeSelectionnee]);

  // Impression état de rapprochement A4 — Méthode des deux tableaux
  const imprimerRapprochement = () => {
    if (!rapport) return;
    const r = rapport;
    const fmtMontant = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
    const fmtDate = (d: string) => {
      if (!d) return '-';
      const parts = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (parts) return `${parts[3]}/${parts[2]}/${parts[1]}`;
      return d;
    };

    const nonMatchees = r.non_matchees_compta || [];
    const creees = r.ecritures_creees || [];
    const reg471 = r.regulariser_471 || [];
    const pointeesArr = r.pointees || [];
    const nonMatcheesArr = r.non_matchees_compta || [];

    // Recalcul deux tableaux pour impression (même logique que useMemo)
    const dtRaw = r.deux_tableaux;
    const proposed = (r.proposed_ecritures || []) as Array<Record<string, unknown>>;
    const dt = dtRaw ? (() => {
      const suspD = nonMatcheesArr.filter(e => e.type === 'debit').reduce((s, e) => s + e.montant, 0);
      const suspC = nonMatcheesArr.filter(e => e.type === 'credit').reduce((s, e) => s + e.montant, 0);
      // Côté compta : proposed_ecritures sur 512 (inclut créées + régularisations)
      const p512 = proposed.filter(e => String(e.compte_numero) === '512');
      const crH = p512.reduce((s, e) => s + (Number(e.debit) || 0), 0) / 100;
      const dbH = p512.reduce((s, e) => s + (Number(e.credit) || 0), 0) / 100;
      return {
        cote_banque: { solde_releve: dtRaw.cote_banque.solde_releve, plus_debits_compta_hors_releve: Math.round(suspD * 100) / 100, moins_credits_compta_hors_releve: Math.round(suspC * 100) / 100, solde_rapproche: Math.round((dtRaw.cote_banque.solde_releve + suspD - suspC) * 100) / 100 },
        cote_compta: { solde_512: dtRaw.cote_compta.solde_512, plus_credits_releve_hors_compta: Math.round(crH * 100) / 100, moins_debits_releve_hors_compta: Math.round(dbH * 100) / 100, solde_rapproche: Math.round((dtRaw.cote_compta.solde_512 + crH - dbH) * 100) / 100 }
      };
    })() : null;

    const lignesPointees = pointeesArr.map(e =>
      `<tr><td>${e.date}</td><td>${e.libelle_releve}</td><td>${e.libelle_compta}</td><td class="num">${e.type === 'credit' ? fmtMontant(e.montant) : ''}</td><td class="num">${e.type === 'debit' ? fmtMontant(e.montant) : ''}</td><td class="code">${e.lettrage}</td></tr>`
    ).join('');

    const lignesNonReleve = nonMatchees.map(e =>
      `<tr><td>${fmtDate(e.date)}</td><td>${e.libelle}</td><td class="num">${e.type === 'debit' ? fmtMontant(e.montant) : ''}</td><td class="num">${e.type === 'credit' ? fmtMontant(e.montant) : ''}</td></tr>`
    ).join('');
    const totalNonReleveDeb = nonMatchees.filter(e => e.type === 'debit').reduce((s, e) => s + e.montant, 0);
    const totalNonReleveCred = nonMatchees.filter(e => e.type === 'credit').reduce((s, e) => s + e.montant, 0);

    const lignesCreees = creees.map(e =>
      `<tr><td>${fmtDate(e.date)}</td><td>${e.libelle}</td><td>${e.compte} — ${e.compte_libelle}</td><td class="num">${e.type === 'debit' ? fmtMontant(e.montant) : ''}</td><td class="num">${e.type === 'credit' ? fmtMontant(e.montant) : ''}</td></tr>`
    ).join('');
    const totalCreeesDeb = creees.filter(e => e.type === 'debit').reduce((s, e) => s + e.montant, 0);
    const totalCreeesCred = creees.filter(e => e.type === 'credit').reduce((s, e) => s + e.montant, 0);

    const lignes471 = reg471.map(e =>
      `<tr><td>${fmtDate(e.date)}</td><td>${e.libelle}</td><td class="num">${e.type === 'debit' ? fmtMontant(e.montant) : ''}</td><td class="num">${e.type === 'credit' ? fmtMontant(e.montant) : ''}</td></tr>`
    ).join('');
    const total471Deb = reg471.filter(e => e.type === 'debit').reduce((s, e) => s + e.montant, 0);
    const total471Cred = reg471.filter(e => e.type === 'credit').reduce((s, e) => s + e.montant, 0);

    // Info chaînage
    const rapproPrev = rapprochementPrecedent?.rapprochement;
    const chainageHtml = rapproPrev
      ? `<p style="font-size:10pt;color:#555;margin-bottom:12px">Rapprochement précédent : <strong>${rapproPrev.periode}</strong> — Solde rapproché : <strong>${fmtMontant(rapproPrev.solde_rapproche)}</strong> — ${rapproPrev.nb_non_matchees} suspens reporté(s)</p>`
      : periodePrecedente && periodePrecedente >= '2025-11'
        ? '<p style="font-size:10pt;color:#999;margin-bottom:12px">Aucun rapprochement précédent sauvegardé</p>'
        : '<p style="font-size:10pt;color:#555;margin-bottom:12px">Premier mois de l\'exercice</p>';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>État de rapprochement bancaire — ${periodeLabel}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #333; padding: 18mm; background: white; }
  h1 { font-size: 15pt; text-align: center; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .sep { border-top: 2px solid #333; margin: 8px 0 14px; }
  .header-info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 16px; font-size: 10pt; }
  .header-info span { display: block; }
  .header-info .label { font-weight: 600; color: #555; }
  .section { margin-bottom: 14px; page-break-inside: avoid; }
  .section h2 { font-size: 10pt; font-weight: 700; margin-bottom: 5px; padding: 3px 8px; background: #f3f4f6; border-left: 3px solid #6366f1; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 6px; }
  th, td { padding: 3px 6px; border: 1px solid #ddd; text-align: left; }
  th { background: #f9fafb; font-weight: 600; font-size: 8pt; text-transform: uppercase; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .code { text-align: center; font-family: monospace; font-size: 8pt; }
  .total-row { font-weight: 700; background: #f3f4f6; }
  .deux-tableaux { display: flex; gap: 16px; margin-bottom: 16px; }
  .deux-tableaux .tableau { flex: 1; border: 2px solid #333; border-radius: 4px; padding: 10px; }
  .deux-tableaux .tableau h3 { font-size: 10pt; text-align: center; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #999; text-transform: uppercase; letter-spacing: 0.5px; }
  .deux-tableaux .ligne { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10pt; }
  .deux-tableaux .ligne.total { border-top: 2px solid #333; margin-top: 6px; padding-top: 6px; font-weight: 700; font-size: 11pt; }
  .deux-tableaux .ligne .val { font-variant-numeric: tabular-nums; }
  .ecart-ok { color: #16a34a; }
  .ecart-ko { color: #dc2626; }
  .big-box { border: 2px solid #333; padding: 8px 14px; margin: 10px 0; display: flex; justify-content: space-between; align-items: center; }
  .big-box .label { font-size: 10pt; font-weight: 600; }
  .big-box .value { font-size: 13pt; font-weight: 700; }
  .signature { margin-top: 30px; display: flex; justify-content: space-between; }
  .signature div { width: 45%; }
  .signature .line { border-top: 1px solid #333; margin-top: 35px; padding-top: 4px; text-align: center; font-size: 9pt; color: #666; }
  .resume-badges { display: flex; gap: 10px; margin-bottom: 14px; }
  .badge { padding: 4px 10px; border-radius: 6px; font-size: 9pt; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-orange { background: #fef3c7; color: #92400e; }
  .badge-gray { background: #f3f4f6; color: #374151; }
  @media print { body { padding: 0; } .no-print { display: none !important; } }
</style>
</head>
<body>
  <h1>État de rapprochement bancaire</h1>
  <div class="sep"></div>

  <div class="header-info">
    <div><span class="label">Banque :</span> ${r.banque || '—'}</div>
    <div><span class="label">Date du rapprochement :</span> ${fmtDate(r.date_rapprochement)}</div>
    <div><span class="label">Période :</span> ${periodeLabel || r.periode || '—'}</div>
    <div></div>
  </div>

  ${chainageHtml}

  <div class="resume-badges">
    <span class="badge badge-green">${r.resume?.nb_pointees || 0} pointée(s)</span>
    <span class="badge badge-blue">${r.resume?.nb_ecritures_creees || 0} créée(s)</span>
    <span class="badge badge-orange">${r.resume?.nb_regulariser_471 || 0} en 471</span>
    <span class="badge badge-gray">${r.resume?.nb_non_matchees_compta || 0} suspens compta</span>
  </div>

  <div class="section">
    <h2>1. Méthode des deux tableaux</h2>
    <div class="deux-tableaux">
      <div class="tableau">
        <h3>Côté Banque</h3>
        <div class="ligne"><span>Solde relevé fin de période</span><span class="val">${fmtMontant(dt?.cote_banque?.solde_releve || r.solde_releve_fin || 0)}</span></div>
        <div class="ligne"><span>+ Débits compta (512) non sur relevé</span><span class="val">${fmtMontant(dt?.cote_banque?.plus_debits_compta_hors_releve || 0)}</span></div>
        <div class="ligne"><span>- Crédits compta (512) non sur relevé</span><span class="val">${fmtMontant(dt?.cote_banque?.moins_credits_compta_hors_releve || 0)}</span></div>
        <div class="ligne total"><span>= Solde rapproché</span><span class="val ${Math.abs((dt?.cote_banque?.solde_rapproche || 0) - (dt?.cote_compta?.solde_rapproche || 0)) < 0.01 ? 'ecart-ok' : 'ecart-ko'}">${fmtMontant(dt?.cote_banque?.solde_rapproche || 0)}</span></div>
      </div>
      <div class="tableau">
        <h3>Côté Compta</h3>
        <div class="ligne"><span>Solde compte 512 fin de période</span><span class="val">${fmtMontant(dt?.cote_compta?.solde_512 || r.solde_comptable || 0)}</span></div>
        <div class="ligne"><span>+ Crédits relevé non en compta</span><span class="val">${fmtMontant(dt?.cote_compta?.plus_credits_releve_hors_compta || 0)}</span></div>
        <div class="ligne"><span>- Débits relevé non en compta</span><span class="val">${fmtMontant(dt?.cote_compta?.moins_debits_releve_hors_compta || 0)}</span></div>
        <div class="ligne total"><span>= Solde rapproché</span><span class="val ${Math.abs((dt?.cote_banque?.solde_rapproche || 0) - (dt?.cote_compta?.solde_rapproche || 0)) < 0.01 ? 'ecart-ok' : 'ecart-ko'}">${fmtMontant(dt?.cote_compta?.solde_rapproche || 0)}</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>2. Soldes du relevé bancaire</h2>
    <table>
      <tr><td style="width:70%">Solde de début de période</td><td class="num">${r.solde_releve_debut != null ? fmtMontant(r.solde_releve_debut) : '—'}</td></tr>
      <tr class="total-row"><td>Solde de fin de période</td><td class="num">${r.solde_releve_fin != null ? fmtMontant(r.solde_releve_fin) : '—'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>3. Écritures pointées (${pointeesArr.length})</h2>
    ${pointeesArr.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Libellé relevé</th><th>Libellé compta</th><th class="num">Crédit</th><th class="num">Débit</th><th class="code">Code</th></tr></thead>
      <tbody>${lignesPointees}</tbody>
    </table>` : '<p style="font-size:9pt;color:#666;font-style:italic">Aucune</p>'}
  </div>

  <div class="section">
    <h2>4. Écritures créées automatiquement (${creees.length})</h2>
    <p style="font-size:8pt;color:#666;margin-bottom:4px">(Frais bancaires 627, fournisseurs 401xxx, clients 411xxx)</p>
    ${creees.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead>
      <tbody>${lignesCreees}</tbody>
      <tfoot><tr class="total-row"><td colspan="3">Total</td><td class="num">${fmtMontant(totalCreeesDeb)}</td><td class="num">${fmtMontant(totalCreeesCred)}</td></tr></tfoot>
    </table>` : '<p style="font-size:9pt;color:#666;font-style:italic">Aucune</p>'}
  </div>

  <div class="section">
    <h2>5. Compte 471 — À régulariser (${reg471.length})</h2>
    ${reg471.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Libellé</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead>
      <tbody>${lignes471}</tbody>
      <tfoot><tr class="total-row"><td colspan="2">Total</td><td class="num">${fmtMontant(total471Deb)}</td><td class="num">${fmtMontant(total471Cred)}</td></tr></tfoot>
    </table>` : '<p style="font-size:9pt;color:#666;font-style:italic">Aucune</p>'}
  </div>

  <div class="section">
    <h2>6. Suspens compta — Non figurant sur le relevé (${nonMatchees.length})</h2>
    <p style="font-size:8pt;color:#666;margin-bottom:4px">(Chèques émis non encaissés, virements en cours...)</p>
    ${nonMatchees.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Libellé</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead>
      <tbody>${lignesNonReleve}</tbody>
      <tfoot><tr class="total-row"><td colspan="2">Total</td><td class="num">${fmtMontant(totalNonReleveDeb)}</td><td class="num">${fmtMontant(totalNonReleveCred)}</td></tr></tfoot>
    </table>` : '<p style="font-size:9pt;color:#666;font-style:italic">Aucune</p>'}
  </div>

  <div class="big-box">
    <span class="label">ÉCART entre les deux soldes rapprochés</span>
    <span class="value ${r.ecart != null && Math.abs(r.ecart) < 0.01 ? 'ecart-ok' : 'ecart-ko'}">${r.ecart != null ? fmtMontant(r.ecart) : '—'}</span>
  </div>

  <div class="signature">
    <div>
      <p>Fait le ${fmtDate(r.date_rapprochement)}</p>
      <div class="line">Signature</div>
    </div>
    <div>
      <p>Visa du responsable</p>
      <div class="line">Signature</div>
    </div>
  </div>

  <button class="no-print" onclick="window.print()" style="margin-top:20px;padding:8px 24px;font-size:12pt;cursor:pointer;background:#6366f1;color:white;border:none;border-radius:6px">Imprimer</button>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
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

  return (
    <div className={embedded ? '' : 'p-6'}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Rapprochement Bancaire</h1>
          <p className="text-sm text-gray-500">Méthode des deux tableaux — Pointage et réconciliation</p>
        </div>
      )}

      {/* Sélecteur de période obligatoire */}
      <Card className="mb-6 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              <span className="font-medium text-indigo-700">Période du rapprochement</span>
            </div>
            <div className="flex items-center gap-2">
              {periodeSelectionnee && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => naviguerPeriode('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <select
                value={periodeMois ?? ''}
                onChange={(e) => {
                  const v = e.target.value ? parseInt(e.target.value) : null;
                  setPeriodeMois(v);
                  if (v && !periodeAnnee) setPeriodeAnnee(DEBUT_EXERCICE.annee + (v < DEBUT_EXERCICE.mois ? 1 : 0));
                  setBankTransactions([]); setRapport(null); setReleveBanque(null); setRelevePeriode(null); setReleveSoldeDebut(null); setSoldeBancaire(null);
                }}
                className="border rounded-md px-3 py-1.5 text-sm font-medium bg-white"
              >
                <option value="">Mois...</option>
                {MOIS_LABELS.map((label, i) => (
                  <option key={i} value={i + 1}>{label}</option>
                ))}
              </select>
              <select
                value={periodeAnnee ?? ''}
                onChange={(e) => {
                  const v = e.target.value ? parseInt(e.target.value) : null;
                  setPeriodeAnnee(v);
                  setBankTransactions([]); setRapport(null); setReleveBanque(null); setRelevePeriode(null); setReleveSoldeDebut(null); setSoldeBancaire(null);
                }}
                className="border rounded-md px-3 py-1.5 text-sm font-medium bg-white"
              >
                <option value="">Année...</option>
                {[2025, 2026, 2027].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              {periodeSelectionnee && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => naviguerPeriode('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            {periodeSelectionnee && (
              <span className="text-sm text-indigo-600 font-medium">
                01/{String(periodeMois).padStart(2, '0')}/{periodeAnnee} — {new Date(periodeAnnee!, periodeMois!, 0).getDate()}/{String(periodeMois).padStart(2, '0')}/{periodeAnnee}
              </span>
            )}
            {periodeVerrouillee && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <Lock className="h-3 w-3" />
                Validé
              </span>
            )}
            {!periodeSelectionnee && (
              <span className="text-sm text-orange-600 italic">Sélectionnez une période pour commencer</span>
            )}
          </div>

          {/* Chaînage visuel */}
          {periodeSelectionnee && rapprochementPrecedent?.rapprochement && (
            <div className="mt-3 pt-3 border-t border-indigo-200 text-sm text-gray-600">
              Rapprochement précédent : <strong>{rapprochementPrecedent.rapprochement.periode}</strong> — Solde rapproché : <strong>{formatCurrency(rapprochementPrecedent.rapprochement.solde_rapproche)}</strong>
              {rapprochementPrecedent.rapprochement.nb_non_matchees > 0 && (
                <span className="text-orange-600 ml-2">({rapprochementPrecedent.rapprochement.nb_non_matchees} suspens reporté(s))</span>
              )}
            </div>
          )}
          {periodeSelectionnee && !rapprochementPrecedent?.rapprochement && periodePrecedente && periodePrecedente >= '2025-11' && (
            <div className="mt-3 pt-3 border-t border-indigo-200 text-sm text-orange-500 italic">
              Aucun rapprochement précédent sauvegardé pour {periodePrecedente}
            </div>
          )}
          {periodeSelectionnee && periodePrecedente && periodePrecedente < '2025-11' && (
            <div className="mt-3 pt-3 border-t border-indigo-200 text-sm text-gray-500">
              Premier mois de l'exercice — Solde initial : 0,00 EUR
            </div>
          )}
        </CardContent>
      </Card>

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

      <div className={cn("space-y-6", !periodeSelectionnee && "opacity-50 pointer-events-none")}>
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Landmark className="h-5 w-5 text-purple-500" />
            Rapprochement Bancaire {periodeLabel && `— ${periodeLabel}`}
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

          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <p className="text-sm text-green-600 mb-1">Rapprochées</p>
              <p className="text-2xl font-bold text-green-700">{ecrituresRapprochees.length}</p>
              <p className="text-xs text-gray-500 mt-1">écriture(s) confirmées</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm text-blue-600 mb-1">Solde 512 cumulé</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(soldeComptable.solde)}</p>
              <p className="text-xs text-gray-500 mt-1">toutes périodes</p>
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
                  Importez votre relevé bancaire (HTML, PDF, image ou CSV). Les PDF et images sont analysés par IA, les HTML sont parsés localement.
                </p>
              </div>
              <input
                type="file"
                ref={bankFileInputRef}
                accept=".csv,.txt,.html,.htm,.pdf,image/jpeg,image/png,image/webp"
                onChange={handleBankStatementImport}
                className="hidden"
              />
              <Button variant="outline" className="gap-2" onClick={() => bankFileInputRef.current?.click()} disabled={releveLoading}>
                {releveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {releveLoading ? 'Analyse en cours...' : 'Choisir un fichier'}
              </Button>
            </div>

            {/* Transactions importées */}
            {bankTransactions.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    {bankTransactions.length} transaction(s) importée(s)
                    {releveBanque && <span className="text-gray-400 ml-2">({releveBanque})</span>}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={lancerRapprochementAuto}
                      disabled={rapprochementAutoLoading || periodeVerrouillee}
                    >
                      {rapprochementAutoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : periodeVerrouillee ? <Lock className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                      {rapprochementAutoLoading ? 'Rapprochement en cours...' : periodeVerrouillee ? 'Période verrouillée' : 'Rapprochement automatique'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setBankTransactions([]); setRapport(null); setReleveBanque(null); setRelevePeriode(null); setReleveSoldeDebut(null); }}>
                      Effacer
                    </Button>
                  </div>
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

        {/* Rapport de rapprochement automatique */}
        {rapport && (
          <Card className="border-indigo-200 bg-indigo-50/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                Rapport de rapprochement automatique
                {rapport.banque && <span className="text-xs font-normal text-gray-500">— {rapport.banque}</span>}
              </CardTitle>
              <div className="flex gap-2">
                {!periodeVerrouillee && periodeISO && (
                  <Button
                    size="sm"
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                    onClick={sauverRapprochement}
                    disabled={sauvegardePending}
                  >
                    {sauvegardePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Valider & Sauver
                  </Button>
                )}
                {periodeVerrouillee && (
                  <Button size="sm" variant="outline" className="gap-2 text-orange-600 border-orange-300" onClick={annulerRapprochement}>
                    <Lock className="h-4 w-4" />
                    Déverrouiller
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-2" onClick={imprimerRapprochement}>
                  <Printer className="h-4 w-4" />
                  Imprimer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Résumé en badges */}
              <div className="flex flex-wrap gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  {rapport.resume?.nb_pointees || 0} pointée(s)
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                  <PlusCircle className="h-4 w-4" />
                  {rapport.resume?.nb_ecritures_creees || 0} créée(s)
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 text-orange-700">
                  <AlertTriangle className="h-4 w-4" />
                  {rapport.resume?.nb_regulariser_471 || 0} en 471
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                  <HelpCircle className="h-4 w-4" />
                  {rapport.resume?.nb_non_matchees_compta || 0} non matchée(s)
                </span>
                {(nbModifications > 0 || nbSuppressions > 0) && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
                    <Pencil className="h-4 w-4" />
                    {nbModifications > 0 && `${nbModifications} modifiée(s)`}
                    {nbModifications > 0 && nbSuppressions > 0 && ', '}
                    {nbSuppressions > 0 && `${nbSuppressions} supprimée(s)`}
                  </span>
                )}
                {deuxTableaux && (
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                    Math.abs(deuxTableaux.cote_banque.solde_rapproche - deuxTableaux.cote_compta.solde_rapproche) < 0.01 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}>
                    <Euro className="h-4 w-4" />
                    Écart : {formatCurrency(Math.round((deuxTableaux.cote_banque.solde_rapproche - deuxTableaux.cote_compta.solde_rapproche) * 100) / 100)}
                  </span>
                )}
              </div>

              {/* Deux tableaux — Méthode de rapprochement FR */}
              {deuxTableaux && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Côté Banque */}
                  <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50/30">
                    <h3 className="text-sm font-bold text-blue-700 text-center mb-3 pb-2 border-b border-blue-200 uppercase tracking-wide">Côté Banque</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Solde relevé fin de période</span>
                        <span className="font-medium">{formatCurrency(deuxTableaux.cote_banque.solde_releve)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">+ Débits compta (512) non sur relevé</span>
                        <span className="font-medium text-green-600">{formatCurrency(deuxTableaux.cote_banque.plus_debits_compta_hors_releve)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">- Crédits compta (512) non sur relevé</span>
                        <span className="font-medium text-red-600">{formatCurrency(deuxTableaux.cote_banque.moins_credits_compta_hors_releve)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t-2 border-blue-300">
                        <span className="font-bold">= Solde rapproché</span>
                        <span className={cn("text-lg font-bold", Math.abs(deuxTableaux.cote_banque.solde_rapproche - deuxTableaux.cote_compta.solde_rapproche) < 0.01 ? "text-emerald-700" : "text-red-700")}>
                          {formatCurrency(deuxTableaux.cote_banque.solde_rapproche)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Côté Compta */}
                  <div className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50/30">
                    <h3 className="text-sm font-bold text-purple-700 text-center mb-3 pb-2 border-b border-purple-200 uppercase tracking-wide">Côté Compta</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Solde compte 512 fin de période</span>
                        <span className="font-medium">{formatCurrency(deuxTableaux.cote_compta.solde_512)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">+ Crédits relevé non en compta</span>
                        <span className="font-medium text-green-600">{formatCurrency(deuxTableaux.cote_compta.plus_credits_releve_hors_compta)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">- Débits relevé non en compta</span>
                        <span className="font-medium text-red-600">{formatCurrency(deuxTableaux.cote_compta.moins_debits_releve_hors_compta)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t-2 border-purple-300">
                        <span className="font-bold">= Solde rapproché</span>
                        <span className={cn("text-lg font-bold", Math.abs(deuxTableaux.cote_banque.solde_rapproche - deuxTableaux.cote_compta.solde_rapproche) < 0.01 ? "text-emerald-700" : "text-red-700")}>
                          {formatCurrency(deuxTableaux.cote_compta.solde_rapproche)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Écart global */}
              {deuxTableaux && (() => {
                const ecartCalc = Math.round((deuxTableaux.cote_banque.solde_rapproche - deuxTableaux.cote_compta.solde_rapproche) * 100) / 100;
                return (
                  <div className={cn("rounded-lg p-3 border mb-4 text-center", Math.abs(ecartCalc) < 0.01 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
                    <p className="text-xs text-gray-500 mb-1">Écart entre les deux soldes rapprochés</p>
                    <p className={cn("text-xl font-bold", Math.abs(ecartCalc) < 0.01 ? "text-emerald-700" : "text-red-700")}>
                      {formatCurrency(ecartCalc)}
                      {Math.abs(ecartCalc) < 0.01 && ' — Rapprochement OK'}
                    </p>
                  </div>
                );
              })()}

              {/* Tabs du rapport */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-4 flex-wrap">
                <button
                  onClick={() => setRapportTab('pointees')}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                    rapportTab === 'pointees' ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Pointées ({(rapport.pointees || []).length})
                </button>
                <button
                  onClick={() => setRapportTab('creees')}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                    rapportTab === 'creees' ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Créées ({(rapport.ecritures_creees || []).length})
                </button>
                <button
                  onClick={() => setRapportTab('regulariser_471')}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                    rapportTab === 'regulariser_471' ? "bg-orange-600 text-white" : "text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  471 ({(rapport.regulariser_471 || []).length})
                </button>
                <button
                  onClick={() => setRapportTab('non_matchees')}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                    rapportTab === 'non_matchees' ? "bg-gray-600 text-white" : "text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Non matchées ({(rapport.non_matchees_compta || []).length})
                </button>
              </div>

              {/* Tab Pointées */}
              {rapportTab === 'pointees' && (
                (rapport.pointees || []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">Aucune écriture auto-pointée</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 text-gray-600">Date</th>
                          <th className="text-left py-2 px-3 text-gray-600">Libellé relevé</th>
                          <th className="text-left py-2 px-3 text-gray-600">Libellé compta</th>
                          <th className="text-right py-2 px-3 text-gray-600">Montant</th>
                          <th className="text-center py-2 px-3 text-gray-600">Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rapport.pointees || []).map((p, i) => (
                          <tr key={i} className="border-t hover:bg-green-50">
                            <td className="py-2 px-3 whitespace-nowrap">{p.date}</td>
                            <td className="py-2 px-3 text-xs">{p.libelle_releve}</td>
                            <td className="py-2 px-3 text-xs">{p.libelle_compta}</td>
                            <td className={cn("py-2 px-3 text-right font-medium whitespace-nowrap", p.type === 'credit' ? "text-green-600" : "text-red-600")}>
                              {p.type === 'credit' ? '+' : '-'}{formatCurrency(p.montant)}
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-mono">{p.lettrage}</span>
                              {p.ecart_regul && (
                                <span className={cn("text-xs px-1.5 py-0.5 rounded ml-1 font-medium", p.ecart_regul.startsWith('+') ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                  {p.ecart_regul}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Tab Créées (401, 411, 627) — éditables avant validation */}
              {rapportTab === 'creees' && (
                (rapport.ecritures_creees || []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">Aucune écriture proposée</p>
                ) : (
                  <div>
                    {!periodeVerrouillee && (
                      <p className="text-xs text-blue-600 mb-2">Ces écritures seront créées uniquement à la validation. Vous pouvez les modifier ou supprimer.</p>
                    )}
                    <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 text-gray-600">Date</th>
                            <th className="text-left py-2 px-3 text-gray-600">Libellé</th>
                            <th className="text-right py-2 px-3 text-gray-600">Montant</th>
                            <th className="text-center py-2 px-3 text-gray-600">Compte</th>
                            <th className="text-center py-2 px-3 text-gray-600">Code</th>
                            {!periodeVerrouillee && <th className="text-center py-2 px-3 text-gray-600 w-20">Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(rapport.ecritures_creees || []).map((c, i) => (
                            <tr key={i} className="border-t hover:bg-blue-50">
                              {editingEntry?.source === 'creees' && editingEntry.index === i ? (
                                <>
                                  <td className="py-2 px-3 whitespace-nowrap">{c.date}</td>
                                  <td className="py-1 px-2"><Input value={editLibelle} onChange={e => setEditLibelle(e.target.value)} className="h-7 text-xs" /></td>
                                  <td className="py-1 px-2"><Input type="number" step="0.01" value={editMontant} onChange={e => setEditMontant(e.target.value)} className="h-7 text-xs text-right w-24 ml-auto" /></td>
                                  <td className="py-1 px-2">
                                    <Input value={editCompte} onChange={e => setEditCompte(e.target.value)} className="h-7 text-xs w-20 inline-block" placeholder="Compte" />
                                    <Input value={editCompteLibelle} onChange={e => setEditCompteLibelle(e.target.value)} className="h-7 text-xs w-24 inline-block ml-1" placeholder="Libellé" />
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-mono">{c.lettrage}</span>
                                  </td>
                                  <td className="py-1 px-2 text-center">
                                    <button onClick={saveEdit} className="text-green-600 hover:text-green-800 mr-1" title="Valider"><Check className="h-4 w-4 inline" /></button>
                                    <button onClick={() => setEditingEntry(null)} className="text-gray-400 hover:text-gray-600" title="Annuler"><X className="h-4 w-4 inline" /></button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-2 px-3 whitespace-nowrap">{c.date}</td>
                                  <td className="py-2 px-3">{c.libelle}</td>
                                  <td className={cn("py-2 px-3 text-right font-medium whitespace-nowrap", c.type === 'credit' ? "text-green-600" : "text-red-600")}>
                                    {c.type === 'credit' ? '+' : '-'}{formatCurrency(c.montant)}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-mono">{c.compte}</span>
                                    <span className="text-xs text-gray-500 ml-1">{c.compte_libelle}</span>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-mono">{c.lettrage}</span>
                                  </td>
                                  {!periodeVerrouillee && (
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <button onClick={() => openMatchingPicker(i, 'creees')} className="text-purple-500 hover:text-purple-700 mr-2" title="Matcher avec écriture existante"><Link2 className="h-3.5 w-3.5 inline" /></button>
                                      <button onClick={() => startEdit(i, 'creees')} className="text-blue-500 hover:text-blue-700 mr-2" title="Modifier"><Pencil className="h-3.5 w-3.5 inline" /></button>
                                      <button onClick={() => supprimerProposee(c.lettrage, 'creees')} className="text-red-400 hover:text-red-600" title="Supprimer"><Trash2 className="h-3.5 w-3.5 inline" /></button>
                                    </td>
                                  )}
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Picker matching forcé — Créées */}
                    {matchingEntry && matchingEntry.source === 'creees' && (
                      <div className="mt-2 border-2 border-purple-200 rounded-lg bg-purple-50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-purple-800">
                            Matcher « {matchingEntry.libelle} » ({formatCurrency(matchingEntry.montant)}) avec une écriture existante :
                          </p>
                          <button onClick={() => setMatchingEntry(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                        </div>
                        {matchingCandidates.length === 0 ? (
                          <p className="text-xs text-gray-500 py-2">Aucune écriture compta compatible ({matchingEntry.type}) dans les non matchées</p>
                        ) : (
                          <div className="max-h-[200px] overflow-y-auto border rounded bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  <th className="text-left py-1.5 px-2 text-gray-600">Date</th>
                                  <th className="text-left py-1.5 px-2 text-gray-600">Libellé</th>
                                  <th className="text-right py-1.5 px-2 text-gray-600">Montant</th>
                                  <th className="text-right py-1.5 px-2 text-gray-600">Écart</th>
                                  <th className="text-center py-1.5 px-2 text-gray-600">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matchingCandidates.map((c) => (
                                  <tr key={c.originalIndex} className="border-t hover:bg-purple-50 cursor-pointer" onClick={() => {
                                    if (confirm(`Matcher « ${matchingEntry.libelle} » (${formatCurrency(matchingEntry.montant)}) avec « ${c.libelle} » (${formatCurrency(c.montant)}) ?\n\nÉcart : ${c.ecartAbs.toFixed(2)}€ → ${c.estPerte ? 'Charge 658' : c.ecartAbs < 0.001 ? 'Aucun écart' : 'Produit 758'}`)) {
                                      forcerMatch(c.originalIndex);
                                    }
                                  }}>
                                    <td className="py-1.5 px-2 whitespace-nowrap">{formatDate(c.date)}</td>
                                    <td className="py-1.5 px-2">{c.libelle}</td>
                                    <td className="py-1.5 px-2 text-right font-medium">{formatCurrency(c.montant)}</td>
                                    <td className={cn("py-1.5 px-2 text-right font-bold", c.ecartAbs < 0.001 ? "text-green-600" : c.estPerte ? "text-red-600" : "text-green-600")}>
                                      {c.ecartAbs < 0.001 ? '= 0' : `${c.estPerte ? '-' : '+'}${c.ecartAbs.toFixed(2)}€`}
                                    </td>
                                    <td className="py-1.5 px-2 text-center">
                                      <span className="text-purple-600 hover:text-purple-800 font-medium">Matcher</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Tab 471 — À régulariser — éditables avant validation */}
              {rapportTab === 'regulariser_471' && (
                (rapport.regulariser_471 || []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">Aucune écriture en compte 471</p>
                ) : (
                  <div>
                    <p className="text-xs text-orange-600 mb-2">
                      {periodeVerrouillee
                        ? 'Ces transactions non identifiées sont en compte 471 (attente). Reclassifiez-les dans le journal.'
                        : 'Transactions non identifiées → 471 (attente). Vous pouvez changer le compte avant validation (ex: 471 → 401xxx).'}
                    </p>
                    <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 text-gray-600">Date</th>
                            <th className="text-left py-2 px-3 text-gray-600">Libellé</th>
                            <th className="text-right py-2 px-3 text-gray-600">Montant</th>
                            <th className="text-center py-2 px-3 text-gray-600">Compte</th>
                            <th className="text-center py-2 px-3 text-gray-600">Code</th>
                            {!periodeVerrouillee && <th className="text-center py-2 px-3 text-gray-600 w-20">Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(rapport.regulariser_471 || []).map((e, i) => (
                            <tr key={i} className="border-t hover:bg-orange-50">
                              {editingEntry?.source === '471' && editingEntry.index === i ? (
                                <>
                                  <td className="py-2 px-3 whitespace-nowrap">{e.date}</td>
                                  <td className="py-1 px-2"><Input value={editLibelle} onChange={ev => setEditLibelle(ev.target.value)} className="h-7 text-xs" /></td>
                                  <td className="py-1 px-2"><Input type="number" step="0.01" value={editMontant} onChange={ev => setEditMontant(ev.target.value)} className="h-7 text-xs text-right w-24 ml-auto" /></td>
                                  <td className="py-1 px-2">
                                    <Input value={editCompte} onChange={ev => setEditCompte(ev.target.value)} className="h-7 text-xs w-20 inline-block" placeholder="471" />
                                    <Input value={editCompteLibelle} onChange={ev => setEditCompteLibelle(ev.target.value)} className="h-7 text-xs w-24 inline-block ml-1" placeholder="Libellé" />
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded font-mono">{e.lettrage}</span>
                                  </td>
                                  <td className="py-1 px-2 text-center">
                                    <button onClick={saveEdit} className="text-green-600 hover:text-green-800 mr-1" title="Valider"><Check className="h-4 w-4 inline" /></button>
                                    <button onClick={() => setEditingEntry(null)} className="text-gray-400 hover:text-gray-600" title="Annuler"><X className="h-4 w-4 inline" /></button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-2 px-3 whitespace-nowrap">{e.date}</td>
                                  <td className="py-2 px-3">{e.libelle}</td>
                                  <td className={cn("py-2 px-3 text-right font-medium whitespace-nowrap", e.type === 'credit' ? "text-green-600" : "text-red-600")}>
                                    {e.type === 'credit' ? '+' : '-'}{formatCurrency(e.montant)}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded font-mono">{e.compte || '471'}</span>
                                    <span className="text-xs text-gray-500 ml-1">{e.compte_libelle || 'Compte d\'attente'}</span>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded font-mono">{e.lettrage}</span>
                                  </td>
                                  {!periodeVerrouillee && (
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <button onClick={() => openMatchingPicker(i, '471')} className="text-purple-500 hover:text-purple-700 mr-2" title="Matcher avec écriture existante"><Link2 className="h-3.5 w-3.5 inline" /></button>
                                      <button onClick={() => startEdit(i, '471')} className="text-blue-500 hover:text-blue-700 mr-2" title="Modifier"><Pencil className="h-3.5 w-3.5 inline" /></button>
                                      <button onClick={() => supprimerProposee(e.lettrage, '471')} className="text-red-400 hover:text-red-600" title="Supprimer"><Trash2 className="h-3.5 w-3.5 inline" /></button>
                                    </td>
                                  )}
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Picker matching forcé — 471 */}
                    {matchingEntry && matchingEntry.source === '471' && (
                      <div className="mt-2 border-2 border-purple-200 rounded-lg bg-purple-50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-purple-800">
                            Matcher « {matchingEntry.libelle} » ({formatCurrency(matchingEntry.montant)}) avec une écriture existante :
                          </p>
                          <button onClick={() => setMatchingEntry(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                        </div>
                        {matchingCandidates.length === 0 ? (
                          <p className="text-xs text-gray-500 py-2">Aucune écriture compta compatible ({matchingEntry.type}) dans les non matchées</p>
                        ) : (
                          <div className="max-h-[200px] overflow-y-auto border rounded bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  <th className="text-left py-1.5 px-2 text-gray-600">Date</th>
                                  <th className="text-left py-1.5 px-2 text-gray-600">Libellé</th>
                                  <th className="text-right py-1.5 px-2 text-gray-600">Montant</th>
                                  <th className="text-right py-1.5 px-2 text-gray-600">Écart</th>
                                  <th className="text-center py-1.5 px-2 text-gray-600">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matchingCandidates.map((c) => (
                                  <tr key={c.originalIndex} className="border-t hover:bg-purple-50 cursor-pointer" onClick={() => {
                                    if (confirm(`Matcher « ${matchingEntry.libelle} » (${formatCurrency(matchingEntry.montant)}) avec « ${c.libelle} » (${formatCurrency(c.montant)}) ?\n\nÉcart : ${c.ecartAbs.toFixed(2)}€ → ${c.estPerte ? 'Charge 658' : c.ecartAbs < 0.001 ? 'Aucun écart' : 'Produit 758'}`)) {
                                      forcerMatch(c.originalIndex);
                                    }
                                  }}>
                                    <td className="py-1.5 px-2 whitespace-nowrap">{formatDate(c.date)}</td>
                                    <td className="py-1.5 px-2">{c.libelle}</td>
                                    <td className="py-1.5 px-2 text-right font-medium">{formatCurrency(c.montant)}</td>
                                    <td className={cn("py-1.5 px-2 text-right font-bold", c.ecartAbs < 0.001 ? "text-green-600" : c.estPerte ? "text-red-600" : "text-green-600")}>
                                      {c.ecartAbs < 0.001 ? '= 0' : `${c.estPerte ? '-' : '+'}${c.ecartAbs.toFixed(2)}€`}
                                    </td>
                                    <td className="py-1.5 px-2 text-center">
                                      <span className="text-purple-600 hover:text-purple-800 font-medium">Matcher</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Tab Non matchées compta */}
              {rapportTab === 'non_matchees' && (
                (rapport.non_matchees_compta || []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">Toutes les écritures compta ont une correspondance</p>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Écritures compta non figurant sur le relevé</p>
                    <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 text-gray-600">Date</th>
                            <th className="text-left py-2 px-3 text-gray-600">Libellé</th>
                            <th className="text-right py-2 px-3 text-gray-600">Montant</th>
                            <th className="text-left py-2 px-3 text-gray-600">Raison</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rapport.non_matchees_compta || []).map((e, i) => (
                            <tr key={i} className="border-t hover:bg-gray-50">
                              <td className="py-2 px-3 whitespace-nowrap">{formatDate(e.date)}</td>
                              <td className="py-2 px-3">{e.libelle}</td>
                              <td className={cn("py-2 px-3 text-right font-medium whitespace-nowrap", e.type === 'debit' ? "text-green-600" : "text-red-600")}>
                                {e.type === 'debit' ? '+' : '-'}{formatCurrency(e.montant)}
                              </td>
                              <td className="py-2 px-3 text-xs text-gray-500">{e.raison}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
