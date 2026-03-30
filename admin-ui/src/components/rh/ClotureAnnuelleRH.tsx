import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  FileText,
  Shield,
  Euro,
  Users
} from 'lucide-react';
import { api } from '@/lib/api';

interface Verification {
  ok: boolean;
  warnings: string[];
  errors: string[];
  stats: {
    nb_membres: number;
    nb_bulletins: number;
    nb_brouillons: number;
    nb_reguls_en_attente: number;
  };
}

interface ClotureStatus {
  cloture: {
    id: number;
    statut: string;
    annee: number;
    snapshot_cumuls: unknown[];
    provision_cp: { montant_total: number; taux_charges: number; detail: unknown[] };
    report_cp: { membre_id: number; nom: string; solde_reporte: number }[];
    date_cloture: string;
    cloture_par: string;
    date_reouverture?: string;
  } | null;
}

interface ClotureResult {
  success: boolean;
  annee: number;
  nb_membres: number;
  provision_cp: number;
  nb_reports: number;
  snapshot_cumuls: number;
}

const formatMoney = (centimes: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(centimes / 100);

export default function ClotureAnnuelleRH() {
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);
  const [step, setStep] = useState(0); // 0=verif, 1=apercu, 2=execution, 3=termine
  const [confirmed, setConfirmed] = useState(false);
  const queryClient = useQueryClient();

  // Statut clôture existante
  const { data: statusData, isLoading: loadingStatus } = useQuery<ClotureStatus>({
    queryKey: ['rh-cloture-status', annee],
    queryFn: () => api.get(`/admin/rh/cloture/${annee}/status`)
  });

  // Sauter directement à l'étape 4 si déjà clôturé
  useEffect(() => {
    if (statusData?.cloture?.statut === 'cloturee') {
      setStep(3);
    } else {
      setStep(0);
    }
  }, [statusData]);

  // Vérifications
  const {
    data: verifs,
    isLoading: loadingVerifs,
    refetch: lancerVerifs,
    isFetched: verifsDone
  } = useQuery<Verification>({
    queryKey: ['rh-cloture-verifs', annee],
    queryFn: () => api.get(`/admin/rh/cloture/${annee}/verifications`),
    enabled: false
  });

  // Exécuter clôture
  const executerMutation = useMutation<ClotureResult>({
    mutationFn: () => api.post(`/admin/rh/cloture/${annee}/executer`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-cloture-status', annee] });
      setStep(3);
    }
  });

  // Rouvrir
  const rouvrirMutation = useMutation({
    mutationFn: () => api.post(`/admin/rh/cloture/${annee}/rouvrir`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-cloture-status', annee] });
      queryClient.invalidateQueries({ queryKey: ['rh-cloture-verifs', annee] });
      setStep(0);
      setConfirmed(false);
    }
  });

  const cloture = statusData?.cloture;
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cloture annuelle RH</h2>
          <p className="text-sm text-gray-500">
            Report CP, provisions, archivage cumuls
          </p>
        </div>
        <select
          value={annee}
          onChange={(e) => {
            setAnnee(Number(e.target.value));
            setStep(0);
            setConfirmed(false);
          }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {['Verifications', 'Apercu', 'Execution', 'Termine'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                i < step
                  ? 'bg-green-100 text-green-700'
                  : i === step
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={i === step ? 'font-medium text-gray-900' : 'text-gray-400'}>
              {label}
            </span>
            {i < 3 && <ArrowRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Etape 1 — Vérifications */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5" />
              Pre-verifications {annee}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              onClick={() => lancerVerifs()}
              disabled={loadingVerifs}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loadingVerifs ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              Lancer les verifications
            </button>

            {verifsDone && verifs && (
              <div className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{verifs.stats.nb_membres}</div>
                    <div className="text-xs text-gray-500">Membres actifs</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{verifs.stats.nb_bulletins}</div>
                    <div className="text-xs text-gray-500">Bulletins</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{verifs.stats.nb_brouillons}</div>
                    <div className="text-xs text-gray-500">Brouillons</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{verifs.stats.nb_reguls_en_attente}</div>
                    <div className="text-xs text-gray-500">Reguls en attente</div>
                  </div>
                </div>

                {/* Erreurs */}
                {verifs.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-700 flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4" />
                      Erreurs bloquantes ({verifs.errors.length})
                    </h4>
                    <ul className="text-sm text-red-600 space-y-1">
                      {verifs.errors.map((err, i) => (
                        <li key={i}>- {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {verifs.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-700 flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Avertissements ({verifs.warnings.length})
                    </h4>
                    <ul className="text-sm text-yellow-600 space-y-1">
                      {verifs.warnings.map((w, i) => (
                        <li key={i}>- {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Résultat */}
                {verifs.ok && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <CheckCircle className="w-5 h-5" />
                      Verifications OK — pret pour la cloture
                    </div>
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      Suivant
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Etape 2 — Aperçu */}
      {step === 1 && verifs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5" />
              Apercu cloture {annee}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <Users className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-700">{verifs.stats.nb_membres}</div>
                <div className="text-sm text-blue-600">Membres concernes</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <RotateCcw className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <div className="text-lg font-bold text-green-700">Report CP</div>
                <div className="text-sm text-green-600">
                  Soldes reportes vers {annee + 1}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <Euro className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <div className="text-lg font-bold text-purple-700">Provision CP</div>
                <div className="text-sm text-purple-600">
                  Ecritures OD 6412/4282
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
              <h4 className="font-medium">La cloture va :</h4>
              <ul className="space-y-1 text-gray-600">
                <li>1. Archiver les cumuls de paie (snapshot decembre)</li>
                <li>2. Reporter les soldes CP vers {annee + 1} (RAZ acquis/RTT/RC)</li>
                <li>3. Calculer et comptabiliser la provision conges payes</li>
                <li>4. Generer les ecritures OD (debit 6412, credit 4282)</li>
              </ul>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="rounded"
              />
              Je confirme vouloir cloturer l'annee RH {annee}
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </button>
              <button
                onClick={() => {
                  setStep(2);
                  executerMutation.mutate();
                }}
                disabled={!confirmed}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                Executer la cloture
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etape 3 — Exécution */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="w-5 h-5 animate-spin" />
              Cloture en cours...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {executerMutation.isPending && (
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Snapshot cumuls...
                </div>
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Report conges payes...
                </div>
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Provision CP + ecritures OD...
                </div>
              </div>
            )}
            {executerMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-700 flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4" />
                  Erreur
                </h4>
                <p className="text-sm text-red-600">
                  {(executerMutation.error as Error)?.message || 'Erreur inconnue'}
                </p>
                <button
                  onClick={() => setStep(1)}
                  className="mt-3 px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-50 text-sm"
                >
                  Retour
                </button>
              </div>
            )}
            {executerMutation.isSuccess && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" /> Snapshot cumuls OK
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" /> Report CP OK ({executerMutation.data.nb_reports} membres)
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" /> Provision CP OK ({formatMoney(executerMutation.data.provision_cp)})
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" /> Ecritures OD generees
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Etape 4 — Terminé / Résumé */}
      {step === 3 && cloture && cloture.statut === 'cloturee' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Cloture RH {annee}
              <Badge className="bg-green-100 text-green-700 ml-2">Cloturee</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1">Provision CP</div>
                <div className="text-xl font-bold text-green-700">
                  {formatMoney(cloture.provision_cp?.montant_total || 0)}
                </div>
                <div className="text-xs text-green-500 mt-1">
                  Taux charges: {((cloture.provision_cp?.taux_charges || 0.45) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">Reports CP</div>
                <div className="text-xl font-bold text-blue-700">
                  {cloture.report_cp?.length || 0} membres
                </div>
                <div className="text-xs text-blue-500 mt-1">
                  Soldes reportes vers {annee + 1}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Snapshot</div>
                <div className="text-xl font-bold text-gray-700">
                  {Array.isArray(cloture.snapshot_cumuls) ? cloture.snapshot_cumuls.length : 0} fiches
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Cumuls archives
                </div>
              </div>
            </div>

            {/* Détail reports CP */}
            {cloture.report_cp && cloture.report_cp.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Membre</th>
                      <th className="text-right px-4 py-2 font-medium">Solde reporte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cloture.report_cp.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2">{r.nom}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {r.solde_reporte} j
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-gray-400">
              Cloturee le {new Date(cloture.date_cloture).toLocaleDateString('fr-FR')}
              {cloture.cloture_par && ` par ${cloture.cloture_par}`}
            </div>

            {/* Rouvrir */}
            <div className="pt-4 border-t">
              <button
                onClick={() => {
                  if (window.confirm(`Rouvrir la cloture RH ${annee} ? Les ecritures de provision seront supprimees et les reports CP annules.`)) {
                    rouvrirMutation.mutate();
                  }
                }}
                disabled={rouvrirMutation.isPending}
                className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-2 text-sm"
              >
                {rouvrirMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Rouvrir la cloture
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
