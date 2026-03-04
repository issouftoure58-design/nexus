// client/src/pages/admin/components/OverviewPanel.tsx

import React from 'react';
import { SentinelStatus, HealthStatus } from '../../../hooks/useSentinel';

interface OverviewPanelProps {
  status: SentinelStatus | null;
  health: HealthStatus | null;
}

export default function OverviewPanel({ status, health }: OverviewPanelProps) {
  if (!status) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const healthStatus = health?.overall || 'healthy';
  const healthColor = {
    healthy: 'text-green-600 bg-green-100 border-green-200',
    degraded: 'text-yellow-600 bg-yellow-100 border-yellow-200',
    critical: 'text-red-600 bg-red-100 border-red-200'
  }[healthStatus] || 'text-gray-600 bg-gray-100 border-gray-200';

  const healthIcon = {
    healthy: '✅',
    degraded: '⚠️',
    critical: '🚨'
  }[healthStatus] || '❓';

  const modules = [
    { name: 'Observer', key: 'observer', icon: '👁️', desc: 'Surveillance' },
    { name: 'Action', key: 'action', icon: '🔧', desc: 'Auto-repair' },
    { name: 'Analyzer', key: 'analyzer', icon: '🔍', desc: 'Detection' },
    { name: 'Alerter', key: 'alerter', icon: '📢', desc: 'Notifications' },
    { name: 'Protector', key: 'protector', icon: '🛡️', desc: 'Security' },
    { name: 'Intelligence', key: 'intelligence', icon: '🧠', desc: 'AI Learning' }
  ];

  const activeCount = modules.filter(m => {
    const mod = status[m.key as keyof SentinelStatus];
    return mod && typeof mod === 'object' && 'active' in mod && mod.active;
  }).length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">SENTINEL Overview</h2>
        <div className="text-sm text-gray-500">
          {activeCount}/{modules.length} modules active
        </div>
      </div>

      {/* Health Score */}
      <div className={`rounded-lg p-6 mb-6 border-2 ${healthColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium mb-1 opacity-80">System Health</div>
            <div className="text-3xl font-bold flex items-center gap-3">
              <span>{healthIcon}</span>
              <span>{healthStatus.toUpperCase()}</span>
            </div>
          </div>
          <div className="text-right text-sm opacity-80">
            <div>Last check:</div>
            <div className="font-mono">
              {health?.timestamp
                ? new Date(health.timestamp).toLocaleTimeString()
                : new Date().toLocaleTimeString()
              }
            </div>
          </div>
        </div>
      </div>

      {/* Modules Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {modules.map(module => {
          const mod = status[module.key as keyof SentinelStatus];
          const isActive = mod && typeof mod === 'object' && 'active' in mod && mod.active;

          return (
            <div
              key={module.key}
              className={`rounded-lg p-4 border-2 transition-all ${
                isActive
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="text-3xl mb-2">{module.icon}</div>
                <div className="font-semibold text-gray-900">{module.name}</div>
                <div className="text-xs text-gray-500 mt-1">{module.desc}</div>
                <div className="mt-2">
                  <div
                    className={`w-3 h-3 rounded-full mx-auto ${
                      isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Services Health */}
      {health?.services && Object.keys(health.services).length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Services Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(health.services).map(([name, service]: [string, any]) => (
              <div
                key={name}
                className={`rounded-lg p-3 text-sm ${
                  service.status === 'healthy' || service.status === 'ok'
                    ? 'bg-green-100 text-green-800'
                    : service.status === 'degraded' || service.status === 'warning'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <div className="font-semibold capitalize">{name}</div>
                <div className="text-xs mt-1 opacity-80">
                  {service.responseTime ? `${service.responseTime}ms` : service.status || 'unknown'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
