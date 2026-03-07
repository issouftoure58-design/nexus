import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { comptaApi, type EcritureComptable } from '@/lib/api';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function Rapprochement() {
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

  // État pour le rapprochement bancaire
  const [soldeBancaire, setSoldeBancaire] = useState<number | null>(null);
  const [rapprochementSubTab, setRapprochementSubTab] = useState<'a_rapprocher' | 'rapprochees'>('a_rapprocher');
  const [selectedEcrituresForPointage, setSelectedEcrituresForPointage] = useState<number[]>([]);
  const [bankTransactions, setBankTransactions] = useState<Array<{id: number; date: string; libelle: string; montant: number; type: 'credit' | 'debit'; pointed: boolean}>>([]);
  const bankFileInputRef = useRef<HTMLInputElement>(null);

  // Query pour les écritures du journal banque (BQ) pour le rapprochement
  const { data: ecrituresBanqueData, isLoading: ecrituresBanqueLoading, isFetching: ecrituresBanqueFetching, refetch: refetchEcrituresBanque } = useQuery<{ ecritures: EcritureComptable[]; solde_comptable: number }>({
    queryKey: ['ecritures-banque'],
    queryFn: () => comptaApi.getEcrituresBanque(),
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

  // Handler pour l'import du relevé bancaire CSV
  const handleBankStatementImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
        setNotification({ type: 'success', message: `${transactions.length} transactions importées` });
        setTimeout(() => setNotification(null), 3000);
      }
    };
    reader.readAsText(file);
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rapprochement Bancaire</h1>
        <p className="text-sm text-gray-500">Pointage et réconciliation des écritures bancaires</p>
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
    </div>
  );
}
