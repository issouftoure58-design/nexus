/**
 * Subscription - Page d'abonnement NEXUS
 * Systeme modulaire avec Stripe Billing
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Package,
  CreditCard,
  Calendar,
  Download,
  ExternalLink,
  Plus,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Sparkles,
  FileText,
  Trash2
} from 'lucide-react';

interface Module {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  prix_mensuel: number;
  requis?: boolean;
}

interface SubscriptionData {
  has_subscription: boolean;
  id?: string;
  status?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  cancel_at?: string;
  items?: Array<{
    product_name: string;
    unit_amount: number;
  }>;
}

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

export default function Subscription() {
  const queryClient = useQueryClient();
  const [showAddCard, setShowAddCard] = useState(false);

  // Charger les modules actifs
  const { data: modulesData, isLoading: loadingModules } = useQuery({
    queryKey: ['active-modules'],
    queryFn: () => api.get<{ modules: Module[]; pricing: { total_centimes: number } }>('/modules/active'),
  });

  // Charger l'abonnement Stripe
  const { data: subscriptionData, isLoading: loadingSubscription } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => api.get<SubscriptionData>('/billing/subscription'),
  });

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

  // Charger la prochaine facture
  const { data: upcomingData } = useQuery({
    queryKey: ['upcoming-invoice'],
    queryFn: () => api.get<{ has_upcoming: boolean; amount_due?: number; period_end?: string }>('/billing/upcoming'),
  });

  // Mutation pour desactiver un module
  const deactivateMutation = useMutation({
    mutationFn: (moduleId: string) => api.post(`/modules/${moduleId}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-modules'] });
    },
  });

  // Mutation pour annuler l'abonnement
  const cancelMutation = useMutation({
    mutationFn: () => api.delete('/billing/subscription'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
    },
  });

  // Mutation pour reactiver l'abonnement
  const reactivateMutation = useMutation({
    mutationFn: () => api.post('/billing/subscription/reactivate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
    },
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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" />
            Actif
          </span>
        );
      case 'past_due':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            <AlertCircle className="w-3 h-3" />
            Paiement en retard
          </span>
        );
      case 'canceled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            <X className="w-3 h-3" />
            Annule
          </span>
        );
      case 'trialing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            <Clock className="w-3 h-3" />
            Essai
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            <Clock className="w-3 h-3" />
            {status || 'Inconnu'}
          </span>
        );
    }
  };

  const totalMensuel = modulesData?.pricing?.total_centimes || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mon Abonnement</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Gerez vos modules et votre facturation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Modules Actifs */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Modules Actifs</h2>
                  <p className="text-sm text-gray-500">
                    {modulesData?.modules?.length || 0} modules
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-cyan-600">
                  {formatCurrency(totalMensuel)}
                </p>
                <p className="text-xs text-gray-500">/mois</p>
              </div>
            </div>

            <div className="p-6">
              {loadingModules ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
                </div>
              ) : (
                <div className="space-y-3">
                  {modulesData?.modules?.map((mod) => (
                    <div
                      key={mod.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {mod.nom}
                          </p>
                          <p className="text-sm text-gray-500">
                            {mod.requis ? 'Module de base' : `${formatCurrency(mod.prix_mensuel)}/mois`}
                          </p>
                        </div>
                      </div>
                      {!mod.requis && (
                        <button
                          onClick={() => deactivateMutation.mutate(mod.id)}
                          disabled={deactivateMutation.isPending}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Desactiver"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Link
                to="/onboarding"
                className="mt-4 flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 hover:text-cyan-600 hover:border-cyan-500 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Ajouter des modules
              </Link>
            </div>
          </div>

          {/* Factures */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Factures
              </h2>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {invoicesData?.invoices?.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Aucune facture pour le moment
                </div>
              ) : (
                invoicesData?.invoices?.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
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
                        {invoice.status === 'paid' ? 'Payee' : invoice.status}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
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
              )}
            </div>
          </div>
        </div>

        {/* Colonne laterale */}
        <div className="space-y-6">
          {/* Statut Abonnement */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Statut Abonnement
            </h3>

            {loadingSubscription ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
              </div>
            ) : subscriptionData?.has_subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Statut</span>
                  {getStatusBadge(subscriptionData.status)}
                </div>

                {subscriptionData.current_period_end && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Prochaine facturation</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDate(subscriptionData.current_period_end)}
                    </span>
                  </div>
                )}

                {upcomingData?.has_upcoming && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Montant</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(upcomingData.amount_due || 0)}
                    </span>
                  </div>
                )}

                {subscriptionData.cancel_at_period_end && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Votre abonnement sera annule le {formatDate(subscriptionData.cancel_at || subscriptionData.current_period_end || '')}
                    </p>
                    <button
                      onClick={() => reactivateMutation.mutate()}
                      disabled={reactivateMutation.isPending}
                      className="mt-2 text-sm font-medium text-yellow-700 hover:text-yellow-800"
                    >
                      Reactiver l'abonnement
                    </button>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
                  <button
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Gerer sur Stripe
                  </button>

                  {!subscriptionData.cancel_at_period_end && (
                    <button
                      onClick={() => {
                        if (confirm('Etes-vous sur de vouloir annuler votre abonnement?')) {
                          cancelMutation.mutate();
                        }
                      }}
                      disabled={cancelMutation.isPending}
                      className="w-full py-2 px-4 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm"
                    >
                      Annuler l'abonnement
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-4">Pas d'abonnement actif</p>
                <Link
                  to="/onboarding"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700"
                >
                  <Sparkles className="w-4 h-4" />
                  Commencer
                </Link>
              </div>
            )}
          </div>

          {/* Moyens de paiement */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-400" />
              Moyens de paiement
            </h3>

            <div className="space-y-3">
              {paymentMethodsData?.payment_methods?.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold uppercase">
                      {pm.brand}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
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
                  Aucune carte enregistree
                </p>
              )}

              <button
                onClick={() => portalMutation.mutate()}
                className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 hover:text-cyan-600 hover:border-cyan-500 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Ajouter une carte
              </button>
            </div>
          </div>

          {/* Support */}
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Besoin d'aide?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Notre equipe est la pour vous aider avec votre abonnement.
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
