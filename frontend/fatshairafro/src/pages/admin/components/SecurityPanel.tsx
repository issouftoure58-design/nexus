// client/src/pages/admin/components/SecurityPanel.tsx

import React, { useState, useEffect } from 'react';
import { FirewallStats } from '../../../hooks/useSentinel';

interface SecurityPanelProps {
  firewallStats: FirewallStats | null;
}

interface IPBlockerStats {
  enabled: boolean;
  blacklistSize: number;
  whitelistSize: number;
  tempBansActive: number;
}

// Helper to get auth token
const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export default function SecurityPanel({ firewallStats }: SecurityPanelProps) {
  const [ipBlockerStats, setIPBlockerStats] = useState<IPBlockerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/sentinel/ip-blocker/status', {
          headers: getAuthHeaders()
        });
        if (response.ok) {
          const data = await response.json();
          setIPBlockerStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch IP blocker stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !firewallStats) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Firewall Rules',
      value: firewallStats?.activeRules || firewallStats?.rulesCount || 0,
      icon: '🔥',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      status: firewallStats?.enabled ? 'Active' : 'Disabled'
    },
    {
      label: 'Blocked Requests',
      value: firewallStats?.blocked || 0,
      icon: '🚫',
      color: (firewallStats?.blocked || 0) > 100
        ? 'text-red-600 bg-red-50 border-red-200'
        : 'text-orange-600 bg-orange-50 border-orange-200',
      status: 'Last 24h'
    },
    {
      label: 'Blocked IPs',
      value: ipBlockerStats?.blacklistSize || 0,
      icon: '🔒',
      color: (ipBlockerStats?.blacklistSize || 0) > 10
        ? 'text-red-600 bg-red-50 border-red-200'
        : 'text-green-600 bg-green-50 border-green-200',
      status: `${ipBlockerStats?.tempBansActive || 0} temp bans`
    },
    {
      label: 'Whitelisted IPs',
      value: ipBlockerStats?.whitelistSize || 0,
      icon: '✅',
      color: 'text-green-600 bg-green-50 border-green-200',
      status: 'Trusted'
    },
    {
      label: 'Allowed Requests',
      value: firewallStats?.allowed || 0,
      icon: '📥',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      status: 'Passed'
    },
    {
      label: 'Total Requests',
      value: firewallStats?.requests || 0,
      icon: '📊',
      color: 'text-gray-600 bg-gray-50 border-gray-200',
      status: 'Processed'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🛡️</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Security</h2>
            <p className="text-sm text-gray-500">Firewall & IP Protection</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            firewallStats?.enabled && ipBlockerStats?.enabled
              ? 'bg-green-500 animate-pulse'
              : 'bg-yellow-500'
          }`} />
          <span className="text-sm text-gray-600">
            {firewallStats?.enabled && ipBlockerStats?.enabled
              ? 'Protected'
              : 'Partially Active'
            }
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`border-2 rounded-lg p-4 ${stat.color}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-xs opacity-70">{stat.status}</span>
            </div>
            <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
            <div className="text-sm opacity-80 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Protection Status */}
      <div className="mt-6 pt-6 border-t">
        <div className="text-sm font-medium text-gray-600 mb-3">Protection Status</div>
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-lg p-3 flex items-center justify-between ${
            firewallStats?.enabled
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}>
            <span className="font-medium">Firewall</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              firewallStats?.enabled
                ? 'bg-green-200'
                : 'bg-gray-200'
            }`}>
              {firewallStats?.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className={`rounded-lg p-3 flex items-center justify-between ${
            ipBlockerStats?.enabled
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}>
            <span className="font-medium">IP Blocker</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              ipBlockerStats?.enabled
                ? 'bg-green-200'
                : 'bg-gray-200'
            }`}>
              {ipBlockerStats?.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
