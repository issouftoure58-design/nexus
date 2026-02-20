import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings, User, Bell, Shield, Palette, Key, Globe, AlertCircle,
  Loader2, Webhook
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Parametres() {
  const [activeSubSection, setActiveSubSection] = useState('profile');
  const queryClient = useQueryClient();

  const subSections = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'branding', label: 'Personnalisation', icon: Palette },
    { id: 'api', label: 'API & Webhooks', icon: Webhook },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500">Configurez votre compte et vos préférences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sub-navigation */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {subSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSubSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                      activeSubSection === section.id
                        ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-white'
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
          {activeSubSection === 'profile' && <ProfileSubSection />}
          {activeSubSection === 'notifications' && <NotificationsSubSection />}
          {activeSubSection === 'security' && <SecuritySubSection />}
          {activeSubSection === 'branding' && <BrandingSubSection />}
          {activeSubSection === 'api' && <ApiSubSection />}
        </div>
      </div>
    </div>
  );
}

// Profile Sub-Section
function ProfileSubSection() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    phone: '',
    address: ''
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: parametresData, isLoading } = useQuery({
    queryKey: ['parametres'],
    queryFn: async () => {
      const token = localStorage.getItem('nexus_admin_token');
      const res = await fetch('/api/admin/parametres', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur chargement parametres');
      return res.json();
    }
  });

  useEffect(() => {
    if (parametresData?.parametres?.salon) {
      const salonParams = parametresData.parametres.salon;
      const getValue = (cle: string) => salonParams.find((p: any) => p.cle === cle)?.valeur || '';
      setFormData({
        businessName: getValue('nom_salon'),
        email: getValue('email_salon'),
        phone: getValue('telephone_salon'),
        address: getValue('adresse_salon')
      });
    }
  }, [parametresData]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const token = localStorage.getItem('nexus_admin_token');
      const res = await fetch('/api/admin/parametres', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parametres: [
            { cle: 'nom_salon', valeur: data.businessName },
            { cle: 'email_salon', valeur: data.email },
            { cle: 'telephone_salon', valeur: data.phone },
            { cle: 'adresse_salon', valeur: data.address }
          ]
        })
      });
      if (!res.ok) throw new Error('Erreur sauvegarde');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametres'] });
      setHasChanges(false);
    }
  });

  if (isLoading) {
    return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations du profil</CardTitle>
        <CardDescription>Gérez les informations de votre entreprise</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom de l'entreprise</label>
            <Input value={formData.businessName} onChange={(e) => { setFormData(d => ({ ...d, businessName: e.target.value })); setHasChanges(true); }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input type="email" value={formData.email} onChange={(e) => { setFormData(d => ({ ...d, email: e.target.value })); setHasChanges(true); }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Téléphone</label>
            <Input type="tel" value={formData.phone} onChange={(e) => { setFormData(d => ({ ...d, phone: e.target.value })); setHasChanges(true); }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Adresse</label>
            <Input value={formData.address} onChange={(e) => { setFormData(d => ({ ...d, address: e.target.value })); setHasChanges(true); }} />
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={() => saveMutation.mutate(formData)} disabled={!hasChanges || saveMutation.isPending} className="bg-gradient-to-r from-gray-700 to-gray-800">
            {saveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</> : 'Enregistrer'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Notifications Sub-Section
function NotificationsSubSection() {
  const [settings, setSettings] = useState({
    emailNewBooking: true,
    emailCancellation: true,
    emailReminder: true,
    smsReminder: false,
    pushNotifications: true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Préférences de notification</CardTitle>
        <CardDescription>Choisissez comment vous souhaitez être notifié</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          { key: 'emailNewBooking', label: 'Email - Nouvelle réservation', desc: 'Recevoir un email à chaque nouvelle réservation' },
          { key: 'emailCancellation', label: 'Email - Annulation', desc: 'Recevoir un email en cas d\'annulation' },
          { key: 'emailReminder', label: 'Email - Rappel quotidien', desc: 'Recevoir un résumé quotidien des rendez-vous' },
          { key: 'smsReminder', label: 'SMS - Rappels clients', desc: 'Envoyer des SMS de rappel aux clients' },
          { key: 'pushNotifications', label: 'Notifications push', desc: 'Recevoir des notifications push' },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0">
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key as keyof typeof settings] }))}
              className={cn('w-12 h-6 rounded-full relative', settings[item.key as keyof typeof settings] ? 'bg-green-500' : 'bg-gray-300')}
            >
              <div className={cn('w-5 h-5 bg-white rounded-full absolute top-0.5 shadow', settings[item.key as keyof typeof settings] ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Security Sub-Section
function SecuritySubSection() {
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sécurité du compte</CardTitle>
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
            <Button variant="outline" onClick={() => setShowChangePassword(!showChangePassword)}>Modifier</Button>
          </div>

          {showChangePassword && (
            <div className="p-4 border rounded-lg space-y-4">
              <div><label className="block text-sm font-medium mb-1">Mot de passe actuel</label><Input type="password" /></div>
              <div><label className="block text-sm font-medium mb-1">Nouveau mot de passe</label><Input type="password" /></div>
              <div><label className="block text-sm font-medium mb-1">Confirmer</label><Input type="password" /></div>
              <Button className="bg-gradient-to-r from-gray-700 to-gray-800">Mettre à jour</Button>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">Authentification 2FA</p>
                <p className="text-sm text-gray-500">Sécurisez votre compte</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Non activé</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Branding Sub-Section
function BrandingSubSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personnalisation</CardTitle>
        <CardDescription>Personnalisez l'apparence de votre espace</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Logo de l'entreprise</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">N</div>
            <Button variant="outline">Changer le logo</Button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Couleur principale</label>
          <div className="flex gap-3">
            {['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'].map((color) => (
              <button key={color} className={cn('w-10 h-10 rounded-full border-2', color === '#06b6d4' ? 'border-gray-900 scale-110' : 'border-transparent')} style={{ backgroundColor: color }} />
            ))}
          </div>
        </div>
        <div className="flex justify-end"><Button className="bg-gradient-to-r from-gray-700 to-gray-800">Enregistrer</Button></div>
      </CardContent>
    </Card>
  );
}

// API Sub-Section
function ApiSubSection() {
  const [showKey, setShowKey] = useState(false);

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
              <code className="flex-1 p-2 bg-white border rounded text-sm font-mono">{showKey ? 'sk_live_xxxxxxxxxxxxxxxxxxxx' : '•'.repeat(32)}</code>
              <Button variant="outline" size="sm" onClick={() => setShowKey(!showKey)}>{showKey ? 'Masquer' : 'Afficher'}</Button>
            </div>
          </div>
          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-700">Ne partagez jamais votre clé API.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>Configurez les webhooks pour recevoir des événements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Globe className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucun webhook configuré</p>
            <Button variant="link" className="mt-2">Ajouter un webhook</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
