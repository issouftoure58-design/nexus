// client/src/pages/admin/components/AnomaliesTable.tsx

import React from 'react';
import { Anomaly } from '../../../hooks/useSentinel';

interface AnomaliesTableProps {
  anomalies: Anomaly[];
  onRefresh?: () => void;
}

export default function AnomaliesTable({ anomalies, onRefresh }: AnomaliesTableProps) {
  const severityColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-800 border-red-200',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    LOW: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  const severityIcons: Record<string, string> = {
    CRITICAL: '🚨',
    HIGH: '⚠️',
    MEDIUM: '⚡',
    LOW: 'ℹ️'
  };

  // Group by severity for summary
  const bySeverity = anomalies.reduce((acc, a) => {
    const sev = a.severity || 'MEDIUM';
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Recent Anomalies</h2>
          <p className="text-sm text-gray-500 mt-1">
            Detected issues and patterns
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Severity summary badges */}
          <div className="flex gap-2">
            {Object.entries(bySeverity).map(([severity, count]) => (
              <span
                key={severity}
                className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                  severityColors[severity] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {severityIcons[severity]} {count}
              </span>
            ))}
          </div>
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold">
            {anomalies.length} total
          </span>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">✅</div>
          <div className="text-xl font-semibold mb-2">No Anomalies Detected</div>
          <div className="text-sm">System is running normally</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {anomalies.slice(0, 15).map((anomaly, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                    <div className="font-mono">
                      {new Date(anomaly.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(anomaly.timestamp).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {anomaly.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
                        severityColors[anomaly.severity] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {severityIcons[anomaly.severity] || '❓'}
                      {anomaly.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                    {anomaly.message}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {anomaly.details && typeof anomaly.details === 'object' ? (
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:text-blue-800">
                          View details
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-w-md">
                          {JSON.stringify(anomaly.details, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {anomalies.length > 15 && (
            <div className="text-center py-3 text-sm text-gray-500 border-t">
              Showing 15 of {anomalies.length} anomalies
            </div>
          )}
        </div>
      )}
    </div>
  );
}
