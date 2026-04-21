import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { useTenantContext } from '@/contexts/TenantContext';
import { Lock, ArrowRight, X } from 'lucide-react';

export interface IAChannelConfig {
  web: boolean;
  whatsapp: boolean;
  telephone: boolean;
}

interface Props {
  channels: IAChannelConfig;
  onChange: (channels: IAChannelConfig) => void;
}

type PlanType = 'free' | 'basic' | 'business';

const CHANNELS = [
  {
    key: 'web' as const,
    label: 'Agent IA Web',
    description: 'Chatbot IA 24/7 intégré sur votre site web (consomme des crédits)',
    emoji: '🌐',
    plan: 'starter' as PlanType,
  },
  {
    key: 'whatsapp' as const,
    label: 'Agent IA WhatsApp',
    description: 'Assistant IA sur WhatsApp pour vos clients (consomme des crédits)',
    emoji: '📱',
    plan: 'starter' as PlanType,
  },
  {
    key: 'telephone' as const,
    label: 'Agent IA Téléphone',
    description: 'Assistant vocal IA pour les appels entrants (consomme des crédits)',
    emoji: '📞',
    plan: 'starter' as PlanType,
  },
];

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  basic: 'Starter',
};

export default function ConfigIAChannels({ channels, onChange }: Props) {
  const { hasPlan } = useTenantContext();
  const navigate = useNavigate();
  const [upgradePrompt, setUpgradePrompt] = useState<{ channel: string; requiredPlan: PlanType } | null>(null);

  const toggle = (key: keyof IAChannelConfig, requiredPlan: PlanType) => {
    // Check if user has the required plan
    if (!hasPlan(requiredPlan)) {
      setUpgradePrompt({ channel: CHANNELS.find(c => c.key === key)?.label || key, requiredPlan });
      return;
    }
    onChange({ ...channels, [key]: !channels[key] });
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">Canaux IA</h3>
      <p className="text-sm text-gray-500">
        Activez les assistants IA pour répondre à vos clients 24/7. Configurable après l'onboarding.
      </p>

      <div className="space-y-2">
        {CHANNELS.map(ch => {
          const hasAccess = hasPlan(ch.plan);
          return (
            <div
              key={ch.key}
              className={`flex items-center justify-between p-3 rounded-lg ${hasAccess ? 'bg-gray-50' : 'bg-gray-50/60'}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{ch.emoji}</span>
                <div>
                  <div className={`font-medium text-sm ${hasAccess ? 'text-gray-900' : 'text-gray-500'}`}>
                    {ch.label}
                  </div>
                  <div className="text-xs text-gray-500">{ch.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!hasAccess && (
                  <button
                    onClick={() => setUpgradePrompt({ channel: ch.label, requiredPlan: ch.plan })}
                    className="flex items-center gap-1 text-xs bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 px-2.5 py-1 rounded-full font-medium hover:from-blue-200 hover:to-cyan-200 transition-colors cursor-pointer"
                  >
                    <Lock className="w-3 h-3" />
                    {PLAN_LABELS[ch.plan]}
                  </button>
                )}
                <Switch
                  checked={channels[ch.key]}
                  onCheckedChange={() => toggle(ch.key, ch.plan)}
                  disabled={!hasAccess}
                  className={!hasAccess ? 'opacity-40 cursor-not-allowed' : ''}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Upgrade prompt modal */}
      {upgradePrompt && (
        <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-blue-900 text-sm">
                  Fonctionnalité {PLAN_LABELS[upgradePrompt.requiredPlan]}
                </span>
              </div>
              <p className="text-sm text-blue-800">
                <strong>{upgradePrompt.channel}</strong> est disponible avec le plan{' '}
                <strong>{PLAN_LABELS[upgradePrompt.requiredPlan]}</strong>.
                Passez au plan supérieur pour débloquer cette fonctionnalité.
              </p>
              <button
                onClick={() => {
                  setUpgradePrompt(null);
                  navigate('/subscription');
                }}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-4 py-1.5 rounded-lg transition-colors"
              >
                Voir les plans <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => setUpgradePrompt(null)}
              className="text-blue-400 hover:text-blue-600 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
