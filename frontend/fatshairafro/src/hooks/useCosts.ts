/**
 * Hook useCosts - Source de vérité unique pour les coûts
 *
 * Récupère les coûts depuis l'API SENTINEL et les met en cache.
 * Utilisé par tous les composants dashboard pour garantir la cohérence.
 */

import { useState, useEffect, useCallback } from 'react';

export interface CostData {
  total: number;
  byService: {
    anthropic: number;
    twilio: number;
    elevenlabs: number;
  };
  calls: number;
  tokensIn: number;
  tokensOut: number;
  byTenant?: Record<string, {
    cost: number;
    calls: number;
    tokensIn: number;
    tokensOut: number;
  }>;
  byDate?: Array<{
    date: string;
    cost: number;
    calls: number;
  }>;
  error?: string;
}

export interface CostBreakdown {
  success: boolean;
  today: CostData;
  month: CostData;
  timestamp: string;
}

export function useCosts(tenantId?: string) {
  const [costs, setCosts] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = useCallback(async () => {
    try {
      // Récupérer le token admin
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('Non authentifié');
        setLoading(false);
        return;
      }

      const url = tenantId
        ? `/api/sentinel/costs/current?tenantId=${tenantId}`
        : '/api/sentinel/costs/current';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.error || 'Failed to fetch costs');
      }

      setCosts(data);
      setError(null);
    } catch (err) {
      console.error('[useCosts] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchCosts();

    // Refresh toutes les 30 secondes
    const interval = setInterval(fetchCosts, 30000);

    return () => clearInterval(interval);
  }, [fetchCosts]);

  return {
    costs,
    loading,
    error,
    refresh: fetchCosts
  };
}

export function useCostsBreakdown(options: {
  tenantId?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  const [costs, setCosts] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBreakdown = useCallback(async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('Non authentifié');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (options.tenantId) params.append('tenantId', options.tenantId);
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);

      const url = `/api/sentinel/costs/breakdown?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.error || 'Failed to fetch breakdown');
      }

      setCosts(data);
      setError(null);
    } catch (err) {
      console.error('[useCostsBreakdown] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [options.tenantId, options.startDate, options.endDate]);

  useEffect(() => {
    fetchBreakdown();
  }, [fetchBreakdown]);

  return {
    costs,
    loading,
    error,
    refresh: fetchBreakdown
  };
}

export default useCosts;
