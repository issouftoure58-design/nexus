/**
 * Marketing Analytics — Dashboard analytics marketing
 * Consomme /api/marketing/analytics/overview et /evolution
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { marketingApi } from '@/lib/marketingApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, TrendingUp, Mail, MousePointer, Target,
  Eye, BarChart3, ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';

export default function MarketingAnalytics() {
  const [periode, setPeriode] = useState(30);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['marketing-analytics-overview', periode],
    queryFn: () => marketingApi.getAnalyticsOverview(periode),
  });

  const { data: evolution, isLoading: evolutionLoading } = useQuery({
    queryKey: ['marketing-analytics-evolution', periode],
    queryFn: () => marketingApi.getAnalyticsEvolution(periode),
  });

  const isLoading = overviewLoading || evolutionLoading;
  const stats = overview?.stats;
  const evolutionData = evolution?.evolution || [];
  const topCampagnes = overview?.top_campagnes || [];

  const formatPercent = (v?: number) => v != null ? `${v.toFixed(1)}%` : '0%';
  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const KPI_CARDS = [
    { label: 'Envois', value: stats?.envois || 0, icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Ouvertures', value: stats?.ouvertures || 0, icon: Eye, color: 'text-green-600', bg: 'bg-green-50', rate: formatPercent(stats?.taux_ouverture) },
    { label: 'Clics', value: stats?.clics || 0, icon: MousePointer, color: 'text-cyan-600', bg: 'bg-cyan-50', rate: formatPercent(stats?.taux_clic) },
    { label: 'Conversions', value: stats?.conversions || 0, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50', rate: formatPercent(stats?.taux_conversion) },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Marketing</h1>
          <p className="text-gray-500 mt-1">Performance de vos campagnes marketing</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(p => (
            <Button
              key={p}
              variant={periode === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriode(p)}
            >
              {p}j
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {KPI_CARDS.map(kpi => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.label}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">{kpi.label}</p>
                        <p className="text-2xl font-bold mt-1">{kpi.value.toLocaleString('fr-FR')}</p>
                        {kpi.rate && (
                          <p className={cn('text-sm font-medium mt-0.5', kpi.color)}>
                            {kpi.rate}
                          </p>
                        )}
                      </div>
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', kpi.bg)}>
                        <Icon className={cn('w-5 h-5', kpi.color)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evolution chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-600" />
                  Evolution sur {periode} jours
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evolutionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip labelFormatter={v => new Date(String(v)).toLocaleDateString('fr-FR')} />
                      <Area type="monotone" dataKey="envois" stackId="1" stroke="#3b82f6" fill="#3b82f680" name="Envois" />
                      <Area type="monotone" dataKey="ouvertures" stackId="2" stroke="#10b981" fill="#10b98180" name="Ouvertures" />
                      <Area type="monotone" dataKey="clics" stackId="3" stroke="#06b6d4" fill="#06b6d480" name="Clics" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">
                    <p>Aucune donnée sur cette période</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conversions bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  Conversions quotidiennes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evolutionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip labelFormatter={v => new Date(String(v)).toLocaleDateString('fr-FR')} />
                      <Bar dataKey="conversions" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Conversions" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">
                    <p>Aucune donnée sur cette période</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Campagnes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Campagnes</CardTitle>
            </CardHeader>
            <CardContent>
              {topCampagnes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 font-medium">Campagne</th>
                        <th className="pb-2 font-medium text-right">Envois</th>
                        <th className="pb-2 font-medium text-right">Ouvertures</th>
                        <th className="pb-2 font-medium text-right">Clics</th>
                        <th className="pb-2 font-medium text-right">Conversions</th>
                        <th className="pb-2 font-medium text-right">Taux conv.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {topCampagnes.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="py-2.5 font-medium text-gray-900">{c.nom}</td>
                          <td className="py-2.5 text-right">{c.total_envois || 0}</td>
                          <td className="py-2.5 text-right">{c.total_ouvertures || 0}</td>
                          <td className="py-2.5 text-right">{c.total_clics || 0}</td>
                          <td className="py-2.5 text-right">{c.total_conversions || 0}</td>
                          <td className="py-2.5 text-right">
                            <span className="text-green-600 font-medium flex items-center justify-end gap-1">
                              {c.total_envois
                                ? `${((c.total_conversions || 0) / c.total_envois * 100).toFixed(1)}%`
                                : '0%'}
                              <ArrowUpRight className="w-3 h-3" />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">Aucune campagne sur cette période</p>
              )}
            </CardContent>
          </Card>

          {/* Campagnes overview */}
          {overview?.campagnes && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-sm text-gray-500">Total campagnes</p>
                  <p className="text-3xl font-bold">{overview.campagnes.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-sm text-gray-500">En cours</p>
                  <p className="text-3xl font-bold text-green-600">{overview.campagnes.en_cours}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-sm text-gray-500">Terminées</p>
                  <p className="text-3xl font-bold text-blue-600">{overview.campagnes.terminees}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
