/**
 * Subscription - Page d'abonnement NEXUS
 * Affichage du plan et upgrade
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import {
  Crown,
  CreditCard,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  Sparkles,
  FileText,
  Trash2,
  Check,
  Zap,
  Phone,
  MessageSquare,
  Globe,
  Users,
  BarChart3,
  Shield,
  Star,
  X,
  AlertTriangle,
  Mail,
  Package,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default?: boolean;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount_paid: number;
  currency: string;
  created: string;
  pdf_url: string;
  hosted_url: string;
}

interface SubscriptionData {
  has_subscription: boolean;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  items: unknown[];
}

interface QuotaMetric {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  excess: number;
  overageRate: number;
  overageCost: number;
  status: 'ok' | 'warning' | 'exceeded';
}

interface QuotaModule {
  name: string;
  basePrice: number;
  unlimited: boolean;
  metrics: Record<string, QuotaMetric>;
}

interface QuotaStatusResponse {
  success: boolean;
  tenantId: string;
  modules: Record<string, QuotaModule>;
  totalOverage: number;
  resetDate: string;
  resetInDays: number;
  modulesActifs: Record<string, boolean>;
  pendingActivations: string[];
}

type BillingCycle = 'monthly' | 'yearly';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'bg-green-100 text-green-700' },
  trialing: { label: 'Essai gratuit', color: 'bg-blue-100 text-blue-700' },
  expired: { label: 'Essai expiré', color: 'bg-orange-100 text-orange-700' },
  past_due: { label: 'En retard', color: 'bg-red-100 text-red-700' },
  canceled: { label: 'Annulé', color: 'bg-gray-100 text-gray-500' },
  incomplete: { label: 'Incomplet', color: 'bg-yellow-100 text-yellow-700' },
  unpaid: { label: 'Impayé', color: 'bg-red-100 text-red-700' },
};

// Plans NEXUS officiels - Grille tarifaire 2026
// Promo 100 premiers clients: prix réduits
const PROMO_ACTIVE = true; // Désactiver quand les 100 premiers clients sont atteints
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    promoPrice: 79,
    yearlyPrice: 950,
    promoYearlyPrice: 758,
    description: 'Pour démarrer votre activité',
    color: 'from-gray-500 to-gray-600',
    features: [
      { text: '1 utilisateur', icon: Users },
      { text: '200 clients max', icon: Users },
      { text: '200 SMS/mois', icon: MessageSquare },
      { text: 'Dashboard & CRM basique', icon: BarChart3 },
      { text: 'Réservations en ligne', icon: Clock },
      { text: 'Facturation & Documents', icon: FileText },
      { text: 'Agent IA Web', icon: Globe },
      { text: 'Support email (48h)', icon: Clock },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 249,
    promoPrice: 199,
    yearlyPrice: 2390,
    promoYearlyPrice: 1910,
    description: 'Pour les équipes en croissance',
    popular: true,
    color: 'from-purple-500 to-indigo-600',
    features: [
      { text: '5 utilisateurs inclus', icon: Users },
      { text: '2 000 clients max', icon: Users },
      { text: '500 SMS/mois', icon: MessageSquare },
      { text: '60 min voix IA/mois', icon: Phone },
      { text: 'Tout Starter +', icon: CheckCircle },
      { text: 'WhatsApp IA', icon: MessageSquare },
      { text: 'Téléphone IA', icon: Phone },
      { text: 'Comptabilité & Devis', icon: FileText },
      { text: 'Stock & Inventaire', icon: Sparkles },
      { text: 'CRM avancé', icon: BarChart3 },
      { text: 'Support prioritaire (24h)', icon: Zap },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 499,
    promoPrice: 399,
    yearlyPrice: 4790,
    promoYearlyPrice: 3830,
    description: 'Pour les entreprises structurées',
    color: 'from-cyan-500 to-blue-600',
    features: [
      { text: '20 utilisateurs inclus', icon: Users },
      { text: 'Clients illimités', icon: Users },
      { text: '2 000 SMS/mois', icon: MessageSquare },
      { text: '300 min voix IA/mois', icon: Phone },
      { text: 'Tout Pro +', icon: CheckCircle },
      { text: 'Marketing automatisé', icon: Sparkles },
      { text: 'Pipeline commercial', icon: BarChart3 },
      { text: 'Analytics avancés & SEO', icon: Star },
      { text: 'RH & Planning complet', icon: Shield },
      { text: 'API & Intégrations', icon: Shield },
      { text: 'Account Manager dédié', icon: Crown },
    ],
  },
];

// Labels et unités spécifiques par métrique (quand un module a plusieurs métriques)
const METRIC_LABELS: Record<string, Record<string, { label: string; unit: string }>> = {
  web_chat_ia: {
    sessions: { label: 'Chat Web IA — Sessions', unit: 'sessions' },
    messages: { label: 'Chat Web IA — Messages', unit: 'msg' },
  },
};

// Config d'affichage par module de quota
const QUOTA_MODULE_CONFIG: Record<string, { icon: typeof Phone; label: string; unit: string; color: string }> = {
  telephone_ia: { icon: Phone, label: 'Voix IA', unit: 'min', color: 'text-purple-600' },
  sms_rdv: { icon: MessageSquare, label: 'SMS', unit: 'SMS', color: 'text-cyan-600' },
  whatsapp_ia: { icon: MessageSquare, label: 'WhatsApp IA', unit: 'msg', color: 'text-green-600' },
  web_chat_ia: { icon: Globe, label: 'Chat Web IA', unit: 'sessions', color: 'text-blue-600' },
  marketing_email: { icon: Mail, label: 'Email Marketing', unit: 'emails', color: 'text-orange-600' },
};

// Packs supplémentaires disponibles à l'achat
const ADDON_PACKS = {
  voix: [
    { amount: 30, price: 15, unit: 'min', code: 'nexus_voix_30', unitPrice: '0,50€' },
    { amount: 60, price: 25, unit: 'min', code: 'nexus_voix_60', unitPrice: '0,42€' },
    { amount: 120, price: 45, unit: 'min', code: 'nexus_voix_120', unitPrice: '0,38€' },
    { amount: 300, price: 99, unit: 'min', code: 'nexus_voix_300', unitPrice: '0,33€' },
  ],
  sms: [
    { amount: 100, price: 15, unit: 'SMS', code: 'nexus_sms_100', unitPrice: '0,15€' },
    { amount: 500, price: 65, unit: 'SMS', code: 'nexus_sms_500', unitPrice: '0,13€' },
    { amount: 1000, price: 110, unit: 'SMS', code: 'nexus_sms_1000', unitPrice: '0,11€' },
    { amount: 5000, price: 450, unit: 'SMS', code: 'nexus_sms_5000', unitPrice: '0,09€' },
  ],
};

// Modules avec quotas visibles par plan
const PLAN_MODULES: Record<string, string[]> = {
  starter: ['sms_rdv', 'web_chat_ia'],
  pro: ['telephone_ia', 'sms_rdv', 'whatsapp_ia', 'web_chat_ia'],
  business: ['telephone_ia', 'sms_rdv', 'whatsapp_ia', 'web_chat_ia', 'marketing_email'],
};

// Mapping quotaModuleId → clé dans modules_actifs
const QUOTA_TO_MODULE_KEY: Record<string, string> = {
  telephone_ia: 'telephone',
  sms_rdv: 'sms_rdv',
  whatsapp_ia: 'whatsapp',
  web_chat_ia: 'agent_ia_web',
  marketing_email: 'marketing_email',
};

// Modules toujours considérés actifs (infra partagée)
const ALWAYS_ACTIVE_MODULES = new Set(['sms_rdv', 'marketing_email']);

const getBarColor = (pct: number) =>
  pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-green-500';

export default function Subscription() {
  const queryClient = useQueryClient();
  const { plan: currentPlan, chosenPlan, tenant, isLoading: loadingTenant } = useTenant();
  const isOnTrial = tenant?.statut === 'essai';
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [error, setError] = useState<string | null>(null);

  // Charger le statut d'abonnement
  const { data: subscriptionData, isError: isSubError } = useQuery<SubscriptionData>({
    queryKey: ['subscription'],
    queryFn: () => api.get<SubscriptionData>('/billing/subscription'),
  });

  // Charger les moyens de paiement
  const { data: paymentMethodsData, isError: isPmError } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.get<{ payment_methods: PaymentMethod[] }>('/billing/payment-methods'),
  });

  // Charger les quotas de consommation
  const { data: quotaData, isLoading: isQuotaLoading } = useQuery<QuotaStatusResponse>({
    queryKey: ['quotas'],
    queryFn: () => api.get<QuotaStatusResponse>('/quotas'),
    staleTime: 60_000,
  });

  // Charger les factures
  const { data: invoicesData, isError: isInvError } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<{ invoices: Invoice[] }>('/billing/invoices'),
  });

  // Mutation pour ouvrir le portail Stripe
  const portalMutation = useMutation({
    mutationFn: () => api.post<{ url: string }>('/billing/portal', {
      returnUrl: window.location.href
    }),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'Impossible d\'ouvrir le portail Stripe');
    },
  });

  // Mutation pour acheter un pack add-on
  const packCheckoutMutation = useMutation({
    mutationFn: (priceId: string) => api.post<{ url: string }>('/billing/checkout/pack', {
      priceId,
      quantity: 1,
      successUrl: window.location.href,
      cancelUrl: window.location.href,
    }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: Error) => {
      setError(err.message || 'Impossible de procéder à l\'achat');
    },
  });

  // Mutation pour supprimer une carte
  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/billing/payment-methods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Impossible de supprimer la carte');
    },
  });

  // Mutation pour demander l'activation d'un module
  const activationMutation = useMutation({
    mutationFn: (moduleId: string) => api.post('/quotas/request-activation', { moduleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Impossible d\'envoyer la demande d\'activation');
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency = 'eur') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  const currentPlanData = PLANS.find(p => p.id === currentPlan) || PLANS[0];

  // Statut dynamique — priorité au statut tenant (essai/expire) sur le statut Stripe
  const tenantStatut = tenant?.statut;
  const subStatus = tenantStatut === 'essai'
    ? 'trialing'
    : tenantStatut === 'expire'
    ? 'expired'
    : tenantStatut === 'annule'
    ? 'canceled'
    : tenantStatut === 'suspendu'
    ? 'past_due'
    : tenantStatut === 'actif'
    ? (subscriptionData?.status || 'active')
    : subscriptionData?.status || (subscriptionData?.has_subscription ? 'active' : 'trialing');
  const statusInfo = STATUS_MAP[subStatus] || STATUS_MAP.active;

  if (loadingTenant) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const hasQueryError = isSubError || isPmError || isInvError;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Error banner */}
      {(error || hasQueryError) && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm flex-1">{error || 'Erreur lors du chargement des données de facturation.'}</p>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cancellation warning */}
      {subscriptionData?.cancel_at_period_end && subscriptionData.current_period_end && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Annulation prévue le <strong>{formatDate(subscriptionData.current_period_end)}</strong>. Votre abonnement reste actif jusque-là.</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mon Abonnement</h1>
        <p className="text-gray-500">Gérez votre plan et votre facturation</p>
      </div>

      {/* Bannière essai gratuit */}
      {isOnTrial && (
        <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900">Essai gratuit — Plan Starter</p>
              <p className="text-sm text-gray-600 mt-1">
                Pendant votre essai, vous avez acces aux fonctionnalites Starter.
                {chosenPlan !== 'starter' && (
                  <> Souscrivez au plan <span className="font-semibold capitalize">{chosenPlan}</span> pour debloquer toutes ses fonctionnalites (WhatsApp IA, Telephone IA, etc.).</>
                )}
              </p>
              {tenant?.essai_fin && (
                <p className="text-sm text-blue-700 font-medium mt-2">
                  {(() => {
                    const days = Math.max(0, Math.ceil((new Date(tenant.essai_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                    return days > 0 ? `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}` : 'Essai expire';
                  })()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan actuel */}
      <div className="mb-8">
        <div className={cn(
          'relative overflow-hidden rounded-2xl p-8 text-white bg-gradient-to-br',
          currentPlanData.color
        )}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Crown className="h-8 w-8" />
              <div>
                <p className="text-sm opacity-80">Plan actuel</p>
                <h2 className="text-3xl font-bold">{currentPlanData.name}</h2>
              </div>
            </div>

            <p className="text-lg opacity-90 mb-6">{currentPlanData.description}</p>

            <div className="flex items-baseline gap-1">
              {PROMO_ACTIVE && (
                <span className="text-2xl opacity-60 line-through mr-2">{currentPlanData.price}€</span>
              )}
              <span className="text-5xl font-bold">{PROMO_ACTIVE ? currentPlanData.promoPrice : currentPlanData.price}€</span>
              <span className="text-xl opacity-80">/mois</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale - Plans */}
        <div className="lg:col-span-2 space-y-6">
          {/* Comparaison des plans */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Changer de plan</h2>
                <p className="text-sm text-gray-500">Comparez les fonctionnalités de chaque plan</p>
              </div>
              {/* Toggle mensuel/annuel */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  )}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1',
                    billingCycle === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  )}
                >
                  Annuel
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">-20%</span>
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const isCurrentPlan = plan.id === currentPlan;
                const Icon = plan.id === 'business' ? Crown : plan.id === 'pro' ? Star : Zap;
                const originalPrice = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
                const promoPrice = billingCycle === 'yearly' ? plan.promoYearlyPrice : plan.promoPrice;
                const displayPrice = PROMO_ACTIVE ? promoPrice : originalPrice;
                const priceSuffix = billingCycle === 'yearly' ? '/an' : '/mois';

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'relative rounded-xl border-2 p-5 transition-all',
                      isCurrentPlan
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                          POPULAIRE
                        </span>
                      </div>
                    )}

                    {isCurrentPlan && (
                      <div className="absolute -top-3 right-4">
                        <span className="px-3 py-1 bg-cyan-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          ACTUEL
                        </span>
                      </div>
                    )}

                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br text-white',
                      plan.color
                    )}>
                      <Icon className="h-6 w-6" />
                    </div>

                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      {PROMO_ACTIVE && (
                        <span className="text-lg text-gray-400 line-through mr-1">{originalPrice}€</span>
                      )}
                      <span className="text-3xl font-bold text-gray-900">{displayPrice}€</span>
                      <span className="text-gray-500">{priceSuffix}</span>
                    </div>
                    {PROMO_ACTIVE && (
                      <span className="inline-block text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        OFFRE 100 PREMIERS CLIENTS
                      </span>
                    )}
                    <div className="mb-3" />

                    <ul className="space-y-2 mb-6">
                      {plan.features.slice(0, 5).map((feature, idx) => {
                        const FeatureIcon = feature.icon;
                        return (
                          <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                            <FeatureIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span>{feature.text}</span>
                          </li>
                        );
                      })}
                      {plan.features.length > 5 && (
                        <li className="text-sm text-gray-400">
                          + {plan.features.length - 5} autres fonctionnalités
                        </li>
                      )}
                    </ul>

                    {isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full py-2.5 px-4 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed"
                      >
                        Plan actuel
                      </button>
                    ) : (
                      <button
                        onClick={() => portalMutation.mutate()}
                        className={cn(
                          'w-full py-2.5 px-4 rounded-lg font-medium transition-colors',
                          plan.id === 'business'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        )}
                      >
                        {PLANS.findIndex(p => p.id === plan.id) > PLANS.findIndex(p => p.id === currentPlan)
                          ? 'Passer à ce plan'
                          : 'Rétrograder'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consommation du mois */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-400" />
                Consommation du mois
              </h2>
              {quotaData && (
                <span className="text-sm text-gray-500">
                  Réinitialisation dans {quotaData.resetInDays} jour{quotaData.resetInDays > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="p-6 space-y-5">
              {isQuotaLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : quotaData?.modules ? (
                <>
                  {(PLAN_MODULES[currentPlan || 'starter'] || PLAN_MODULES.starter).map((moduleId: string) => {
                    const mod = quotaData.modules[moduleId];
                    const config = QUOTA_MODULE_CONFIG[moduleId];
                    if (!mod || !config) return null;

                    const metricEntries = Object.entries(mod.metrics);
                    if (metricEntries.length === 0) return null;

                    // Déterminer le statut d'activation
                    const moduleKey = QUOTA_TO_MODULE_KEY[moduleId] || moduleId;
                    const isAlwaysActive = ALWAYS_ACTIVE_MODULES.has(moduleId);
                    const isActive = isAlwaysActive || quotaData.modulesActifs?.[moduleKey] === true;
                    const isPending = !isActive && quotaData.pendingActivations?.includes(moduleId);

                    // Module non activé — afficher demande d'activation
                    if (!isActive && !isAlwaysActive) {
                      const Icon = config.icon;
                      return (
                        <div key={moduleId} className={cn('rounded-lg p-4', isPending ? 'bg-yellow-50' : 'bg-gray-50')}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className={cn('w-4 h-4', isPending ? 'text-yellow-600' : 'text-gray-400')} />
                              <span className="text-sm font-medium text-gray-900">{config.label}</span>
                            </div>
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                                <Clock className="w-3 h-3" />
                                Activation en cours
                              </span>
                            ) : (
                              <button
                                onClick={() => activationMutation.mutate(moduleId)}
                                disabled={activationMutation.isPending}
                                className="px-3 py-1.5 bg-cyan-500 text-white text-xs font-medium rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50"
                              >
                                Demander l'activation
                              </button>
                            )}
                          </div>
                          {isPending && (
                            <p className="mt-2 text-xs text-yellow-600">Votre demande est en cours de traitement</p>
                          )}
                        </div>
                      );
                    }

                    // Module actif — afficher les barres de progression
                    return metricEntries.map(([metricKey, metric]) => {
                      const Icon = config.icon;
                      const metricOverride = METRIC_LABELS[moduleId]?.[metricKey];
                      const displayLabel = metricOverride?.label || config.label;
                      const displayUnit = metricOverride?.unit || config.unit;
                      return (
                        <div key={`${moduleId}-${metricKey}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Icon className={cn('w-4 h-4', config.color)} />
                              <span className="text-sm font-medium text-gray-900">{displayLabel}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">
                                {metric.used} / {metric.limit} {displayUnit}
                              </span>
                              {metric.status === 'exceeded' ? (
                                <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                  Dépassé
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  ({metric.remaining} restants)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', getBarColor(metric.percentage))}
                              style={{ width: `${Math.min(metric.percentage, 100)}%` }}
                            />
                          </div>
                          {metric.excess > 0 && (
                            <p className="mt-1 text-xs text-red-600">
                              {metric.excess} {displayUnit} en dépassement = {metric.overageCost.toFixed(2)}€
                            </p>
                          )}
                        </div>
                      );
                    });
                  })}

                  {quotaData.totalOverage > 0 && (
                    <div className="mt-2 pt-4 border-t border-gray-200 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Total dépassement ce mois</span>
                      <span className="text-sm font-bold text-red-600">{quotaData.totalOverage.toFixed(2)}€</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Aucune donnée de consommation</p>
              )}
            </div>
          </div>

          {/* Forfaits supplémentaires */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-400" />
                Forfaits supplémentaires
              </h2>
              <p className="text-sm text-gray-500">Achetez des packs pour compléter vos quotas</p>
            </div>

            <div className="p-6 space-y-8">
              {/* Packs Voix IA */}
              {(currentPlan === 'pro' || currentPlan === 'business') ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-purple-600" />
                    Packs Voix IA
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {ADDON_PACKS.voix.map((pack) => (
                      <div
                        key={pack.code}
                        className="border border-gray-200 rounded-lg p-4 hover:border-cyan-300 transition-colors text-center"
                      >
                        <p className="text-2xl font-bold text-gray-900">{pack.amount}</p>
                        <p className="text-xs text-gray-500 mb-2">{pack.unit}</p>
                        <p className="text-lg font-semibold text-gray-900">{pack.price}€</p>
                        <p className="text-xs text-gray-400 mb-3">{pack.unitPrice}/{pack.unit}</p>
                        <button
                          onClick={() => packCheckoutMutation.mutate(pack.code)}
                          disabled={packCheckoutMutation.isPending}
                          className="w-full py-1.5 px-3 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                          Ajouter
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 p-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Débloquez la Voix IA et WhatsApp</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Passez au plan Pro pour accéder au téléphone IA, WhatsApp IA et bien plus.
                      </p>
                      <button
                        onClick={() => portalMutation.mutate()}
                        className="mt-3 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-colors"
                      >
                        Découvrir Pro
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Packs SMS */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-600" />
                  Packs SMS
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {ADDON_PACKS.sms.map((pack) => (
                    <div
                      key={pack.code}
                      className="border border-gray-200 rounded-lg p-4 hover:border-cyan-300 transition-colors text-center"
                    >
                      <p className="text-2xl font-bold text-gray-900">{pack.amount}</p>
                      <p className="text-xs text-gray-500 mb-2">{pack.unit}</p>
                      <p className="text-lg font-semibold text-gray-900">{pack.price}€</p>
                      <p className="text-xs text-gray-400 mb-3">{pack.unitPrice}/{pack.unit}</p>
                      <button
                        onClick={() => packCheckoutMutation.mutate(pack.code)}
                        disabled={packCheckoutMutation.isPending}
                        className="w-full py-1.5 px-3 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Factures */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Historique de facturation
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              {invoicesData?.invoices?.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Aucune facture pour le moment
                </div>
              ) : invoicesData?.invoices ? (
                invoicesData.invoices.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {invoice.number || invoice.id}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(invoice.created)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {invoice.status === 'paid' ? 'Payée' : invoice.status}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(invoice.amount_paid, invoice.currency)}
                      </span>
                      {invoice.pdf_url && (
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-cyan-600 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500">
                  Chargement...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Statut */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Statut</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Plan</span>
                <span className="font-semibold text-gray-900 capitalize">{currentPlan}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Statut</span>
                <span className={cn('inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full', statusInfo.color)}>
                  <CheckCircle className="w-3 h-3" />
                  {statusInfo.label}
                </span>
              </div>
              {tenantStatut === 'essai' && tenant?.essai_fin && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Fin d'essai</span>
                  <span className="text-sm font-medium text-blue-700">
                    {(() => {
                      const days = Math.max(0, Math.ceil((new Date(tenant.essai_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                      return days > 0 ? `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}` : 'Expiré';
                    })()}
                  </span>
                </div>
              )}
              {tenantStatut !== 'essai' && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Facturation</span>
                  <span className="font-semibold text-gray-900">
                    {PROMO_ACTIVE && <span className="text-gray-400 line-through text-sm mr-1">{currentPlanData.price}€</span>}
                    {PROMO_ACTIVE ? currentPlanData.promoPrice : currentPlanData.price}€/mois
                  </span>
                </div>
              )}
              {subscriptionData?.current_period_end && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Prochain paiement</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(subscriptionData.current_period_end)}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Gérer sur Stripe
              </button>
            </div>
          </div>

          {/* Moyens de paiement */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-400" />
              Moyens de paiement
            </h3>

            <div className="space-y-3">
              {paymentMethodsData?.payment_methods?.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold uppercase">
                      {pm.brand}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        •••• {pm.last4}
                      </p>
                      <p className="text-xs text-gray-500">
                        Expire {pm.exp_month}/{pm.exp_year}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCardMutation.mutate(pm.id)}
                    disabled={deleteCardMutation.isPending}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {(!paymentMethodsData?.payment_methods || paymentMethodsData.payment_methods.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-2">
                  Aucune carte enregistrée
                </p>
              )}

              <button
                onClick={() => portalMutation.mutate()}
                className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-cyan-600 hover:border-cyan-500 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Ajouter une carte
              </button>
            </div>
          </div>

          {/* Support */}
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">
              Besoin d'aide?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Notre équipe est là pour vous aider avec votre abonnement.
            </p>
            <a
              href="mailto:nexussentinelai@yahoo.com"
              className="inline-flex items-center gap-2 text-cyan-600 hover:text-cyan-700 text-sm font-medium"
            >
              Contacter le support
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
