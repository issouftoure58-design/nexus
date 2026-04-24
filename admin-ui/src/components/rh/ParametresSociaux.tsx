import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  Euro,
  Clock,
  ExternalLink,
  Info,
  Building2,
  Users,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ParametresSociauxData {
  source: string;
  annee: number;
  date_application: string;
  parametres: {
    smic_horaire_brut: number;
    smic_mensuel_brut: number;
    plafond_ss_mensuel: number;
    plafond_ss_annuel: number;
    cotisations_salariales: Record<string, { taux: number; note?: string }>;
    cotisations_patronales: Record<string, { taux: number; taux_reduit?: number; taux_haut_revenu?: number; note?: string }>;
    heures_supplementaires: {
      majoration_25: number;
      majoration_50: number;
      contingent_annuel: number;
    };
  };
  sources?: string[];
}

const fetchParametresSociaux = async (): Promise<ParametresSociauxData> =>
  api.get('/admin/rh/parametres-sociaux');

const formatTaux = (taux: number) => {
  return taux.toFixed(2).replace('.', ',') + ' %';
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

interface VerificationResult {
  success: boolean;
  a_jour: boolean;
  differences: Array<{
    champ: string;
    actuel: number;
    officiel: number;
    ecart: number;
  }>;
  taux_officiels: Record<string, number>;
  date_verification: string;
}

const LABELS_TAUX: Record<string, string> = {
  smic_horaire: 'SMIC horaire',
  smic_mensuel: 'SMIC mensuel',
  plafond_ss_mensuel: 'Plafond SS mensuel',
  plafond_ss_annuel: 'Plafond SS annuel',
  sal_maladie: 'Maladie (sal.)',
  sal_vieillesse_plafonnee: 'Vieillesse plaf. (sal.)',
  sal_vieillesse_deplafonnee: 'Vieillesse déplaf. (sal.)',
  sal_chomage: 'Chômage (sal.)',
  sal_retraite_t1: 'Retraite T1 (sal.)',
  sal_retraite_t2: 'Retraite T2 (sal.)',
  sal_ceg_t1: 'CEG T1 (sal.)',
  sal_ceg_t2: 'CEG T2 (sal.)',
  sal_cet: 'CET (sal.)',
  sal_csg_deductible: 'CSG déductible',
  sal_csg_non_deductible: 'CSG non déductible',
  sal_crds: 'CRDS',
  pat_maladie: 'Maladie taux plein (pat.)',
  pat_maladie_reduit: 'Maladie réduit < 2.5 SMIC (pat.)',
  pat_vieillesse_plafonnee: 'Vieillesse plaf. (pat.)',
  pat_vieillesse_deplafonnee: 'Vieillesse déplaf. (pat.)',
  pat_allocations_familiales: 'Alloc. familiales (pat.)',
  pat_allocations_familiales_reduit: 'Alloc. fam. réduit (pat.)',
  pat_chomage: 'Chômage (pat.)',
  pat_ags: 'AGS (pat.)',
  pat_csa: 'CSA (pat.)',
  pat_retraite_t1: 'Retraite T1 (pat.)',
  pat_retraite_t2: 'Retraite T2 (pat.)',
  pat_ceg_t1: 'CEG T1 (pat.)',
  pat_ceg_t2: 'CEG T2 (pat.)',
  pat_cet: 'CET (pat.)',
  pat_formation_moins_11: 'Formation < 11 sal. (pat.)',
  pat_formation_11_plus: 'Formation ≥ 11 sal. (pat.)',
  pat_taxe_apprentissage: 'Taxe apprentissage (pat.)',
};

export function ParametresSociaux() {
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['parametres-sociaux'],
    queryFn: fetchParametresSociaux
  });

  const verifierMutation = useMutation({
    mutationFn: () => api.post<VerificationResult>('/admin/rh/parametres-sociaux/verifier', {}),
    onSuccess: (result) => setVerificationResult(result),
  });

  const appliquerMutation = useMutation({
    mutationFn: (taux_officiels: Record<string, number>) =>
      api.post('/admin/rh/parametres-sociaux/appliquer', { taux_officiels }),
    onSuccess: () => {
      setVerificationResult(null);
      queryClient.invalidateQueries({ queryKey: ['parametres-sociaux'] });
    },
  });

  const queryClient = useQueryClient();

  if (isLoading) {
    return <div className="text-gray-500">Chargement des paramètres...</div>;
  }

  if (error) {
    return <div className="text-red-500">Erreur de chargement</div>;
  }

  if (!data) return null;

  const { parametres } = data;

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">Paramètres sociaux {data.annee}</p>
            <p className="text-sm text-blue-700 mt-1">
              Ces taux sont appliqués automatiquement lors du calcul des bulletins de paie.
              Dernière mise à jour : {new Date(data.date_application).toLocaleDateString('fr-FR')}.
            </p>
            {data.sources && (
              <div className="mt-2 flex flex-wrap gap-2">
                {data.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.includes('http') ? src : `https://${src}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {(() => { try { return new URL(src.includes('://') ? src : `https://${src}`).hostname; } catch { return src; } })()}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bouton vérification + résultats */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => verifierMutation.mutate()}
          disabled={verifierMutation.isPending}
          variant="outline"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", verifierMutation.isPending && "animate-spin")} />
          {verifierMutation.isPending ? 'Vérification en cours...' : 'Vérifier les mises à jour'}
        </Button>
        <span className="text-xs text-gray-400">Consomme de l'utilisation IA</span>
      </div>

      {verifierMutation.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {(verifierMutation.error as any)?.message || 'Erreur lors de la vérification'}
        </div>
      )}

      {verificationResult && (
        <Card className={verificationResult.a_jour ? 'border-green-200' : 'border-orange-200'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {verificationResult.a_jour ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-800">Tous les taux sont à jour</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <span className="text-orange-800">{verificationResult.differences.length} différence(s) détectée(s)</span>
                </>
              )}
            </CardTitle>
            <CardDescription>
              Vérifié le {new Date(verificationResult.date_verification).toLocaleString('fr-FR')}
            </CardDescription>
          </CardHeader>
          {!verificationResult.a_jour && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2">Taux</th>
                      <th className="pb-2 text-right">Actuel</th>
                      <th className="pb-2 text-center"></th>
                      <th className="pb-2 text-right">Officiel</th>
                      <th className="pb-2 text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verificationResult.differences.map((d) => (
                      <tr key={d.champ} className="border-b">
                        <td className="py-2 font-medium">{LABELS_TAUX[d.champ] || d.champ}</td>
                        <td className="py-2 text-right font-mono text-red-600">{d.actuel}</td>
                        <td className="py-2 text-center"><ArrowRight className="w-4 h-4 text-gray-400 inline" /></td>
                        <td className="py-2 text-right font-mono text-green-600 font-bold">{d.officiel}</td>
                        <td className="py-2 text-right font-mono text-orange-600">
                          {d.ecart > 0 ? '+' : ''}{d.ecart}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Button
                  onClick={() => verificationResult && appliquerMutation.mutate(verificationResult.taux_officiels)}
                  disabled={appliquerMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {appliquerMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Appliquer les taux officiels
                </Button>
                <span className="text-xs text-gray-500">Les bulletins futurs utiliseront les nouveaux taux.</span>
              </div>
              {appliquerMutation.isSuccess && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-800 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Taux mis à jour avec succès.
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* SMIC et Plafonds */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Euro className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">SMIC horaire brut</p>
                <p className="text-xl font-bold">{formatMoney(parametres.smic_horaire_brut)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Euro className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">SMIC mensuel brut</p>
                <p className="text-xl font-bold">{formatMoney(parametres.smic_mensuel_brut)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Plafond SS mensuel</p>
                <p className="text-xl font-bold">{formatMoney(parametres.plafond_ss_mensuel)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Plafond SS annuel</p>
                <p className="text-xl font-bold">{formatMoney(parametres.plafond_ss_annuel)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cotisations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cotisations salariales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Cotisations salariales
            </CardTitle>
            <CardDescription>Retenues sur le salaire brut</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(parametres.cotisations_salariales).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="text-sm font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    {value.note && (
                      <p className="text-xs text-gray-500">{value.note}</p>
                    )}
                  </div>
                  <Badge variant={value.taux === 0 ? 'secondary' : 'default'} className="font-mono">
                    {formatTaux(value.taux)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cotisations patronales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-500" />
              Cotisations patronales
            </CardTitle>
            <CardDescription>Charges employeur</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Object.entries(parametres.cotisations_patronales).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <span className="text-sm font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    {value.note && (
                      <p className="text-xs text-gray-500">{value.note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="font-mono">
                      {formatTaux(value.taux)}
                    </Badge>
                    {value.taux_reduit && (
                      <Badge variant="outline" className="font-mono text-xs">
                        réd. {formatTaux(value.taux_reduit)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heures supplémentaires */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Heures supplémentaires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Majoration 1ère à 8ème heure/semaine</p>
              <p className="text-2xl font-bold text-orange-600">
                +{parametres.heures_supplementaires.majoration_25}%
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Majoration au-delà de 8h/semaine</p>
              <p className="text-2xl font-bold text-red-600">
                +{parametres.heures_supplementaires.majoration_50}%
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Contingent annuel</p>
              <p className="text-2xl font-bold">
                {parametres.heures_supplementaires.contingent_annuel}h
              </p>
              <p className="text-xs text-gray-500">Repos compensateur au-delà</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totaux estimés */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 text-green-500" />
            Estimation charges totales (base SMIC)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const smic = parametres.smic_mensuel_brut;
            // Calcul cotisations salariales
            const cotSal = Object.values(parametres.cotisations_salariales)
              .reduce((sum, c) => sum + c.taux, 0);

            // Calcul cotisations patronales (estimation)
            const cotPat = Object.values(parametres.cotisations_patronales)
              .reduce((sum, c) => sum + c.taux, 0);

            return (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-500">Salaire brut</p>
                  <p className="text-xl font-bold">{formatMoney(smic)}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-500">Cotisations salariales</p>
                  <p className="text-xl font-bold text-orange-600">
                    ~{formatMoney(smic * cotSal / 100)}
                  </p>
                  <p className="text-xs text-gray-500">~{cotSal.toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-500">Cotisations patronales</p>
                  <p className="text-xl font-bold text-purple-600">
                    ~{formatMoney(smic * cotPat / 100)}
                  </p>
                  <p className="text-xs text-gray-500">~{cotPat.toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-500">Coût total employeur</p>
                  <p className="text-xl font-bold text-blue-600">
                    ~{formatMoney(smic * (1 + cotPat / 100))}
                  </p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

export default ParametresSociaux;
