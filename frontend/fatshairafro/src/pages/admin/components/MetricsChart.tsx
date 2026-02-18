// client/src/pages/admin/components/MetricsChart.tsx

import React, { useState, useEffect } from 'react';

interface Metrics {
  errorsPerHour: number;
  tokensPerHour: number;
  avgResponseTime: number;
  requestsPerHour: number;
  timestamp: string;
}

// Helper to get auth token
const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export default function MetricsChart() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/sentinel/baseline', {
          headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch metrics');
        const data = await response.json();

        const baseline = data.baseline || {};
        setMetrics({
          errorsPerHour: parseFloat(baseline.errorsPerHour) || 0,
          tokensPerHour: parseFloat(baseline.tokensPerHour) || 0,
          avgResponseTime: parseFloat(baseline.avgResponseTime) || 0,
          requestsPerHour: parseFloat(baseline.requestsPerHour) || 0,
          timestamp: baseline.lastUpdated || new Date().toISOString()
        });
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
        // Set default metrics on error
        setMetrics({
          errorsPerHour: 0,
          tokensPerHour: 0,
          avgResponseTime: 0,
          requestsPerHour: 0,
          timestamp: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      label: 'Errors / Hour',
      value: metrics?.errorsPerHour.toFixed(2) || '0',
      icon: '⚠️',
      color: (metrics?.errorsPerHour || 0) > 10
        ? 'text-red-600 bg-red-50 border-red-200'
        : 'text-green-600 bg-green-50 border-green-200',
      trend: (metrics?.errorsPerHour || 0) > 10 ? 'high' : 'normal'
    },
    {
      label: 'Tokens / Hour',
      value: metrics?.tokensPerHour.toFixed(0) || '0',
      icon: '🎯',
      color: (metrics?.tokensPerHour || 0) > 100000
        ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
        : 'text-blue-600 bg-blue-50 border-blue-200',
      trend: (metrics?.tokensPerHour || 0) > 100000 ? 'high' : 'normal'
    },
    {
      label: 'Avg Response',
      value: `${metrics?.avgResponseTime.toFixed(0) || 0}ms`,
      icon: '⚡',
      color: (metrics?.avgResponseTime || 0) > 1000
        ? 'text-red-600 bg-red-50 border-red-200'
        : 'text-green-600 bg-green-50 border-green-200',
      trend: (metrics?.avgResponseTime || 0) > 1000 ? 'slow' : 'fast'
    },
    {
      label: 'Requests / Hour',
      value: metrics?.requestsPerHour.toFixed(0) || '0',
      icon: '📊',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      trend: 'normal'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Real-time Metrics</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live</span>
          <span className="text-gray-300">|</span>
          <span>
            Updated: {metrics?.timestamp
              ? new Date(metrics.timestamp).toLocaleTimeString()
              : 'N/A'
            }
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => (
          <div
            key={index}
            className={`border-2 rounded-lg p-4 ${metric.color}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{metric.icon}</span>
            </div>
            <div className="text-3xl font-bold mb-1">
              {metric.value}
            </div>
            <div className="text-sm opacity-80">{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Simple bar chart visualization */}
      <div className="mt-6 pt-6 border-t">
        <div className="text-sm font-medium text-gray-600 mb-3">Performance Overview</div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Error Rate</span>
              <span>{((metrics?.errorsPerHour || 0) / 100 * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (metrics?.errorsPerHour || 0) > 10 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((metrics?.errorsPerHour || 0), 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Response Time</span>
              <span>{metrics?.avgResponseTime.toFixed(0)}ms / 1000ms</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (metrics?.avgResponseTime || 0) > 1000 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((metrics?.avgResponseTime || 0) / 10, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
