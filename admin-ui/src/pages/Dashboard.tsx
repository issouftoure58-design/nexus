import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statsApi, quotasApi, type DashboardStats, type QuotasData } from '@/lib/api';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Euro,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { data: stats, isLoading, error, refetch } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: statsApi.getDashboard,
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: quotas } = useQuery<QuotasData>({
    queryKey: ['quotas'],
    queryFn: quotasApi.get,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatTime = (heure: string) => {
    return heure?.slice(0, 5) || '--:--';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  if (isLoading) {
    return (
      <Layout title="Tableau de bord" subtitle="Chargement...">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Tableau de bord" subtitle="Erreur">
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-gray-600">Erreur lors du chargement des données</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </Layout>
    );
  }

  const totalRdv = stats ? stats.rdv.confirmes + stats.rdv.en_attente + stats.rdv.termines : 0;

  return (
    <Layout title="Tableau de bord" subtitle={`Bonjour ! Voici l'activité d'aujourd'hui`}>
      <div className="space-y-6">
        {/* KPIs Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CA du jour */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -translate-y-8 translate-x-8" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">CA du jour</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {formatCurrency(stats?.ca.jour || 0)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <Euro className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-gray-500">Ce mois:</span>
                <span className="font-semibold text-gray-700">{formatCurrency(stats?.ca.mois || 0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Réservations */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-8 translate-x-8" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Réservations</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{totalRdv}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {stats?.rdv.confirmes || 0} confirmés
                </Badge>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  {stats?.rdv.en_attente || 0} en attente
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Clients */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -translate-y-8 translate-x-8" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Clients</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.nbClients || 0}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <Link to="/clients" className="mt-4 flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700">
                Voir tous les clients
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          {/* Prochaine prestation */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -translate-y-8 translate-x-8" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Prochaine prestation</p>
                  {stats?.prochainRdv ? (
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {formatTime(stats.prochainRdv.heure)}
                    </p>
                  ) : (
                    <p className="text-xl font-medium text-gray-400 mt-1">Aucun</p>
                  )}
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              {stats?.prochainRdv && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600 truncate">
                    {stats.prochainRdv.clients?.prenom} {stats.prochainRdv.clients?.nom}
                  </p>
                  <p className="text-xs text-gray-400">{stats.prochainRdv.service_nom}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Chiffre d'affaires (7 derniers jours)</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.graphiqueCa || []}>
                    <defs>
                      <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="jour"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      tickFormatter={(value) => `${value}€`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white shadow-lg rounded-lg p-3 border">
                              <p className="text-sm font-medium">{payload[0].payload.date}</p>
                              <p className="text-lg font-bold text-cyan-600">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ca"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fill="url(#colorCa)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Services populaires */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Services populaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(stats?.servicesPopulaires || []).map((service, index) => (
                  <div key={service.service} className="flex items-center gap-3">
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      index === 0 && 'bg-yellow-100 text-yellow-700',
                      index === 1 && 'bg-gray-100 text-gray-700',
                      index === 2 && 'bg-orange-100 text-orange-700',
                      index > 2 && 'bg-gray-50 text-gray-500'
                    )}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{service.service}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(100, (service.count / (stats?.servicesPopulaires[0]?.count || 1)) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-600">{service.count}</span>
                  </div>
                ))}
                {(!stats?.servicesPopulaires || stats.servicesPopulaires.length === 0) && (
                  <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Statut des prestations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Statut des réservations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">Terminés</span>
                  </div>
                  <span className="text-lg font-bold text-green-700">{stats?.rdv.termines || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium">Confirmés</span>
                  </div>
                  <span className="text-lg font-bold text-blue-700">{stats?.rdv.confirmes || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium">En attente</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-700">{stats?.rdv.en_attente || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium">Annulés</span>
                  </div>
                  <span className="text-lg font-bold text-red-700">{stats?.rdv.annules || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quotas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                <span>Utilisation des quotas</span>
                {quotas && (
                  <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-0">
                    {quotas.plan}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quotas ? (
                  <>
                    <QuotaBar
                      label="Clients"
                      used={quotas.quotas.clients.used}
                      limit={quotas.quotas.clients.limit}
                      color="purple"
                    />
                    <QuotaBar
                      label="Messages IA"
                      used={quotas.quotas.messages_ia.used}
                      limit={quotas.quotas.messages_ia.limit}
                      color="cyan"
                    />
                    <QuotaBar
                      label="Réservations"
                      used={quotas.quotas.reservations.used}
                      limit={quotas.quotas.reservations.limit}
                      color="blue"
                    />
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Chargement...</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions rapides */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/reservations">
                  <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="text-xs">Nouvelle prestation</span>
                  </Button>
                </Link>
                <Link to="/clients">
                  <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    <span className="text-xs">Nouveau client</span>
                  </Button>
                </Link>
                <Link to="/analytics">
                  <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-xs">Analytics</span>
                  </Button>
                </Link>
                <Link to="/parametres">
                  <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                    <Sparkles className="h-5 w-5 text-orange-600" />
                    <span className="text-xs">Paramètres</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

// Quota progress bar component
function QuotaBar({ label, used, limit, color }: { label: string; used: number; limit: number; color: string }) {
  const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isUnlimited = limit === -1;
  const isWarning = percentage > 80;
  const isCritical = percentage > 95;

  const colorClasses: Record<string, string> = {
    purple: 'from-purple-500 to-purple-600',
    cyan: 'from-cyan-500 to-cyan-600',
    blue: 'from-blue-500 to-blue-600',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">
          {used.toLocaleString()} / {isUnlimited ? '∞' : limit.toLocaleString()}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={cn(
            'h-2 rounded-full bg-gradient-to-r transition-all duration-500',
            isCritical ? 'from-red-500 to-red-600' : isWarning ? 'from-yellow-500 to-orange-500' : colorClasses[color]
          )}
          style={{ width: isUnlimited ? '30%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
}
