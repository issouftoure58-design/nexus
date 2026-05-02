/**
 * Subscription - Page d'abonnement NEXUS
 * Affichage du plan et upgrade
 */

import { useState, useEffect } from 'react';
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
  Globe,
  Users,
  BarChart3,
  Shield,
  Star,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreditsBalanceCard } from '@/components/CreditsBalanceCard';

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

// Prix importés depuis lib/planPricing.ts (source unique frontend)
import { PLAN_PRICES as PP, PLAN_YEARLY_PRICES as PY } from '../lib/planPricing';

const PROMO_ACTIVE = false;
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: PP.free,
    promoPrice: PP.free,
    yearlyPrice: PY.free,
    promoYearlyPrice: PY.free,
    description: 'Gratuit a vie, sans carte bancaire',
    color: 'from-gray-500 to-gray-600',
    features: [
      { text: 'Dashboard, Clients, Reservations', icon: Clock },
      { text: '5 clients, 5 RDV, 5 factures/mois', icon: FileText },
      { text: '1 utilisateur', icon: Users },
      { text: 'IA bloquee (Starter+)', icon: Zap },
      { text: 'Support email', icon: Clock },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: PP.starter,
    promoPrice: PP.starter,
    yearlyPrice: PY.starter,
    promoYearlyPrice: PY.starter,
    description: 'Toute l\'IA + CRM avance, 5 users max',
    popular: true,
    color: 'from-cyan-500 to-blue-600',
    features: [
      { text: 'Toutes les IA (Tel, WhatsApp, Web)', icon: Sparkles },
      { text: 'CRM avance (contacts, segments)', icon: BarChart3 },
      { text: '200 limites, 5 postes', icon: Users },
      { text: 'Utilisation IA incluse (base)', icon: Zap },
      { text: 'Support email prioritaire', icon: CheckCircle },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: PP.pro,
    promoPrice: PP.pro,
    yearlyPrice: PY.pro,
    promoYearlyPrice: PY.pro,
    description: 'Facturation, Devis, Pipeline, Equipe, Marketing complet, 20 users',
    color: 'from-blue-500 to-indigo-600',
    features: [
      { text: 'Tout Starter +', icon: CheckCircle },
      { text: 'Facturation, Devis, Pipeline, Stock', icon: FileText },
      { text: 'Equipe, Planning, Fidelite', icon: Users },
      { text: 'Marketing complet (campagnes, posts, reseaux)', icon: Sparkles },
      { text: 'Multi-sites, tout illimite, 20 postes', icon: Globe },
      { text: 'Utilisation IA 5x', icon: Zap },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: PP.business,
    promoPrice: PP.business,
    yearlyPrice: PY.business,
    promoYearlyPrice: PY.business,
    description: 'Compta, SEO, API + Webhooks, 50 users',
    color: 'from-yellow-500 to-orange-600',
    features: [
      { text: 'Tout Pro +', icon: CheckCircle },
      { text: 'Comptabilite basique (rapports, FEC, TVA)', icon: BarChart3 },
      { text: 'SEO complet (articles IA, meta, audit)', icon: Globe },
      { text: 'API + Webhooks', icon: Shield },
      { text: '50 postes, multi-sites', icon: Users },
      { text: 'Utilisation IA 12.5x', icon: Zap },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: PP.enterprise,
    promoPrice: PP.enterprise,
    yearlyPrice: PY.enterprise,
    promoYearlyPrice: PY.enterprise,
    description: 'RH, Sentinel, Analytique, White-label, SSO, 50 users',
    color: 'from-purple-500 to-pink-600',
    features: [
      { text: 'Tout Business +', icon: CheckCircle },
      { text: 'RH complet (paie, DSN, conges)', icon: BarChart3 },
      { text: 'Compta analytique', icon: BarChart3 },
      { text: 'SENTINEL monitoring', icon: Shield },
      { text: 'White-label + SSO entreprise', icon: Star },
      { text: 'Account Manager dedie, 50 postes', icon: Crown },
      { text: 'Utilisation IA 25x', icon: Sparkles },
    ],
  },
];

export default function Subscription() {
  const queryClient = useQueryClient();
  const { plan: currentPlan, tenant, isLoading: loadingTenant } = useTenant();
  const isOnTrial = tenant?.statut === 'essai';
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [error, setError] = useState<string | null>(null);

  // Au retour de Stripe checkout, vérifier et synchroniser le plan
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
      // Appeler le backend pour forcer la sync du plan
      api.post('/billing/verify-checkout', {})
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['subscription'] });
          queryClient.invalidateQueries({ queryKey: ['tenant'] });
        })
        .catch((err: unknown) => console.error('verify-checkout error:', err));
    }
  }, [queryClient]);

  // Charger le statut d'abonnement
  const { data: subscriptionData } = useQuery<SubscriptionData>({
    queryKey: ['subscription'],
    queryFn: () => api.get<SubscriptionData>('/billing/subscription'),
  });

  // Charger les moyens de paiement
  const { data: paymentMethodsData, isError: isPmError } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.get<{ payment_methods: PaymentMethod[] }>('/billing/payment-methods'),
  });

  // Charger les factures
  const { data: invoicesData, isError: isInvError } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<{ invoices: Invoice[] }>('/billing/invoices'),
  });

  // Mutation pour ouvrir le portail Stripe (gestion d'un abonnement existant)
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

  // Mutation pour creer une Checkout Session (premiere souscription : Free → Starter/Pro/Business)
  const checkoutMutation = useMutation({
    mutationFn: (planId: 'starter' | 'pro' | 'business') => {
      const productCode = `nexus_${planId}_${billingCycle === 'yearly' ? 'yearly' : 'monthly'}`;
      return api.post<{ url: string }>('/billing/checkout', {
        priceId: productCode,
        successUrl: `${window.location.origin}/subscription?checkout=success`,
        cancelUrl: `${window.location.origin}/subscription?checkout=cancelled`,
      });
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'Impossible de creer la session de paiement');
    },
  });

  // Mutation pour changer de plan payant (Starter ↔ Pro ↔ Business) sans passer par le portal Stripe
  // Utilise l'API subscription update directement (prorata auto cote Stripe)
  const changePlanMutation = useMutation({
    mutationFn: (planId: 'starter' | 'pro' | 'business') =>
      api.post<{ success: boolean; plan: string }>('/billing/change-plan', {
        planId,
        cycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
      }),
    onSuccess: () => {
      // Refresh des donnees d'abonnement
      window.location.href = `${window.location.pathname}?plan-changed=success`;
    },
    onError: (err: Error) => {
      setError(err.message || 'Impossible de changer de plan');
    },
  });

  // Decide quel flux Stripe utiliser : checkout (premiere souscription),
  // change-plan (switch entre plans payants) ou portal (downgrade vers Free / annulation)
  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlan) return;
    if (planId === 'free') {
      // Downgrade vers Free → portal pour annuler l'abo existant
      portalMutation.mutate();
      return;
    }
    if (subscriptionData?.has_subscription) {
      // Deja un abo payant → change-plan direct (pas besoin du portal)
      changePlanMutation.mutate(planId as 'starter' | 'pro' | 'business');
      return;
    }
    // Sinon checkout direct (premier abo)
    checkoutMutation.mutate(planId as 'starter' | 'pro' | 'business');
  };

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

  // Pas d'erreur si pas de subscription Stripe active (Free, ou plan sans abo)
  const hasStripeSubscription = !!subscriptionData?.has_subscription;
  const hasQueryError = hasStripeSubscription && (isPmError || isInvError);

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
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

      {/* Banniere essai gratuit (14 jours Starter, puis bascule Free automatique) */}
      {isOnTrial && (
        <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Essai Starter en cours</p>
              <p className="text-sm text-gray-600 mt-1">
                Vous profitez de toutes les fonctionnalites du plan <strong>Starter</strong> gratuitement pendant 14 jours
                (IA, stock, workflows, pipeline, devis, SEO, fidelite). A la fin de l'essai, votre compte
                bascule automatiquement sur le plan <strong>Free</strong> sans frais.
              </p>
              {tenant?.essai_fin && (
                <p className="text-sm text-blue-700 font-medium mt-2">
                  {(() => {
                    const days = Math.max(0, Math.ceil((new Date(tenant.essai_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                    return days > 0 ? `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''} avant la bascule sur Free` : 'Essai expire';
                  })()}
                </p>
              )}
              <button
                onClick={() => handleSelectPlan('starter')}
                disabled={checkoutMutation.isPending}
                className="mt-3 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm disabled:opacity-60"
              >
                {checkoutMutation.isPending ? 'Redirection...' : 'Conserver Starter apres l\'essai'}
              </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Colonne principale - Plans */}
        <div className="lg:col-span-3 space-y-6">
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
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">2 mois offerts</span>
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {PLANS.map((plan) => {
                const isCurrentPlan = plan.id === currentPlan;
                const Icon = plan.id === 'enterprise' ? Crown : plan.id === 'business' ? Shield : plan.id === 'pro' ? Globe : plan.id === 'starter' ? Sparkles : Zap;
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
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={checkoutMutation.isPending || portalMutation.isPending || changePlanMutation.isPending}
                        className={cn(
                          'w-full py-2.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-60',
                          plan.id === 'enterprise'
                            ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700'
                            : plan.id === 'business'
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white hover:from-yellow-600 hover:to-orange-700'
                            : plan.id === 'pro'
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700'
                            : plan.id === 'starter'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        )}
                      >
                        {(checkoutMutation.isPending || portalMutation.isPending || changePlanMutation.isPending)
                          ? 'Mise a jour...'
                          : PLANS.findIndex(p => p.id === plan.id) > PLANS.findIndex(p => p.id === currentPlan)
                          ? 'Passer à ce plan'
                          : 'Rétrograder'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Utilisation IA — Solde + achat supplementaire (modele 2026) */}
          {currentPlan === 'free' ? (
            <div className="rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 p-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-6 h-6 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-lg">Debloquez l'IA NEXUS</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Les fonctions IA (chat admin, WhatsApp, telephone, marketing, posts, SEO) sont bloquees sur le plan Free.
                    Passez au plan <strong>Starter 69€/mois</strong> pour acceder a toute l'IA.
                  </p>
                  <button
                    onClick={() => handleSelectPlan('starter')}
                    disabled={checkoutMutation.isPending}
                    className="mt-4 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-60"
                  >
                    {checkoutMutation.isPending ? 'Redirection...' : 'Passer au plan Starter'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <CreditsBalanceCard showPacks={true} />
          )}

          {/* Factures — masque si pas d'abonnement Stripe actif */}
          {hasStripeSubscription && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  Historique de facturation
                </h2>
              </div>

              <div className="divide-y divide-gray-200">
                {invoicesData?.invoices?.length === 0 ? (
                  <div className="p-3 sm:p-6 text-center text-gray-500">
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
                  <div className="p-3 sm:p-6 text-center text-gray-500">
                    Chargement...
                  </div>
                )}
              </div>
            </div>
          )}
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
              href="mailto:contact@nexus-ai-saas.com"
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
