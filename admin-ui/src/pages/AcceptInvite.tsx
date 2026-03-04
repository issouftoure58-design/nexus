import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { invitationsApi } from '@/lib/api';
import { Loader2, AlertCircle, CheckCircle, ArrowLeft, Users } from 'lucide-react';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<{ email: string; role: string; tenant_name: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [nom, setNom] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token d\'invitation manquant');
      setLoading(false);
      return;
    }

    invitationsApi.verify(token)
      .then((data) => {
        if (data.valid) {
          setInviteData(data);
        } else {
          setError('Invitation invalide');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Invitation invalide ou expirée');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setSubmitting(true);
    try {
      await invitationsApi.accept(token, nom, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Users className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Rejoindre l'équipe</CardTitle>
          <CardDescription>
            {inviteData ? `Vous êtes invité à rejoindre ${inviteData.tenant_name}` : 'Vérification de l\'invitation...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
            </div>
          )}

          {error && !success && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700 mb-4">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-green-700 font-medium">Compte créé avec succès !</p>
              <p className="text-sm text-gray-500">Vous pouvez maintenant vous connecter.</p>
              <Button onClick={() => navigate('/login')} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600">
                Se connecter
              </Button>
            </div>
          )}

          {!loading && inviteData && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-cyan-700">
                Invitation pour <strong>{inviteData.email}</strong> en tant que <strong>{inviteData.role}</strong>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Votre nom</label>
                <Input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Jean Dupont"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 12 caractères"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
                disabled={submitting || !nom || !password || !confirmPassword}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer mon compte'}
              </Button>
            </form>
          )}

          {!loading && !inviteData && !success && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={() => navigate('/login')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
