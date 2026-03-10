import { Switch } from '@/components/ui/switch';

export interface IAChannelConfig {
  web: boolean;
  whatsapp: boolean;
  telephone: boolean;
}

interface Props {
  channels: IAChannelConfig;
  onChange: (channels: IAChannelConfig) => void;
}

const CHANNELS = [
  {
    key: 'web' as const,
    label: 'Agent IA Web',
    description: 'Chatbot IA 24/7 intégré sur votre site web',
    emoji: '🌐',
    plan: 'starter',
  },
  {
    key: 'whatsapp' as const,
    label: 'Agent IA WhatsApp',
    description: 'Assistant IA sur WhatsApp pour vos clients',
    emoji: '📱',
    plan: 'pro',
  },
  {
    key: 'telephone' as const,
    label: 'Agent IA Téléphone',
    description: 'Assistant vocal IA pour les appels entrants',
    emoji: '📞',
    plan: 'pro',
  },
];

export default function ConfigIAChannels({ channels, onChange }: Props) {
  const toggle = (key: keyof IAChannelConfig) => {
    onChange({ ...channels, [key]: !channels[key] });
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">Canaux IA</h3>
      <p className="text-sm text-gray-500">
        Activez les assistants IA pour répondre à vos clients 24/7. Configurable après l'onboarding.
      </p>

      <div className="space-y-2">
        {CHANNELS.map(ch => (
          <div
            key={ch.key}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ch.emoji}</span>
              <div>
                <div className="font-medium text-sm text-gray-900">{ch.label}</div>
                <div className="text-xs text-gray-500">{ch.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ch.plan !== 'starter' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {ch.plan === 'pro' ? 'Pro' : 'Business'}
                </span>
              )}
              <Switch
                checked={channels[ch.key]}
                onCheckedChange={() => toggle(ch.key)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
