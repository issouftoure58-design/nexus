import { useState, useRef } from 'react';
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
                    <a href="mailto:support@nexus-ai-saas.com" className="text-cyan-600 hover:text-cyan-700 font-medium text-xs ml-6">
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
