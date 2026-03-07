/**
 * ChurnCharts — Graphiques de distribution du churn
 * 3 visualisations : BarChart scores, PieChart risques, BarChart facteurs
 */

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { api } from '@/lib/api';
import { RefreshCw } from 'lucide-react';

interface ChurnDistribution {
  distribution: Array<{ tranche: string; count: number }>;
  risk_levels: Array<{ name: string; value: number; color: string }>;
  top_factors: Array<{ factor: string; count: number }>;
}

export default function ChurnCharts() {
  const [data, setData] = useState<ChurnDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDistribution();
  }, []);

  const fetchDistribution = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<ChurnDistribution>('/admin/analytics/churn/distribution');
      setData(result);
    } catch {
      setError('Erreur chargement distribution churn');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
        {error || 'Donnees indisponibles'}
      </div>
    );
  }

  const hasData = data.distribution.some(d => d.count > 0);

  if (!hasData) {
    return (
      <div className="p-4 bg-gray-50 text-gray-500 rounded-lg text-sm text-center">
        Pas assez de donnees pour afficher les graphiques churn
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* Distribution des scores */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Distribution des scores</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.distribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tranche" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="count" name="Clients" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Repartition par risque */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Niveaux de risque</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data.risk_levels.filter(r => r.value > 0)}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              {data.risk_levels.filter(r => r.value > 0).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Top facteurs */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Top facteurs de churn</h3>
        {data.top_factors.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">Aucun facteur identifie</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.top_factors} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="factor" width={140} fontSize={11} tick={{ fill: '#6b7280' }} />
              <Tooltip />
              <Bar dataKey="count" name="Clients" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
