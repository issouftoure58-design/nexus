/**
 * Subscription - Page de gestion abonnement
 *
 * Features:
 * - Affichage plan actuel
 * - Comparatif des 3 plans (Starter/Pro/Business)
 * - Modules additionnels
 * - Infos facturation
 */

import { useTenant, PlanType } from '@/hooks/useTenant';
import {
  Check,
  X,
  Crown,
  Zap,
  Building2,
  CreditCard,
  Calendar,
  Download,
  Sparkles,
  Shield,
  Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface PlanFeature {
  name: string;
  starter: boolean | string;
  pro: boolean | string;
  business: boolean | string;
}

interface AddOnModule {
  id: string;
  name: string;
  description: string;
  price: number;
  requiredPlan: PlanType;
  icon: React.ElementType;
}

// ══════════════════════════════════════════════════════════════════════════════
// PLANS DATA
// ══════════════════════════════════════════════════════════════════════════════

const PLANS: Record<PlanType, {
  name: string;
  price: number;
  description: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  popular?: boolean;
}> = {
  starter: {
    name: 'Starter',
    price: 99,
    description: 'Parfait pour démarrer votre activité',
    icon: Zap,
    color: 'gray',
    gradient: 'from-gray-500 to-gray-600',
  },
  pro: {
    name: 'Pro',
    price: 199,
    description: 'Pour les professionnels qui veulent grandir',
    icon: Rocket,
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    popular: true,
  },
  business: {
    name: 'Business',
    price: 399,
    description: 'Solution complète pour les entreprises',
    icon: Crown,
    color: 'yellow',
    gradient: 'from-yellow-500 to-orange-500',
  },
};

const FEATURES: PlanFeature[] = [
  { name: 'Gestion clients', starter: true, pro: true, business: true },
  { name: 'Réservations en ligne', starter: true, pro: true, business: true },
  { name: 'Facturation simple', starter: true, pro: true, business: true },
  { name: 'Limite clients', starter: '1 000', pro: '3 000', business: 'Illimité' },
  { name: 'Stockage', starter: '2 Go', pro: '10 Go', business: '50 Go' },
  { name: 'Support', starter: 'Email', pro: 'Prioritaire', business: 'Dédié 24/7' },
  { name: 'CRM avancé & Segments', starter: false, pro: true, business: true },
  { name: 'Analytics & Tableaux de bord', starter: false, pro: true, business: true },
  { name: 'Comptabilité complète', starter: false, pro: true, business: true },
  { name: 'Gestion stock', starter: false, pro: true, business: true },
  { name: 'Workflows automatisés', starter: false, pro: true, business: true },
  { name: 'Pipeline marketing', starter: false, pro: true, business: true },
  { name: 'IA Admin Assistant', starter: false, pro: true, business: true },
  { name: 'SEO & Contenu IA', starter: false, pro: false, business: true },
  { name: 'Anti-Churn Prevention', starter: false, pro: false, business: true },
  { name: 'SENTINEL Intelligence', starter: false, pro: false, business: true },
  { name: 'Gestion RH & équipe', starter: false, pro: false, business: true },
  { name: 'Account Manager dédié', starter: false, pro: false, business: true },
];

const ADDON_MODULES: AddOnModule[] = [
  {
    id: 'agent_ia_web',
    name: 'Agent IA Web Chat',
    description: 'Assistant conversationnel sur votre site web',
    price: 19,
    requiredPlan: 'starter',
    icon: Sparkles,
  },
  {
    id: 'agent_ia_whatsapp',
    name: 'Agent IA WhatsApp',
    description: 'Réponses automatiques sur WhatsApp Business',
    price: 49,
    requiredPlan: 'starter',
    icon: Sparkles,
  },
  {
    id: 'agent_ia_telephone',
    name: 'Agent IA Téléphone',
    description: 'Standard téléphonique automatisé',
    price: 79,
    requiredPlan: 'pro',
    icon: Shield,
  },
  {
    id: 'salon',
    name: 'Module Salon/Beauté',
    description: 'Gestion spécialisée pour salons de coiffure et beauté',
    price: 49,
    requiredPlan: 'starter',
    icon: Sparkles,
  },
  {
    id: 'restaurant',
    name: 'Module Restaurant',
    description: 'Gestion spécialisée pour restaurants et traiteurs',
    price: 49,
    requiredPlan: 'starter',
    icon: Building2,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function Subscription() {
  const { plan, modules, hasPlan, name: tenantName, isLoading } = useTenant();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const currentPlan = PLANS[plan];

  // Calculer le prix annuel avec réduction
  const getPrice = (basePrice: number) => {
    if (billingPeriod === 'yearly') {
      return Math.round(basePrice * 10); // 2 mois gratuits
    }
    return basePrice;
  };

  const handleUpgrade = (targetPlan: PlanType) => {
    // TODO: Intégrer Stripe
    console.log(`Upgrade to ${targetPlan}`);
    alert(`Redirection vers Stripe pour upgrade vers ${PLANS[targetPlan].name}...`);
  };

  const handleToggleModule = (moduleId: string) => {
    // TODO: Intégrer activation module
    console.log(`Toggle module ${moduleId}`);
    alert(`Activation/désactivation du module ${moduleId}...`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Abonnement & Facturation
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Gérez votre abonnement NEXUS et découvrez nos options pour faire grandir votre activité
          </p>
        </div>

        {/* Plan actuel */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center',
                `bg-gradient-to-br ${currentPlan.gradient}`
              )}>
                <currentPlan.icon className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Plan actuel</p>
                <h2 className="text-2xl font-bold text-gray-900">{currentPlan.name}</h2>
                <p className="text-gray-600">{tenantName}</p>
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900">{currentPlan.price}€</span>
              <span className="text-gray-500">/mois</span>
            </div>

            {plan !== 'business' && (
              <button
                onClick={() => handleUpgrade(plan === 'starter' ? 'pro' : 'business')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Crown className="w-5 h-5" />
                Passer à {plan === 'starter' ? 'Pro' : 'Business'}
              </button>
            )}
          </div>
        </div>

        {/* Toggle période */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-full p-1 shadow-md inline-flex">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={cn(
                'px-6 py-2 rounded-full font-medium transition-all',
                billingPeriod === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={cn(
                'px-6 py-2 rounded-full font-medium transition-all flex items-center gap-2',
                billingPeriod === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Annuel
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                -17%
              </span>
            </button>
          </div>
        </div>

        {/* Grille des plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {(['starter', 'pro', 'business'] as PlanType[]).map((planKey) => {
            const planInfo = PLANS[planKey];
            const isCurrentPlan = plan === planKey;
            const canUpgrade = !hasPlan(planKey);
            const Icon = planInfo.icon;

            return (
              <div
                key={planKey}
                className={cn(
                  'bg-white rounded-2xl shadow-lg overflow-hidden transition-all',
                  planInfo.popular && 'ring-2 ring-blue-500 scale-105',
                  isCurrentPlan && 'ring-2 ring-green-500'
                )}
              >
                {/* Badge populaire */}
                {planInfo.popular && (
                  <div className="bg-blue-500 text-white text-center py-2 text-sm font-semibold">
                    Le plus populaire
                  </div>
                )}

                {/* Header */}
                <div className={cn(
                  'p-6 text-center',
                  `bg-gradient-to-br ${planInfo.gradient} text-white`
                )}>
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{planInfo.name}</h3>
                  <p className="text-white/80 text-sm">{planInfo.description}</p>
                </div>

                {/* Prix */}
                <div className="p-6 text-center border-b">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-gray-900">
                      {getPrice(planInfo.price)}€
                    </span>
                    <span className="text-gray-500">
                      /{billingPeriod === 'yearly' ? 'an' : 'mois'}
                    </span>
                  </div>
                  {billingPeriod === 'yearly' && (
                    <p className="text-sm text-green-600 mt-1">
                      Économisez {planInfo.price * 2}€/an
                    </p>
                  )}
                </div>

                {/* Features highlight */}
                <div className="p-6">
                  <ul className="space-y-3">
                    {FEATURES.slice(0, 8).map((feature, i) => {
                      const value = feature[planKey];
                      const hasFeature = value === true || typeof value === 'string';

                      return (
                        <li key={i} className="flex items-center gap-3">
                          {hasFeature ? (
                            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <Check className="w-3 h-3 text-green-600" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <X className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                          <span className={cn(
                            'text-sm',
                            hasFeature ? 'text-gray-700' : 'text-gray-400'
                          )}>
                            {feature.name}
                            {typeof value === 'string' && (
                              <span className="font-semibold ml-1">({value})</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* CTA */}
                <div className="p-6 pt-0">
                  {isCurrentPlan ? (
                    <div className="w-full py-3 text-center bg-green-100 text-green-700 font-semibold rounded-xl">
                      Plan actuel
                    </div>
                  ) : canUpgrade ? (
                    <button
                      onClick={() => handleUpgrade(planKey)}
                      className={cn(
                        'w-full py-3 font-semibold rounded-xl transition-all',
                        `bg-gradient-to-r ${planInfo.gradient} text-white hover:opacity-90`
                      )}
                    >
                      Passer à {planInfo.name}
                    </button>
                  ) : (
                    <div className="w-full py-3 text-center bg-gray-100 text-gray-500 font-medium rounded-xl">
                      Inclus dans votre plan
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparatif complet */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-12">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Comparatif détaillé</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Fonctionnalité</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-500">Starter</th>
                  <th className="text-center py-4 px-6 font-semibold text-blue-600">Pro</th>
                  <th className="text-center py-4 px-6 font-semibold text-yellow-600">Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {FEATURES.map((feature, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-4 px-6 text-gray-700">{feature.name}</td>
                    {(['starter', 'pro', 'business'] as PlanType[]).map((planKey) => {
                      const value = feature[planKey];
                      return (
                        <td key={planKey} className="text-center py-4 px-6">
                          {value === true ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : value === false ? (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          ) : (
                            <span className="font-medium text-gray-900">{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modules additionnels */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-12">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Modules additionnels</h2>
            <p className="text-gray-600 mt-1">
              Ajoutez des fonctionnalités spécialisées à votre abonnement
            </p>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ADDON_MODULES.map((module) => {
                const isActive = modules[module.id] === true;
                const canActivate = hasPlan(module.requiredPlan);
                const Icon = module.icon;

                return (
                  <div
                    key={module.id}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all',
                      isActive
                        ? 'border-green-500 bg-green-50'
                        : canActivate
                          ? 'border-gray-200 hover:border-blue-300'
                          : 'border-gray-100 bg-gray-50 opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-lg font-bold text-gray-900">{module.price}€/mois</span>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-1">{module.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">{module.description}</p>

                    {!canActivate ? (
                      <div className="text-xs text-gray-500">
                        Requiert le plan {PLANS[module.requiredPlan].name}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleToggleModule(module.id)}
                        className={cn(
                          'w-full py-2 rounded-lg font-medium transition-all text-sm',
                          isActive
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        )}
                      >
                        {isActive ? 'Désactiver' : 'Activer'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Facturation */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Facturation</h2>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Méthode de paiement */}
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="w-5 h-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Méthode de paiement</h3>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
                      VISA
                    </div>
                    <span className="text-gray-700">•••• •••• •••• 4242</span>
                  </div>
                  <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    Modifier
                  </button>
                </div>
              </div>

              {/* Prochaine facturation */}
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Prochaine facturation</h3>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-900 font-medium">15 mars 2024</p>
                    <p className="text-gray-500 text-sm">{currentPlan.price}€ HT</p>
                  </div>
                  <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    Factures
                  </button>
                </div>
              </div>
            </div>

            {/* Historique */}
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Historique des paiements</h3>
              <div className="space-y-3">
                {[
                  { date: '15 février 2024', amount: currentPlan.price, status: 'Payé' },
                  { date: '15 janvier 2024', amount: currentPlan.price, status: 'Payé' },
                  { date: '15 décembre 2023', amount: currentPlan.price, status: 'Payé' },
                ].map((payment, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-gray-700">{payment.date}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-900">{payment.amount}€</span>
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                        {payment.status}
                      </span>
                      <button className="text-gray-400 hover:text-gray-600">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer aide */}
        <div className="mt-8 text-center text-gray-500">
          <p>
            Des questions sur votre abonnement ?{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
              Contactez notre support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Subscription;
