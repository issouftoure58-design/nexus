/**
 * ModuleGate - Bloque l'accès aux modules selon plan/modules
 *
 * Usage:
 *   <ModuleGate requiredPlan="pro">
 *     <CRMPage />
 *   </ModuleGate>
 *
 *   <ModuleGate module="salon">
 *     <SalonFeature />
 *   </ModuleGate>
 */

import { useTenant, PlanType } from '@/hooks/useTenant';
import { Lock, Zap, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface ModuleGateProps {
  /** Module optionnel requis */
  module?: string;
  /** Plan minimum requis */
  requiredPlan?: PlanType;
  /** Titre personnalisé pour le module */
  moduleTitle?: string;
  /** Description personnalisée */
  moduleDescription?: string;
  /** Enfants à afficher si accès autorisé */
  children: React.ReactNode;
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAN INFO
// ══════════════════════════════════════════════════════════════════════════════

const PLAN_INFO: Record<PlanType, { name: string; color: string; price: number }> = {
  starter: { name: 'Starter', color: 'gray', price: 199 },
  pro: { name: 'Pro', color: 'blue', price: 399 },
  business: { name: 'Business', color: 'yellow', price: 799 },
};

const PLAN_FEATURES: Record<PlanType, string[]> = {
  starter: [
    'Gestion clients et services',
    'Réservations en ligne',
    'Facturation simple',
    'Support email',
  ],
  pro: [
    'Tout Starter +',
    'CRM avancé & Segments',
    'Analytics & Tableaux de bord',
    'Comptabilité complète',
    'Marketing automation',
    'Support prioritaire',
  ],
  business: [
    'Tout Pro +',
    'SEO & Contenu IA',
    'Churn Prevention',
    'SENTINEL Intelligence',
    'RH & Gestion équipe',
    'Account Manager dédié',
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function ModuleGate({
  module,
  requiredPlan,
  moduleTitle,
  moduleDescription,
  children,
}: ModuleGateProps) {
  const { plan, hasPlan, hasModule } = useTenant();

  // Vérif plan minimum
  if (requiredPlan && !hasPlan(requiredPlan)) {
    const planInfo = PLAN_INFO[requiredPlan];
    const features = PLAN_FEATURES[requiredPlan];

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          {/* Card principale */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-8 py-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Lock className="w-10 h-10 text-white/80" />
              </div>

              <h2 className="text-3xl font-bold text-white mb-3">
                {moduleTitle || `Module ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}`}
              </h2>

              <p className="text-white/70 text-lg max-w-md mx-auto">
                {moduleDescription || `Cette fonctionnalité est disponible avec le plan ${planInfo.name}`}
              </p>
            </div>

            {/* Content */}
            <div className="p-8">
              {/* Plan actuel */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
                <div>
                  <p className="text-sm text-gray-500">Votre plan actuel</p>
                  <p className="font-semibold text-gray-900">{PLAN_INFO[plan].name}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
                <div className="text-right">
                  <p className="text-sm text-gray-500">Plan requis</p>
                  <p className="font-semibold text-blue-600">{planInfo.name}</p>
                </div>
              </div>

              {/* Features du plan requis */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  Inclus dans {planInfo.name}
                </h3>
                <ul className="space-y-3">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Prix */}
              <div className="text-center mb-6">
                <div className="inline-flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{planInfo.price}€</span>
                  <span className="text-gray-500">/mois</span>
                </div>
              </div>

              {/* CTA */}
              <Link
                to="/subscription"
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Crown className="w-6 h-6" />
                Passer à {planInfo.name}
              </Link>

              <p className="text-center text-sm text-gray-500 mt-4">
                Annulation possible à tout moment. Sans engagement.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vérif module optionnel activé
  if (module && !hasModule(module)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Lock className="w-10 h-10 text-gray-400" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {moduleTitle || `Module ${module.charAt(0).toUpperCase() + module.slice(1)}`}
          </h2>

          <p className="text-xl text-gray-600 mb-8">
            {moduleDescription || "Ce module n'est pas activé pour votre compte"}
          </p>

          <Link
            to="/subscription"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Zap className="w-6 h-6" />
            Activer ce module
          </Link>

          <p className="mt-6 text-sm text-gray-500">
            Plan actuel : <span className="font-semibold">{PLAN_INFO[plan].name}</span>
          </p>
        </div>
      </div>
    );
  }

  // Accès autorisé
  return <>{children}</>;
}

export default ModuleGate;
