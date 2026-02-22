import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertCircle, Lock, Mail, User, Building, Phone, Check, ArrowLeft } from 'lucide-react';

const PLANS = {
  starter: { name: 'Starter', price: 199, features: ['1 assistant IA', 'CRM & Agenda', 'Support email'] },
  pro: { name: 'Pro', price: 399, features: ['Tous les assistants IA', 'Marketing & Compta', 'Support prioritaire'] },
  business: { name: 'Business', price: 799, features: ['Multi-sites', 'API & Webhooks', 'Account manager'] }
};

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get('plan') as keyof typeof PLANS || 'starter';

  const [formData, setFormData] = useState({
    entreprise: '',
    nom: '',
    email: '',
    telephone: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          plan: selectedPlan
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la creation du compte');
      }

      navigate('/login?registered=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la creation du compte');
    } finally {
      setIsLoading(false);
    }
  };

  const plan = PLANS[selectedPlan] || PLANS.starter;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Bouton retour */}
      <a
        href="http://localhost:3000"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Retour au site</span>
      </a>

      <div className="w-full max-w-4xl relative z-10 grid md:grid-cols-2 gap-6">
        <Card className="shadow-2xl border-0 bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
          <CardHeader>
            <CardTitle className="text-2xl">Plan {plan.name}</CardTitle>
            <CardDescription className="text-cyan-100">
              14 jours d'essai gratuit, sans engagement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold">{plan.price}€</span>
              <span className="text-cyan-100">/mois</span>
            </div>

            <div className="space-y-3">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/20">
              <p className="text-sm text-cyan-100">
                Vous ne serez pas facture pendant les 14 premiers jours. Annulez a tout moment.
              </p>
            </div>

            <div className="flex gap-2">
              {Object.keys(PLANS).map(p => (
                <button
                  key={p}
                  onClick={() => navigate(`/signup?plan=${p}`)}
                  className={`px-3 py-1 rounded-full text-sm transition ${
                    p === selectedPlan ? 'bg-white text-cyan-600' : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  {PLANS[p as keyof typeof PLANS].name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl">N</span>
            </div>
            <CardTitle className="text-xl font-bold">Creer votre compte</CardTitle>
            <CardDescription>Commencez votre essai gratuit</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input name="entreprise" value={formData.entreprise} onChange={handleChange} placeholder="Ma Societe" className="pl-10" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Votre nom</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input name="nom" value={formData.nom} onChange={handleChange} placeholder="Jean Dupont" className="pl-10" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@exemple.com" className="pl-10" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} placeholder="06 12 34 56 78" className="pl-10" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="8 caracteres minimum" className="pl-10" required minLength={8} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirmez votre mot de passe" className="pl-10" required />
                </div>
              </div>

              <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Commencer l'essai gratuit"}
              </Button>

              <p className="text-xs text-center text-gray-500">
                En creant un compte, vous acceptez nos <a href="#" className="text-cyan-600 hover:underline">CGU</a> et notre <a href="#" className="text-cyan-600 hover:underline">politique de confidentialite</a>
              </p>
            </form>

            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-sm text-gray-600">
                Deja un compte ? <a href="/login" className="text-cyan-600 hover:text-cyan-700 font-medium">Se connecter</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
