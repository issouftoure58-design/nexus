/**
 * Quick Analytics Widget - Business Plan
 * Widget compact pour le Dashboard principal
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';

interface ForecastData {
  forecasts: { month: string; predicted_ca: string; confidence: number }[];
  growth_rate: string;
  avg_monthly: string;
}

export default function QuickAnalyticsWidget() {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchForecast();
  }, []);

  const fetchForecast = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch('/api/admin/analytics/forecast?months=1', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) throw new Error('Erreur fetch');
      const data = await response.json();
      setForecast(data);
    } catch (err) {
      console.error('Erreur forecast widget:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center h-24">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </Card>
    );
  }

  if (error || !forecast) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Analytics indisponibles</span>
        </div>
      </Card>
    );
  }

  const nextMonth = forecast.forecasts[0];
  const growthRate = parseFloat(forecast.growth_rate);
  const growthPositive = growthRate > 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Prévision Mois Prochain</h3>
        {growthPositive ? (
          <TrendingUp className="w-4 h-4 text-green-500" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-500" />
        )}
      </div>

      <div className="text-2xl font-bold mb-1">
        {parseFloat(nextMonth.predicted_ca).toFixed(0)}€
      </div>

      <div className={`text-xs ${growthPositive ? 'text-green-600' : 'text-red-600'}`}>
        {growthPositive ? '+' : ''}{forecast.growth_rate}% vs moyenne
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Confiance : {nextMonth.confidence}%
      </div>

      {nextMonth.confidence < 60 && (
        <div className="mt-2 flex items-start gap-2 text-xs text-orange-600">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>Prévision incertaine - données volatiles</span>
        </div>
      )}

      <div className="mt-3 pt-3 border-t text-xs text-gray-400">
        Moyenne mensuelle : {forecast.avg_monthly}€
      </div>
    </Card>
  );
}
