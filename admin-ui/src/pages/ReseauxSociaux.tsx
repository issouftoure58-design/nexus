/**
 * Page Reseaux Sociaux — Connexion comptes Facebook/Instagram OAuth
 * Liste comptes connectes, alertes expiration token, deconnexion
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Facebook,
  Instagram,
  Loader2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';

interface SocialAccount {
  id: string;
  platform: 'facebook' | 'instagram';
  account_name: string;
  account_id: string;
  page_id: string | null;
  ig_account_id: string | null;
  is_active: boolean;
  connected_at: string;
  last_used_at: string | null;
  token_expires_at: string | null;
  token_expiring_soon: boolean;
  token_expired: boolean;
}

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  facebook: { label: 'Facebook', icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50' },
  instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-50' },
};

export default function ReseauxSociaux() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Afficher les messages de retour du callback OAuth
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const pages = searchParams.get('pages');

    if (success) {
      setToast({ type: 'success', message: `Connexion reussie ! ${pages || ''} page(s) connectee(s).` });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        no_pages: 'Aucune page Facebook trouvee. Verifiez que votre compte a au moins une page.',
        missing_params: 'Parametres manquants dans le callback.',
        invalid_state: 'Session OAuth invalide. Reessayez.',
      };
      setToast({ type: 'error', message: errorMessages[error] || `Erreur: ${decodeURIComponent(error)}` });
    }

    if (success || error) {
      const timer = setTimeout(() => setToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Charger la liste des comptes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => api.get<{ accounts: SocialAccount[] }>('/social/auth/accounts'),
  });

  const accounts: SocialAccount[] = data?.accounts || [];

  // Mutation connecter Facebook
  const connectMutation = useMutation({
    mutationFn: () => api.get<{ url: string }>('/social/auth/facebook'),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message });
    },
  });

  // Mutation deconnecter
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/social/auth/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
      setToast({ type: 'success', message: 'Compte deconnecte.' });
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message });
    },
  });

  const facebookAccounts = accounts.filter(a => a.platform === 'facebook');
  const instagramAccounts = accounts.filter(a => a.platform === 'instagram');
  const expiringAccounts = accounts.filter(a => a.token_expiring_soon && !a.token_expired);
  const expiredAccounts = accounts.filter(a => a.token_expired);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reseaux Sociaux</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Connectez vos comptes Facebook et Instagram pour publier automatiquement.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          toast.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Alertes token */}
      {expiredAccounts.length > 0 && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-700">
              {expiredAccounts.length} compte(s) avec token expire
            </p>
            <p className="text-sm text-red-600">
              Reconnectez ces comptes pour continuer a publier.
            </p>
          </div>
        </div>
      )}

      {expiringAccounts.length > 0 && (
        <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-700">
              {expiringAccounts.length} compte(s) avec token expirant bientot
            </p>
            <p className="text-sm text-yellow-600">
              Reconnectez ces comptes avant l'expiration (moins de 7 jours).
            </p>
          </div>
        </div>
      )}

      {/* Connecter un compte */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connecter un compte</h2>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {connectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Facebook className="w-4 h-4 mr-2" />
              )}
              Connecter Facebook / Instagram
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            La connexion Facebook connecte automatiquement le compte Instagram Business lie a votre page.
          </p>
        </CardContent>
      </Card>

      {/* Comptes connectes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Comptes connectes ({accounts.length})
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucun compte connecte
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Connectez votre page Facebook pour commencer a publier automatiquement
                sur Facebook et Instagram.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account) => {
              const config = PLATFORM_CONFIG[account.platform] || PLATFORM_CONFIG.facebook;
              const Icon = config.icon;

              return (
                <Card key={account.id} className={account.token_expired ? 'border-red-200' : ''}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {account.account_name || account.account_id}
                          </p>
                          <p className="text-sm text-gray-500">{config.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {account.token_expired ? (
                          <Badge variant="destructive">Expire</Badge>
                        ) : account.token_expiring_soon ? (
                          <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50">
                            Expire bientot
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                            Actif
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                      <span>
                        Connecte le {new Date(account.connected_at).toLocaleDateString('fr-FR')}
                      </span>
                      {account.token_expires_at && (
                        <span>
                          Expire le {new Date(account.token_expires_at).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Deconnecter ${account.account_name || config.label} ?`)) {
                            disconnectMutation.mutate(account.id);
                          }
                        }}
                        disabled={disconnectMutation.isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Deconnecter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Resume */}
      {accounts.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Resume</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{accounts.length}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{facebookAccounts.length}</p>
                <p className="text-sm text-gray-500">Facebook</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-pink-600">{instagramAccounts.length}</p>
                <p className="text-sm text-gray-500">Instagram</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${expiredAccounts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {accounts.length - expiredAccounts.length}/{accounts.length}
                </p>
                <p className="text-sm text-gray-500">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
