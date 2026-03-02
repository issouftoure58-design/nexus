import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import {
  Phone,
  Settings,
  Volume2,
  MessageSquare,
  Play,
  Save,
  RefreshCw,
  AlertCircle,
  Mic,
  Clock,
  User
} from 'lucide-react';

interface IAConfig {
  id?: string;
  greeting_message: string;
  voice_style: string;
  tone: string;
  language: string;
  transfer_phone: string;
  max_duration_seconds: number;
  business_hours: {
    enabled: boolean;
    message_outside_hours: string;
  };
  personality: string;
  services_description: string;
  booking_enabled: boolean;
  active: boolean;
}

const DEFAULT_CONFIG: IAConfig = {
  greeting_message: "Bonjour ! Je suis l'assistante virtuelle. Comment puis-je vous aider ?",
  voice_style: 'polly_lea',
  tone: 'professionnel',
  language: 'fr-FR',
  transfer_phone: '',
  max_duration_seconds: 300,
  business_hours: {
    enabled: false,
    message_outside_hours: "Nous sommes actuellement fermés. Veuillez rappeler pendant nos heures d'ouverture."
  },
  personality: 'Assistante professionnelle et chaleureuse',
  services_description: '',
  booking_enabled: true,
  active: true
};

const VOICE_OPTIONS = [
  { value: 'polly_lea', label: 'Lea (Française, naturelle)' },
  { value: 'polly_celine', label: 'Celine (Française, formelle)' },
  { value: 'polly_mathieu', label: 'Mathieu (Français, masculin)' },
  { value: 'elevenlabs', label: 'ElevenLabs (Premium)' },
];

const TONE_OPTIONS = [
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'chaleureux', label: 'Chaleureux' },
  { value: 'decontracte', label: 'Decontracte' },
  { value: 'formel', label: 'Formel' },
];

export default function IATelephone() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<IAConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ia-telephone-config'],
    queryFn: () => api.get<{ config: IAConfig }>('/admin/ia/telephone/config'),
  });

  useEffect(() => {
    if (data?.config) {
      setConfig({ ...DEFAULT_CONFIG, ...data.config });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (data: IAConfig) => api.put('/admin/ia/telephone/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ia-telephone-config'] });
      setHasChanges(false);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api.post('/admin/ia/telephone/test', { message: 'Bonjour, je voudrais prendre rendez-vous' }),
    onSuccess: () => setTestStatus('success'),
    onError: () => setTestStatus('error'),
  });

  const handleChange = (field: keyof IAConfig, value: any) => {
    setConfig(c => ({ ...c, [field]: value }));
    setHasChanges(true);
  };

  const handleBusinessHoursChange = (field: string, value: any) => {
    setConfig(c => ({
      ...c,
      business_hours: { ...c.business_hours, [field]: value }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const handleTest = () => {
    setTestStatus('testing');
    testMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Erreur de chargement</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Impossible de charger la configuration de l'IA Telephone.
          </p>
          <Button onClick={() => refetch()}>Reessayer</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Phone className="w-7 h-7 text-cyan-500" />
            Agent IA Telephone
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configurez votre assistant vocal pour les appels entrants
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testStatus === 'testing'}
          >
            {testStatus === 'testing' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Tester
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            {saveMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-3">
        <Badge variant={config.active ? 'default' : 'secondary'}>
          {config.active ? 'Actif' : 'Inactif'}
        </Badge>
        {testStatus === 'success' && (
          <Badge className="bg-green-500">Test reussi</Badge>
        )}
        {testStatus === 'error' && (
          <Badge variant="destructive">Test echoue</Badge>
        )}
        {hasChanges && (
          <Badge variant="outline" className="text-amber-500 border-amber-500">
            Modifications non sauvegardees
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message d'accueil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-500" />
              Message d'accueil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Message de bienvenue
              </label>
              <textarea
                value={config.greeting_message}
                onChange={(e) => handleChange('greeting_message', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Bonjour ! Comment puis-je vous aider ?"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ce message sera dit au debut de chaque appel
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Voix & Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-cyan-500" />
              Voix & Style
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Voix</label>
              <select
                value={config.voice_style}
                onChange={(e) => handleChange('voice_style', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-cyan-500"
              >
                {VOICE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Ton</label>
              <select
                value={config.tone}
                onChange={(e) => handleChange('tone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-cyan-500"
              >
                {TONE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Personnalite */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-500" />
              Personnalite de l'agent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Description de la personnalite
              </label>
              <textarea
                value={config.personality}
                onChange={(e) => handleChange('personality', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Assistante chaleureuse et professionnelle..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Description des services
              </label>
              <textarea
                value={config.services_description}
                onChange={(e) => handleChange('services_description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Liste des services proposes..."
              />
              <p className="text-xs text-gray-500 mt-1">
                L'IA utilisera ces informations pour repondre aux questions
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Parametres */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-500" />
              Parametres
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Numero de transfert
              </label>
              <input
                type="tel"
                value={config.transfer_phone}
                onChange={(e) => handleChange('transfer_phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-cyan-500"
                placeholder="+33 6 12 34 56 78"
              />
              <p className="text-xs text-gray-500 mt-1">
                Numero vers lequel transferer si le client demande un humain
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Duree max d'appel (secondes)
              </label>
              <input
                type="number"
                value={config.max_duration_seconds}
                onChange={(e) => handleChange('max_duration_seconds', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-cyan-500"
                min={60}
                max={600}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Prise de rendez-vous</p>
                <p className="text-sm text-gray-500">Permettre a l'IA de prendre des RDV</p>
              </div>
              <button
                onClick={() => handleChange('booking_enabled', !config.booking_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${config.booking_enabled ? 'bg-cyan-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${config.booking_enabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Agent actif</p>
                <p className="text-sm text-gray-500">Activer/desactiver l'agent IA</p>
              </div>
              <button
                onClick={() => handleChange('active', !config.active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${config.active ? 'bg-cyan-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${config.active ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Horaires */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-500" />
              Gestion des horaires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Activer la gestion des horaires</p>
                <p className="text-sm text-gray-500">
                  Afficher un message different en dehors des heures d'ouverture
                </p>
              </div>
              <button
                onClick={() => handleBusinessHoursChange('enabled', !config.business_hours.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${config.business_hours.enabled ? 'bg-cyan-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${config.business_hours.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
            {config.business_hours.enabled && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Message en dehors des horaires
                </label>
                <textarea
                  value={config.business_hours.message_outside_hours}
                  onChange={(e) => handleBusinessHoursChange('message_outside_hours', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
