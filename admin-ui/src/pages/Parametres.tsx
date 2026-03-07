import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api, authApi, invitationsApi } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings, User, Bell, Shield, Palette, Key, Globe, AlertCircle,
  Loader2, Webhook, CheckCircle, X, Plus, Trash2, Eye, EyeOff, Copy, Users, Mail, Clock, Monitor
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════════════
// FEEDBACK BANNER
// ══════════════════════════════════════════════════════════════════════════════

function FeedbackBanner({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  return (
    <div className={cn(
      'flex items-center gap-2 p-3 rounded-lg mb-4',
      type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
    )}>
      {type === 'success' ? (
        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
      )}
      <p className={cn('text-sm flex-1', type === 'success' ? 'text-green-700' : 'text-red-700')}>{message}</p>
      <button onClick={onDismiss} className="p-0.5 hover:opacity-70">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function Parametres() {
  const [activeSubSection, setActiveSubSection] = useState('profile');

  const subSections = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'team', label: 'Équipe', icon: Users },
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
          {activeSubSection === 'team' && <TeamSubSection />}
          {activeSubSection === 'notifications' && <NotificationsSubSection />}
          {activeSubSection === 'security' && <SecuritySubSection />}
          {activeSubSection === 'branding' && <BrandingSubSection />}
          {activeSubSection === 'api' && <ApiSubSection />}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════════════════════════════════════════

function ProfileSubSection() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    phone: '',
    address: ''
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: parametresData, isLoading } = useQuery({
    queryKey: ['parametres'],
    queryFn: () => api.get<{ parametres: { salon: { cle: string; valeur: string }[] } }>('/admin/parametres'),
  });

  useEffect(() => {
    if (parametresData?.parametres?.salon) {
      const salonParams = parametresData.parametres.salon;
      const getValue = (cle: string) => salonParams.find((p: { cle: string; valeur: string }) => p.cle === cle)?.valeur || '';
      setFormData({
        businessName: getValue('nom_salon'),
        email: getValue('email_salon'),
        phone: getValue('telephone_salon'),
        address: getValue('adresse_salon')
      });
    }
  }, [parametresData]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      api.put('/admin/parametres', {
        parametres: [
          { cle: 'nom_salon', valeur: data.businessName, categorie: 'salon' },
          { cle: 'email_salon', valeur: data.email, categorie: 'salon' },
          { cle: 'telephone_salon', valeur: data.phone, categorie: 'salon' },
          { cle: 'adresse_salon', valeur: data.address, categorie: 'salon' }
        ]
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametres'] });
      setHasChanges(false);
      setFeedback({ message: 'Profil mis à jour avec succès', type: 'success' });
    },
    onError: (err: Error) => {
      setFeedback({ message: err.message || 'Erreur lors de la sauvegarde', type: 'error' });
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
        {feedback && <FeedbackBanner message={feedback.message} type={feedback.type} onDismiss={() => setFeedback(null)} />}
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

// ══════════════════════════════════════════════════════════════════════════════
// TEAM / INVITATIONS
// ══════════════════════════════════════════════════════════════════════════════

function TeamSubSection() {
  const queryClient = useQueryClient();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('manager');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: invitationsData, isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => invitationsApi.list(),
  });

  const sendMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) => invitationsApi.send(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setInviteEmail('');
      setInviteRole('manager');
      setShowInviteForm(false);
      setFeedback({ message: 'Invitation envoyée avec succès', type: 'success' });
    },
    onError: (err: Error) => setFeedback({ message: err.message || 'Erreur', type: 'error' }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => invitationsApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setFeedback({ message: 'Invitation révoquée', type: 'success' });
    },
    onError: (err: Error) => setFeedback({ message: err.message || 'Erreur', type: 'error' }),
  });

  const pending = (invitationsData?.invitations || []).filter(i => !i.accepted_at);
  const accepted = (invitationsData?.invitations || []).filter(i => i.accepted_at);

  return (
    <div className="space-y-6">
      {feedback && <FeedbackBanner message={feedback.message} type={feedback.type} onDismiss={() => setFeedback(null)} />}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>Invitez des membres à rejoindre votre équipe</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowInviteForm(!showInviteForm)}>
            <Plus className="h-4 w-4 mr-1" />Inviter
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showInviteForm && (
            <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email du membre"
                  />
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Lecteur</option>
                </select>
              </div>
              <Button
                onClick={() => sendMutation.mutate({ email: inviteEmail, role: inviteRole })}
                disabled={!inviteEmail.trim() || sendMutation.isPending}
                className="bg-gradient-to-r from-gray-700 to-gray-800"
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer l\'invitation'}
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : pending.length === 0 && accepted.length === 0 ? (
            <div className="text-center py-6">
              <Mail className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Aucune invitation envoyée</p>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">En attente</p>
                  {pending.map((inv) => {
                    const isExpired = new Date(inv.expires_at) < new Date();
                    return (
                      <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">{inv.email}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Badge variant="outline" className="text-xs">{inv.role}</Badge>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {isExpired ? 'Expiré' : `Expire ${new Date(inv.expires_at).toLocaleDateString('fr-FR')}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExpired ? (
                            <Badge className="bg-red-50 text-red-700 border-red-200">Expiré</Badge>
                          ) : (
                            <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">En attente</Badge>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(inv.id)} disabled={revokeMutation.isPending}>
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {accepted.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Acceptées</p>
                  {accepted.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">{inv.email}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Badge variant="outline" className="text-xs">{inv.role}</Badge>
                            <span>Accepté le {new Date(inv.accepted_at!).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

const NOTIF_ITEMS = [
  { key: 'notif_email_new_booking', label: 'Email - Nouvelle réservation', desc: 'Recevoir un email à chaque nouvelle réservation', defaultVal: 'true' },
  { key: 'notif_email_cancellation', label: 'Email - Annulation', desc: "Recevoir un email en cas d'annulation", defaultVal: 'true' },
  { key: 'notif_email_reminder', label: 'Email - Rappel quotidien', desc: 'Recevoir un résumé quotidien des rendez-vous', defaultVal: 'true' },
  { key: 'notif_sms_reminder', label: 'SMS - Rappels clients', desc: 'Envoyer des SMS de rappel aux clients', defaultVal: 'false' },
  { key: 'notif_push', label: 'Notifications push', desc: 'Recevoir des notifications push', defaultVal: 'true' },
];

function NotificationsSubSection() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: parametresData, isLoading } = useQuery({
    queryKey: ['parametres'],
    queryFn: () => api.get<{ parametres: Record<string, { cle: string; valeur: string }[]> }>('/admin/parametres'),
  });

  // Build settings from API data
  const notifParams = parametresData?.parametres?.notifications || [];
  const settings: Record<string, boolean> = {};
  for (const item of NOTIF_ITEMS) {
    const found = notifParams.find((p: { cle: string; valeur: string }) => p.cle === item.key);
    settings[item.key] = found ? found.valeur === 'true' : item.defaultVal === 'true';
  }

  const toggleMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      api.put('/admin/parametres', {
        parametres: [{ cle: key, valeur: String(value), categorie: 'notifications' }]
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametres'] });
      setFeedback({ message: 'Préférence mise à jour', type: 'success' });
    },
    onError: (err: Error) => {
      setFeedback({ message: err.message || 'Erreur lors de la sauvegarde', type: 'error' });
    }
  });

  if (isLoading) {
    return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Préférences de notification</CardTitle>
        <CardDescription>Choisissez comment vous souhaitez être notifié</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedback && <FeedbackBanner message={feedback.message} type={feedback.type} onDismiss={() => setFeedback(null)} />}
        {NOTIF_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0">
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
            <button
              onClick={() => toggleMutation.mutate({ key: item.key, value: !settings[item.key] })}
              disabled={toggleMutation.isPending}
              className={cn('w-12 h-6 rounded-full relative transition-colors', settings[item.key] ? 'bg-green-500' : 'bg-gray-300')}
            >
              <div className={cn('w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-transform', settings[item.key] ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY
// ══════════════════════════════════════════════════════════════════════════════

function SecuritySubSection() {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load password policy
  const { data: policyData } = useQuery({
    queryKey: ['password-policy'],
    queryFn: () => api.get<{ policy: { minLength: number; requireUppercase: boolean; requireLowercase: boolean; requireNumbers: boolean; requireSymbols: boolean } }>('/admin/auth/password-policy'),
  });

  const policy = policyData?.policy;

  // Client-side validation
  function validatePassword(pw: string): string[] {
    if (!policy) return [];
    const errors: string[] = [];
    if (pw.length < policy.minLength) errors.push(`${policy.minLength} caractères minimum`);
    if (policy.requireUppercase && !/[A-Z]/.test(pw)) errors.push('Au moins une majuscule');
    if (policy.requireLowercase && !/[a-z]/.test(pw)) errors.push('Au moins une minuscule');
    if (policy.requireNumbers && !/[0-9]/.test(pw)) errors.push('Au moins un chiffre');
    if (policy.requireSymbols && !/[^a-zA-Z0-9]/.test(pw)) errors.push('Au moins un symbole');
    return errors;
  }

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post('/admin/auth/change-password', data),
    onSuccess: () => {
      setFeedback({ message: 'Mot de passe modifié avec succès', type: 'success' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowChangePassword(false);
      setValidationErrors([]);
    },
    onError: (err: Error) => {
      setFeedback({ message: err.message || 'Erreur lors du changement de mot de passe', type: 'error' });
    }
  });

  const handleSubmitPassword = () => {
    const errors = validatePassword(pwForm.newPassword);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setValidationErrors(['Les mots de passe ne correspondent pas']);
      return;
    }
    setValidationErrors([]);
    changePasswordMutation.mutate({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sécurité du compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback && <FeedbackBanner message={feedback.message} type={feedback.type} onDismiss={() => setFeedback(null)} />}

          {/* Change password */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">Mot de passe</p>
                <p className="text-sm text-gray-500">Modifiez votre mot de passe</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowChangePassword(!showChangePassword)}>
              {showChangePassword ? 'Annuler' : 'Modifier'}
            </Button>
          </div>

          {showChangePassword && (
            <div className="p-4 border rounded-lg space-y-4">
              {validationErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                    {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Mot de passe actuel</label>
                <Input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm(d => ({ ...d, currentPassword: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
                <Input type="password" value={pwForm.newPassword} onChange={(e) => { setPwForm(d => ({ ...d, newPassword: e.target.value })); setValidationErrors([]); }} />
                {policy && (
                  <p className="text-xs text-gray-400 mt-1">
                    Min. {policy.minLength} caractères, majuscule, minuscule, chiffre, symbole
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirmer</label>
                <Input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm(d => ({ ...d, confirmPassword: e.target.value }))} />
              </div>
              <Button
                onClick={handleSubmitPassword}
                disabled={changePasswordMutation.isPending || !pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword}
                className="bg-gradient-to-r from-gray-700 to-gray-800"
              >
                {changePasswordMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mise à jour...</> : 'Mettre à jour'}
              </Button>
            </div>
          )}

          {/* 2FA TOTP */}
          <TwoFactorSection />
        </CardContent>
      </Card>

      {/* Sessions actives */}
      <SessionsSection />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SESSIONS MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

function SessionsSection() {
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => authApi.getSessions(),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setRevoking(null);
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => authApi.revokeAllSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const sessions = data?.sessions || [];

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-gray-500" />
            <CardTitle className="text-base">Sessions actives</CardTitle>
          </div>
          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => revokeAllMutation.mutate()}
              disabled={revokeAllMutation.isPending}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {revokeAllMutation.isPending ? 'Révocation...' : 'Tout déconnecter'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Aucune session active</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border',
                session.is_current ? 'border-cyan-200 bg-cyan-50/50' : 'border-gray-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  session.is_current ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'
                )}>
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{session.device_info || 'Appareil inconnu'}</span>
                    {session.is_current && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded">Session actuelle</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{session.ip_address}</span>
                    <span>·</span>
                    <span>{timeAgo(session.last_active_at)}</span>
                    <span>·</span>
                    <span>Connecté le {formatDate(session.created_at)}</span>
                  </div>
                </div>
              </div>
              {!session.is_current && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeMutation.mutate(session.id)}
                  disabled={revokeMutation.isPending}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  Révoquer
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2FA TOTP SECTION
// ══════════════════════════════════════════════════════════════════════════════

function TwoFactorSection() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'backup' | 'disable'>('idle');
  const [setupData, setSetupData] = useState<{ secret: string; otpAuthUrl: string; backupCodes: string[] } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: statusData, isLoading: loadingStatus } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: () => authApi.get2FAStatus(),
  });

  const setupMutation = useMutation({
    mutationFn: () => authApi.setup2FA(),
    onSuccess: (data) => {
      setSetupData(data);
      setStep('setup');
    },
    onError: (err: Error) => setFeedback({ message: err.message || 'Erreur setup 2FA', type: 'error' }),
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => authApi.verify2FA(code),
    onSuccess: () => {
      setStep('backup');
      queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: (err: Error) => setFeedback({ message: err.message || 'Code invalide', type: 'error' }),
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => authApi.disable2FA(password),
    onSuccess: () => {
      setStep('idle');
      setDisablePassword('');
      setFeedback({ message: '2FA désactivée avec succès', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: (err: Error) => setFeedback({ message: err.message || 'Mot de passe incorrect', type: 'error' }),
  });

  const copyBackupCodes = () => {
    if (setupData?.backupCodes) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-gray-400" />
          <p className="font-medium">Authentification 2FA</p>
        </div>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const is2FAEnabled = statusData?.enabled || false;

  // État: 2FA active — affichage du statut et option de désactivation
  if (is2FAEnabled) {
    return (
      <div className="space-y-3">
        {feedback && <FeedbackBanner message={feedback.message} type={feedback.type} onDismiss={() => setFeedback(null)} />}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium">Authentification 2FA</p>
              <p className="text-sm text-gray-500">
                {statusData?.backup_codes_remaining !== undefined
                  ? `${statusData.backup_codes_remaining} codes de secours restants`
                  : 'Activée'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge>
            {step !== 'disable' && (
              <Button variant="outline" size="sm" onClick={() => setStep('disable')}>Désactiver</Button>
            )}
          </div>
        </div>

        {step === 'disable' && (
          <div className="p-4 border rounded-lg space-y-3">
            <p className="text-sm font-medium">Confirmez avec votre mot de passe pour désactiver la 2FA</p>
            <Input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Mot de passe actuel"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setStep('idle'); setDisablePassword(''); setFeedback(null); }}
              >
                Annuler
              </Button>
              <Button
                onClick={() => disableMutation.mutate(disablePassword)}
                disabled={!disablePassword || disableMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {disableMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Désactiver la 2FA'}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // État: 2FA non active
  return (
    <div className="space-y-3">
      {feedback && <FeedbackBanner message={feedback.message} type={feedback.type} onDismiss={() => setFeedback(null)} />}

      {step === 'idle' && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium">Authentification 2FA</p>
              <p className="text-sm text-gray-500">Sécurisez votre compte avec une double authentification</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
          >
            {setupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Configurer'}
          </Button>
        </div>
      )}

      {step === 'setup' && setupData && (
        <div className="p-4 border rounded-lg space-y-4">
          <div className="text-center">
            <p className="font-medium mb-1">Scannez ce QR code</p>
            <p className="text-sm text-gray-500 mb-4">
              Avec Google Authenticator, Authy ou toute application TOTP
            </p>
            <div className="inline-block p-4 bg-white rounded-xl shadow-sm border">
              <QRCodeSVG value={setupData.otpAuthUrl} size={200} />
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Ou entrez ce code manuellement :</p>
            <code className="text-sm font-mono bg-gray-100 px-3 py-1 rounded select-all">
              {setupData.secret}
            </code>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Entrez le code à 6 chiffres pour vérifier</p>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-lg tracking-widest font-mono flex-1"
                maxLength={6}
                autoComplete="one-time-code"
              />
              <Button
                onClick={() => verifyMutation.mutate(verifyCode)}
                disabled={verifyCode.length !== 6 || verifyMutation.isPending}
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activer'}
              </Button>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={() => { setStep('idle'); setSetupData(null); setVerifyCode(''); setFeedback(null); }}>
            Annuler
          </Button>
        </div>
      )}

      {step === 'backup' && setupData && (
        <div className="p-4 border border-green-200 bg-green-50 rounded-lg space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="font-medium text-green-800">2FA activée avec succès</p>
          </div>

          <div>
            <p className="text-sm font-medium text-green-800 mb-2">
              Sauvegardez ces codes de secours en lieu sûr. Chaque code ne peut être utilisé qu'une seule fois.
            </p>
            <div className="bg-white border rounded-lg p-3 font-mono text-sm grid grid-cols-2 gap-1">
              {setupData.backupCodes.map((code, i) => (
                <span key={i} className="text-gray-700">{code}</span>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyBackupCodes}>
              <Copy className="h-4 w-4 mr-1" />
              {copied ? 'Copié !' : 'Copier'}
            </Button>
            <Button
              size="sm"
              onClick={() => { setStep('idle'); setSetupData(null); setVerifyCode(''); setFeedback(null); }}
              className="bg-gradient-to-r from-gray-700 to-gray-800"
            >
              J'ai sauvegardé mes codes
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BRANDING
// ══════════════════════════════════════════════════════════════════════════════

const BRAND_COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

function BrandingSubSection() {
  const queryClient = useQueryClient();
  const { tenant, isBusiness } = useTenant();
  const [selectedColor, setSelectedColor] = useState<string>(tenant?.branding?.primaryColor || '#06b6d4');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (tenant?.branding?.primaryColor) {
      setSelectedColor(tenant.branding.primaryColor);
    }
  }, [tenant?.branding?.primaryColor]);

  const brandingMutation = useMutation({
    mutationFn: (color: string) =>
      api.patch('/tenants/me/branding', { primaryColor: color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      setFeedback({ message: 'Couleur mise à jour', type: 'success' });
    },
    onError: (err: Error) => {
      setFeedback({ message: err.message || 'Erreur lors de la sauvegarde', type: 'error' });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personnalisation</CardTitle>
        <CardDescription>Personnalisez l'apparence de votre espace</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {feedback && <FeedbackBanner message={feedback.message} type={feedback.type} onDismiss={() => setFeedback(null)} />}

        {!isBusiness && (
          <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg flex items-center gap-3">
            <Palette className="h-5 w-5 text-cyan-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-cyan-800">Personnalisation avancée</p>
              <p className="text-xs text-cyan-600">La personnalisation complète (couleurs, logo) est disponible avec le plan Business.</p>
            </div>
          </div>
        )}

        {/* Logo — disabled (no upload infra) */}
        <div>
          <label className="block text-sm font-medium mb-2">Logo de l'entreprise</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              {tenant?.name?.charAt(0) || 'N'}
            </div>
            <div>
              <Button variant="outline" disabled>Changer le logo</Button>
              <p className="text-xs text-gray-400 mt-1">Upload bientôt disponible</p>
            </div>
          </div>
        </div>

        {/* Color picker */}
        <div className={cn(!isBusiness && 'opacity-50 pointer-events-none')}>
          <label className="block text-sm font-medium mb-2">Couleur principale</label>
          <div className="flex gap-3">
            {BRAND_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                disabled={!isBusiness}
                className={cn(
                  'w-10 h-10 rounded-full border-2 transition-transform',
                  selectedColor === color ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => brandingMutation.mutate(selectedColor)}
            disabled={!isBusiness || brandingMutation.isPending || selectedColor === (tenant?.branding?.primaryColor || '#06b6d4')}
            className="bg-gradient-to-r from-gray-700 to-gray-800"
          >
            {brandingMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</> : 'Enregistrer'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// API & WEBHOOKS
// ══════════════════════════════════════════════════════════════════════════════

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

function ApiSubSection() {
  const { isBusiness } = useTenant();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', events: 'reservation.created,reservation.canceled' });
  const [showNewKey, setShowNewKey] = useState(false);
  const [showNewWebhook, setShowNewWebhook] = useState(false);

  // Gate: Business plan only
  if (!isBusiness) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Key className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">API & Webhooks</h3>
          <p className="text-gray-500 mb-4">L'accès API est disponible avec le plan Business.</p>
          <Badge variant="outline" className="bg-cyan-50 text-cyan-700">Requiert le plan Business</Badge>
        </CardContent>
      </Card>
    );
  }

  const { data: keysData, isLoading: loadingKeys } = useQuery({
    queryKey: ['admin-api-keys'],
    queryFn: () => api.get<{ api_keys: ApiKey[] }>('/admin/api-keys'),
  });

  const { data: webhooksData, isLoading: loadingWebhooks } = useQuery({
    queryKey: ['admin-webhooks'],
    queryFn: () => api.get<{ webhooks: WebhookItem[] }>('/admin/webhooks'),
  });

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => api.post<{ api_key: ApiKey; raw_key: string }>('/admin/api-keys', { name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
      setRevealedKey(data.raw_key);
      setNewKeyName('');
      setShowNewKey(false);
      setFeedback({ message: 'Clé API créée. Copiez-la maintenant, elle ne sera plus affichée.', type: 'success' });
    },
    onError: (err: Error) => setFeedback({ message: err.message || 'Erreur', type: 'error' })
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
      setFeedback({ message: 'Clé révoquée', type: 'success' });
    },
    onError: (err: Error) => setFeedback({ message: err.message || 'Erreur', type: 'error' })
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: { name: string; url: string; events: string[] }) => api.post('/admin/webhooks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-webhooks'] });
      setNewWebhook({ name: '', url: '', events: 'reservation.created,reservation.canceled' });
      setShowNewWebhook(false);
      setFeedback({ message: 'Webhook créé', type: 'success' });
    },
    onError: (err: Error) => setFeedback({ message: err.message || 'Erreur', type: 'error' })
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-webhooks'] });
      setFeedback({ message: 'Webhook supprimé', type: 'success' });
    },
    onError: (err: Error) => setFeedback({ message: err.message || 'Erreur', type: 'error' })
  });

  return (
    <div className="space-y-6">
      {feedback && <FeedbackBanner message={feedback.message} type={feedback.type} onDismiss={() => setFeedback(null)} />}

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-medium text-green-800 mb-2">Votre nouvelle clé API :</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-white border rounded text-sm font-mono break-all">{revealedKey}</code>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(revealedKey); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-green-600 mt-2">Cette clé ne sera plus affichée. Conservez-la en lieu sûr.</p>
          <Button variant="link" size="sm" className="mt-1 p-0 h-auto text-green-700" onClick={() => setRevealedKey(null)}>Fermer</Button>
        </div>
      )}

      {/* API Keys */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Clés API</CardTitle>
            <CardDescription>Gérez vos clés d'accès à l'API NEXUS</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowNewKey(!showNewKey)}>
            <Plus className="h-4 w-4 mr-1" />Nouvelle clé
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNewKey && (
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
              <Input placeholder="Nom de la clé (ex: Production)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="flex-1" />
              <Button onClick={() => createKeyMutation.mutate(newKeyName)} disabled={!newKeyName.trim() || createKeyMutation.isPending} className="bg-gradient-to-r from-gray-700 to-gray-800">
                {createKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
              </Button>
            </div>
          )}

          {loadingKeys ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : keysData?.api_keys?.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Aucune clé API</p>
          ) : (
            keysData?.api_keys?.filter(k => k.is_active).map((key) => (
              <div key={key.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{key.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                    <Button variant="ghost" size="sm" onClick={() => revokeKeyMutation.mutate(key.id)} disabled={revokeKeyMutation.isPending}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
                <code className="text-xs text-gray-400 font-mono">{key.key_prefix}{'•'.repeat(20)}</code>
                {key.last_used_at && (
                  <p className="text-xs text-gray-400 mt-1">Dernière utilisation : {new Date(key.last_used_at).toLocaleDateString('fr-FR')}</p>
                )}
              </div>
            ))
          )}

          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-700">Ne partagez jamais votre clé API.</p>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Configurez les webhooks pour recevoir des événements</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowNewWebhook(!showNewWebhook)}>
            <Plus className="h-4 w-4 mr-1" />Ajouter
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNewWebhook && (
            <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
              <Input placeholder="Nom (ex: Mon app)" value={newWebhook.name} onChange={(e) => setNewWebhook(d => ({ ...d, name: e.target.value }))} />
              <Input placeholder="URL (https://...)" value={newWebhook.url} onChange={(e) => setNewWebhook(d => ({ ...d, url: e.target.value }))} />
              <Input placeholder="Événements (séparés par virgule)" value={newWebhook.events} onChange={(e) => setNewWebhook(d => ({ ...d, events: e.target.value }))} />
              <Button
                onClick={() => createWebhookMutation.mutate({
                  name: newWebhook.name,
                  url: newWebhook.url,
                  events: newWebhook.events.split(',').map(e => e.trim()).filter(Boolean)
                })}
                disabled={!newWebhook.name || !newWebhook.url || createWebhookMutation.isPending}
                className="bg-gradient-to-r from-gray-700 to-gray-800"
              >
                {createWebhookMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
              </Button>
            </div>
          )}

          {loadingWebhooks ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : webhooksData?.webhooks?.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Aucun webhook configuré</p>
            </div>
          ) : (
            webhooksData?.webhooks?.map((wh) => (
              <div key={wh.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{wh.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge className={wh.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}>{wh.is_active ? 'Actif' : 'Inactif'}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => deleteWebhookMutation.mutate(wh.id)} disabled={deleteWebhookMutation.isPending}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-mono truncate">{wh.url}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {wh.events.map((ev) => (
                    <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
