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
  Star
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

// Plans NEXUS officiels
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 199,
    description: 'Pour les petits établissements',
    color: 'from-gray-500 to-gray-600',
    features: [
      { text: 'Téléphone IA: 300 min/mois', icon: Phone },
      { text: 'WhatsApp IA: 1000 msg/mois', icon: MessageSquare },
      { text: 'Web Chat: 5000 msg/mois', icon: Globe },
      { text: '1000 clients max', icon: Users },
      { text: '100 posts & images IA/mois', icon: Sparkles },
      { text: 'Support email (48h)', icon: Clock },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 399,
    description: 'Pour les établissements en croissance',
    popular: true,
    color: 'from-purple-500 to-indigo-600',
    features: [
      { text: 'Téléphone IA: 600 min/mois', icon: Phone },
      { text: 'WhatsApp IA: 2500 msg/mois', icon: MessageSquare },
      { text: 'Web Chat: 10000 msg/mois', icon: Globe },
      { text: '3000 clients max', icon: Users },
      { text: '500 posts & images IA/mois', icon: Sparkles },
      { text: 'CRM avancé + Marketing auto', icon: BarChart3 },
      { text: 'Stock & Comptabilité', icon: FileText },
      { text: '5 utilisateurs inclus', icon: Users },
      { text: 'Support prioritaire (24h)', icon: Zap },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 799,
    description: 'Pour les entreprises structurées',
    color: 'from-cyan-500 to-blue-600',
    features: [
      { text: 'Téléphone IA: 1200 min/mois', icon: Phone },
      { text: 'WhatsApp IA: 5000 msg/mois', icon: MessageSquare },
      { text: 'Web Chat: Illimité', icon: Globe },
      { text: 'Clients illimités', icon: Users },
      { text: '1000 posts & images IA/mois', icon: Sparkles },
      { text: 'SEO & Visibilité IA', icon: Star },
      { text: 'RH complet + API', icon: Shield },
      { text: 'SENTINEL Intelligence', icon: Shield },
      { text: '10 utilisateurs + Account Manager', icon: Crown },
      { text: 'Support dédié 24/7', icon: Zap },
    ],
  },
];

export default function Subscription() {
  const queryClient = useQueryClient();
  const { plan: currentPlan, tenant, isLoading: loadingTenant } = useTenant();

  // Charger les moyens de paiement
  const { data: paymentMethodsData } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.get<{ payment_methods: PaymentMethod[] }>('/billing/payment-methods'),
  });

  // Charger les factures
  const { data: invoicesData } = useQuery({
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
  });

  // Mutation pour supprimer une carte
  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/billing/payment-methods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
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

  if (loadingTenant) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mon Abonnement</h1>
        <p className="text-gray-500">Gérez votre plan et votre facturation</p>
      </div>

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
              <span className="text-5xl font-bold">{currentPlanData.price}€</span>
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
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Changer de plan</h2>
              <p className="text-sm text-gray-500">Comparez les fonctionnalités de chaque plan</p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const isCurrentPlan = plan.id === currentPlan;
                const Icon = plan.id === 'business' ? Crown : plan.id === 'pro' ? Star : Zap;

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
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-bold text-gray-900">{plan.price}€</span>
                      <span className="text-gray-500">/mois</span>
                    </div>

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
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Actif
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Facturation</span>
                <span className="font-semibold text-gray-900">{currentPlanData.price}€/mois</span>
              </div>
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
              href="mailto:support@nexus.app"
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
