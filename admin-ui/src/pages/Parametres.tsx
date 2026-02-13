import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { quotasApi, type QuotasData } from '@/lib/api';
import {
  Settings,
  User,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Palette,
  Key,
  Mail,
  Check,
  AlertCircle,
  ChevronRight,
  Loader2,
  Zap,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Parametres() {
  const [activeSection, setActiveSection] = useState<string>('profile');

  const { data: quotas, isLoading: quotasLoading } = useQuery<QuotasData>({
    queryKey: ['quotas'],
    queryFn: quotasApi.get,
  });

  const sections = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'billing', label: 'Abonnement', icon: CreditCard },
    { id: 'branding', label: 'Personnalisation', icon: Palette },
    { id: 'api', label: 'API & Intégrations', icon: Key },
  ];

  return (
    <Layout title="Paramètres" subtitle="Configurez votre espace">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                      activeSection === section.id
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeSection === 'profile' && <ProfileSection />}
          {activeSection === 'notifications' && <NotificationsSection />}
          {activeSection === 'security' && <SecuritySection />}
          {activeSection === 'billing' && <BillingSection quotas={quotas} loading={quotasLoading} />}
          {activeSection === 'branding' && <BrandingSection />}
          {activeSection === 'api' && <ApiSection />}
        </div>
      </div>
    </Layout>
  );
}

// Profile Section
function ProfileSection() {
  const [formData, setFormData] = useState({
    businessName: 'Test NEXUS Platform',
    email: 'admin@nexus-test.com',
    phone: '0612345678',
    address: '123 Rue Test, Paris'
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations du profil</CardTitle>
        <CardDescription>Gérez les informations de votre entreprise</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
            <Input
              value={formData.businessName}
              onChange={(e) => setFormData(d => ({ ...d, businessName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email de contact</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(d => ({ ...d, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(d => ({ ...d, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData(d => ({ ...d, address: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600">
            Enregistrer les modifications
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Notifications Section
function NotificationsSection() {
  const [settings, setSettings] = useState({
    emailNewBooking: true,
    emailCancellation: true,
    emailReminder: true,
    smsReminder: false,
    pushNotifications: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const NotificationToggle = ({ label, description, settingKey }: {
    label: string;
    description: string;
    settingKey: keyof typeof settings;
  }) => (
    <div className="flex items-center justify-between py-4 border-b last:border-0">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => toggleSetting(settingKey)}
        className={cn(
          'w-12 h-6 rounded-full transition-colors relative',
          settings[settingKey] ? 'bg-green-500' : 'bg-gray-300'
        )}
      >
        <div className={cn(
          'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow',
          settings[settingKey] ? 'translate-x-6' : 'translate-x-0.5'
        )} />
      </button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Préférences de notification</CardTitle>
        <CardDescription>Choisissez comment vous souhaitez être notifié</CardDescription>
      </CardHeader>
      <CardContent>
        <NotificationToggle
          label="Email - Nouvelle réservation"
          description="Recevoir un email à chaque nouvelle réservation"
          settingKey="emailNewBooking"
        />
        <NotificationToggle
          label="Email - Annulation"
          description="Recevoir un email en cas d'annulation"
          settingKey="emailCancellation"
        />
        <NotificationToggle
          label="Email - Rappel quotidien"
          description="Recevoir un résumé quotidien des rendez-vous"
          settingKey="emailReminder"
        />
        <NotificationToggle
          label="SMS - Rappels clients"
          description="Envoyer des SMS de rappel aux clients"
          settingKey="smsReminder"
        />
        <NotificationToggle
          label="Notifications push"
          description="Recevoir des notifications push dans l'application"
          settingKey="pushNotifications"
        />
      </CardContent>
    </Card>
  );
}

// Security Section
function SecuritySection() {
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sécurité du compte</CardTitle>
          <CardDescription>Gérez vos paramètres de sécurité</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">Mot de passe</p>
                <p className="text-sm text-gray-500">Dernière modification il y a 30 jours</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowChangePassword(!showChangePassword)}>
              Modifier
            </Button>
          </div>

          {showChangePassword && (
            <div className="p-4 border rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
                <Input type="password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                <Input type="password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                <Input type="password" />
              </div>
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-600">
                Mettre à jour le mot de passe
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">Authentification à deux facteurs</p>
                <p className="text-sm text-gray-500">Sécurisez votre compte avec la 2FA</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              Non activé
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions actives</CardTitle>
          <CardDescription>Gérez les appareils connectés à votre compte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Chrome sur MacOS</p>
                  <p className="text-xs text-gray-500">Session actuelle • Paris, France</p>
                </div>
              </div>
              <Badge className="bg-green-50 text-green-700 border-green-200">Actif</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Billing Section
function BillingSection({ quotas, loading }: { quotas?: QuotasData; loading: boolean }) {
  const formatNumber = (num: number) => num === -1 ? '∞' : num.toLocaleString();

  const planFeatures: Record<string, string[]> = {
    starter: ['1 000 clients max', '5 000 messages IA/mois', 'Support email'],
    pro: ['3 000 clients max', '15 000 messages IA/mois', 'Support prioritaire', 'Workflows'],
    business: ['Clients illimités', 'Messages IA illimités', 'Support dédié', 'API complète', 'Multi-utilisateurs'],
  };

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50/50 to-blue-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-cyan-600" />
                Votre abonnement
              </CardTitle>
              <CardDescription>Gérez votre plan et vos options</CardDescription>
            </div>
            {quotas && (
              <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 text-lg px-4 py-1">
                {quotas.plan.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          ) : quotas ? (
            <div className="space-y-4">
              {/* Quotas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Clients</span>
                    <span className="text-sm font-medium">
                      {quotas.quotas.clients.used} / {formatNumber(quotas.quotas.clients.limit)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                      style={{
                        width: quotas.quotas.clients.limit === -1
                          ? '30%'
                          : `${Math.min(100, (quotas.quotas.clients.used / quotas.quotas.clients.limit) * 100)}%`
                      }}
                    />
                  </div>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Messages IA</span>
                    <span className="text-sm font-medium">
                      {quotas.quotas.messages_ia.used} / {formatNumber(quotas.quotas.messages_ia.limit)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600"
                      style={{
                        width: quotas.quotas.messages_ia.limit === -1
                          ? '30%'
                          : `${Math.min(100, (quotas.quotas.messages_ia.used / quotas.quotas.messages_ia.limit) * 100)}%`
                      }}
                    />
                  </div>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Réservations</span>
                    <span className="text-sm font-medium">
                      {quotas.quotas.reservations.used} / {formatNumber(quotas.quotas.reservations.limit)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                      style={{
                        width: quotas.quotas.reservations.limit === -1
                          ? '30%'
                          : `${Math.min(100, (quotas.quotas.reservations.used / quotas.quotas.reservations.limit) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-2 pt-2">
                {planFeatures[quotas.plan]?.map((feature) => (
                  <Badge key={feature} variant="outline" className="bg-white">
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Upgrade options */}
      <Card>
        <CardHeader>
          <CardTitle>Changer de plan</CardTitle>
          <CardDescription>Comparez nos offres et choisissez celle qui vous convient</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Starter', price: 99, features: planFeatures.starter },
              { name: 'Pro', price: 199, features: planFeatures.pro, popular: true },
              { name: 'Business', price: 399, features: planFeatures.business },
            ].map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'p-4 border rounded-lg relative',
                  plan.popular && 'border-cyan-500 ring-1 ring-cyan-500',
                  quotas?.plan === plan.name.toLowerCase() && 'bg-gray-50'
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0">
                    Populaire
                  </Badge>
                )}
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <p className="text-2xl font-bold mt-2">
                  {plan.price}€<span className="text-sm font-normal text-gray-500">/mois</span>
                </p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={quotas?.plan === plan.name.toLowerCase() ? 'outline' : 'default'}
                  className={cn(
                    'w-full mt-4',
                    quotas?.plan !== plan.name.toLowerCase() && 'bg-gradient-to-r from-cyan-500 to-blue-600'
                  )}
                  disabled={quotas?.plan === plan.name.toLowerCase()}
                >
                  {quotas?.plan === plan.name.toLowerCase() ? 'Plan actuel' : 'Choisir ce plan'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Branding Section
function BrandingSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personnalisation</CardTitle>
        <CardDescription>Personnalisez l'apparence de votre espace</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Logo de l'entreprise</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              N
            </div>
            <Button variant="outline">Changer le logo</Button>
          </div>
        </div>

        {/* Colors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Couleur principale</label>
          <div className="flex items-center gap-3">
            {['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'].map((color) => (
              <button
                key={color}
                className={cn(
                  'w-10 h-10 rounded-full border-2 transition-transform hover:scale-110',
                  color === '#06b6d4' ? 'border-gray-900 scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600">
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// API Section
function ApiSection() {
  const [showKey, setShowKey] = useState(false);
  const apiKey = 'sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clés API</CardTitle>
          <CardDescription>Gérez vos clés d'accès à l'API NEXUS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Clé API Live</span>
              <Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-white border rounded text-sm font-mono">
                {showKey ? apiKey : '•'.repeat(32)}
              </code>
              <Button variant="outline" size="sm" onClick={() => setShowKey(!showKey)}>
                {showKey ? 'Masquer' : 'Afficher'}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-700">
              Ne partagez jamais votre clé API. Régénérez-la si elle a été compromise.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>Configurez les webhooks pour recevoir des événements en temps réel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Globe className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p>Aucun webhook configuré</p>
            <Button variant="link" className="mt-2">Ajouter un webhook</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
