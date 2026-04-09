/**
 * ModuleGate - Bloque l'accès aux modules selon plan/modules
 *
 * Usage:
 *   <ModuleGate requiredPlan="basic">
 *     <CRMPage />
 *   </ModuleGate>
 *
 *   <ModuleGate module="salon">
 *     <SalonFeature />
 *   </ModuleGate>
 */

import { useState } from 'react';
import { useTenant, PlanType, normalizePlan } from '@/hooks/useTenant';
import { Lock, Zap, Crown, Sparkles, ArrowRight, Send, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

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

// Modele 2026 — revision finale 9 avril 2026 (voir memory/business-model-2026.md)
const PLAN_INFO: Record<'free' | 'basic' | 'business', { name: string; color: string; price: number }> = {
  free: { name: 'Free', color: 'gray', price: 0 },
  basic: { name: 'Basic', color: 'cyan', price: 29 },
  business: { name: 'Business', color: 'purple', price: 149 },
};

const PLAN_FEATURES: Record<'free' | 'basic' | 'business', string[]> = {
  free: [
    '10 réservations / mois',
    '10 factures / mois (avec watermark)',
    '30 clients max dans le CRM',
    'Tous les modules visibles (lecture)',
    'Support email',
  ],
  basic: [
    'Réservations illimitées',
    'Facturation illimitée (sans watermark)',
    'CRM, Équipe, Fidélité, Comptabilité, RH, Stock',
    'Workflows, Pipeline, Devis, SEO',
    '1 000 crédits IA inclus chaque mois (valeur 15€)',
    'Support email prioritaire',
  ],
  business: [
    'Tout Basic +',
    'Multi-sites illimités',
    'White-label (logo + domaine custom)',
    'API + Webhooks + SSO entreprise',
    '10 000 crédits IA inclus chaque mois (valeur 150€)',
    'Account Manager dédié + support prioritaire 1h',
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
    const normalizedRequired = normalizePlan(requiredPlan);
    const planInfo = PLAN_INFO[normalizedRequired];
    const features = PLAN_FEATURES[normalizedRequired];

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
                {moduleTitle || `Module ${normalizedRequired.charAt(0).toUpperCase() + normalizedRequired.slice(1)}`}
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
                  <p className="font-semibold text-gray-900">{PLAN_INFO[normalizePlan(plan)].name}</p>
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
    const hasRequiredPlan = hasPlan('basic');

    // Modules self-service (pas de numéro OVH nécessaire) → activation directe
    const SELF_SERVICE_MODULES = ['agent_ia_web'];
    const isSelfService = SELF_SERVICE_MODULES.includes(module);

    if (hasRequiredPlan && isSelfService) {
      return (
        <SelfServiceActivation
          module={module}
          moduleTitle={moduleTitle}
          plan={plan}
        />
      );
    }

    // Modules nécessitant un numéro OVH → demande d'activation manuelle
    if (hasRequiredPlan) {
      return (
        <ModuleActivationRequest
          module={module}
          moduleTitle={moduleTitle}
          plan={plan}
        />
      );
    }

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
            {moduleDescription || "Ce module nécessite un plan Basic ou Business"}
          </p>

          <Link
            to="/subscription"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Crown className="w-6 h-6" />
            Passer en Basic — 29€/mois
          </Link>

          <p className="mt-6 text-sm text-gray-500">
            Plan actuel : <span className="font-semibold">{PLAN_INFO[normalizePlan(plan)].name}</span>
          </p>
        </div>
      </div>
    );
  }

  // Accès autorisé
  return <>{children}</>;
}

// ══════════════════════════════════════════════════════════════════════════════
// SELF-SERVICE ACTIVATION — Pour modules sans provisioning (Web Chat)
// ══════════════════════════════════════════════════════════════════════════════

function SelfServiceActivation({
  module,
  moduleTitle,
  plan,
}: {
  module: string;
  moduleTitle?: string;
  plan: PlanType;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const { refetch } = useTenant();

  const handleActivate = async () => {
    setStatus('loading');
    try {
      await api.post(`/modules/${module}/activate`);
      await refetch();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Erreur lors de l'activation");
      setStatus('error');
    }
  };

  const info = MODULE_LABELS[module] || {
    name: moduleTitle || module,
    description: 'Module IA disponible immédiatement.',
    icon: '⚡',
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 px-8 py-10 text-center">
            <div className="text-5xl mb-4">{info.icon}</div>
            <h2 className="text-2xl font-bold text-white mb-2">{info.name}</h2>
            <p className="text-white/80">{info.description}</p>
          </div>

          <div className="p-8 text-center">
            {status === 'idle' && (
              <>
                <p className="text-gray-600 mb-6">
                  Ce module est disponible avec votre plan {PLAN_INFO[normalizePlan(plan)].name}. Activez-le en un clic.
                </p>
                <button
                  onClick={handleActivate}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-lg font-semibold rounded-xl hover:from-emerald-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <Zap className="w-5 h-5" />
                  Activer maintenant
                </button>
                <p className="text-sm text-gray-500 mt-3">Activation instantanée — consomme des crédits IA</p>
              </>
            )}

            {status === 'loading' && (
              <div className="py-8">
                <Loader2 className="w-10 h-10 text-cyan-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Activation en cours...</p>
              </div>
            )}

            {status === 'error' && (
              <>
                <p className="text-red-600 mb-4">{errorMsg}</p>
                <button onClick={() => setStatus('idle')} className="text-cyan-600 font-medium hover:underline">
                  Réessayer
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE ACTIVATION REQUEST — Formulaire de demande pour tenants Basic/Business
// ══════════════════════════════════════════════════════════════════════════════

const MODULE_LABELS: Record<string, { name: string; description: string; icon: string }> = {
  agent_ia_web: {
    name: 'Agent IA Web',
    description: 'Chatbot IA sur votre site web qui répond à vos clients 24/7, prend des RDV et répond aux questions.',
    icon: '💬',
  },
  agent_ia_whatsapp: {
    name: 'Agent IA WhatsApp',
    description: 'Assistant WhatsApp IA qui répond instantanément à vos clients, prend des RDV et envoie des confirmations.',
    icon: '📱',
  },
  agent_ia_telephone: {
    name: 'Agent IA Téléphone',
    description: 'Standard téléphonique IA qui répond à vos appels 24/7, prend des RDV et transfère vers un humain si nécessaire.',
    icon: '📞',
  },
  whatsapp: {
    name: 'WhatsApp IA',
    description: 'Assistant WhatsApp IA pour vos clients.',
    icon: '📱',
  },
  telephone: {
    name: 'Téléphone IA',
    description: 'Standard téléphonique IA 24/7.',
    icon: '📞',
  },
};

// Map module names to API module IDs
const MODULE_TO_API_ID: Record<string, string> = {
  agent_ia_web: 'web_chat_ia',
  agent_ia_whatsapp: 'whatsapp_ia',
  agent_ia_telephone: 'telephone_ia',
  whatsapp: 'whatsapp_ia',
  telephone: 'telephone_ia',
};

function ModuleActivationRequest({
  module,
  moduleTitle,
  plan,
}: {
  module: string;
  moduleTitle?: string;
  plan: PlanType;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'already' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const info = MODULE_LABELS[module] || {
    name: moduleTitle || module.charAt(0).toUpperCase() + module.slice(1),
    description: "Ce module nécessite une activation par l'équipe NEXUS.",
    icon: '⚡',
  };

  const handleRequest = async () => {
    setStatus('loading');
    try {
      const apiModuleId = MODULE_TO_API_ID[module] || module;
      await api.post('/quotas/request-activation', { moduleId: apiModuleId });
      setStatus('sent');
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 409) {
        setStatus('already');
      } else {
        setErrorMsg(error.message || 'Erreur lors de la demande');
        setStatus('error');
      }
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-8 py-10 text-center">
            <div className="text-5xl mb-4">{info.icon}</div>
            <h2 className="text-2xl font-bold text-white mb-2">{info.name}</h2>
            <p className="text-white/80">{info.description}</p>
          </div>

          {/* Content */}
          <div className="p-8">
            {status === 'idle' && (
              <>
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-blue-900 mb-2">Comment ça marche ?</h3>
                  <ol className="text-sm text-blue-800 space-y-2">
                    <li className="flex gap-2">
                      <span className="font-bold text-blue-600">1.</span>
                      Vous cliquez sur "Demander l'activation"
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold text-blue-600">2.</span>
                      Notre équipe configure votre numéro dédié (06/07)
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold text-blue-600">3.</span>
                      Vous recevez une notification quand c'est prêt
                    </li>
                  </ol>
                  <p className="text-xs text-blue-600 mt-3">Délai habituel : 24-48h ouvrées</p>
                </div>

                <button
                  onClick={handleRequest}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-lg font-semibold rounded-xl hover:from-cyan-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <Send className="w-5 h-5" />
                  Demander l'activation
                </button>
              </>
            )}

            {status === 'loading' && (
              <div className="text-center py-8">
                <Loader2 className="w-10 h-10 text-cyan-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Envoi de la demande...</p>
              </div>
            )}

            {status === 'sent' && (
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Demande envoyée !</h3>
                <p className="text-gray-600 mb-4">
                  Notre équipe a été notifiée. Nous configurons votre {info.name} dans les plus brefs délais.
                </p>
                <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800">
                  Vous recevrez un email de confirmation une fois le module activé.
                </div>
              </div>
            )}

            {status === 'already' && (
              <div className="text-center py-4">
                <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Demande déjà en cours</h3>
                <p className="text-gray-600">
                  Votre demande d'activation pour {info.name} est en cours de traitement. Notre équipe s'en occupe.
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Erreur</h3>
                <p className="text-gray-600 mb-4">{errorMsg}</p>
                <button
                  onClick={() => setStatus('idle')}
                  className="text-cyan-600 font-medium hover:underline"
                >
                  Réessayer
                </button>
              </div>
            )}

            <p className="text-center text-sm text-gray-500 mt-6">
              Plan actuel : <span className="font-semibold">{PLAN_INFO[normalizePlan(plan)].name}</span>
              {' · '}Consomme des crédits IA
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModuleGate;
