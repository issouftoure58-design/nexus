/**
 * Page Fidélité — Programme de points clients
 * Stats, config, leaderboard, historique client
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Star, Trophy, Settings, Users, TrendingUp,
  Award, Gift, Loader2, Save, ArrowUpDown
} from 'lucide-react';
import { loyaltyApi } from '@/lib/api';

interface LoyaltyConfig {
  enabled: boolean;
  points_per_euro: number;
  signup_bonus: number;
  validity_days: number;
  min_redeem: number;
  redeem_ratio: number;
}

interface LeaderboardEntry {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  loyalty_points: number;
  total_spent: number;
}

interface LoyaltyStats {
  total_points_circulation: number;
  active_members: number;
  earned_30d: number;
  redeemed_30d: number;
}

export default function Fidelite() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'leaderboard'>('overview');
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [adjustForm, setAdjustForm] = useState({ points: '', reason: '' });

  // Data
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['loyalty-stats'],
    queryFn: loyaltyApi.getStats,
  });

  const { data: leaderboardData, isLoading: loadingLeaderboard } = useQuery({
    queryKey: ['loyalty-leaderboard'],
    queryFn: () => loyaltyApi.getLeaderboard(),
  });

  const { data: _clientDetail } = useQuery({
    queryKey: ['loyalty-client', selectedClient],
    queryFn: () => loyaltyApi.getClientDetail(selectedClient!),
    enabled: !!selectedClient,
  });

  // Config form
  const [configForm, setConfigForm] = useState<Partial<LoyaltyConfig>>({});

  const { data: configData } = useQuery<{ config: LoyaltyConfig }>({
    queryKey: ['loyalty-config'],
    queryFn: loyaltyApi.getConfig,
  });

  useEffect(() => {
    if (configData?.config) setConfigForm(configData.config);
  }, [configData]);

  const saveConfig = useMutation({
    mutationFn: (config: Partial<LoyaltyConfig>) => loyaltyApi.updateConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-config'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-stats'] });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ clientId, points, reason }: { clientId: number; points: number; reason: string }) =>
      loyaltyApi.adjustPoints(clientId, points, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-client', selectedClient] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-stats'] });
      setAdjustForm({ points: '', reason: '' });
    },
  });

  const stats: LoyaltyStats = statsData?.stats || { total_points_circulation: 0, active_members: 0, earned_30d: 0, redeemed_30d: 0 };
  const config: LoyaltyConfig = configData?.config || { enabled: true, points_per_euro: 1, signup_bonus: 50, validity_days: 730, min_redeem: 100, redeem_ratio: 0.10 };
  const leaderboard: LeaderboardEntry[] = leaderboardData?.leaderboard || [];

  if (loadingStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500" />
            Programme Fidélité
          </h1>
          <p className="text-gray-500 mt-1">Gestion des points et récompenses clients</p>
        </div>
        <Badge variant={config.enabled ? 'default' : 'secondary'} className={config.enabled ? 'bg-green-100 text-green-700' : ''}>
          {config.enabled ? 'Actif' : 'Désactivé'}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold">{stats.total_points_circulation.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Points en circulation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{stats.active_members}</p>
            <p className="text-sm text-gray-500">Membres actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold text-green-600">+{stats.earned_30d.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Gagnés (30j)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Gift className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold text-purple-600">-{stats.redeemed_30d.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Utilisés (30j)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto pb-px">
        {(['overview', 'config', 'leaderboard'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'overview' ? 'Vue d\'ensemble' : tab === 'config' ? 'Configuration' : 'Classement'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Règles actives
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Points par euro</span>
                <span className="font-medium">{config.points_per_euro} pt/€</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Bonus inscription</span>
                <span className="font-medium">{config.signup_bonus} pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Validité</span>
                <span className="font-medium">{Math.floor(config.validity_days / 365)} ans</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Minimum utilisation</span>
                <span className="font-medium">{config.min_redeem} pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Valeur remise</span>
                <span className="font-medium">{(config.redeem_ratio * 100).toFixed(0)} cts/pt ({config.min_redeem * config.redeem_ratio}€ min)</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5" />
                Top 5 clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.slice(0, 5).map((client, i) => (
                <div key={client.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{client.prenom} {client.nom}</p>
                    <p className="text-xs text-gray-400">{client.email}</p>
                  </div>
                  <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                    {client.loyalty_points.toLocaleString()} pts
                  </Badge>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Aucun membre avec des points</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'config' && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration du programme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40">Programme actif</label>
              <input
                type="checkbox"
                checked={configForm.enabled ?? config.enabled}
                onChange={e => setConfigForm(prev => ({ ...prev, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40">Points / euro</label>
              <Input
                type="number" step="0.1" min="0.1" max="10"
                value={configForm.points_per_euro ?? config.points_per_euro}
                onChange={e => setConfigForm(prev => ({ ...prev, points_per_euro: parseFloat(e.target.value) }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40">Bonus inscription</label>
              <Input
                type="number" min="0" max="500"
                value={configForm.signup_bonus ?? config.signup_bonus}
                onChange={e => setConfigForm(prev => ({ ...prev, signup_bonus: parseInt(e.target.value) }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40">Validité (jours)</label>
              <Input
                type="number" min="30" max="3650"
                value={configForm.validity_days ?? config.validity_days}
                onChange={e => setConfigForm(prev => ({ ...prev, validity_days: parseInt(e.target.value) }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40">Minimum utilisation</label>
              <Input
                type="number" min="1"
                value={configForm.min_redeem ?? config.min_redeem}
                onChange={e => setConfigForm(prev => ({ ...prev, min_redeem: parseInt(e.target.value) }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40">Ratio remise (€/pt)</label>
              <Input
                type="number" step="0.01" min="0.01" max="1"
                value={configForm.redeem_ratio ?? config.redeem_ratio}
                onChange={e => setConfigForm(prev => ({ ...prev, redeem_ratio: parseFloat(e.target.value) }))}
                className="w-32"
              />
            </div>
            <Button
              onClick={() => saveConfig.mutate(configForm)}
              disabled={saveConfig.isPending}
              className="mt-4"
            >
              {saveConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Sauvegarder
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'leaderboard' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Classement fidélité
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLeaderboard ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-3 w-12">#</th>
                      <th className="py-2 px-3">Client</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3 text-right">Points</th>
                      <th className="py-2 px-3 text-right">CA Total</th>
                      <th className="py-2 px-3 w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((client, i) => (
                      <tr key={client.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{client.prenom} {client.nom}</td>
                        <td className="py-2 px-3 text-gray-500">{client.email}</td>
                        <td className="py-2 px-3 text-right font-bold text-amber-600">{client.loyalty_points.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">{(client.total_spent || 0).toLocaleString()}€</td>
                        <td className="py-2 px-3">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setSelectedClient(selectedClient === client.id ? null : client.id)}
                          >
                            <ArrowUpDown className="w-4 h-4 mr-1" />
                            Ajuster
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {leaderboard.length === 0 && (
                  <p className="text-center text-gray-400 py-8">Aucun client avec des points fidélité</p>
                )}
              </div>
            )}

            {/* Adjust panel */}
            {selectedClient && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-medium mb-3">Ajustement manuel — Client #{selectedClient}</h4>
                <div className="flex gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-500">Points (+/-)</label>
                    <Input
                      type="number"
                      value={adjustForm.points}
                      onChange={e => setAdjustForm(prev => ({ ...prev, points: e.target.value }))}
                      placeholder="Ex: 50 ou -20"
                      className="w-32"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Raison</label>
                    <Input
                      value={adjustForm.reason}
                      onChange={e => setAdjustForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Geste commercial, correction..."
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (adjustForm.points && adjustForm.reason) {
                        adjustMutation.mutate({
                          clientId: selectedClient,
                          points: parseInt(adjustForm.points),
                          reason: adjustForm.reason,
                        });
                      }
                    }}
                    disabled={!adjustForm.points || !adjustForm.reason || adjustMutation.isPending}
                    size="sm"
                  >
                    {adjustMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
