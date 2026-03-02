/**
 * Churn Prevention Page - Business Plan
 * Interface de gestion du risque de churn
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Mail,
  MessageSquare,
  Percent,
  RefreshCw,
  Users,
  TrendingDown,
  Shield,
  CheckCircle
} from 'lucide-react';

interface ChurnClient {
  client_id: number;
  name: string;
  email: string;
  risk_score: number;
  risk_level: 'high' | 'medium' | 'low';
  last_activity_days: number;
  total_spent: number;
  factors: {
    inactivity: number;
    frequency_drop: number;
    spending_drop: number;
    engagement: number;
  };
}

interface ChurnAnalysis {
  total_clients: number;
  at_risk: number;
  high_risk: number;
  medium_risk: number;
  clients: ChurnClient[];
}

type ActionType = 'email_retention' | 'sms_rappel' | 'promo_personnalisee';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};

export default function ChurnPrevention() {
  const [analysis, setAnalysis] = useState<ChurnAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all');

  useEffect(() => {
    fetchChurnAnalysis();
  }, []);

  const fetchChurnAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/analytics/churn', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!response.ok) throw new Error('Erreur fetch');
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      console.error('Erreur analyse churn:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreventAction = async (clientId: number, actionType: ActionType) => {
    setActionLoading(clientId);
    try {
      const response = await fetch(`/api/admin/analytics/churn/${clientId}/prevent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action_type: actionType })
      });
      if (!response.ok) throw new Error('Erreur action');
      const result = await response.json();
      setSuccessMessage(`Action "${actionType}" programmee pour ${result.task?.client_name || 'client'}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Erreur action anti-churn:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-orange-600 bg-orange-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'high': return 'Critique';
      case 'medium': return 'Attention';
      default: return 'Stable';
    }
  };

  const filteredClients = analysis?.clients.filter(c => {
    if (filter === 'all') return true;
    return c.risk_level === filter;
  }) || [];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Prevention Churn
          </h1>
          <p className="text-gray-500 mt-1">Identifiez et retenez vos clients a risque</p>
        </div>
        <Button variant="outline" onClick={fetchChurnAnalysis}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Clients</p>
              <p className="text-2xl font-bold">{analysis?.total_clients || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">A Risque</p>
              <p className="text-2xl font-bold text-orange-600">{analysis?.at_risk || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Risque Critique</p>
              <p className="text-2xl font-bold text-red-600">{analysis?.high_risk || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Attention</p>
              <p className="text-2xl font-bold text-yellow-600">{analysis?.medium_risk || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Tous ({analysis?.at_risk || 0})
        </Button>
        <Button
          variant={filter === 'high' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('high')}
        >
          Critiques ({analysis?.high_risk || 0})
        </Button>
        <Button
          variant={filter === 'medium' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('medium')}
        >
          Attention ({analysis?.medium_risk || 0})
        </Button>
      </div>

      {/* Liste clients a risque */}
      <div className="space-y-4">
        {filteredClients.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-500">Aucun client a risque detecte</p>
          </Card>
        ) : (
          filteredClients.map(client => (
            <Card key={client.client_id} className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{client.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(client.risk_level)}`}>
                      {getRiskLabel(client.risk_level)} - Score {client.risk_score}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 mb-3">{client.email}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Derniere activite</p>
                      <p className="font-medium">{client.last_activity_days ?? 0} jours</p>
                    </div>
                    <div>
                      <p className="text-gray-400">CA Total</p>
                      <p className="font-medium">{formatCurrency(client.total_spent ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Facteur principal</p>
                      <p className="font-medium">
                        {client.factors && Object.keys(client.factors).length > 0
                          ? Object.entries(client.factors)
                              .sort(([,a], [,b]) => b - a)[0]?.[0]
                              ?.replace('_', ' ') || 'N/A'
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Score inactivite</p>
                      <p className="font-medium">{client.factors?.inactivity ?? 0}/100</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:w-48">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading === client.client_id}
                    onClick={() => handlePreventAction(client.client_id, 'email_retention')}
                  >
                    {actionLoading === client.client_id ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4 mr-2" />
                    )}
                    Email Retention
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading === client.client_id}
                    onClick={() => handlePreventAction(client.client_id, 'sms_rappel')}
                  >
                    {actionLoading === client.client_id ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4 mr-2" />
                    )}
                    SMS Rappel
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={actionLoading === client.client_id}
                    onClick={() => handlePreventAction(client.client_id, 'promo_personnalisee')}
                  >
                    {actionLoading === client.client_id ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Percent className="w-4 h-4 mr-2" />
                    )}
                    Promo Perso
                  </Button>
                </div>
              </div>

              {/* Barre de score visuelle */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-400 w-20">Score Risque</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        client.risk_score >= 70 ? 'bg-red-500' :
                        client.risk_score >= 50 ? 'bg-orange-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${client.risk_score}%` }}
                    />
                  </div>
                  <span className="font-medium w-12 text-right">{client.risk_score}/100</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
