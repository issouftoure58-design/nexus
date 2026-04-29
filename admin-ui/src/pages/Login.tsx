import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi, api } from '@/lib/api';
import { Loader2, AlertCircle, Lock, Mail, Sparkles, ArrowLeft, Shield, XCircle, PauseCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Auto-redirect si déjà connecté (ex: retour de Stripe checkout)
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  // SSO state
  const [ssoProviders, setSsoProviders] = useState<Array<{ id: string; name: string; provider_type: string }>>([]);
  const [ssoTenantId, setSsoTenantId] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);

  // Charger les providers SSO quand l'email contient un @domaine connu
  useEffect(() => {
    const domain = email.split('@')[1];
    if (!domain || domain.length < 3) {
      setSsoProviders([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const data = await api.get<{ providers: Array<{ id: string; name: string; provider_type: string }>; tenant_id: string }>(
          `/sso/discover?domain=${encodeURIComponent(domain)}`,
          { skipAuth: true, skipTenant: true }
        );
        if (data.providers?.length > 0) {
          setSsoProviders(data.providers);
          setSsoTenantId(data.tenant_id);
        } else {
          setSsoProviders([]);
        }
      } catch {
        setSsoProviders([]);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [email]);

  const handleSSOLogin = async (providerId: string) => {
    setSsoLoading(true);
    setError('');
    try {
      const data = await api.post<{ authorization_url: string; state: string; provider_id: string }>(
        '/sso/oidc/initiate',
        { tenant_id: ssoTenantId, provider_id: providerId },
        { skipAuth: true, skipTenant: true }
      );
      // Sauvegarder le state pour le callback
      localStorage.setItem('nexus_sso_state', JSON.stringify({
        tenant_id: ssoTenantId,
        provider_id: data.provider_id,
        state: data.state
      }));
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur SSO');
      setSsoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authApi.login(email, password);

      if (result.requires_2fa && result.temp_token) {
        setRequires2FA(true);
        setTempToken(result.temp_token);
        setIsLoading(false);
        setTimeout(() => codeInputRef.current?.focus(), 100);
        return;
      }

      if (result.token) {
        // Nettoyer l'ancien tenant avant de connecter le nouveau
        api.clearToken();
        api.setToken(result.token);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authApi.validate2FA(tempToken, totpCode);
      api.clearToken();
      api.setToken(result.token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setTempToken('');
    setTotpCode('');
    setError('');
    setUseBackupCode(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Bouton retour */}
      <a
        href="https://nexus-ai-saas.com"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Retour au site</span>
      </a>

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-2xl">N</span>
          </div>
          <CardTitle className="text-2xl font-bold">NEXUS Admin</CardTitle>
          <CardDescription>
            {requires2FA ? 'Vérification en deux étapes' : 'Connectez-vous à votre espace administration'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!requires2FA ? (
            /* Login classique */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className={`p-3 rounded-lg flex flex-col gap-2 text-sm ${
                  error.includes('essai gratuit') || error.includes('résilié')
                    ? 'bg-orange-50 border border-orange-200 text-orange-800'
                    : error.includes('suspendu')
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center gap-2">
                    {error.includes('essai gratuit') || error.includes('résilié') ? (
                      <XCircle className="h-4 w-4 flex-shrink-0" />
                    ) : error.includes('suspendu') ? (
                      <PauseCircle className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    )}
                    {error}
                  </div>
                  {error.includes('essai gratuit') && (
                    <a href="/signup?plan=starter" className="text-cyan-600 hover:text-cyan-700 font-medium text-xs ml-6">
                      Choisir un plan et continuer &rarr;
                    </a>
                  )}
                  {error.includes('suspendu') && (
                    <a href="mailto:contact@nexus-ai-saas.com" className="text-cyan-600 hover:text-cyan-700 font-medium text-xs ml-6">
                      Contacter le support &rarr;
                    </a>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@nexus.com"
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Se connecter'
                )}
              </Button>

              {ssoProviders.length > 0 && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-400">ou</span>
                    </div>
                  </div>
                  {ssoProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={ssoLoading}
                      onClick={() => handleSSOLogin(provider.id)}
                    >
                      {ssoLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                      )}
                      Se connecter avec {provider.name}
                    </Button>
                  ))}
                </>
              )}
            </form>
          ) : (
            /* Étape 2FA */
            <form onSubmit={handle2FASubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="text-center py-2">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-cyan-50 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-cyan-600" />
                </div>
                <p className="text-sm text-gray-600">
                  {useBackupCode
                    ? 'Entrez un code de secours'
                    : 'Entrez le code à 6 chiffres de votre application d\'authentification'}
                </p>
              </div>

              <div>
                <Input
                  ref={codeInputRef}
                  type="text"
                  inputMode={useBackupCode ? 'text' : 'numeric'}
                  value={totpCode}
                  onChange={(e) => setTotpCode(useBackupCode ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={useBackupCode ? 'Code de secours' : '000000'}
                  className="text-center text-2xl tracking-widest font-mono"
                  maxLength={useBackupCode ? 8 : 6}
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                disabled={isLoading || (!useBackupCode && totpCode.length !== 6) || (useBackupCode && totpCode.length === 0)}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Vérifier'
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={() => { setUseBackupCode(!useBackupCode); setTotpCode(''); setError(''); }}
                  className="text-cyan-600 hover:text-cyan-700"
                >
                  {useBackupCode ? 'Utiliser le code TOTP' : 'Utiliser un code de secours'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-4 border-t text-center space-y-3">
            <p className="text-sm text-gray-600">
              Pas encore de compte ?{' '}
              <a href="/signup" className="text-cyan-600 hover:text-cyan-700 font-medium">
                Créer un compte
              </a>
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Sparkles className="h-4 w-4" />
              Propulsé par NEXUS Platform
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
