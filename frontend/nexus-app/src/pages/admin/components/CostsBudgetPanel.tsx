/**
 * CostsBudgetPanel - Affichage des coûts réels
 *
 * Utilise le hook useCosts pour récupérer les vraies données
 * depuis sentinel_usage via l'API /api/sentinel/costs/current.
 */

import React from 'react';
import { useCosts } from '../../../hooks/useCosts';

interface CostsBudgetPanelProps {
  tenantId?: string;
}

export default function CostsBudgetPanel({ tenantId }: CostsBudgetPanelProps) {
  const { costs, loading, error, refresh } = useCosts(tenantId);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-100 rounded-lg p-4 h-24" />
          ))}
        </div>
        <div className="bg-gray-100 rounded-lg p-6 h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">Error loading costs</span>
          <span className="text-red-600 font-semibold">{error}</span>
        </div>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const today = costs?.today || { total: 0, byService: { anthropic: 0, twilio: 0, elevenlabs: 0 }, calls: 0, tokensIn: 0, tokensOut: 0 };
  const month = costs?.month || { total: 0, byService: { anthropic: 0, twilio: 0, elevenlabs: 0 }, calls: 0, tokensIn: 0, tokensOut: 0 };

  // Budgets mensuels (configurable)
  const budgets = {
    anthropic: 150,
    twilio: 80,
    elevenlabs: 20,
    total: 250
  };

  const getPercentage = (value: number, max: number) => Math.min((value / max) * 100, 100);
  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* KPIs du jour et du mois */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
          <div className="text-sm text-cyan-600 mb-1">Aujourd'hui</div>
          <div className="text-3xl font-bold text-cyan-900">
            {today.total.toFixed(4)}
          </div>
          <div className="text-xs text-cyan-500 mt-1">
            {today.calls} appels
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 mb-1">Ce mois</div>
          <div className="text-3xl font-bold text-blue-900">
            {month.total.toFixed(2)}
          </div>
          <div className="text-xs text-blue-500 mt-1">
            {month.calls.toLocaleString()} appels
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-sm text-purple-600 mb-1">Tokens IN</div>
          <div className="text-3xl font-bold text-purple-900">
            {(month.tokensIn / 1000000).toFixed(2)}M
          </div>
          <div className="text-xs text-purple-500 mt-1">
            ~{Math.round(month.tokensIn / month.calls || 0)} / appel
          </div>
        </div>

        <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
          <div className="text-sm text-pink-600 mb-1">Tokens OUT</div>
          <div className="text-3xl font-bold text-pink-900">
            {(month.tokensOut / 1000).toFixed(0)}K
          </div>
          <div className="text-xs text-pink-500 mt-1">
            ~{Math.round(month.tokensOut / month.calls || 0)} / appel
          </div>
        </div>
      </div>

      {/* Budget par service */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Budget par service</h3>
          <button
            onClick={refresh}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Actualiser
          </button>
        </div>
        <div className="text-sm text-gray-600 mb-4">
          Chaque service a un budget mensuel. La barre montre le % consomme.
        </div>

        <div className="space-y-6">
          {/* Anthropic Claude */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <span className="text-lg">Claude</span>
                  Anthropic
                </div>
                <div className="text-sm text-gray-500">
                  Conversations IA, outils, analyse
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  {month.byService.anthropic.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">/ {budgets.anthropic}</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${getStatusColor(getPercentage(month.byService.anthropic, budgets.anthropic))}`}
                style={{ width: `${getPercentage(month.byService.anthropic, budgets.anthropic)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{month.calls.toLocaleString()} appels API</span>
              <span>{getPercentage(month.byService.anthropic, budgets.anthropic).toFixed(1)}% utilise</span>
            </div>
          </div>

          {/* Twilio */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <span className="text-lg">SMS</span>
                  Twilio
                </div>
                <div className="text-sm text-gray-500">
                  SMS rappels, WhatsApp, appels
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  {month.byService.twilio.toFixed(4)}
                </div>
                <div className="text-sm text-gray-500">/ {budgets.twilio}</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${getStatusColor(getPercentage(month.byService.twilio, budgets.twilio))}`}
                style={{ width: `${Math.max(getPercentage(month.byService.twilio, budgets.twilio), 1)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Non tracke actuellement</span>
              <span>{getPercentage(month.byService.twilio, budgets.twilio).toFixed(1)}% utilise</span>
            </div>
          </div>

          {/* ElevenLabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <span className="text-lg">Voice</span>
                  ElevenLabs
                </div>
                <div className="text-sm text-gray-500">
                  Synthese vocale Halimah
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  {month.byService.elevenlabs.toFixed(4)}
                </div>
                <div className="text-sm text-gray-500">/ {budgets.elevenlabs}</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${getStatusColor(getPercentage(month.byService.elevenlabs, budgets.elevenlabs))}`}
                style={{ width: `${Math.max(getPercentage(month.byService.elevenlabs, budgets.elevenlabs), 1)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Non tracke actuellement</span>
              <span>{getPercentage(month.byService.elevenlabs, budgets.elevenlabs).toFixed(1)}% utilise</span>
            </div>
          </div>
        </div>
      </div>

      {/* Evolution par jour */}
      {month.byDate && month.byDate.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Evolution par jour</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Appels</th>
                  <th className="pb-2 text-right">Cout</th>
                </tr>
              </thead>
              <tbody>
                {month.byDate.slice(-7).map((day, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2">{day.date}</td>
                    <td className="py-2 text-right">{day.calls.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{day.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right">{month.calls.toLocaleString()}</td>
                  <td className="pt-2 text-right font-mono">{month.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Alert si budget depasse */}
      {getPercentage(month.total, budgets.total) >= 80 && (
        <div className={`rounded-lg p-4 ${getPercentage(month.total, budgets.total) >= 100 ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getPercentage(month.total, budgets.total) >= 100 ? 'Critical' : 'Warning'}</span>
            <div>
              <div className="font-semibold">
                {getPercentage(month.total, budgets.total) >= 100 ? 'Budget depasse!' : 'Attention au budget'}
              </div>
              <div className="text-sm text-gray-600">
                {month.total.toFixed(2)} / {budgets.total} ({getPercentage(month.total, budgets.total).toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="text-xs text-gray-400 text-right">
        Derniere mise a jour: {costs?.timestamp ? new Date(costs.timestamp).toLocaleString() : 'N/A'}
      </div>
    </div>
  );
}
