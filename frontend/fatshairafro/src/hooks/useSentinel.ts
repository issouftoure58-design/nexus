// client/src/hooks/useSentinel.ts

import { useState, useEffect, useCallback } from 'react';

export interface SentinelStatus {
  observer: { active: boolean };
  action: { active: boolean; stats: any };
  analyzer: { active: boolean };
  alerter: { active: boolean };
  protector: { active: boolean; components?: any };
  intelligence: { active: boolean; components?: any };
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  services: Record<string, any>;
  timestamp: string;
}

export interface Anomaly {
  type: string;
  severity: string;
  timestamp: string;
  message: string;
  details: any;
}

export interface FirewallStats {
  enabled: boolean;
  rulesCount: number;
  activeRules: number;
  requests: number;
  blocked: number;
  allowed: number;
}

export interface DiagnosticResult {
  timestamp: string;
  checks: any[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  healthScore: number;
  duration: number;
}

// Helper to get auth token
const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export function useSentinel() {
  const [status, setStatus] = useState<SentinelStatus | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [firewallStats, setFirewallStats] = useState<FirewallStats | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch status global
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/sentinel/status', {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Authentication required');
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Fetch health
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/sentinel/health', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch health');
      const data = await response.json();
      setHealth({
        overall: data.overall || 'healthy',
        services: data.services || {},
        timestamp: data.timestamp || new Date().toISOString()
      });
    } catch (err) {
      // Health endpoint might not require auth
      setHealth({
        overall: 'healthy',
        services: {},
        timestamp: new Date().toISOString()
      });
    }
  }, []);

  // Fetch anomalies
  const fetchAnomalies = useCallback(async () => {
    try {
      const response = await fetch('/api/sentinel/anomalies?limit=50', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch anomalies');
      const data = await response.json();
      setAnomalies(data.anomalies || []);
    } catch (err) {
      // Don't set error for anomalies, just keep empty
      setAnomalies([]);
    }
  }, []);

  // Fetch firewall stats
  const fetchFirewallStats = useCallback(async () => {
    try {
      const response = await fetch('/api/sentinel/firewall/status', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch firewall stats');
      const data = await response.json();
      setFirewallStats(data);
    } catch (err) {
      // Firewall might not be accessible
    }
  }, []);

  // Actions
  const startModule = useCallback(async (module: string) => {
    try {
      const response = await fetch(`/api/sentinel/${module}/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to start ${module}`);
      await fetchStatus();
      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return { success: false, error: err };
    }
  }, [fetchStatus]);

  const stopModule = useCallback(async (module: string) => {
    try {
      const response = await fetch(`/api/sentinel/${module}/stop`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to stop ${module}`);
      await fetchStatus();
      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return { success: false, error: err };
    }
  }, [fetchStatus]);

  const detectAnomalies = useCallback(async () => {
    try {
      const response = await fetch('/api/sentinel/anomalies/detect', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ timeWindow: 60 })
      });
      if (!response.ok) throw new Error('Failed to detect anomalies');
      const data = await response.json();
      await fetchAnomalies();
      return { success: true, count: data.count };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return { success: false, error: err };
    }
  }, [fetchAnomalies]);

  const runDiagnostic = useCallback(async () => {
    try {
      const response = await fetch('/api/sentinel/diagnostic/run', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to run diagnostic');
      const data = await response.json();
      setDiagnostic(data.results || data);
      return data.results || data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const forceAnalysis = useCallback(async () => {
    try {
      const response = await fetch('/api/sentinel/analyzer/force-analysis', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to force analysis');
      await Promise.all([fetchStatus(), fetchAnomalies()]);
      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return { success: false, error: err };
    }
  }, [fetchStatus, fetchAnomalies]);

  const testAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/sentinel/alerts/test', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to test alerts');
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return { success: false, error: err };
    }
  }, []);

  // Auto-refresh toutes les 10 secondes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStatus(),
        fetchHealth(),
        fetchAnomalies(),
        fetchFirewallStats()
      ]);
      setLoading(false);
    };

    loadData();
    const interval = setInterval(loadData, 10000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchHealth, fetchAnomalies, fetchFirewallStats]);

  return {
    status,
    health,
    anomalies,
    firewallStats,
    diagnostic,
    loading,
    error,
    actions: {
      startModule,
      stopModule,
      detectAnomalies,
      runDiagnostic,
      forceAnalysis,
      testAlerts,
      refresh: fetchStatus
    }
  };
}
