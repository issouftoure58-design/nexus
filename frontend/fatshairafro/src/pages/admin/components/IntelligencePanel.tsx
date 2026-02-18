// client/src/pages/admin/components/IntelligencePanel.tsx

import React, { useState, useEffect } from 'react';
import { DiagnosticResult } from '../../../hooks/useSentinel';

interface IntelligencePanelProps {
  onRunDiagnostic: () => Promise<DiagnosticResult | null>;
}

// Helper to get auth token
const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

interface LearningStats {
  patternsActive: number;
  errorsAnalyzed: number;
  adaptationsPending: number;
  isLearning: boolean;
}

export default function IntelligencePanel({ onRunDiagnostic }: IntelligencePanelProps) {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch learning stats
  useEffect(() => {
    const fetchLearningStats = async () => {
      try {
        const response = await fetch('/api/sentinel/learning/status', {
          headers: getAuthHeaders()
        });
        if (response.ok) {
          const data = await response.json();
          setLearningStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch learning stats:', err);
      }
    };

    fetchLearningStats();
    const interval = setInterval(fetchLearningStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch last diagnostic on load
  useEffect(() => {
    const fetchLastDiagnostic = async () => {
      try {
        const response = await fetch('/api/sentinel/diagnostic', {
          headers: getAuthHeaders()
        });
        if (response.ok) {
          const data = await response.json();
          if (data.diagnostic) {
            setDiagnostic(data.diagnostic);
          }
        }
      } catch (err) {
        console.error('Failed to fetch last diagnostic:', err);
      }
    };

    fetchLastDiagnostic();
  }, []);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const result = await onRunDiagnostic();
      if (result) {
        setDiagnostic(result);
      }
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100 border-green-200';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    if (score >= 50) return 'text-orange-600 bg-orange-100 border-orange-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Critical';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧠</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Intelligence</h2>
            <p className="text-sm text-gray-500">Self-diagnostic & Learning</p>
          </div>
        </div>
        <button
          onClick={runDiagnostic}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Running...
            </>
          ) : (
            <>
              <span>🔬</span>
              Run Diagnostic
            </>
          )}
        </button>
      </div>

      {/* Health Score */}
      {diagnostic && (
        <div className={`rounded-lg p-4 mb-6 border-2 ${getScoreColor(diagnostic.healthScore)}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium opacity-80">Health Score</div>
              <div className="text-4xl font-bold">{diagnostic.healthScore}/100</div>
              <div className="text-sm mt-1">{getScoreLabel(diagnostic.healthScore)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-80">Last check</div>
              <div className="font-mono text-sm">
                {new Date(diagnostic.timestamp).toLocaleTimeString()}
              </div>
              <div className="text-xs opacity-70 mt-1">
                {diagnostic.duration}ms
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Summary */}
      {diagnostic && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{diagnostic.summary.total}</div>
            <div className="text-xs text-gray-500">Checks</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{diagnostic.summary.passed}</div>
            <div className="text-xs text-green-600">Passed</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{diagnostic.summary.warnings}</div>
            <div className="text-xs text-yellow-600">Warnings</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{diagnostic.summary.failed}</div>
            <div className="text-xs text-red-600">Failed</div>
          </div>
        </div>
      )}

      {/* Learning Stats */}
      {learningStats && (
        <div className="border-t pt-6">
          <div className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
            <span>Learning Engine</span>
            {learningStats.isLearning && (
              <span className="flex items-center gap-1 text-green-600 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Active
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-xl font-bold text-purple-600">
                {learningStats.patternsActive}
              </div>
              <div className="text-xs text-purple-600">Patterns Learned</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xl font-bold text-blue-600">
                {learningStats.errorsAnalyzed}
              </div>
              <div className="text-xs text-blue-600">Errors Analyzed</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-xl font-bold text-orange-600">
                {learningStats.adaptationsPending}
              </div>
              <div className="text-xs text-orange-600">Adaptations Pending</div>
            </div>
          </div>
        </div>
      )}

      {/* Failed checks details */}
      {diagnostic && diagnostic.checks && diagnostic.checks.filter((c: any) => c.status === 'FAIL').length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <div className="text-sm font-medium text-red-600 mb-3">Issues Detected</div>
          <div className="space-y-2">
            {diagnostic.checks
              .filter((c: any) => c.status === 'FAIL')
              .map((check: any, i: number) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="font-medium text-red-800">{check.name}</div>
                  <div className="text-sm text-red-600 mt-1">{check.message}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
