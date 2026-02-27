import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  Euro,
  Percent,
  Clock,
  ExternalLink,
  Info,
  Building2,
  Users
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('nexus_admin_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

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

const fetchParametresSociaux = async (): Promise<ParametresSociauxData> => {
  const res = await fetch(`${API_BASE}/admin/rh/parametres-sociaux`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement paramètres');
  return res.json();
};

const formatTaux = (taux: number) => {
  return taux.toFixed(2).replace('.', ',') + ' %';
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

export function ParametresSociaux() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['parametres-sociaux'],
    queryFn: fetchParametresSociaux
  });

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
                    {src.split('/')[0]}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
            const plafond = parametres.plafond_ss_mensuel;
            const baseSS = Math.min(smic, plafond);

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
