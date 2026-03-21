import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { comptaApi, type ComptaDashboardResponse } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatCurrency, COLORS } from './constants';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Percent,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  exercice: number;
}

export default function ComptaDashboard({ exercice }: Props) {
  const { data, isLoading } = useQuery<ComptaDashboardResponse>({
    queryKey: ['compta-dashboard', exercice],
    queryFn: () => comptaApi.getDashboardAnalytics(exercice),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-400 py-8">Aucune donnée disponible</div>;
  }

  const { kpis, tendance_12mois, tresorerie_mensuelle, charges_par_categorie, top_services, top_clients } = data;

  return (
    <div className="space-y-6">
      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          label="CA HT"
          value={formatCurrency(kpis.ca_ht)}
          variation={kpis.variation_ca_pct}
          icon={<DollarSign className="h-5 w-5 text-blue-500" />}
          sparkData={tendance_12mois.map(t => t.ca_ht)}
          sparkColor="#3b82f6"
        />
        <KPICard
          label="Charges"
          value={formatCurrency(kpis.charges)}
          variation={kpis.variation_charges_pct}
          invertVariation
          icon={<TrendingDown className="h-5 w-5 text-red-500" />}
          sparkData={tendance_12mois.map(t => t.charges)}
          sparkColor="#ef4444"
        />
        <KPICard
          label="Résultat Net"
          value={formatCurrency(kpis.resultat_net)}
          variation={kpis.variation_resultat_pct}
          icon={kpis.resultat_net >= 0
            ? <TrendingUp className="h-5 w-5 text-green-500" />
            : <TrendingDown className="h-5 w-5 text-red-500" />}
          sparkData={tendance_12mois.map(t => t.resultat)}
          sparkColor={kpis.resultat_net >= 0 ? '#10b981' : '#ef4444'}
        />
        <KPICard
          label="Marge"
          value={`${kpis.marge_pct}%`}
          icon={<Percent className="h-5 w-5 text-purple-500" />}
          positive={kpis.marge_pct > 0}
        />
        <KPICard
          label="TVA Nette"
          value={formatCurrency(kpis.tva_nette)}
          icon={<Receipt className="h-5 w-5 text-cyan-500" />}
        />
        <KPICard
          label="Impayées"
          value={`${kpis.factures_impayees_count}`}
          sub={formatCurrency(kpis.factures_impayees_montant)}
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          positive={kpis.factures_impayees_count === 0}
        />
      </div>

      {/* Tendance 12 mois */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tendance CA / Charges / Résultat (12 mois)</CardTitle>
        </CardHeader>
        <CardContent>
          {tendance_12mois.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tendance_12mois}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" fontSize={11} tickFormatter={m => m.substring(5)} />
                <YAxis fontSize={12} tickFormatter={v => `${v}€`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="ca_ht" name="CA HT" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="charges" name="Charges" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="resultat" name="Résultat" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Ligne du bas : 3 colonnes */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Trésorerie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trésorerie</CardTitle>
          </CardHeader>
          <CardContent>
            {tresorerie_mensuelle.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tresorerie_mensuelle}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" fontSize={10} tickFormatter={m => m.substring(5)} />
                  <YAxis fontSize={10} tickFormatter={v => `${v}€`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="encaissements" name="Encaissements" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="decaissements" name="Décaissements" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Services</CardTitle>
          </CardHeader>
          <CardContent>
            {top_services.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={top_services.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={10} tickFormatter={v => `${v}€`} />
                  <YAxis type="category" dataKey="nom" fontSize={10} width={90} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="ca_ht" name="CA HT" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Clients</CardTitle>
          </CardHeader>
          <CardContent>
            {top_clients.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={top_clients.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={10} tickFormatter={v => `${v}€`} />
                  <YAxis type="category" dataKey="client_nom" fontSize={10} width={90} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="ca_ht" name="CA HT" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Répartition charges */}
      {charges_par_categorie.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des charges par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={charges_par_categorie}
                    dataKey="montant"
                    nameKey="categorie"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {charges_par_categorie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex flex-col justify-center">
                {charges_par_categorie.map((c, i) => (
                  <div key={c.categorie} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="truncate flex-1">{c.categorie}</span>
                    <span className="font-medium">{formatCurrency(c.montant)}</span>
                    <span className="text-gray-400 text-xs w-10 text-right">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── KPI Card avec sparkline ────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  variation,
  invertVariation,
  icon,
  positive,
  sparkData,
  sparkColor,
}: {
  label: string;
  value: string;
  sub?: string;
  variation?: number;
  invertVariation?: boolean;
  icon: React.ReactNode;
  positive?: boolean;
  sparkData?: number[];
  sparkColor?: string;
}) {
  const isPositive = variation !== undefined
    ? (invertVariation ? variation <= 0 : variation >= 0)
    : positive;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
          {variation !== undefined && (
            <span className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-full inline-block',
              isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              {variation >= 0 ? '+' : ''}{variation}%
            </span>
          )}
          {sub && !variation && (
            <p className={cn('text-xs', isPositive === undefined ? 'text-gray-400' : isPositive ? 'text-green-600' : 'text-red-600')}>{sub}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {icon}
          {sparkData && sparkData.length > 1 && (
            <div className="w-16 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData.map((v, i) => ({ v, i }))}>
                  <Area type="monotone" dataKey="v" stroke={sparkColor || '#8884d8'} fill={sparkColor || '#8884d8'} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
