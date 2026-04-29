/**
 * Comptabilité Analytique
 * Rentabilité par service, par collaborateur, marges, seuil de rentabilité
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { analyticsApi } from '@/lib/api';
import type { AnalytiqueData, AnalytiqueClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useProfile } from '@/contexts/ProfileContext';
import {
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  UserCheck,
  Target,
  Calculator,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

type Periode = 'mois' | 'trimestre' | 'annee';
type Onglet = 'vue' | 'services' | 'collaborateurs' | 'clients' | 'seuil';

const PERIODES: { value: Periode; label: string }[] = [
  { value: 'mois', label: 'Ce mois' },
  { value: 'trimestre', label: 'Ce trimestre' },
  { value: 'annee', label: 'Cette année' },
];

const ONGLETS: { value: Onglet; label: string; icon: typeof BarChart3 }[] = [
  { value: 'vue', label: "Vue d'ensemble", icon: BarChart3 },
  { value: 'services', label: 'Par service', icon: Target },
  { value: 'collaborateurs', label: 'Par collaborateur', icon: Users },
  { value: 'clients', label: 'Par client', icon: UserCheck },
  { value: 'seuil', label: 'Seuil de rentabilité', icon: Calculator },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#F06292', '#4DB6AC'];

const CATEGORIE_LABELS: Record<string, string> = {
  fournitures: 'Fournitures',
  loyer: 'Loyer',
  charges: 'Charges',
  telecom: 'Télécom',
  assurance: 'Assurance',
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
  autre: 'Autre',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function getDateRange(periode: Periode): { debut: string; fin: string } {
  const now = new Date();
  const fin = now.toISOString().split('T')[0];

  switch (periode) {
    case 'mois': {
      const debut = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { debut, fin };
    }
    case 'trimestre': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const debut = `${now.getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`;
      return { debut, fin };
    }
    case 'annee':
      return { debut: `${now.getFullYear()}-01-01`, fin };
  }
}

export default function Analytics() {
  const [periode, setPeriode] = useState<Periode>('annee');
  const [onglet, setOnglet] = useState<Onglet>('vue');
  const { businessType } = useProfile();

  const { debut, fin } = getDateRange(periode);

  const { data, isLoading, isError, refetch } = useQuery<AnalytiqueData>({
    queryKey: ['analytique', debut, fin, businessType],
    queryFn: () => analyticsApi.getAnalytique(debut, fin, businessType),
  });

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-3 sm:p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-gray-600">Erreur lors du chargement des données analytiques</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Comptabilité Analytique</h1>
          <p className="text-gray-500">Rentabilité, marges et seuil de rentabilité</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sélecteur de période */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {PERIODES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriode(p.value)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  periode === p.value
                    ? 'bg-white shadow text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b overflow-x-auto pb-px">
        {ONGLETS.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              onClick={() => setOnglet(o.value)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                onglet === o.value
                  ? 'border-cyan-600 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{o.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenu onglet */}
      {onglet === 'vue' && <OngletVueEnsemble data={data} businessType={businessType} />}
      {onglet === 'services' && <OngletServices data={data} />}
      {onglet === 'collaborateurs' && <OngletCollaborateurs data={data} />}
      {onglet === 'clients' && <OngletClients clients={data.par_client || []} />}
      {onglet === 'seuil' && <OngletSeuil data={data} />}
    </div>
  );
}

// ─── Onglet 1 : Vue d'ensemble ──────────────────────────────────────────────

function OngletVueEnsemble({ data, businessType }: { data: AnalytiqueData; businessType: string }) {
  const s = data.synthese;

  // KPIs sectoriels (2 métriques adaptées au métier)
  const kpisSectoriels = useMemo(() => {
    const totalFactures = data.par_service.reduce((sum, svc) => sum + svc.nb_factures, 0);
    const totalRdv = data.par_collaborateur.reduce((sum, c) => sum + c.nb_rdv, 0);
    const nbCollabs = data.par_collaborateur.filter(c => c.nom !== 'Non assigné').length;
    const caParCollab = nbCollabs > 0 ? s.ca_ht / nbCollabs : 0;
    switch (businessType) {
      case 'restaurant': {
        // Food cost ratio = fournitures / CA (objectif < 30%)
        const fournitures = data.depenses.par_categorie.find(d => d.categorie === 'fournitures');
        const foodCost = fournitures ? (fournitures.total / s.ca_ht) * 100 : 0;
        return [
          { label: 'Ticket moyen', value: totalFactures > 0 ? formatCurrency(s.ca_ht / totalFactures) : '-' },
          { label: 'Food cost', value: s.ca_ht > 0 ? `${foodCost.toFixed(1)}%` : '-', target: '< 30%' },
        ];
      }
      case 'hotel':
        return [
          { label: 'RevPAR estimé', value: totalRdv > 0 ? formatCurrency(s.ca_ht / totalRdv) : '-' },
          { label: 'CA/chambre moy.', value: totalRdv > 0 ? formatCurrency(s.ca_ht / totalRdv) : '-' },
        ];
      case 'service_domicile':
        return [
          { label: 'CA/intervention', value: totalRdv > 0 ? formatCurrency(s.ca_ht / totalRdv) : '-' },
          { label: 'CA/technicien', value: nbCollabs > 0 ? formatCurrency(caParCollab) : '-' },
        ];
      default: // salon
        return [
          { label: 'Panier moyen', value: totalRdv > 0 ? formatCurrency(s.ca_ht / totalRdv) : '-' },
          { label: 'CA/collaborateur', value: nbCollabs > 0 ? formatCurrency(caParCollab) : '-' },
        ];
    }
  }, [data, businessType, s.ca_ht, s.charges_personnel]);

  // Données PieChart cascade SIG
  const chargesData = [
    { name: 'Consommations', value: s.consommations },
    { name: 'Personnel', value: s.charges_personnel },
    { name: 'Charges externes', value: s.charges_externes },
  ].filter((d) => d.value > 0);

  // Top 5 services par CA
  const top5Services = data.par_service.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI cards : 4 génériques + sectoriels */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          label="CA HT"
          value={formatCurrency(s.ca_ht)}
          icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
        />
        <KPICard
          label="Marge brute"
          value={`${s.taux_marge_brute.toFixed(1)}%`}
          sub={formatCurrency(s.marge_brute)}
          icon={<TrendingUp className="w-5 h-5 text-green-500" />}
          positive={s.taux_marge_brute > 0}
        />
        <KPICard
          label="EBE"
          value={formatCurrency(s.ebe)}
          sub={`${s.taux_ebe.toFixed(1)}%`}
          icon={s.ebe >= 0 ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
          positive={s.ebe >= 0}
        />
        <KPICard
          label="Résultat net"
          value={formatCurrency(s.resultat_net)}
          sub={`${s.marge_nette.toFixed(1)}%`}
          icon={s.resultat_net >= 0 ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
          positive={s.resultat_net >= 0}
        />
        {kpisSectoriels.map((kpi) => (
          <KPICard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            sub={'target' in kpi ? (kpi as { target: string }).target : undefined}
            icon={<Calculator className="w-5 h-5 text-cyan-500" />}
          />
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* PieChart Charges */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des charges</CardTitle>
          </CardHeader>
          <CardContent>
            {chargesData.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Aucune dépense enregistrée</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chargesData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    <Cell fill="#10B981" />
                    <Cell fill="#3B82F6" />
                    <Cell fill="#F59E0B" />
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex justify-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                Achats: {formatCurrency(s.consommations)}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                Personnel: {formatCurrency(s.charges_personnel)}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                Externes: {formatCurrency(s.charges_externes)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BarChart Top 5 services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 services par CA</CardTitle>
          </CardHeader>
          <CardContent>
            {top5Services.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={top5Services} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} tickFormatter={(v) => `${v}€`} />
                  <YAxis type="category" dataKey="nom" fontSize={11} width={120} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="ca_ht" fill="#0088FE" name="CA HT" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Onglet 2 : Par service ─────────────────────────────────────────────────

function OngletServices({ data }: { data: AnalytiqueData }) {
  const services = data.par_service;
  const totalCA = services.reduce((sum, s) => sum + s.ca_ht, 0);

  // Données tendance mensuelle — extraire les noms de services uniques
  const serviceNames = useMemo(() => {
    const names = new Set<string>();
    for (const t of data.tendance_mensuelle) {
      for (const key of Object.keys(t)) {
        if (key !== 'mois') names.add(key);
      }
    }
    return Array.from(names);
  }, [data.tendance_mensuelle]);

  return (
    <div className="space-y-6">
      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CA par service</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-center text-gray-400 py-4">Aucune facture payée sur la période</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Service</th>
                    <th className="pb-2 font-medium text-right">CA HT</th>
                    <th className="pb-2 font-medium text-right">Factures</th>
                    <th className="pb-2 font-medium text-right">% du total</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.nom} className="border-b last:border-0">
                      <td className="py-2 font-medium">{s.nom}</td>
                      <td className="py-2 text-right">{formatCurrency(s.ca_ht)}</td>
                      <td className="py-2 text-right">{s.nb_factures}</td>
                      <td className="py-2 text-right">
                        {totalCA > 0 ? ((s.ca_ht / totalCA) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-right">{formatCurrency(totalCA)}</td>
                    <td className="pt-2 text-right">{services.reduce((s, v) => s + v.nb_factures, 0)}</td>
                    <td className="pt-2 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* BarChart CA par service */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CA par service</CardTitle>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={services}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nom" fontSize={11} angle={-20} textAnchor="end" height={60} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${v}€`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="ca_ht" name="CA HT" radius={[4, 4, 0, 0]}>
                    {services.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* LineChart évolution mensuelle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Évolution mensuelle</CardTitle>
          </CardHeader>
          <CardContent>
            {data.tendance_mensuelle.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Pas assez de données</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.tendance_mensuelle}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" fontSize={11} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${v}€`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  {serviceNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Onglet 3 : Par collaborateur ───────────────────────────────────────────

function OngletCollaborateurs({ data }: { data: AnalytiqueData }) {
  const collabs = data.par_collaborateur;

  return (
    <div className="space-y-6">
      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance par collaborateur</CardTitle>
        </CardHeader>
        <CardContent>
          {collabs.length === 0 ? (
            <p className="text-center text-gray-400 py-4">Aucune réservation sur la période</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Collaborateur</th>
                    <th className="pb-2 font-medium">Rôle</th>
                    <th className="pb-2 font-medium text-right">CA</th>
                    <th className="pb-2 font-medium text-right">Réservations</th>
                    <th className="pb-2 font-medium text-right">Panier moy.</th>
                    <th className="pb-2 font-medium text-right">Salaire</th>
                    <th className="pb-2 font-medium text-right">Ratio CA/Salaire</th>
                  </tr>
                </thead>
                <tbody>
                  {collabs.map((c) => {
                    const panierMoyen = c.nb_rdv > 0 ? c.ca / c.nb_rdv : 0;
                    const ratio = c.salaire_mensuel > 0 ? c.ca / c.salaire_mensuel : null;
                    return (
                      <tr key={c.nom} className="border-b last:border-0">
                        <td className="py-2 font-medium">{c.nom}</td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-xs capitalize">{c.role}</Badge>
                        </td>
                        <td className="py-2 text-right">{formatCurrency(c.ca)}</td>
                        <td className="py-2 text-right">{c.nb_rdv}</td>
                        <td className="py-2 text-right">{formatCurrency(panierMoyen)}</td>
                        <td className="py-2 text-right">
                          {c.salaire_mensuel > 0 ? formatCurrency(c.salaire_mensuel) : '-'}
                        </td>
                        <td className="py-2 text-right">
                          {ratio !== null ? (
                            <Badge className={cn(
                              'text-xs',
                              ratio >= 3 ? 'bg-green-100 text-green-700' :
                              ratio >= 2 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            )}>
                              x{ratio.toFixed(1)}
                            </Badge>
                          ) : '-'}
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

      {/* BarChart CA par collaborateur */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CA par collaborateur</CardTitle>
        </CardHeader>
        <CardContent>
          {collabs.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collabs}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nom" fontSize={11} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={12} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="ca" name="CA" radius={[4, 4, 0, 0]}>
                  {collabs.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Onglet 4 : Seuil de rentabilité ────────────────────────────────────────

function OngletSeuil({ data }: { data: AnalytiqueData }) {
  const s = data.synthese;
  const progressValue = s.seuil_rentabilite > 0 ? (s.ca_ht / s.seuil_rentabilite) * 100 : 0;
  const depenses = data.depenses.par_categorie;

  // Données BarChart : Charges fixes vs Variables vs CA
  const stackedData = [
    { name: 'Charges fixes', montant: s.charges_fixes },
    { name: 'Coûts variables', montant: s.couts_variables },
    { name: 'CA HT', montant: s.ca_ht },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs seuil */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Charges fixes"
          value={formatCurrency(s.charges_fixes)}
          icon={<Calculator className="w-5 h-5 text-amber-500" />}
        />
        <KPICard
          label="Coûts variables"
          value={formatCurrency(s.couts_variables)}
          icon={<Calculator className="w-5 h-5 text-blue-500" />}
        />
        <KPICard
          label="Taux marge sur CV"
          value={`${s.taux_marge_cv.toFixed(1)}%`}
          sub={`Marge brute: ${s.taux_marge_brute.toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5 text-green-500" />}
          positive={s.taux_marge_cv > 50}
        />
        <KPICard
          label="Seuil rentabilité"
          value={formatCurrency(s.seuil_rentabilite)}
          sub={s.point_mort_atteint ? 'Atteint' : 'Non atteint'}
          icon={<Target className="w-5 h-5 text-purple-500" />}
          positive={s.point_mort_atteint}
        />
      </div>

      {/* Jauge seuil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progression vers le seuil de rentabilité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">CA réalisé</span>
              <span className="font-medium">{formatCurrency(s.ca_ht)}</span>
            </div>
            <div className="relative">
              <div className="h-6 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={cn(
                    'h-full transition-all rounded-full',
                    s.point_mort_atteint ? 'bg-green-500' : 'bg-red-500'
                  )}
                  style={{ width: `${Math.min(progressValue, 100)}%` }}
                />
              </div>
              {s.seuil_rentabilite > 0 && (
                <div className="absolute top-0 h-6 border-r-2 border-dashed border-gray-700" style={{ left: '100%' }} />
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Seuil de rentabilité</span>
              <span className="font-medium">{formatCurrency(s.seuil_rentabilite)}</span>
            </div>
            <div className="text-center">
              <Badge className={cn(
                'text-sm px-4 py-1',
                s.point_mort_atteint
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              )}>
                {s.point_mort_atteint
                  ? `Point mort atteint (${progressValue.toFixed(0)}%)`
                  : `${progressValue.toFixed(0)}% du seuil — manque ${formatCurrency(s.seuil_rentabilite - s.ca_ht)}`
                }
              </Badge>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Seuil = Charges fixes ({formatCurrency(s.charges_fixes)}) / Taux marge sur CV ({s.taux_marge_cv.toFixed(1)}%)
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* BarChart comparatif */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CA vs Charges</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stackedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={12} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="montant" name="Montant" radius={[4, 4, 0, 0]}>
                  <Cell fill="#F59E0B" />
                  <Cell fill="#3B82F6" />
                  <Cell fill="#10B981" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Fixes</div>
              <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Variables</div>
              <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /> CA</div>
            </div>
          </CardContent>
        </Card>

        {/* Table catégories de dépenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail des dépenses</CardTitle>
          </CardHeader>
          <CardContent>
            {depenses.length === 0 ? (
              <p className="text-center text-gray-400 py-4">Aucune dépense</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 font-medium">Catégorie</th>
                      <th className="pb-2 font-medium text-right">Montant</th>
                      <th className="pb-2 font-medium text-center">SIG</th>
                      <th className="pb-2 font-medium text-center">Variabilité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depenses.map((d) => (
                      <tr key={d.categorie} className="border-b last:border-0">
                        <td className="py-1.5">{CATEGORIE_LABELS[d.categorie] || d.categorie}</td>
                        <td className="py-1.5 text-right">{formatCurrency(d.total)}</td>
                        <td className="py-1.5 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              d.sig === 'achat' ? 'border-emerald-300 text-emerald-700' :
                              d.sig === 'personnel' ? 'border-blue-300 text-blue-700' :
                              'border-amber-300 text-amber-700'
                            )}
                          >
                            {d.sig === 'achat' ? 'Achat' : d.sig === 'personnel' ? 'Personnel' : 'Externe'}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              d.variable ? 'border-purple-300 text-purple-700' : 'border-gray-300 text-gray-500'
                            )}
                          >
                            {d.variable ? 'Variable' : 'Fixe'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="pt-2">Total</td>
                      <td className="pt-2 text-right">
                        {formatCurrency(s.consommations + s.charges_personnel + s.charges_externes)}
                      </td>
                      <td />
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Onglet 5 : Par client ────────────────────────────────────────────────

function OngletClients({ clients }: { clients: AnalytiqueClient[] }) {
  const totalCA = clients.reduce((sum, c) => sum + c.ca_ht, 0);
  const top10 = clients.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* BarChart Top 10 clients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 clients par CA</CardTitle>
        </CardHeader>
        <CardContent>
          {top10.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Aucune donnée client</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} tickFormatter={(v) => `${v}€`} />
                <YAxis type="category" dataKey="client_nom" fontSize={11} width={130} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="ca_ht" name="CA HT" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                  {top10.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail par client</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-center text-gray-400 py-4">Aucune facture sur la période</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Client</th>
                    <th className="pb-2 font-medium text-right">CA HT</th>
                    <th className="pb-2 font-medium text-right">Factures</th>
                    <th className="pb-2 font-medium text-right">CA moyen</th>
                    <th className="pb-2 font-medium text-right">Dernière facture</th>
                    <th className="pb-2 font-medium text-right">% du total</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.client_id || c.client_nom} className="border-b last:border-0">
                      <td className="py-2 font-medium">{c.client_nom}</td>
                      <td className="py-2 text-right">{formatCurrency(c.ca_ht)}</td>
                      <td className="py-2 text-right">{c.nb_factures}</td>
                      <td className="py-2 text-right">{formatCurrency(c.ca_moyen)}</td>
                      <td className="py-2 text-right text-gray-500">
                        {c.derniere_facture ? new Date(c.derniere_facture).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '-'}
                      </td>
                      <td className="py-2 text-right">
                        {totalCA > 0 ? ((c.ca_ht / totalCA) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-right">{formatCurrency(totalCA)}</td>
                    <td className="pt-2 text-right">{clients.reduce((s, c) => s + c.nb_factures, 0)}</td>
                    <td className="pt-2 text-right">
                      {clients.length > 0 ? formatCurrency(totalCA / clients.length) : '-'}
                    </td>
                    <td />
                    <td className="pt-2 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Composant KPI Card ─────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  icon,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  positive?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
          {sub && (
            <p className={cn(
              'text-xs',
              positive === undefined ? 'text-gray-400' :
              positive ? 'text-green-600' : 'text-red-600'
            )}>
              {sub}
            </p>
          )}
        </div>
        {icon}
      </div>
    </Card>
  );
}
