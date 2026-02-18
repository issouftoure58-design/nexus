// client/src/pages/admin/components/ControlPanel.tsx

import React, { useState } from 'react';

interface ControlPanelProps {
  onStartModule: (module: string) => Promise<{ success: boolean; error?: any }>;
  onStopModule: (module: string) => Promise<{ success: boolean; error?: any }>;
  onDetectAnomalies: () => Promise<{ success: boolean; count?: number; error?: any }>;
  onForceAnalysis: () => Promise<{ success: boolean; error?: any }>;
  onTestAlerts: () => Promise<any>;
}

interface ActionResult {
  action: string;
  success: boolean;
  message: string;
  timestamp: string;
}

export default function ControlPanel({
  onStartModule,
  onStopModule,
  onDetectAnomalies,
  onForceAnalysis,
  onTestAlerts
}: ControlPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<ActionResult[]>([]);

  const addResult = (action: string, success: boolean, message: string) => {
    setResults(prev => [{
      action,
      success,
      message,
      timestamp: new Date().toISOString()
    }, ...prev.slice(0, 4)]);
  };

  const handleAction = async (
    action: () => Promise<any>,
    name: string,
    successMessage: string
  ) => {
    setLoading(name);
    try {
      const result = await action();
      const success = result?.success !== false;
      addResult(name, success, success ? successMessage : (result?.error?.message || 'Action failed'));
    } catch (err) {
      addResult(name, false, err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const actions = [
    {
      name: 'Detect Anomalies',
      action: () => onDetectAnomalies(),
      successMessage: 'Anomaly detection completed',
      color: 'bg-blue-600 hover:bg-blue-700',
      icon: '🔍'
    },
    {
      name: 'Force Analysis',
      action: () => onForceAnalysis(),
      successMessage: 'Analysis completed',
      color: 'bg-purple-600 hover:bg-purple-700',
      icon: '📊'
    },
    {
      name: 'Test Alerts',
      action: () => onTestAlerts(),
      successMessage: 'Test alerts sent',
      color: 'bg-orange-600 hover:bg-orange-700',
      icon: '🔔'
    }
  ];

  const moduleControls = [
    { name: 'analyzer', label: 'Analyzer', icon: '🔍' },
    { name: 'alerter', label: 'Alerter', icon: '📢' },
    { name: 'protector', label: 'Protector', icon: '🛡️' },
    { name: 'intelligence', label: 'Intelligence', icon: '🧠' }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚙️</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Controls</h2>
            <p className="text-sm text-gray-500">Manual actions & module control</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-600 mb-3">Quick Actions</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {actions.map((item) => (
            <button
              key={item.name}
              onClick={() => handleAction(item.action, item.name, item.successMessage)}
              disabled={loading === item.name}
              className={`${item.color} text-white px-4 py-3 rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2`}
            >
              {loading === item.name ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <span>{item.icon}</span>
                  {item.name}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Module Controls */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-600 mb-3">Module Controls</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {moduleControls.map((module) => (
            <div key={module.name} className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span>{module.icon}</span>
                <span className="font-medium text-gray-800">{module.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAction(
                    () => onStartModule(module.name),
                    `Start ${module.label}`,
                    `${module.label} started`
                  )}
                  disabled={loading?.includes(module.label)}
                  className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                >
                  Start
                </button>
                <button
                  onClick={() => handleAction(
                    () => onStopModule(module.name),
                    `Stop ${module.label}`,
                    `${module.label} stopped`
                  )}
                  disabled={loading?.includes(module.label)}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                >
                  Stop
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Results */}
      {results.length > 0 && (
        <div className="border-t pt-4">
          <div className="text-sm font-medium text-gray-600 mb-3">Recent Actions</div>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded ${
                  result.success
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{result.success ? '✅' : '❌'}</span>
                  <span className="font-medium">{result.action}</span>
                  <span className="text-sm opacity-80">- {result.message}</span>
                </div>
                <span className="text-xs opacity-60">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
