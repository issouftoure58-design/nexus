import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import {
  MessageCircle,
  Settings,
  MessageSquare,
  Play,
  Save,
  RefreshCw,
  AlertCircle,
  Clock,
  User,
  Image,
  Send
} from 'lucide-react';

interface IAConfig {
  id?: string;
  greeting_message: string;
  tone: string;
  language: string;
  response_delay_ms: number;
  business_hours: {
    enabled: boolean;
    message_outside_hours: string;
  };
  personality: string;
  services_description: string;
  booking_enabled: boolean;
  send_images: boolean;
  send_location: boolean;
  quick_replies_enabled: boolean;
  quick_replies: string[];
  active: boolean;
}

const DEFAULT_CONFIG: IAConfig = {
  greeting_message: "Bonjour ! Je suis l'assistante virtuelle. Comment puis-je vous aider ?",
  tone: 'professionnel',
  language: 'fr-FR',
  response_delay_ms: 1000,
  business_hours: {
    enabled: false,
    message_outside_hours: "Nous sommes actuellement fermés. Nous vous répondrons dès notre réouverture."
  },
  personality: 'Assistante professionnelle et chaleureuse',
  services_description: '',
  booking_enabled: true,
  send_images: true,
  send_location: true,
  quick_replies_enabled: true,
  quick_replies: ['Prendre RDV', 'Nos services', 'Nos horaires', 'Contact'],
  active: true
};

const TONE_OPTIONS = [
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'chaleureux', label: 'Chaleureux' },
  { value: 'decontracte', label: 'Decontracte' },
  { value: 'formel', label: 'Formel' },
  { value: 'amical', label: 'Amical' },
];

export default function IAWhatsApp() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<IAConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [newQuickReply, setNewQuickReply] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ia-whatsapp-config'],
    queryFn: () => api.get<{ config: IAConfig }>('/admin/ia/whatsapp/config'),
  });

  useEffect(() => {
    if (data?.config) {
      setConfig({ ...DEFAULT_CONFIG, ...data.config });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (data: IAConfig) => api.put('/admin/ia/whatsapp/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ia-whatsapp-config'] });
      setHasChanges(false);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api.post('/admin/ia/whatsapp/test', { message: 'Bonjour' }),
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

  const addQuickReply = () => {
    if (newQuickReply.trim() && config.quick_replies.length < 10) {
      setConfig(c => ({
        ...c,
        quick_replies: [...c.quick_replies, newQuickReply.trim()]
      }));
      setNewQuickReply('');
      setHasChanges(true);
    }
  };

  const removeQuickReply = (index: number) => {
    setConfig(c => ({
      ...c,
      quick_replies: c.quick_replies.filter((_, i) => i !== index)
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
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
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
            Impossible de charger la configuration de l'IA WhatsApp.
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
            <MessageCircle className="w-7 h-7 text-green-500" />
            Agent IA WhatsApp
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configurez votre assistant WhatsApp Business
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
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
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
        <Badge variant={config.active ? 'default' : 'secondary'} className={config.active ? 'bg-green-500' : ''}>
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
              <MessageSquare className="w-5 h-5 text-green-500" />
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
                         focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Bonjour ! Comment puis-je vous aider ?"
              />
              <p className="text-xs text-gray-500 mt-1">
                Utilise des emojis pour un style WhatsApp authentique
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Ton & Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-green-500" />
              Personnalite
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Ton</label>
              <select
                value={config.tone}
                onChange={(e) => handleChange('tone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-green-500"
              >
                {TONE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
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
                         focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Assistante chaleureuse qui utilise des emojis..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-green-500" />
              Services & Fonctionnalites
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                         focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Liste des services proposes..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Delai de reponse (ms)
              </label>
              <input
                type="number"
                value={config.response_delay_ms}
                onChange={(e) => handleChange('response_delay_ms', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-green-500"
                min={500}
                max={5000}
                step={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                Delai avant d'envoyer la reponse (effet "en train d'ecrire")
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-green-500" />
              Options de message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Prise de rendez-vous</p>
                <p className="text-sm text-gray-500">Permettre a l'IA de prendre des RDV</p>
              </div>
              <button
                onClick={() => handleChange('booking_enabled', !config.booking_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${config.booking_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${config.booking_enabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Envoyer des images</p>
                <p className="text-sm text-gray-500">Partager des photos de realisations</p>
              </div>
              <button
                onClick={() => handleChange('send_images', !config.send_images)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${config.send_images ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${config.send_images ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Envoyer la localisation</p>
                <p className="text-sm text-gray-500">Partager l'adresse du salon</p>
              </div>
              <button
                onClick={() => handleChange('send_location', !config.send_location)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${config.send_location ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${config.send_location ? 'translate-x-6' : 'translate-x-1'}`}
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
                  ${config.active ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${config.active ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Reponses rapides */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-500" />
              Reponses rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Activer les reponses rapides</p>
                <p className="text-sm text-gray-500">
                  Boutons cliquables pour guider la conversation
                </p>
              </div>
              <button
                onClick={() => handleChange('quick_replies_enabled', !config.quick_replies_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${config.quick_replies_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${config.quick_replies_enabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
            {config.quick_replies_enabled && (
              <>
                <div className="flex flex-wrap gap-2">
                  {config.quick_replies.map((reply, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="px-3 py-1 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                      onClick={() => removeQuickReply(index)}
                    >
                      {reply} x
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newQuickReply}
                    onChange={(e) => setNewQuickReply(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addQuickReply()}
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-green-500"
                    placeholder="Ajouter une reponse rapide..."
                    maxLength={20}
                  />
                  <Button onClick={addQuickReply} variant="outline">
                    Ajouter
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Maximum 10 reponses rapides. Cliquez sur une reponse pour la supprimer.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Horaires */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-500" />
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
                  ${config.business_hours.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
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
                           focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
