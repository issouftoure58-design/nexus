import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, Users, HardDrive, Image, FileText, Crown, Infinity } from 'lucide-react';

type PlanType = 'free' | 'starter' | 'pro' | 'business';

interface QuotaData {
  plan: PlanType | 'basic';
  limits: {
    clients: number;
    storage_gb: number;
    posts: number;
    images: number;
  };
  usage: {
    clients: number;
    storage_gb: number;
    posts: number;
    images: number;
  };
}

// Retro-compat : basic→starter
const normalizePlan = (plan: string): PlanType => {
  if (plan === 'basic') return 'starter';
  return plan as PlanType;
};

const PLAN_LABELS: Record<PlanType, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

const PLAN_COLORS: Record<PlanType, 'secondary' | 'default' | 'success'> = {
  free: 'secondary',
  starter: 'default',
  pro: 'default',
  business: 'success',
};

export function QuotasWidget() {
  const { data: quotas, isLoading, error } = useQuery<QuotaData>({
    queryKey: ['quotas'],
    queryFn: () => api.get<QuotaData>('/admin/quotas'),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !quotas) {
    return (
      <Card>
        <CardContent className="p-6 text-red-600">
          Erreur lors du chargement des quotas
        </CardContent>
      </Card>
    );
  }

  const isNearLimit = (used: number, limit: number) => {
    if (limit === -1) return false;
    return (used / limit) >= 0.8;
  };

  const isAtLimit = (used: number, limit: number) => {
    if (limit === -1) return false;
    return used >= limit;
  };

  const formatLimit = (value: number) => {
    if (value === -1) return 'Illimite';
    return value.toLocaleString('fr-FR');
  };

  const quotaItems = [
    {
      label: 'Clients',
      icon: Users,
      used: quotas.usage.clients,
      limit: quotas.limits.clients,
      unit: '',
    },
    {
      label: 'Stockage',
      icon: HardDrive,
      used: quotas.usage.storage_gb,
      limit: quotas.limits.storage_gb,
      unit: 'Go',
    },
    {
      label: 'Publications',
      icon: FileText,
      used: quotas.usage.posts,
      limit: quotas.limits.posts,
      unit: '',
    },
    {
      label: 'Images',
      icon: Image,
      used: quotas.usage.images,
      limit: quotas.limits.images,
      unit: '',
    },
  ];

  const hasWarnings = quotaItems.some(
    (item) => isNearLimit(item.used, item.limit) || isAtLimit(item.used, item.limit)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Utilisation des quotas
              {hasWarnings && (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
            </CardTitle>
            <CardDescription>
              Plan actuel : <Badge variant={PLAN_COLORS[normalizePlan(quotas.plan)]}>{PLAN_LABELS[normalizePlan(quotas.plan)]}</Badge>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Message special Business */}
        {normalizePlan(quotas.plan) === 'business' && (
          <Alert className="mb-6 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50">
            <Crown className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Plan Business</strong> - RH, Compta, Sentinel, White-label, API, SSO + 20 000 credits IA inclus / mois
              <div className="flex items-center gap-1 mt-1 text-sm text-amber-600">
                <Infinity className="h-3 w-3" /> Aucune limite sur vos ressources principales
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {quotaItems.map((item) => {
            const nearLimit = isNearLimit(item.used, item.limit);
            const atLimit = isAtLimit(item.used, item.limit);
            const Icon = item.icon;

            return (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className={atLimit ? 'text-red-600 font-semibold' : nearLimit ? 'text-yellow-600' : 'text-gray-600'}>
                    {item.used.toLocaleString('fr-FR')} {item.unit} / {formatLimit(item.limit)} {item.unit}
                  </span>
                </div>
                {item.limit !== -1 ? (
                  <Progress value={item.used} max={item.limit} />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full w-fit">
                    <Infinity className="h-3 w-3" />
                    <span>Illimite sur ce plan</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Alertes d'upgrade */}
        {normalizePlan(quotas.plan) === 'free' && hasWarnings && (
          <div className="mt-6 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-cyan-600 mt-0.5" />
              <div>
                <p className="font-medium text-cyan-900">Passez au plan Starter — 69€/mois</p>
                <p className="text-sm text-cyan-700 mt-1">
                  Toute l'IA + stock, workflows, pipeline, devis, SEO, fidelite + 1 000 credits IA inclus.
                </p>
              </div>
            </div>
          </div>
        )}

        {normalizePlan(quotas.plan) === 'starter' && hasWarnings && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Passez au plan Pro — 199€/mois</p>
                <p className="text-sm text-blue-700 mt-1">
                  Multi-sites, tout illimite, 20 users + 5 000 credits IA inclus chaque mois.
                </p>
              </div>
            </div>
          </div>
        )}

        {normalizePlan(quotas.plan) === 'pro' && hasWarnings && (
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <p className="font-medium text-purple-900">Passez au plan Business — 599€/mois</p>
                <p className="text-sm text-purple-700 mt-1">
                  RH complet, Compta, Sentinel, White-label, API, SSO + 20 000 credits IA inclus chaque mois.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
