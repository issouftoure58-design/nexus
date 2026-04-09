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

// Plans NEXUS officiels — Modèle 2026 revision finale 9 avril 2026 (voir memory/business-model-2026.md)
// Free freemium / Basic 29€ illimité non-IA + 500 crédits IA / Business 149€ multi-sites + 10 000 crédits IA inclus
const PROMO_ACTIVE = false; // Plus de promo : prix bas en permanence
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    promoPrice: 0,
    yearlyPrice: 0,
    promoYearlyPrice: 0,
    description: 'Gratuit à vie, sans carte bancaire',
    color: 'from-gray-500 to-gray-600',
    features: [
      { text: '30 réservations / mois', icon: Clock },
      { text: '20 factures / mois (avec watermark)', icon: FileText },
      { text: '50 clients max dans le CRM', icon: Users },
      { text: '5 prestations max', icon: Sparkles },
      { text: '1 utilisateur', icon: Users },
      { text: 'Tous les modules visibles', icon: Globe },
      { text: 'Fonctions IA bloquées', icon: Shield },
      { text: 'Support email', icon: Clock },
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 29,
    promoPrice: 29,
    yearlyPrice: 290,
    promoYearlyPrice: 290,
    description: 'Tout illimité non-IA + 500 crédits IA inclus / mois',
    popular: true,
    color: 'from-cyan-500 to-blue-600',
    features: [
      { text: 'Réservations illimitées', icon: Clock },
      { text: 'Facturation illimitée (sans watermark)', icon: FileText },
      { text: 'CRM, Équipe, Fidélité illimités', icon: Users },
      { text: 'Comptabilité, RH, Stock complets', icon: BarChart3 },
      { text: 'Workflows, Pipeline, Devis, SEO', icon: Sparkles },
      { text: 'WhatsApp IA, Téléphone IA, Marketing IA', icon: Phone },
      { text: '500 crédits IA inclus / mois (valeur 7,50€)', icon: Zap },
      { text: 'Support email prioritaire', icon: CheckCircle },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 149,
    promoPrice: 149,
    yearlyPrice: 1490,
    promoYearlyPrice: 1490,
    description: 'Multi-sites, white-label, API, 10 000 crédits IA inclus',
    color: 'from-purple-500 to-indigo-600',
    features: [
      { text: 'Tout Basic +', icon: CheckCircle },
      { text: 'Multi-sites illimités', icon: Globe },
      { text: 'White-label (logo + domaine custom)', icon: Star },
      { text: 'API + Webhooks', icon: Shield },
      { text: 'SSO entreprise', icon: Shield },
      { text: 'Support prioritaire 1h', icon: Zap },
      { text: 'Account Manager dédié', icon: Crown },
      { text: '10 000 crédits IA inclus / mois (valeur 150€)', icon: Sparkles },
    ],
  },
];

export default function Subscription() {
  const queryClient = useQueryClient();
  const { plan: currentPlan, tenant, isLoading: loadingTenant } = useTenant();
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

  // Mutation pour creer une Checkout Session (upgrade Free → Basic / Basic → Business)
  const checkoutMutation = useMutation({
    mutationFn: (planId: 'basic' | 'business') => {
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

  // Decide si on doit utiliser checkout (pas d'abo Stripe) ou portal (deja abo)
  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlan) return;
    if (planId === 'free') {
      // Downgrade vers Free → portal pour annuler l'abo existant
      portalMutation.mutate();
      return;
    }
    if (subscriptionData?.has_subscription) {
      // Deja un abo actif → portal pour switcher
      portalMutation.mutate();
      return;
    }
    // Sinon checkout direct (premier abo)
    checkoutMutation.mutate(planId as 'basic' | 'business');
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

      {/* Bannière essai gratuit (14 jours Basic, puis bascule Free automatique) */}
      {isOnTrial && (
        <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Essai Basic en cours</p>
              <p className="text-sm text-gray-600 mt-1">
                Vous profitez de toutes les fonctionnalités du plan <strong>Basic</strong> gratuitement pendant 14 jours
                (réservations illimitées, facturation sans watermark, IA via crédits). À la fin de l'essai, votre compte
                bascule automatiquement sur le plan <strong>Free</strong> sans frais.
              </p>
              {tenant?.essai_fin && (
                <p className="text-sm text-blue-700 font-medium mt-2">
                  {(() => {
                    const days = Math.max(0, Math.ceil((new Date(tenant.essai_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                    return days > 0 ? `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''} avant la bascule sur Free` : 'Essai expiré';
                  })()}
                </p>
              )}
              <button
                onClick={() => handleSelectPlan('basic')}
                disabled={checkoutMutation.isPending}
                className="mt-3 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm disabled:opacity-60"
              >
                {checkoutMutation.isPending ? 'Redirection...' : 'Conserver Basic après l\'essai'}
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
                const Icon = plan.id === 'business' ? Crown : plan.id === 'basic' ? Sparkles : Zap;
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
                        disabled={checkoutMutation.isPending || portalMutation.isPending}
                        className={cn(
                          'w-full py-2.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-60',
                          plan.id === 'business'
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
                            : plan.id === 'basic'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        )}
                      >
                        {(checkoutMutation.isPending || portalMutation.isPending)
                          ? 'Redirection...'
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

          {/* Crédits IA — Solde + packs d'achat (modèle 2026) */}
          {currentPlan === 'free' ? (
            <div className="rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 p-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-6 h-6 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-lg">Débloquez l'IA NEXUS</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Les fonctions IA (chat admin, WhatsApp, téléphone, marketing, posts, SEO) sont bloquées sur le plan Free.
                    Passez au plan <strong>Basic 29€/mois</strong> pour accéder à toute l'IA en pay-as-you-go via crédits.
                  </p>
                  <button
                    onClick={() => handleSelectPlan('basic')}
                    disabled={checkoutMutation.isPending}
                    className="mt-4 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-60"
                  >
                    {checkoutMutation.isPending ? 'Redirection...' : 'Passer au plan Basic'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <CreditsBalanceCard showPacks={true} />
          )}

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
