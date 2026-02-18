/**
 * QuotasWidget - Widget d'affichage des quotas par plan
 * Affiche l'utilisation des quotas (clients, stockage, posts IA, images)
 */

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, TrendingUp, Users, HardDrive, FileText, Image, RefreshCw } from 'lucide-react';

interface QuotaData {
  ok: boolean;
  current: number;
  limit: number;
  current_gb?: string;
  limit_gb?: number;
  percentage?: number;
  message?: string | null;
}

interface QuotasResponse {
  success: boolean;
  plan: string;
  plan_name: string;
  quotas: {
    clients: QuotaData;
    storage: QuotaData;
    posts: QuotaData;
    images: QuotaData;
  };
  reset_date: string;
  reset_in_days: number;
}

const PLAN_PRICES: Record<string, string> = {
  starter: '99',
  pro: '199',
  business: '399'
};

export default function QuotasWidget() {
  const [quotas, setQuotas] = useState<QuotasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotas = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/quotas', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la recuperation des quotas');
      }

      const data = await response.json();
      if (data.success) {
        setQuotas(data);
      } else {
        throw new Error(data.error || 'Erreur inconnue');
      }
    } catch (err) {
      console.error('Erreur fetch quotas:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotas();
  }, []);

  const getAlertVariant = (percentage: number): 'default' | 'destructive' => {
    if (percentage >= 90) return 'destructive';
    return 'default';
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Chargement des quotas...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-500">Erreur</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={fetchQuotas} variant="outline" size="sm" className="mt-2">
            Reessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!quotas) return null;

  const { plan, plan_name, quotas: q, reset_in_days } = quotas;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Utilisation & Quotas</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Plan {plan_name} ({PLAN_PRICES[plan] || '?'}EUR/mois)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchQuotas}
              variant="ghost"
              size="icon"
              title="Rafraichir"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {plan !== 'business' && (
              <Button variant="outline" size="sm" asChild>
                <a href="/admin/billing/upgrade">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Upgrade
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Clients */}
        <QuotaItem
          icon={<Users className="w-4 h-4" />}
          label="Clients"
          current={q.clients.current}
          limit={q.clients.limit}
          percentage={q.clients.percentage || 0}
          isUnlimited={q.clients.limit === -1}
        />

        {/* Stockage */}
        <QuotaItem
          icon={<HardDrive className="w-4 h-4" />}
          label="Stockage documents"
          current={q.storage.current_gb ? `${q.storage.current_gb} GB` : '0 GB'}
          limit={q.storage.limit_gb === -1 ? 'Illimite' : `${q.storage.limit_gb} GB`}
          percentage={q.storage.percentage || 0}
          isUnlimited={q.storage.limit_gb === -1}
        />

        {/* Posts IA */}
        <QuotaItem
          icon={<FileText className="w-4 h-4" />}
          label="Posts IA ce mois"
          current={q.posts.current}
          limit={q.posts.limit}
          percentage={q.posts.percentage || 0}
          isUnlimited={false}
        />

        {/* Images DALL-E */}
        <QuotaItem
          icon={<Image className="w-4 h-4" />}
          label="Images IA ce mois"
          current={q.images.current}
          limit={q.images.limit}
          percentage={q.images.percentage || 0}
          isUnlimited={false}
        />

        {/* Alertes si quota proche */}
        {(q.clients.percentage && q.clients.percentage >= 80) && (
          <Alert variant={getAlertVariant(q.clients.percentage)}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {q.clients.percentage >= 95
                ? "Limite clients presque atteinte ! Upgradez pour continuer."
                : "Vous approchez de la limite de clients."}
            </AlertDescription>
          </Alert>
        )}

        {(q.posts.percentage && q.posts.percentage >= 80) && (
          <Alert variant={getAlertVariant(q.posts.percentage)}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Quota mensuel posts IA bientot atteint. Renouvellement dans {reset_in_days} jours.
            </AlertDescription>
          </Alert>
        )}

        {(q.images.percentage && q.images.percentage >= 80) && (
          <Alert variant={getAlertVariant(q.images.percentage)}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Quota mensuel images IA bientot atteint. Renouvellement dans {reset_in_days} jours.
            </AlertDescription>
          </Alert>
        )}

        {/* Message Pro → Business */}
        {plan === 'pro' && (
          <Alert className="border-purple-200 bg-purple-50">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              <span className="font-semibold">Besoin de plus ?</span> Passez au plan Business pour des quotas illimites + SEO + RH + API.
              <Button
                variant="link"
                className="text-purple-700 underline p-0 h-auto ml-1"
                onClick={() => window.location.href = '/admin/billing/upgrade'}
              >
                Contacter commercial
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Message Starter → Pro */}
        {plan === 'starter' && (
          <Alert className="border-blue-200 bg-blue-50">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <span className="font-semibold">Passez au plan Pro !</span> 3x plus de clients, 5x plus de stockage, 5x plus de posts IA.
              <Button
                variant="link"
                className="text-blue-700 underline p-0 h-auto ml-1"
                onClick={() => window.location.href = '/admin/billing/upgrade'}
              >
                Voir les avantages
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Info reset */}
        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
          Quotas mensuels reinitialises dans {reset_in_days} jour{reset_in_days > 1 ? 's' : ''}
        </p>
      </CardContent>
    </Card>
  );
}

interface QuotaItemProps {
  icon: React.ReactNode;
  label: string;
  current: number | string;
  limit: number | string;
  percentage: number;
  isUnlimited: boolean;
}

function QuotaItem({ icon, label, current, limit, percentage, isUnlimited }: QuotaItemProps) {
  const getProgressColor = (pct: number): string => {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 75) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className="text-muted-foreground">
          {current} / {isUnlimited ? '∞' : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="relative">
          <Progress
            value={percentage}
            className="h-2"
          />
          <div
            className={`absolute top-0 left-0 h-full rounded-full transition-all ${getProgressColor(percentage)}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
