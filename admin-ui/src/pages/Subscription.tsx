/**
 * Subscription - Page d'abonnement NEXUS
 * Pricing final avec optimisations techniques
 */

import { useState } from 'react';
import { Check, Zap, Crown, Building2, Bot, Phone, MessageCircle, Globe, CreditCard, Calendar, Download, Minus } from 'lucide-react';

// Plan actuel (mock - sera remplacé par données API)
const currentPlan = {
  id: 'starter',
  name: 'Starter',
  billingCycle: 'monthly' as const,
  nextBilling: '1er mars 2026',
  usage: {
    telephone: { used: 145, limit: 300 },
    whatsapp: { used: 523, limit: 1000 },
    web: { used: 2150, limit: 5000 },
  }
};

// Définition des plans
const plans = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    description: 'Pour démarrer avec l\'IA',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    quotas: {
      telephone: 300,
      whatsapp: 1000,
      web: 5000,
      posts: 100,
      images: 100,
    },
    features: [
      'Agent IA Téléphone (300 min)',
      'Agent IA WhatsApp (1000 msg)',
      'Agent IA Web (5000 msg)',
      '100 posts IA/mois',
      '100 images IA/mois',
      'Gestion clients (1000 max)',
      'Facturation avancée',
      'CRM de base',
      'Assistant Admin IA basique',
      '1 utilisateur',
      'Support email (48h)',
    ],
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Crown,
    description: 'Pour les établissements en croissance',
    monthlyPrice: 399,
    yearlyPrice: 3990,
    quotas: {
      telephone: 600,
      whatsapp: 2500,
      web: 10000,
      posts: 500,
      images: 500,
    },
    features: [
      'Agent IA Téléphone (600 min)',
      'Agent IA WhatsApp (2500 msg)',
      'Agent IA Web (10000 msg)',
      '500 posts IA/mois',
      '500 images IA/mois',
      'Gestion clients (3000 max)',
      'CRM avancé & Segmentation',
      'Assistant Admin IA PRO',
      'Marketing automation',
      'Comptabilité complète',
      'Stock & Inventaire',
      '5 utilisateurs (+20€/user)',
      'Support prioritaire (24h)',
    ],
    highlighted: true,
    badge: 'Populaire',
  },
  {
    id: 'business',
    name: 'Business',
    icon: Building2,
    description: 'Pour les multi-établissements',
    monthlyPrice: 799,
    yearlyPrice: 7990,
    quotas: {
      telephone: 1200,
      whatsapp: 5000,
      web: -1, // illimité
      posts: 1000,
      images: 1000,
    },
    features: [
      'Agent IA Téléphone (1200 min)',
      'Agent IA WhatsApp (5000 msg)',
      'Agent IA Web (Illimité)',
      '1000 posts IA/mois',
      '1000 images IA/mois',
      'Clients illimités',
      'SENTINEL Intelligence',
      'Assistant Admin IA Intelligence',
      'SEO & Visibilité IA',
      'RH & Multi-employés',
      'API & Intégrations',
      'White-label complet',
      '10 utilisateurs (+15€/user)',
      'Account Manager dédié',
    ],
    highlighted: false,
  },
];

// Options de réduction par canal
const channelDiscounts = {
  starter: { telephone: 90, whatsapp: 30 },
  pro: { telephone: 180, whatsapp: 80 },
  business: { telephone: 350, whatsapp: 150 },
};

export function Subscription() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedChannels, setSelectedChannels] = useState({
    telephone: true,
    whatsapp: true,
    web: true, // toujours inclus
  });

  const getAdjustedPrice = (plan: typeof plans[0]) => {
    let price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    const discounts = channelDiscounts[plan.id as keyof typeof channelDiscounts];

    if (!selectedChannels.telephone) {
      price -= billingCycle === 'monthly' ? discounts.telephone : discounts.telephone * 10;
    }
    if (!selectedChannels.whatsapp) {
      price -= billingCycle === 'monthly' ? discounts.whatsapp : discounts.whatsapp * 10;
    }

    return price;
  };

  const formatQuota = (value: number) => {
    if (value === -1) return 'Illimité';
    return value.toLocaleString();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mon Abonnement</h1>
        <p className="text-sm text-gray-500">
          Gerez votre plan et vos quotas
        </p>
      </div>

      <div className="max-w-6xl mx-auto">

      {/* Current Plan Status */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">Plan actuel</span>
              <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 text-xs font-medium rounded">
                {currentPlan.name}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Prochain renouvellement: {currentPlan.nextBilling}
            </p>
          </div>

          {/* Usage Bars */}
          <div className="flex-1 max-w-lg space-y-3">
            {/* Téléphone */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Phone className="w-3 h-3" />
                  Téléphone
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentPlan.usage.telephone.used} / {currentPlan.usage.telephone.limit} min
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${(currentPlan.usage.telephone.used / currentPlan.usage.telephone.limit) * 100}%` }}
                />
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <MessageCircle className="w-3 h-3" />
                  WhatsApp
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentPlan.usage.whatsapp.used} / {currentPlan.usage.whatsapp.limit} msg
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${(currentPlan.usage.whatsapp.used / currentPlan.usage.whatsapp.limit) * 100}%` }}
                />
              </div>
            </div>

            {/* Web */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Globe className="w-3 h-3" />
                  Web Chat
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentPlan.usage.web.used} / {currentPlan.usage.web.limit} msg
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all"
                  style={{ width: `${(currentPlan.usage.web.used / currentPlan.usage.web.limit) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dépassements */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dépassements: <span className="font-medium">0.50€/min</span> téléphone · <span className="font-medium">0.05€/msg</span> WhatsApp
          </p>
        </div>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              billingCycle === 'yearly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Annuel
            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium rounded">
              2 mois offerts
            </span>
          </button>
        </div>
      </div>

      {/* Channel Selection */}
      <div className="flex justify-center gap-4 mb-8">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedChannels.telephone}
            onChange={(e) => setSelectedChannels(prev => ({ ...prev, telephone: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
          />
          <Phone className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Téléphone</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedChannels.whatsapp}
            onChange={(e) => setSelectedChannels(prev => ({ ...prev, whatsapp: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
          />
          <MessageCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">WhatsApp</span>
        </label>
        <div className="flex items-center gap-2 opacity-50">
          <input type="checkbox" checked disabled className="w-4 h-4 rounded" />
          <Globe className="w-4 h-4 text-cyan-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Web (inclus)</span>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const price = getAdjustedPrice(plan);
          const isCurrentPlan = plan.id === currentPlan.id;

          return (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-gray-900 rounded-xl border-2 transition-all ${
                plan.highlighted
                  ? 'border-cyan-500 shadow-lg shadow-cyan-500/10'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-cyan-500 text-white text-xs font-medium rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${
                    plan.highlighted ? 'bg-cyan-100 dark:bg-cyan-900/30' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      plan.highlighted ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {price}€
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      /{billingCycle === 'monthly' ? 'mois' : 'an'}
                    </span>
                  </div>
                  {(!selectedChannels.telephone || !selectedChannels.whatsapp) && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Configuration personnalisée
                    </p>
                  )}
                </div>

                {/* Quotas summary */}
                <div className="flex gap-2 mb-4 text-xs">
                  {selectedChannels.telephone && (
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                      {formatQuota(plan.quotas.telephone)} min
                    </span>
                  )}
                  {selectedChannels.whatsapp && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      {formatQuota(plan.quotas.whatsapp)} msg
                    </span>
                  )}
                  <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded">
                    {formatQuota(plan.quotas.web)} web
                  </span>
                </div>

                <button
                  disabled={isCurrentPlan}
                  className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
                    isCurrentPlan
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                      : plan.highlighted
                        ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                        : 'bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900'
                  }`}
                >
                  {isCurrentPlan ? 'Plan actuel' : 'Choisir ce plan'}
                </button>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => {
                      const isDisabled =
                        (!selectedChannels.telephone && feature.includes('Téléphone')) ||
                        (!selectedChannels.whatsapp && feature.includes('WhatsApp'));

                      return (
                        <li key={index} className={`flex items-start gap-2 ${isDisabled ? 'opacity-40' : ''}`}>
                          {isDisabled ? (
                            <Minus className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          )}
                          <span className="text-sm text-gray-600 dark:text-gray-400">{feature}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Agents Info */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <Bot className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Agents IA personnalisables
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choisissez les canaux dont vous avez besoin. Tous les agents IA sont entraînés
              sur votre activité et peuvent prendre des réservations, répondre aux questions,
              et assister vos clients 24h/24.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <span className="text-gray-700 dark:text-gray-300">Standard téléphonique IA</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">WhatsApp Business</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-600" />
                <span className="text-gray-700 dark:text-gray-300">Widget site web</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing Info */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Facturation</h2>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Méthode de paiement
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
                    VISA
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">•••• 4242</span>
                </div>
                <button className="text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                  Modifier
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Prochaine facturation
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">{currentPlan.nextBilling}</p>
                  <p className="text-xs text-gray-500">199€ HT</p>
                </div>
                <button className="text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  Factures
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          Des questions?{' '}
          <a href="#" className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
            Contactez-nous
          </a>
          {' '}ou consultez notre{' '}
          <a href="#" className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
            FAQ tarification
          </a>
        </p>
      </div>
      </div>
    </div>
  );
}

export default Subscription;
